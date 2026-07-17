const KEY = "realdata_compare";
const MAX = 3;

export function getQueue(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // Valid JSON that isn't an array (e.g. hand-edited/corrupted storage)
    // used to reach callers as-is and crash the first `.map()`/`.filter()`.
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isQueued(id: string): boolean {
  return getQueue().includes(id);
}

export function getQueueCount(): number {
  return getQueue().length;
}

// Returns { next: string[], added: boolean }
// added=false when already at max and the id is not already in queue.
export function toggleQueue(id: string): { next: string[]; added: boolean } {
  const current = getQueue();
  if (current.includes(id)) {
    const next = current.filter((x) => x !== id);
    localStorage.setItem(KEY, JSON.stringify(next));
    return { next, added: false };
  }
  if (current.length >= MAX) {
    return { next: current, added: false }; // at cap
  }
  const next = [...current, id];
  localStorage.setItem(KEY, JSON.stringify(next));
  return { next, added: true };
}

export function clearQueue(): void {
  localStorage.removeItem(KEY);
}
