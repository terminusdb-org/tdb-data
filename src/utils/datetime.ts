// Hair space — the smallest word separator, used between the fractional
// digit groups so the timestamp stays one visual unit.
const HAIR_SPACE = "\u200A";

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

/**
 * Format an epoch-seconds timestamp as an ISO-style local datetime at
 * nanosecond resolution: `YYYY-MM-DD HH:MM:SS.SSS SSS SSS`. The fractional
 * part is split into millisecond, microsecond and nanosecond groups of
 * three digits each, separated by hair spaces. Pair with `tabular-nums`
 * so digits align in stacked renderings.
 */
export function formatTimestampNanos(ts: string | number): string {
  const num = Number(ts);
  if (Number.isNaN(num) || num <= 0) return String(ts);
  const nanos = Math.round((num % 1) * 1e9);
  const carry = nanos >= 1e9 ? 1 : 0;
  const d = new Date((Math.floor(num) + carry) * 1000);
  const frac = carry ? "000000000" : String(nanos).padStart(9, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}` +
    ` ${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}` +
    `.${frac.slice(0, 3)}${HAIR_SPACE}${frac.slice(3, 6)}${HAIR_SPACE}${frac.slice(6, 9)}`
  );
}
