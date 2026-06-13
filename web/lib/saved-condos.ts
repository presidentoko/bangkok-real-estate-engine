const KEY = "realdata_saved";
const MAX = 50;

export function getSaved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function isSaved(id: string): boolean {
  return getSaved().includes(id);
}

export function getSavedCount(): number {
  return getSaved().length;
}

// Returns the updated list after toggling.
export function toggleSaved(id: string): string[] {
  const current = getSaved();
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : current.length < MAX
      ? [...current, id]
      : current; // silently refuse at cap
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearSaved(): void {
  localStorage.removeItem(KEY);
}
