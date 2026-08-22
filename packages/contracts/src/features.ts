export type RehearsalFeature = {
  id: string;
  title: string;
  request: string;
  impact: string;
  accent: string;
};

export const REHEARSAL_FEATURES: RehearsalFeature[] = [
  { id: "sector-heatmap", title: "Sector Heatmap", request: "Replace the plain stock list with a full-screen live sector heatmap whose tile size, color, and motion reveal market leadership at a glance.", impact: "Table → kinetic market map", accent: "#c7ff3d" },
  { id: "momentum-lens", title: "Momentum Lens", request: "Rebuild the page as a momentum lens with large normalized price trails, session ranges, leader ranking, and animated quote transitions.", impact: "Rows → live analytical cockpit", accent: "#73d9ff" },
  { id: "market-command", title: "Market Command", request: "Transform the entire dashboard into a broadcast market command center with breadth, movers, activity tape, session clock, and data-health telemetry.", impact: "Simple dashboard → broadcast wall", accent: "#9b7cff" },
  { id: "volatility-storm", title: "Volatility Storm", request: "Turn the market monitor into an immersive volatility weather system whose typography, ambient motion, and layout intensity respond to real price dispersion.", impact: "Dashboard → reactive data environment", accent: "#ff8066" },
  { id: "closing-bell", title: "Closing Bell", request: "Create a cinematic closing-bell mode with a large countdown, leader and laggard spotlights, market breadth, and a continuously moving live ticker.", impact: "Monitor → event finale", accent: "#ffd66b" },
];
