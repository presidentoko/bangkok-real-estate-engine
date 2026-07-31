import { SubscribeForm } from "@/components/SubscribeForm";

export default function SubscribePage() {
  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Get the Alerts</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Real-time push the moment a Bangkok condo lists ≥20% below its district
        average. Free, private (we only store your Telegram chat ID), no spam —
        only verified underpriced listings.
      </p>

      <ol className="text-sm text-zinc-300 space-y-3 mb-8 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <li>
          <span className="font-semibold text-pink-400">1.</span> Open Telegram
          and start a chat with{" "}
          <a
            href="https://t.me/Bkkbudong_bot"
            target="_blank"
            rel="noreferrer noopener"
            className="text-emerald-400 hover:underline"
          >
            @Bkkbudong_bot
          </a>{" "}
          → tap <span className="font-mono bg-zinc-800 px-1.5 py-0.5 rounded">/start</span>.
        </li>
        <li>
          <span className="font-semibold text-pink-400">2.</span> Find your
          chat ID by messaging{" "}
          <a
            href="https://t.me/userinfobot"
            target="_blank"
            rel="noreferrer noopener"
            className="text-emerald-400 hover:underline"
          >
            @userinfobot
          </a>{" "}
          → it replies with your numeric ID.
        </li>
        <li>
          <span className="font-semibold text-pink-400">3.</span> Paste it
          below and submit — we send a confirmation message immediately, so
          if you don&apos;t see one land in Telegram, the ID was wrong or
          step 1 wasn&apos;t done yet.
        </li>
      </ol>

      <SubscribeForm />
    </main>
  );
}
