import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { formatContext, retrieveContext } from "@/lib/queries/rag";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5";  // fast + cheap; switch to claude-sonnet-4-6 for higher quality
const MAX_TOKENS = 1500;

const SYSTEM_PROMPT_PREFIX = `You are RealData's property research assistant for Thailand.
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

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured on the server" },
      { status: 503 },
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
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

  const supabase = getServerSupabase();
  const ctx = await retrieveContext(supabase, question);
  const system = SYSTEM_PROMPT_PREFIX + formatContext(ctx);

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
