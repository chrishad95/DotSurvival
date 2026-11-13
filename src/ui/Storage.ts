/** Reads and writes the best score, tolerating unavailable or corrupt storage (e.g. private browsing). */
export class BestScore {
  constructor(private readonly key: string) {}

  load(): number {
    try {
      const raw = window.localStorage.getItem(this.key);
      const n = raw === null ? 0 : Number(raw);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  }

  save(value: number): void {
    try {
      window.localStorage.setItem(this.key, String(Math.floor(value)));
    } catch {
      /* storage unavailable: the score just won't persist */
    }
  }
}

export function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
