"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getQueue, clearQueue } from "@/lib/compare-queue";

export function CompareTray() {
  const [queue, setQueue] = useState<string[]>([]);
  const router = useRouter();
  const params = useParams();
  const lang = (params?.lang as string) ?? "en";

  useEffect(() => {
    const update = () => setQueue(getQueue());
    update();
    window.addEventListener("realdata-compare-change", update);
    return () => window.removeEventListener("realdata-compare-change", update);
  }, []);

  if (queue.length === 0) return null;

  const compareHref = `/${lang}/compare?${queue.map((id, i) => `${"abc"[i]}=${id}`).join("&")}`;

  const onClear = () => {
    clearQueue();
    setQueue([]);
    window.dispatchEvent(new Event("realdata-compare-change"));
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3 sm:px-6">
      <div className="text-sm text-zinc-300">
        <span className="font-semibold text-white">{queue.length}</span>
        {" / 3 condos selected for comparison"}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onClear}
          className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => router.push(compareHref)}
          disabled={queue.length < 2}
          title={queue.length < 2 ? "Select at least 2 condos to compare" : ""}
          className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition"
        >
          Compare {queue.length < 2 ? "(need 2+)" : "→"}
        </button>
      </div>
    </div>
  );
}
