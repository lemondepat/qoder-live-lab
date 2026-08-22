export type Candle = {
  index: number;
  open: number;
  high: number;
  low: number;
  close: number;
  samples: number;
};

export type CandleBounds = { low: number; high: number; span: number };

/** Reads a formatted index value such as "25,412.80" back into a number. */
export function parseIndexValue(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Appends one observed sample, keeping the tail bounded. */
export function appendSample(history: number[], value: number, limit: number): number[] {
  const next = [...history, value];
  const size = Math.max(1, Math.floor(limit));
  return next.length > size ? next.slice(next.length - size) : next;
}

/** Groups consecutive observed samples into OHLC candles. */
export function buildCandles(values: number[], samplesPerCandle: number): Candle[] {
  const size = Math.max(1, Math.floor(samplesPerCandle));
  const candles: Candle[] = [];
  for (let start = 0; start < values.length; start += size) {
    const slice = values.slice(start, start + size);
    if (slice.length === 0) continue;
    candles.push({
      index: candles.length,
      open: slice[0],
      close: slice[slice.length - 1],
      high: Math.max(...slice),
      low: Math.min(...slice),
      samples: slice.length,
    });
  }
  return candles;
}

export function candleBounds(candles: Candle[]): CandleBounds {
  if (candles.length === 0) return { low: 0, high: 0, span: 1 };
  const low = Math.min(...candles.map((candle) => candle.low));
  const high = Math.max(...candles.map((candle) => candle.high));
  return { low, high, span: high - low || 1 };
}

/** Simple moving average over candle closes; null until the span is filled. */
export function movingAverage(candles: Candle[], span: number): (number | null)[] {
  const size = Math.max(1, Math.floor(span));
  return candles.map((_, position) => {
    if (position + 1 < size) return null;
    const window = candles.slice(position + 1 - size, position + 1);
    return window.reduce((carry, candle) => carry + candle.close, 0) / size;
  });
}
