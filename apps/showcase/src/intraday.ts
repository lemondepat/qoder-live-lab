/**
 * Pure helpers for the one-day intraday live chart. Every value handed in here
 * comes from the trusted market feed; nothing is generated or simulated.
 */

// Shared numeric scale helpers, reused for the intraday price axis.
export { axisLevels, derivePreviousClose, paddedBounds, parseIndexValue, type CandleBounds as PriceBounds } from "./kline";

export type IntradayPoint = { minute: number; value: number };
export type IntradayStats = { open: number; last: number; high: number; low: number; average: number };
export type TimeTick = { minute: number; label: string };

/** Hong Kong cash session, minutes since midnight HKT. */
export const SESSION_OPEN = 9 * 60 + 30;
export const SESSION_CLOSE = 16 * 60;
export const LUNCH_START = 12 * 60;
export const LUNCH_END = 13 * 60;
export const SESSION_SPAN = SESSION_CLOSE - SESSION_OPEN;

/** Minutes since midnight in Hong Kong for the given instant. */
export function hongKongMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Hong_Kong" }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/** Position of a session minute on the 0..1 intraday axis. */
export function sessionOffset(minute: number): number {
  const ratio = (minute - SESSION_OPEN) / SESSION_SPAN;
  return Math.min(1, Math.max(0, ratio));
}

/** Clock label such as "13:42" for a minute-of-day value. */
export function minuteLabel(minute: number): string {
  const wrapped = ((Math.round(minute) % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  const rest = wrapped % 60;
  return `${String(hour).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/**
 * Appends one observed tick. Repeated ticks inside the same minute update that
 * minute in place so the intraday line stays one point per minute.
 */
export function appendPoint(points: IntradayPoint[], point: IntradayPoint, limit: number): IntradayPoint[] {
  const size = Math.max(1, Math.floor(limit));
  const last = points[points.length - 1];
  const next = last && last.minute === point.minute ? [...points.slice(0, -1), point] : [...points, point];
  return next.length > size ? next.slice(next.length - size) : next;
}

/** Session open, latest, extremes and mean across the observed intraday points. */
export function seriesStats(points: IntradayPoint[]): IntradayStats | null {
  if (points.length === 0) return null;
  const values = points.map((point) => point.value);
  return {
    open: values[0],
    last: values[values.length - 1],
    high: Math.max(...values),
    low: Math.min(...values),
    average: values.reduce((carry, value) => carry + value, 0) / values.length,
  };
}

/** Percent move between two levels; null when the reference is unusable. */
export function percentFrom(reference: number | null, value: number | null): number | null {
  if (reference === null || value === null || !Number.isFinite(reference) || !Number.isFinite(value) || reference === 0) return null;
  return ((value - reference) / reference) * 100;
}

/** Evenly spaced intraday time ticks across the session, inclusive of both ends. */
export function timeTicks(count = 6): TimeTick[] {
  const steps = Math.max(2, Math.floor(count));
  return Array.from({ length: steps }, (_, position) => {
    const minute = SESSION_OPEN + (SESSION_SPAN * position) / (steps - 1);
    return { minute, label: minuteLabel(minute) };
  });
}
