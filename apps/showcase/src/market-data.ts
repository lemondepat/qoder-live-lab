export type MarketQuote = { symbol: string; name: string; sector: string; price: number; change: number; volume: string; trail: number[] };

export const MARKET_INDICES = [
  { symbol: "HSI", label: "Hang Seng", value: "25,412.80", change: 0.84 },
  { symbol: "HSTECH", label: "Hang Seng TECH", value: "5,678.31", change: 1.42 },
  { symbol: "HSCEI", label: "China Enterprises", value: "9,082.16", change: 0.63 },
] as const;

export const MARKET_QUOTES: MarketQuote[] = [
  { symbol: "9988", name: "Alibaba", sector: "Internet", price: 124.8, change: 2.38, volume: "48.2M", trail: [31,35,33,40,44,42,51,58,62,70] },
  { symbol: "0700", name: "Tencent", sector: "Internet", price: 586.5, change: 1.12, volume: "16.8M", trail: [45,43,48,46,51,55,53,60,64,67] },
  { symbol: "3690", name: "Meituan", sector: "Consumer", price: 132.4, change: -0.68, volume: "27.1M", trail: [68,65,62,64,57,59,54,51,49,46] },
  { symbol: "1810", name: "Xiaomi", sector: "Hardware", price: 55.2, change: 3.04, volume: "102M", trail: [24,28,31,37,35,46,50,58,67,78] },
  { symbol: "1211", name: "BYD", sector: "Mobility", price: 116.7, change: -1.26, volume: "35.4M", trail: [72,68,70,62,59,55,58,49,45,42] },
  { symbol: "1024", name: "Kuaishou", sector: "Media", price: 79.6, change: 0.46, volume: "21.9M", trail: [46,49,45,52,50,55,51,57,58,61] },
] as const;
