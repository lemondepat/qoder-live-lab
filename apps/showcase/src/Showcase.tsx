"use client";

import { useMarketFeed } from "./market-feed";
import "./minimal-showcase.css";

export function Showcase() {
  const market = useMarketFeed();
  const hsi = market.indices.find((index) => index.symbol === "HSI");
  const currentValue = market.source === "longbridge" && hsi ? hsi.value : "—";

  return (
    <main className="minimal-hsi">
      <section aria-label="Current Hang Seng Index">
        <span>HSI</span>
        <strong aria-live="polite">{currentValue}</strong>
      </section>
    </main>
  );
}
