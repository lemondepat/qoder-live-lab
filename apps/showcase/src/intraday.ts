export type IntradayPoint = { value: number; at: number };
export type IntradayBounds = { low: number; high: number; span: number };
export type IntradayStats = {
  open: number;
  last: number;
  high: number;
  low: number;
  amplitude: number;
  changePercent: number;
};

/** Appends one observed intraday tick, keeping the single-session tail bounded. */
export function appendPoint(history: IntradayPoint[], point: IntradayPoint, limit: number): IntradayPoint[] {
  const next = [...history, point];
  const size = Math.max(1, Math.floor(limit));
  return next.length > size ? next.slice(next.length - size) : next;
}

/** Session bounds over the observed line plus any reference levels (previous close). */
export function intradayBounds(points: IntradayPoint[], extras: (number | null)[] = [], ratio = 0.06): IntradayBounds {
  const levels = [
    ...points.map((point) => point.value),
    ...extras.filter((value): value is number => value !== null && Number.isFinite(value)),
  ];
  if (levels.length === 0) return { low: 0, high: 1, span: 1 };
  const low = Math.min(...levels);
  const high = Math.max(...levels);
  const pad = (high - low || Math.abs(high) * 0.001 || 1) * Math.max(0, ratio);
  const paddedLow = low - pad;
  const paddedHigh = high + pad;
  return { low: paddedLow, high: paddedHigh, span: paddedHigh - paddedLow || 1 };
}

/** Day open/last/high/low and the intraday move measured against the reference close. */
export function intradayStats(points: IntradayPoint[], reference: number | null): IntradayStats | null {
  if (points.length === 0) return null;
  const values = points.map((point) => point.value);
  const open = values[0];
  const last = values[values.length - 1];
  const high = Math.max(...values);
  const low = Math.min(...values);
  const base = reference !== null && Number.isFinite(reference) && reference !== 0 ? reference : open;
  return {
    open,
    last,
    high,
    low,
    amplitude: high - low,
    changePercent: base === 0 ? 0 : ((last - base) / base) * 100,
  };
}

/** Maps the observed session onto plot coordinates spread across the full width. */
export function projectPoints(points: IntradayPoint[], bounds: IntradayBounds, width: number, height: number, padX = 0, padY = 0): { x: number; y: number }[] {
  const plotWidth = Math.max(1, width - padX * 2);
  const plotHeight = Math.max(1, height - padY * 2);
  const last = points.length - 1;
  return points.map((point, index) => ({
    x: padX + (last <= 0 ? plotWidth : (index / last) * plotWidth),
    y: height - padY - ((point.value - bounds.low) / bounds.span) * plotHeight,
  }));
}

/** Polyline points attribute for the intraday trace. */
export function toLinePath(coords: { x: number; y: number }[]): string {
  return coords.map((coord) => `${coord.x.toFixed(2)},${coord.y.toFixed(2)}`).join(" ");
}

/** Closed polygon that fills between the trace and a baseline row. */
export function toAreaPath(coords: { x: number; y: number }[], baselineY: number): string {
  if (coords.length === 0) return "";
  const first = coords[0];
  const final = coords[coords.length - 1];
  return `${first.x.toFixed(2)},${baselineY.toFixed(2)} ${toLinePath(coords)} ${final.x.toFixed(2)},${baselineY.toFixed(2)}`;
}

/** Evenly spaced price levels from high to low for the vertical scale. */
export function priceLevels(bounds: IntradayBounds, count = 5): number[] {
  const steps = Math.max(2, Math.floor(count));
  return Array.from({ length: steps }, (_, position) => bounds.high - (bounds.span * position) / (steps - 1));
}

/** Picks evenly spread observed ticks so the time axis stays readable. */
export function timeAxis(points: IntradayPoint[], count = 5): { at: number; ratio: number }[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ at: points[0].at, ratio: 1 }];
  const steps = Math.min(Math.max(2, Math.floor(count)), points.length);
  const last = points.length - 1;
  const seen = new Set<number>();
  const marks: { at: number; ratio: number }[] = [];
  for (let step = 0; step < steps; step += 1) {
    const index = Math.round((last * step) / (steps - 1));
    if (seen.has(index)) continue;
    seen.add(index);
    marks.push({ at: points[index].at, ratio: index / last });
  }
  return marks;
}
