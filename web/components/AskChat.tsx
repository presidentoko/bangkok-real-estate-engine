"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Top yield condos in Sukhumvit under ฿8M",
  "Should I buy in Sathorn or Asok for rental income?",
  "Which Phuket condos beat MRR by 2 percentage points?",
  "Show me underpriced condos near BTS",
] as const;

// Trigger the email-capture CTA once an assistant message names this
// many or more distinct condo links — that's when the answer has
// shortlist-shaped value worth keeping.
const SHORTLIST_TRIGGER_COUNT = 3;
const CONDO_LINK_RE = /\/condo\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

function distinctCondoIds(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(CONDO_LINK_RE)) seen.add(m[1].toLowerCase());
  return [...seen];
}

export function AskChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;

      const next: Msg[] = [...messages, { role: "user", content: q }];
      setMessages(next);
      setDraft("");
      setBusy(true);
      setStreaming(true);

      // Append a placeholder assistant message we'll append into.
      setMessages([...next, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            history: next.slice(-6).slice(0, -1),  // exclude the just-added user msg
          }),
        });

        if (!res.ok || !res.body) {
          const errText = res.ok ? "Empty response" : await res.text();
          setMessages((m) => {
            const copy = m.slice();
            copy[copy.length - 1] = {
              role: "assistant",
              content: `Error: ${errText}`,
            };
            return copy;
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((m) => {
            const copy = m.slice();
            copy[copy.length - 1] = { role: "assistant", content: acc };
            return copy;
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = {
            role: "assistant",
            content: `Network error: ${msg}`,
          };
          return copy;
        });
      } finally {
        setBusy(false);
        setStreaming(false);
      }
    },
    [messages, busy],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="text-sm text-zinc-400">
            Ask anything about Bangkok and Thailand condos — yields, prices,
            comparisons, flood risk, mortgage spread. The answer is grounded in
            our own measured data (8K+ condos, 90K+ listings, BOT macro).
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void ask(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {messages.map((m, i) => {
          const isAssistant = m.role === "assistant";
          const isLastAssistant = isAssistant && i === messages.length - 1;
          const isStreamingHere = isLastAssistant && streaming;
          // Only show the shortlist CTA on a completed assistant message
          // that names at least N distinct condos. The previous user msg
          // is the question to attach to the lead.
          const condoIds = isAssistant && !isStreamingHere ? distinctCondoIds(m.content) : [];
          const showShortlistCta = condoIds.length >= SHORTLIST_TRIGGER_COUNT;
          const priorUserMsg = isAssistant ? messages[i - 1]?.content ?? "" : "";
          return (
            <div key={i} className="space-y-2">
              <div
                className={`rounded-2xl p-4 ${
                  m.role === "user"
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : "bg-zinc-900 border border-zinc-800"
                }`}
              >
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  {m.role === "user" ? "You" : "RealData"}
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap prose-invert">
                  <SimpleMarkdown
                    content={
                      m.content || (isStreamingHere ? "…" : "")
                    }
                  />
                </div>
              </div>
              {showShortlistCta && (
                <ShortlistCapture
                  key={`cta-${i}`}
                  question={priorUserMsg}
                  answer={m.content}
                  condoCount={condoIds.length}
                />
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 bg-zinc-950 pt-4 -mx-6 px-6 border-t border-zinc-900"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about a condo, district, yield…"
            disabled={busy}
            maxLength={1000}
            enterKeyHint="send"
            autoCapitalize="off"
            autoCorrect="off"
            // Prevent iOS auto-zoom when input font is < 16px
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-base sm:text-sm placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50 min-w-0"
          />
          <button
            type="submit"
            disabled={busy || draft.trim().length === 0}
            className="shrink-0 px-5 py-3 bg-emerald-500 text-zinc-950 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-400 transition"
          >
            {busy ? "…" : "Ask"}
          </button>
        </div>
        <p className="text-zinc-600 text-xs mt-2">
          Answers cite measured data. Not financial advice — verify before buying.
        </p>
      </form>
    </div>
  );
}

/**
 * Inline lead-magnet CTA shown directly under an assistant message that
 * produced a shortlist of >=3 condos. One field (email). On submit we
 * post to /api/leads with the question + answer attached as the message
 * body — broker picking the lead up gets the full context.
 */
function ShortlistCapture({
  question,
  answer,
  condoCount,
}: {
  question: string;
  answer: string;
  condoCount: number;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // De-duplicate identical CTAs that might re-render across messages —
  // once a user submits in this session, hide further shortlist prompts.
  // (Cheap session storage; resets on tab close.)
  const submittedThisSession = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("askShortlistSubmitted") === "1";
  }, []);
  if (submittedThisSession) return null;

  if (state === "ok") {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl px-4 py-3 text-sm text-emerald-300">
        Got it — we&apos;ll email this shortlist and have a vetted broker reach out
        within 24 hours. No spam.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Enter a valid email.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      const message =
        `Shortlist saved from /ask (${condoCount} condos).\n\n` +
        `Question:\n${question.slice(0, 600)}\n\n` +
        `Answer:\n${answer.slice(0, 1800)}`;
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          message,
          source_url:
            typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Submission failed");
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("askShortlistSubmitted", "1");
      }
      setState("ok");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Network error");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-3 sm:p-4 space-y-2"
    >
      <div className="text-sm text-emerald-200/90">
        Email me this shortlist + have a vetted broker follow up. No spam — free.
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={state === "sending"}
          maxLength={200}
          className="flex-1 min-w-0 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={state === "sending" || email.length === 0}
          className="shrink-0 px-4 py-2.5 bg-emerald-500 text-zinc-950 rounded-lg text-sm font-semibold hover:bg-emerald-400 transition disabled:opacity-50"
        >
          {state === "sending" ? "Sending…" : "Send to my email"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <p className="text-[11px] text-emerald-300/60 leading-snug">
        By submitting, you agree we may share your contact with one vetted
        broker who knows these buildings. Broker pays a flat referral if they
        close — you pay nothing extra.
      </p>
    </form>
  );
}

// Very tiny markdown renderer — links + bullet lists. Avoids pulling a big
// dependency for what's basically inline output.
function SimpleMarkdown({ content }: { content: string }) {
  if (!content) return null;
  const html = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href="$2" class="text-emerald-400 hover:underline">$1</a>',
    )
    .replace(/`([^`]+)`/g, '<code class="text-emerald-300">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-zinc-100">$1</strong>')
    .replace(/^- /gm, "• ");
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
