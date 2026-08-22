export function publicUiText(value?: string) {
  return (value ?? "")
    .replace(/\bLong\s*Bridge\s+market\s+feed\b/gi, "market feed")
    .replace(/\bLong\s*Bridge\s+market\s+data\b/gi, "market data")
    .replace(/\bLong\s*Bridge\s+feed\b/gi, "market feed")
    .replace(/\bLong\s*Bridge\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
