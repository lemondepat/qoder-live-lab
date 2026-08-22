export type IntradayPoint = { minute: number; value: number };
export type IntradaySpan = { low: number; high: number; span: number };
export type IntradayExtremes = { high: number; low: number; highMinute: number; lowMinute: number };

/** Hong Kong cash session in minutes from midnight HKT. */
export const SESSION = { open: 9 * 60 + 30, lunchStart: 12 * 60, lunchEnd: 13 * 60, close: 16 * 60 };
export const TRADED_MINUTES = SESSION.lunchStart - SESSION.open + (SESSION.close - SESSION.lunchEnd);

/** Minutes since midnight in Hong Kong for the given instant. */
export function hongKongMinute(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Hong_Kong" }).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return (hour % 24) * 60 + minute;
}

/** Clamp a wall-clock minute into the Hong Kong cash session [open, close]. */
export function clampToSession(minute: number): number {
  if (!Number.isFinite(minute)) return SESSION.open;
  return Math.min(SESSION.close, Math.max(SESSION.open, minute));
}

/** Trading day (YYYY-MM-DD) in Hong Kong for the given instant. */
export function hongKongTradingDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Hong_Kong" }).format(at);
}

/**
 * Stable observation key isolating an intraday track by data source, trading
 * day and index. A change to any part starts a fresh track so demo fallback
 * ticks never mix with trusted live data or spill across sessions.
 */
export function observationScope(source: string, tradingDay: string, symbol: string): string {
  return `${source}|${tradingDay}|${symbol}`;
}

/** Trading minutes elapsed at a wall-clock minute, with the lunch break removed. */
export function tradedMinutes(minute: number): number {
  if (minute <= SESSION.open) return 0;
  if (minute >= SESSION.close) return TRADED_MINUTES;
  if (minute <= SESSION.lunchStart) return minute - SESSION.open;
  if (minute <= SESSION.lunchEnd) return SESSION.lunchStart - SESSION.open;
  return SESSION.lunchStart - SESSION.open + (minute - SESSION.lunchEnd);
}

/** 0 → 1 position of a wall-clock minute along the traded timeline. */
export function sessionProgress(minute: number): number {
  return tradedMinutes(minute) / TRADED_MINUTES;
}

/** Formats a session minute as HH:MM. */
export function formatMinute(minute: number): string {
  const normalised = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalised / 60)).padStart(2, "0")}:${String(normalised % 60).padStart(2, "0")}`;
}

/**
 * Appends one observed tick to the intraday track. Ticks landing in the same
 * minute replace the previous value so the line stays one point per minute.
 */
export function appendPoint(points: IntradayPoint[], point: IntradayPoint, limit: number): IntradayPoint[] {
  const size = Math.max(1, Math.floor(limit));
  const last = points[points.length - 1];
  const next = last && last.minute === point.minute ? [...points.slice(0, -1), point] : [...points, point];
  return next.length > size ? next.slice(next.length - size) : next;
}

/**
 * Anchors the drawn line at the previous close at session open so a real,
 * visible line is rendered from the first observed tick instead of a degenerate
 * single-point stub. Observed ticks stay untouched for readouts and extremes.
 */
export function anchorSeries(previousClose: number | null, points: IntradayPoint[]): IntradayPoint[] {
  if (previousClose === null || !Number.isFinite(previousClose)) return [...points];
  if (points.length > 0 && points[0].minute <= SESSION.open) return [...points];
  return [{ minute: SESSION.open, value: previousClose }, ...points];
}

/** Vertical drawing domain, padded so the line and reference levels stay inside. */
export function intradaySpan(points: IntradayPoint[], extras: (number | null)[] = [], ratio = 0.12): IntradaySpan {
  const levels = [...points.map((point) => point.value), ...extras.filter((value): value is number => value !== null && Number.isFinite(value))];
  if (levels.length === 0) return { low: 0, high: 1, span: 1 };
  const low = Math.min(...levels);
  const high = Math.max(...levels);
  const pad = (high - low || Math.abs(high) * 0.002 || 1) * Math.max(0, ratio);
  return { low: low - pad, high: high + pad, span: high - low + pad * 2 || 1 };
}

/** Session high and low with the minute each was observed. */
export function intradayExtremes(points: IntradayPoint[]): IntradayExtremes | null {
  if (points.length === 0) return null;
  return points.reduce<IntradayExtremes>((carry, point) => ({
    high: point.value > carry.high ? point.value : carry.high,
    highMinute: point.value > carry.high ? point.minute : carry.highMinute,
    low: point.value < carry.low ? point.value : carry.low,
    lowMinute: point.value < carry.low ? point.minute : carry.lowMinute,
  }), { high: points[0].value, low: points[0].value, highMinute: points[0].minute, lowMinute: points[0].minute });
}

/** Running mean of observed prices — the intraday average line. */
export function runningAverage(points: IntradayPoint[]): IntradayPoint[] {
  let sum = 0;
  return points.map((point, index) => {
    sum += point.value;
    return { minute: point.minute, value: sum / (index + 1) };
  });
}

/** Signed percent move of every point against a reference close. */
export function percentFrom(reference: number | null, value: number): number | null {
  if (reference === null || !Number.isFinite(reference) || reference === 0) return null;
  return ((value - reference) / reference) * 100;
}

/** Evenly spaced axis levels from high to low. */
export function priceLevels(span: IntradaySpan, count = 5): number[] {
  const steps = Math.max(2, Math.floor(count));
  return Array.from({ length: steps }, (_, position) => span.high - (span.span * position) / (steps - 1));
}

/** Wall-clock gridline minutes across the session. */
export function timeLevels(): number[] {
  return [SESSION.open, 10 * 60 + 30, SESSION.lunchStart, SESSION.lunchEnd, 14 * 60, 15 * 60, SESSION.close];
}

/** Builds an SVG path from mapped points; a single point becomes a flat stub. */
export function linePath(points: IntradayPoint[], x: (minute: number) => number, y: (value: number) => number): string {
  if (points.length === 0) return "";
  const steps = points.map((point) => `${x(point.minute).toFixed(2)},${y(point.value).toFixed(2)}`);
  if (steps.length === 1) return `M${steps[0]}L${steps[0]}`;
  return `M${steps[0]}${steps.slice(1).map((step) => `L${step}`).join("")}`;
}

/** Closes the line down to a baseline so the session move can be filled. */
export function areaPath(points: IntradayPoint[], x: (minute: number) => number, y: (value: number) => number, baseline: number): string {
  const line = linePath(points, x, y);
  if (!line) return "";
  const first = x(points[0].minute).toFixed(2);
  const last = x(points[points.length - 1].minute).toFixed(2);
  return `${line}L${last},${baseline.toFixed(2)}L${first},${baseline.toFixed(2)}Z`;
}
