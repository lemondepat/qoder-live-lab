export type RehearsalFeature = {
  id: string;
  title: string;
  request: string;
  impact: string;
  accent: string;
};

export const REHEARSAL_FEATURES: RehearsalFeature[] = [
  { id: "sector-heatmap", title: "Sector Heatmap", request: "Turn the plain stock list into a live sector heatmap with clear winners and losers.", impact: "Table → full-screen market map", accent: "#c7ff3d" },
  { id: "momentum-lens", title: "Momentum Lens", request: "Add compact price trails and a five-minute momentum lens to every market card.", impact: "Static prices → animated market rhythm", accent: "#73d9ff" },
  { id: "market-command", title: "Market Command", request: "Transform the dashboard into a market command center with breadth, activity tape, and closing countdown.", impact: "Simple dashboard → broadcast experience", accent: "#9b7cff" },
];
