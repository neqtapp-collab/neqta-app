export function isClient() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readStoredList<T>(key: string, seed: readonly T[]): T[] {
  if (!isClient()) return structuredClone(seed) as T[];
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as T[];
    }
  } catch {}
  const initial = structuredClone(seed) as T[];
  writeStoredList(key, initial);
  return initial;
}

export function writeStoredList<T>(key: string, value: readonly T[]) {
  if (!isClient()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(`${key}-updated`, { detail: value }));
}
