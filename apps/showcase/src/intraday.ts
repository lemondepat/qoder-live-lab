export type IntradaySample = { t: number; v: number };
export type IntradayBounds = { low: number; high: number; span: number };

/** Hong Kong cash session boundaries (minutes since local midnight). */
export const SESSION_TIMES = {
  start: 9 * 60 + 30,   // 09:30
  end: 16 * 60,         // 16:00
  lunchStart: 12 * 60,  // 12:00
  lunchEnd: 13 * 60,    // 13:00
} as const;

export const SESSION_LENGTH_MIN = SESSION_TIMES.end - SESSION_TIMES.start;

const HKT_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Hong_Kong",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Returns the minute of the day in the Asia/Hong_Kong wall clock. */
export function minuteOfDayHKT(date: Date): number {
  const parts = HKT_FORMATTER.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/**
 * Fraction (0..1) of the way through the HKEX cash session for the given
 * minute-of-day, clamped so pre- and post-market timestamps stay inside the plot.
 */
export function sessionProgress(minuteOfDay: number): number {
  const clamped = Math.max(SESSION_TIMES.start, Math.min(SESSION_TIMES.end, minuteOfDay));
  return (clamped - SESSION_TIMES.start) / SESSION_LENGTH_MIN;
}

/**
 * Appends one observed intraday tick, keeping the tail bounded and dropping
 * exact duplicates that would only add zero-length segments to the line.
 */
export function appendIntradaySample(history: IntradaySample[], sample: IntradaySample, limit: number): IntradaySample[] {
  const last = history[history.length - 1];
  if (last && last.v === sample.v && sample.t - last.t < 250) return history;
  const size = Math.max(1, Math.floor(limit));
  const next = [...history, sample];
  return next.length > size ? next.slice(next.length - size) : next;
}

/**
 * Widens the drawing domain around the observed intraday values and any
 * reference levels (previous close, last tick) so nothing is clipped.
 */
export function intradayBounds(values: number[], extras: (number | null)[] = [], ratio = 0.06): IntradayBounds {
  const levels = [
    ...values.filter((value) => Number.isFinite(value)),
    ...extras.filter((value): value is number => value !== null && Number.isFinite(value)),
  ];
  if (levels.length === 0) return { low: 0, high: 0, span: 1 };
  const low = Math.min(...levels);
  const high = Math.max(...levels);
  const pad = (high - low || Math.abs(high) * 0.001 || 1) * Math.max(0, ratio);
  const paddedLow = low - pad;
  const paddedHigh = high + pad;
  return { low: paddedLow, high: paddedHigh, span: paddedHigh - paddedLow || 1 };
}

/** Evenly spaced axis levels from high to low. */
export function intradayLadder(bounds: IntradayBounds, count = 5): number[] {
  const steps = Math.max(2, Math.floor(count));
  return Array.from({ length: steps }, (_, position) => bounds.high - (bounds.span * position) / (steps - 1));
}
