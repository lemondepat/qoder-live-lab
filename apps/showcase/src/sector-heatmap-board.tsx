import type { CSSProperties } from "react";
import type { MarketQuote } from "./market-data";
import { signedPercent } from "./feature-library/shared";
import { boardTotals, buildSectorBoard, normalizedTrail, type SectorBlock, type SectorCell } from "./sector-leadership";
import "./feature-library/feature-library.css";
import "./sector-heatmap-board.css";

type BoardMode = "turnover" | "equal";

export function SectorHeatmapBoard({ quotes, sessionLabel, clock, status, mode, onMode }: {
  quotes: MarketQuote[];
  sessionLabel: string;
  clock: string;
  status: string;
  mode: BoardMode;
  onMode: (mode: BoardMode) => void;
}) {
  const board = buildSectorBoard(quotes);
  const totals = boardTotals(board);
  const tone = totals.averageChange >= 0 ? "up" : "down";
  const live = status === "live";

  return <section className={`sector-board tone-${tone}`} aria-label="Live sector leadership heatmap">
    <header className="sector-board-head">
      <div>
        <span>SECTOR LEADERSHIP · {sessionLabel} · {clock} HKT</span>
        <h1>Where the<br />money is working</h1>
      </div>
      <dl className="sector-board-readout">
        <div><dt>SECTORS</dt><dd>{totals.sectors}</dd></div>
        <div><dt>NAMES</dt><dd>{totals.names}</dd></div>
        <div><dt>ADV / DEC</dt><dd><i className="up">{totals.advancers}</i> / <i className="down">{totals.decliners}</i></dd></div>
        <div><dt>AVG MOVE</dt><dd className={tone}>{signedPercent(totals.averageChange)}</dd></div>
        <div><dt>DISPERSION</dt><dd>{totals.dispersion.toFixed(2)}pt</dd></div>
      </dl>
      <div className="sector-board-modes" role="group" aria-label="Tile size basis">
        <button type="button" className={mode === "turnover" ? "is-active" : ""} aria-pressed={mode === "turnover"} onClick={() => onMode("turnover")}>SIZE · TURNOVER</button>
        <button type="button" className={mode === "equal" ? "is-active" : ""} aria-pressed={mode === "equal"} onClick={() => onMode("equal")}>SIZE · EQUAL</button>
      </div>
    </header>

    {board.length === 0
      ? <div className="sector-board-empty">Waiting for the trusted market snapshot — sector tiles appear as soon as the first quotes arrive.</div>
      : <div className={`sector-board-grid mode-${mode}`}>
          {board.map((block) => <SectorBlockTile key={block.sector} block={block} mode={mode} live={live} />)}
        </div>}

    <footer className="sector-board-foot">
      <ul className="sector-scale" aria-label="Heatmap color scale">
        <li className="loss-strong"><i />≤ -2%</li>
        <li className="loss"><i />DOWN</li>
        <li className="flat"><i />FLAT</li>
        <li className="gain"><i />UP</li>
        <li className="gain-strong"><i />≥ +2%</li>
      </ul>
      <span>TILE SIZE {mode === "turnover" ? "= TRUSTED SESSION TURNOVER" : "= EQUAL WEIGHT"} · COLOR = LIVE PERCENT CHANGE · GLOW = MOVE INTENSITY</span>
      <span>{totals.strongest ? `LEADING ${totals.strongest.sector.toUpperCase()} ${signedPercent(totals.strongest.averageChange)}` : "—"} · {totals.weakest ? `LAGGING ${totals.weakest.sector.toUpperCase()} ${signedPercent(totals.weakest.averageChange)}` : "—"}</span>
    </footer>
  </section>;
}

function SectorBlockTile({ block, mode, live }: { block: SectorBlock; mode: BoardMode; live: boolean }) {
  const tone = block.averageChange >= 0 ? "positive" : "negative";
  const style = {
    "--tile-span": mode === "turnover" ? block.span : 4,
    "--tile-rows": mode === "turnover" ? block.rows : 1,
    "--tile-heat": block.intensity.toFixed(3),
  } as CSSProperties;

  return <article className={`sector-tile ${tone} ${block.intensity > 0.7 ? "is-hot" : ""}`} style={style}>
    <div className="sector-tile-head">
      <div><b>{block.sector}</b><small>{block.cells.length} NAME{block.cells.length === 1 ? "" : "S"} · {block.advancers}▲ {block.decliners}▼</small></div>
      <strong>{signedPercent(block.averageChange)}</strong>
    </div>
    <div className="sector-tile-share" role="img" aria-label={`${(block.share * 100).toFixed(1)} percent of board weight`}>
      <i style={{ width: `${Math.max(4, Math.round(block.share * 100))}%` }} />
      <span>{(block.share * 100).toFixed(1)}% WEIGHT{block.turnoverBacked ? "" : " · MOVE-WEIGHTED"}</span>
    </div>
    <div className="sector-tile-cells">
      {block.cells.map((cell) => <QuoteCell key={`${cell.quote.symbol}-${cell.quote.timestamp || "snapshot"}`} cell={cell} mode={mode} live={live} />)}
    </div>
  </article>;
}

function QuoteCell({ cell, mode, live }: { cell: SectorCell; mode: BoardMode; live: boolean }) {
  const { quote } = cell;
  const tone = quote.change >= 0 ? "positive" : "negative";
  const trail = normalizedTrail(quote.trail);
  const points = trail.map((value, index) => `${trail.length === 1 ? 50 : (index / (trail.length - 1)) * 100},${92 - (value / 100) * 78}`).join(" ");
  const style = {
    "--cell-grow": mode === "turnover" ? Math.max(1, cell.share * 4).toFixed(3) : 1,
    "--cell-heat": cell.intensity.toFixed(3),
  } as CSSProperties;

  return <div className={`sector-cell quote-tick ${tone}`} style={style} title={`${quote.name} ${signedPercent(quote.change)}`}>
    <div className="sector-cell-top"><b>{quote.symbol}</b><em>{signedPercent(quote.change)}</em></div>
    <h3>{quote.name}</h3>
    {points && <svg className="sector-cell-spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>}
    <div className="sector-cell-foot"><span>{quote.price.toFixed(2)}</span><small>VOL {quote.volume}</small></div>
    {live && <i className="sector-cell-live" aria-hidden="true" />}
  </div>;
}
