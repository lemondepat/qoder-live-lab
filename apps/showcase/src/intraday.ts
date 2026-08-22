import { composeSeries, paddedBounds, type CandleBounds } from "./kline";

export type IntradayPoint = { index: number; value: number; changePercent: number };
export type IntradayStats = { open: number; last: number; high: number; low: number; changePercent: number; range: number };
export type PlotPoint = { x: number; y: number };

/**
 * Turns observed ticks into a single-session intraday track. The derived
 * previous close seeds the first point so a one-day line exists from the very
 * first paint, and every point carries its move relative to that base.
 */
export function buildIntradaySeries(previousClose: number | null, samples: number[]): IntradayPoint[] {
  const values = composeSeries(previousClose, samples);
  const base = previousClose !== null && Number.isFinite(previousClose) ? previousClose : values[0] ?? null;
  return values.map((value, index) => ({
    index,
    value,
    changePercent: base !== null && base !== 0 ? ((value - base) / base) * 100 : 0,
  }));
}

export function intradayStats(series: IntradayPoint[]): IntradayStats | null {
  if (series.length === 0) return null;
  const values = series.map((point) => point.value);
  const high = Math.max(...values);
  const low = Math.min(...values);
  const last = series[series.length - 1];
  return { open: values[0], last: last.value, high, low, changePercent: last.changePercent, range: high - low };
}

export function seriesBounds(values: number[]): CandleBounds {
  if (values.length === 0) return { low: 0, high: 0, span: 1 };
  const low = Math.min(...values);
  const high = Math.max(...values);
  return { low, high, span: high - low || 1 };
}

/** Drawing domain for the intraday line, widened so the baseline stays visible. */
export function intradayDomain(values: number[], extras: (number | null)[] = []): CandleBounds {
  return paddedBounds(seriesBounds(values), extras, 0.14);
}

/** Projects values across the full plot width; a lone tick sits mid-frame. */
export function scalePoints(values: number[], bounds: CandleBounds, width: number, height: number, padY = 0): PlotPoint[] {
  const usable = Math.max(1, height - padY * 2);
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: padY + usable - ((value - bounds.low) / bounds.span) * usable,
  }));
}

export function polylinePoints(points: PlotPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

/** Closed path under the intraday line so the session can be shaded. */
export function areaPath(points: PlotPoint[], baseY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  const line = points.map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  return `M${first.x.toFixed(2)} ${baseY.toFixed(2)} ${line} L${last.x.toFixed(2)} ${baseY.toFixed(2)} Z`;
}

/** Self-scaled mini track used by the index comparison rail. */
export function sparkPoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  return polylinePoints(scalePoints(values, seriesBounds(values), width, height, 2));
}
