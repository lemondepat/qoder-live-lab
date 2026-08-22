export type MarketIntradayPoint = {
  timestamp: string;
  price: number;
  averagePrice?: number;
  volume: number;
  turnover: number;
};

export type MarketQuote = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  volume: string;
  trail: number[];
  previousClose: number;
  intraday: MarketIntradayPoint[];
  featured?: boolean;
  open?: number;
  high?: number;
  low?: number;
  timestamp?: string;
};

export type MarketIndex = {
  symbol: string;
  label: string;
  value: string;
  last: number;
  previousClose: number;
  change: number;
  intraday: MarketIntradayPoint[];
};

export const MARKET_INDICES: MarketIndex[] = [
  { symbol: "HSI", label: "Hang Seng", value: "25,412.80", last: 25412.8, previousClose: 25200.71, change: 0.84, intraday: [] },
  { symbol: "HSTECH", label: "Hang Seng TECH", value: "5,678.31", last: 5678.31, previousClose: 5598.81, change: 1.42, intraday: [] },
  { symbol: "HSCEI", label: "China Enterprises", value: "9,082.16", last: 9082.16, previousClose: 9025.3, change: 0.63, intraday: [] },
];

export const MARKET_QUOTES: MarketQuote[] = [
  { symbol: "9988", name: "Alibaba", sector: "Internet", price: 124.8, previousClose: 121.9, change: 2.38, volume: "48.2M", trail: [31,35,33,40,44,42,51,58,62,70], intraday: [] },
  { symbol: "0700", name: "Tencent", sector: "Internet", price: 586.5, previousClose: 580, change: 1.12, volume: "16.8M", trail: [45,43,48,46,51,55,53,60,64,67], intraday: [] },
  { symbol: "3690", name: "Meituan", sector: "Consumer", price: 132.4, previousClose: 133.31, change: -0.68, volume: "27.1M", trail: [68,65,62,64,57,59,54,51,49,46], intraday: [] },
  { symbol: "1810", name: "Xiaomi", sector: "Hardware", price: 55.2, previousClose: 53.57, change: 3.04, volume: "102M", trail: [24,28,31,37,35,46,50,58,67,78], intraday: [] },
  { symbol: "1211", name: "BYD", sector: "Mobility", price: 116.7, previousClose: 118.19, change: -1.26, volume: "35.4M", trail: [72,68,70,62,59,55,58,49,45,42], intraday: [] },
  { symbol: "1024", name: "Kuaishou", sector: "Media", price: 79.6, previousClose: 79.24, change: 0.46, volume: "21.9M", trail: [46,49,45,52,50,55,51,57,58,61], intraday: [] },
];
