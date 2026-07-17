import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { formatContext, retrieveContext } from "@/lib/queries/rag";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// In-memory token-bucket per IP hash. Resets on serverless cold-start.
// At Vercel scale a single IP can briefly slip past this when hitting
// multiple regions / instances, but it cuts off the obvious abuse case
// (a single client spamming hundreds of requests in seconds) cheaply.
const RATE_LIMIT_MAX = 12;            // requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;  // 1 hour
const ipBuckets = new Map<string, number[]>();

function ipHash(req: Request): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  return createHash("sha1").update(ip).digest("hex");
}

function isRateLimited(hash: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (ipBuckets.get(hash) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_MAX) {
    ipBuckets.set(hash, recent);
    return true;
  }
  recent.push(now);
  ipBuckets.set(hash, recent);
  // light GC — drop oldest entries when map grows
  if (ipBuckets.size > 5000) {
    const oldest = Array.from(ipBuckets.entries())
      .map(([k, v]) => [k, Math.max(...v)] as [string, number])
      .sort((a, b) => a[1] - b[1])
      .slice(0, 1000);
    for (const [k] of oldest) ipBuckets.delete(k);
  }
  return false;
}

const MODEL = "claude-haiku-4-5-20251001";  // fast + cheap; switch to claude-sonnet-4-6 for higher quality
const MAX_TOKENS = 1500;

// Built per-request (not a module-level template literal) so the "as of"
// date doesn't freeze at cold-start — a warm serverless instance could
// otherwise serve a date days stale to every request it handles.
function buildSystemPromptPrefix(): string {
  return `You are RealData's property research assistant for Thailand.
Your only knowledge of the Thai condo market is the DATABASE SNAPSHOT below — never
invent buildings, yields, or prices. If a user asks about a condo not in the
snapshot, say so explicitly and suggest broadening the search.

Always:
- Quote numbers from the snapshot verbatim (yield %, sale ฿M, MRR %, bubble index, flood level).
- Compare yields against MRR when both are present. Positive spread = good cushion.
- Cite condos as Markdown links: [Condo Name](/condo/<id>). The id is in the "url=" field.
- Prefer concise, structured answers. Use short bullet lists for comparisons.
- Be honest about limits: yields require ≥2 sale + ≥2 rent listings, so most condos
  in the DB don't have one yet. Bubble index ≤90 = below district avg.
- If asked for advice, frame as data-driven observations, not financial advice.
- Don't mention you're an AI or LLM. You're "RealData".

LANGUAGE: Match the language of the user's question (English, Thai, or Korean).

DATABASE SNAPSHOT (as of ${new Date().toISOString().slice(0, 10)}):
`;
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured on the server" },
      { status: 503 },
    );
  }

  // Rate limit before doing any retrieval or model work — the whole point
  // is to keep abusers from burning Claude credits or DB egress.
  const hash = ipHash(req);
  if (isRateLimited(hash)) {
    return NextResponse.json(
      {
        error:
          "Rate limit hit — too many questions in the past hour. Try again later.",
      },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  let body: { question?: string; history?: Array<{ role: "user" | "assistant"; content: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const question = (body.question ?? "").trim();
  if (!question || question.length > 1000) {
    return NextResponse.json(
      { error: "question must be 1–1000 characters" },
      { status: 400 },
    );
  }
  // Cap history length AND per-message size — the 6-item slice alone still
  // lets an abuser send 6 huge blobs per request, burning Anthropic token
  // spend within the rate limit. Matches the spirit of the 1000-char cap
  // on the fresh `question` field above.
  const HISTORY_MESSAGE_MAX_CHARS = 2000;
  const history = Array.isArray(body.history)
    ? body.history.slice(-6).map((h) => ({
        role: h.role,
        content: (h.content ?? "").slice(0, HISTORY_MESSAGE_MAX_CHARS),
      }))
    : [];

  const supabase = getServerSupabase();
  const ctx = await retrieveContext(supabase, question);
  const system = buildSystemPromptPrefix() + formatContext(ctx);

  const client = new Anthropic({ apiKey: key });

  // Stream the response back as plain text chunks (SSE-style line-delimited).
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          stream: true,
          messages: [
            ...history.map((h) => ({ role: h.role, content: h.content })),
            { role: "user" as const, content: question },
          ],
        });
        for await (const event of response) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[ERROR] ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
