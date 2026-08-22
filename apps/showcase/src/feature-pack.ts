export const FEATURE_EDITIONS = [
  "baseline",
  "sector-heatmap",
  "momentum-lens",
  "market-command",
  "volatility-storm",
  "closing-bell",
] as const;

export type FeatureEdition = (typeof FEATURE_EDITIONS)[number];

// Signed Feature Pack releases change only these two constants. All feature
// code is reviewed and verified on main before the operator can activate it.
export const DEFAULT_FEATURE_EDITION: FeatureEdition = "baseline";
export const FEATURE_PACK_ACTIVATION = "OWNER-BASELINE";

export function isFeatureEdition(value: string | null): value is FeatureEdition {
  return Boolean(value && FEATURE_EDITIONS.includes(value as FeatureEdition));
}
