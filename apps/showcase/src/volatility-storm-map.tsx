import type { CSSProperties } from "react";
import type { MarketQuote } from "./market-data";
import { VolatilityStormFeature } from "./feature-library/volatility-storm";
import { signedPercent } from "./feature-library/shared";
import { computeVolatilityField } from "./volatility";
import "./volatility-storm-map.css";

export function VolatilityWeatherMap({ quotes, sessionLabel, clock, status }: { quotes: MarketQuote[]; sessionLabel: string; clock: string; status: string }) {
  const field = computeVolatilityField(quotes);

  if (field.cells.length === 0) {
    return <section className="storm-map storm-empty">
      <p>Waiting for the trusted watchlist snapshot — the volatility weather map draws itself as soon as real dispersion arrives.</p>
    </section>;
  }

  const style = {
    "--storm-intensity": `${field.intensity}%`,
    "--storm-force": field.beaufort,
    "--storm-spin": `${Math.max(7, 34 - field.dispersion * 6).toFixed(1)}s`,
    "--storm-tilt": `${(field.deviation * 4).toFixed(2)}deg`,
  } as CSSProperties;

  return <section className={`storm-map force-${field.beaufort} ${field.breadth >= 50 ? "warm-front" : "cold-front"}`} style={style} aria-label={`Volatility weather map at ${field.dispersion.toFixed(2)} percent mean absolute move`}>
    <div className="storm-sky" aria-hidden="true"><i /><i /><i /></div>

    <header className="storm-bulletin">
      <div className="storm-forecast">
        <span>LIVE VOLATILITY WEATHER · {sessionLabel}</span>
        <h2>Force {field.beaufort} · <em>{field.label}</em></h2>
        <p>Wind speed, colour temperature and orbit rate come only from the trusted watchlist&apos;s real percentage moves. Rising dispersion roughens the atmosphere over Hong Kong.</p>
      </div>
      <dl className="storm-readings">
        <div><dt>MEAN ABS MOVE</dt><dd>{field.dispersion.toFixed(2)}%</dd></div>
        <div><dt>GUST</dt><dd>{field.gust.toFixed(2)}%</dd></div>
        <div><dt>SPREAD</dt><dd>{field.spread.toFixed(2)}%</dd></div>
        <div><dt>DEVIATION</dt><dd>{field.deviation.toFixed(2)}%</dd></div>
        <div><dt>FRONT</dt><dd className={field.breadth >= 50 ? "up" : "down"}>{field.breadth >= 50 ? "WARM" : "COLD"} · {field.breadth}% ADV</dd></div>
        <div><dt>SNAPSHOT</dt><dd>{clock} HKT · {status.toUpperCase()}</dd></div>
      </dl>
      <div className="storm-barometer" role="img" aria-label={`Beaufort force ${field.beaufort} of 9 derived from live dispersion`}>
        {Array.from({ length: 10 }, (_, step) => <i key={step} className={step <= field.beaufort ? "lit" : ""} />)}
        <span>BEAUFORT 0 → 9</span>
      </div>
    </header>

    <div className="storm-eye">
      <VolatilityStormFeature quotes={quotes} />
    </div>

    <div className="storm-front" aria-label="Volatility cells ranked by absolute move">
      {field.cells.map((cell, index) => <article
        key={cell.symbol}
        className={cell.change >= 0 ? "positive" : "negative"}
        style={{ "--energy": cell.energy.toFixed(3), "--cell-index": index } as CSSProperties}
      >
        <header><b>{cell.symbol}</b><small>{cell.name}</small></header>
        <strong>{cell.price.toFixed(2)}</strong>
        <span>{signedPercent(cell.change)}</span>
        <div className="storm-gauge" role="img" aria-label={`${cell.name} intraday swing ${cell.amplitude.toFixed(2)} percent`}><i /></div>
        <small>SWING {cell.amplitude.toFixed(2)}% · {cell.sector}</small>
      </article>)}
    </div>

    <footer className="storm-legend">
      <span>STRONGEST CELL · {field.strongest ? `${field.strongest.symbol} ${signedPercent(field.strongest.change)}` : "—"}</span>
      <span>CALMEST CELL · {field.calmest ? `${field.calmest.symbol} ${signedPercent(field.calmest.change)}` : "—"}</span>
      <span>{field.advancers} ADVANCING · {field.decliners} DECLINING · {field.unchanged} FLAT</span>
      <span>DERIVED FROM TRUSTED WATCHLIST DISPERSION · DISPLAY ONLY</span>
    </footer>
  </section>;
}
