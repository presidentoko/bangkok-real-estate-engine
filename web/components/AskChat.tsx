"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Top yield condos in Sukhumvit under ฿8M",
  "Should I buy in Sathorn or Asok for rental income?",
  "Which Phuket condos beat MRR by 2 percentage points?",
  "Show me underpriced condos near BTS",
] as const;

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
        {messages.map((m, i) => (
          <div
            key={i}
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
              <SimpleMarkdown content={m.content || (streaming && i === messages.length - 1 ? "…" : "")} />
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-0 bg-zinc-950 pt-4 -mx-6 px-6 border-t border-zinc-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about a condo, district, yield, mortgage…"
            disabled={busy}
            maxLength={1000}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || draft.trim().length === 0}
            className="px-5 py-3 bg-emerald-500 text-zinc-950 rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-400 transition"
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
