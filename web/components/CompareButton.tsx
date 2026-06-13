"use client";

import { useEffect, useState } from "react";
import { toggleQueue, isQueued, getQueueCount } from "@/lib/compare-queue";

type Props = {
  id: string;
  name: string;
};

export function CompareButton({ id, name }: Props) {
  const [queued, setQueued] = useState(false);
  const [atCap, setAtCap] = useState(false);

  useEffect(() => {
    const update = () => {
      setQueued(isQueued(id));
      setAtCap(getQueueCount() >= 3 && !isQueued(id));
    };
    update();
    window.addEventListener("realdata-compare-change", update);
    return () => window.removeEventListener("realdata-compare-change", update);
  }, [id]);

  const onClick = () => {
    const { next } = toggleQueue(id);
    setQueued(next.includes(id));
    setAtCap(next.length >= 3 && !next.includes(id));
    window.dispatchEvent(new Event("realdata-compare-change"));
  };

  const disabled = atCap;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={
        queued
          ? `Remove ${name} from compare`
          : atCap
            ? "Compare is full (max 3). Remove one first."
            : `Add ${name} to compare`
      }
      aria-label={queued ? "Remove from compare" : "Add to compare"}
      className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl font-semibold text-sm transition border disabled:opacity-40 disabled:cursor-not-allowed ${
        queued
          ? "bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30"
          : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
      }`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="6" height="18" rx="1"/>
        <rect x="9" y="3" width="6" height="18" rx="1"/>
        <rect x="16" y="3" width="6" height="18" rx="1"/>
      </svg>
      {queued ? "In compare" : "Compare"}
    </button>
  );
}
