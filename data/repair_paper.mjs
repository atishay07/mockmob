// Which paper a mistake came from and when it was attempted (F17): "Mock 3, Accountancy, 16 Oct, 9:40 PM".
// India time, 12-hour clock, relative where recent. Pure: the clock is handed in, so every line is testable.
const TZ = 'Asia/Kolkata';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; // fixed: some locales write "Sept"
const MINUTE = 60_000;

const partsOf = (ms) => {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  const o = {};
  for (const p of f.formatToParts(new Date(ms))) o[p.type] = p.value;
  return { year: Number(o.year), month: MONTHS[Number(o.month) - 1] || '', day: Number(o.day), hour: o.hour, minute: o.minute, period: String(o.dayPeriod || '').toUpperCase().replace(/\./g, '') };
};
const dayKey = (p) => `${p.year}-${p.month}-${p.day}`;

/** "9:40 PM" in India time. */
export function clockTime(ms) {
  const p = partsOf(ms);
  return `${Number(p.hour)}:${p.minute} ${p.period}`;
}

/**
 * When a paper was attempted: "12 minutes ago" inside the hour, "today, 9:40 PM", "yesterday, 9:40 PM", else
 * "16 Oct, 9:40 PM" (with the year once it is not this year). Empty when the time is missing.
 */
export function attemptedWhen(ms, now = Date.now()) {
  const t = typeof ms === 'string' && !/^\d+$/.test(ms.trim()) ? Date.parse(ms) : Number(ms);
  if (!Number.isFinite(t) || t <= 0) return '';
  const diff = now - t;
  if (diff >= 0 && diff < MINUTE) return 'just now';
  if (diff >= 0 && diff < 60 * MINUTE) { const m = Math.floor(diff / MINUTE); return m === 1 ? '1 minute ago' : `${m} minutes ago`; }
  const p = partsOf(t);
  const n = partsOf(now);
  const time = `${Number(p.hour)}:${p.minute} ${p.period}`;
  if (dayKey(p) === dayKey(n)) return `today, ${time}`;
  if (dayKey(partsOf(now - 24 * 60 * MINUTE)) === dayKey(p)) return `yesterday, ${time}`;
  return `${p.day} ${p.month}${p.year === n.year ? '' : ` ${p.year}`}, ${time}`;
}

/** "Mock 3, Accountancy, 16 Oct, 9:40 PM": the source, the subject and the attempt time; any part that is missing is left out. */
export function paperStamp({ source = '', subject = '', at = null, now = Date.now() } = {}) {
  return [String(source || '').trim(), String(subject || '').trim(), attemptedWhen(at, now)].filter(Boolean).join(', ');
}
