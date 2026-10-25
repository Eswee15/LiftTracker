export const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}
export function fmtDate(s: string, long = false): string {
  const today = isoDate();
  if (!long) {
    if (s === today) return 'Today';
    if (s === addDays(today, -1)) return 'Yesterday';
    if (s === addDays(today, 1)) return 'Tomorrow';
  }
  return parseDate(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(long ? { year: 'numeric' } : {}) });
}
export function fmtWeight(w: number): string {
  return Number.isInteger(w) ? String(w) : String(Math.round(w * 100) / 100);
}
export function fmtDur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
/** Epley estimated one-rep max. */
export const e1rm = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));
export const uid = () => Math.random().toString(36).slice(2, 10);
