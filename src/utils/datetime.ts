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

/**
 * Convert an epoch-seconds decimal string (the stored xsd:decimal form) to
 * an ISO 8601 UTC string, preserving the fraction's digits without a binary
 * floating-point round-trip. Returns null for non-numeric input.
 */
export function epochDecimalToIso(ts: string | number): string | null {
  const str = String(ts);
  const dot = str.indexOf(".");
  const secs = dot < 0 ? str : str.slice(0, dot);
  // Nanoseconds are the smallest stored unit — never emit finer digits.
  const frac = dot < 0 ? "" : str.slice(dot + 1, dot + 10);
  const s = Number(secs);
  if (!Number.isFinite(s) || !/^\d*$/.test(frac)) return null;
  const iso = new Date(s * 1000).toISOString();
  return frac ? iso.replace(/\.\d{3}Z$/, `.${frac}Z`) : iso;
}

/**
 * Convert an ISO 8601 instant to the `YYYY-MM-DDTHH:mm:ss.sss` local-time
 * form a datetime-local input expects. Returns "" for invalid input.
 */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}` +
    `T${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}` +
    `.${pad(d.getMilliseconds(), 3)}`
  );
}
