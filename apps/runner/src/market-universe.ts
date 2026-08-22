import type { MarketQuoteSnapshot } from "@qoder-live-lab/contracts";

export type MarketInstrument = Pick<
  MarketQuoteSnapshot,
  "symbol" | "vendorSymbol" | "name" | "sector" | "kind" | "currency" | "featured"
>;

const indices: MarketInstrument[] = [
  { symbol: "HSI", vendorSymbol: "HSI.HK", name: "Hang Seng", sector: "Broad market", kind: "index", currency: "HKD", featured: true },
  { symbol: "HSTECH", vendorSymbol: "HSTECH.HK", name: "Hang Seng TECH", sector: "Technology", kind: "index", currency: "HKD", featured: true },
  { symbol: "HSCEI", vendorSymbol: "HSCEI.HK", name: "China Enterprises", sector: "China enterprises", kind: "index", currency: "HKD", featured: true },
];

const featuredEquities: MarketInstrument[] = [
  equity("9988", "Alibaba", "Internet", true),
  equity("0700", "Tencent", "Internet", true),
  equity("3690", "Meituan", "Consumer", true),
  equity("1810", "Xiaomi", "Hardware", true),
  equity("1211", "BYD", "Mobility", true),
  equity("1024", "Kuaishou", "Media", true),
];

// A bounded, read-only Hong Kong equity universe. The six featured names above
// keep the opening canvas stable; these additional names make 100 equities
// searchable without publishing 100 full intraday histories in every snapshot.
const additionalEquities: MarketInstrument[] = [
  equity("0001", "CKH HOLDINGS"),
  equity("0002", "CLP HOLDINGS"),
  equity("0003", "HK & CHINA GAS"),
  equity("0005", "HSBC HOLDINGS"),
  equity("0006", "POWER ASSETS"),
  equity("0012", "HENDERSON LAND"),
  equity("0016", "SHK PPT"),
  equity("0017", "NEW WORLD DEV"),
  equity("0019", "SWIRE PACIFIC A"),
  equity("0020", "SENSETIME-W"),
  equity("0027", "GALAXY ENT"),
  equity("0066", "MTR CORPORATION"),
  equity("0100", "MINIMAX-W"),
  equity("0123", "YUEXIU PROPERTY"),
  equity("0135", "KUNLUN ENERGY"),
  equity("0144", "CHINA MER PORT"),
  equity("0148", "KINGBOARD HLDG"),
  equity("0168", "TSINGTAO BREW"),
  equity("0175", "GEELY AUTO"),
  equity("0179", "JOHNSON ELEC H"),
  equity("0189", "DONGYUE GROUP"),
  equity("0220", "U-PRESID CHINA"),
  equity("0241", "ALI HEALTH"),
  equity("0257", "EB ENVIRONMENT"),
  equity("0267", "CITIC"),
  equity("0268", "KINGDEE INT"),
  equity("0270", "GUANGDONG INV"),
  equity("0285", "BYD ELECTRONIC"),
  equity("0288", "WH GROUP"),
  equity("0290", "GOFINTECH QUANT"),
  equity("0291", "CHINA RES BEER"),
  equity("0293", "CATHAY PAC AIR"),
  equity("0300", "MIDEA GROUP"),
  equity("0316", "OOIL"),
  equity("0322", "TINGYI"),
  equity("0325", "BLOKS"),
  equity("0354", "CHINASOFT INT"),
  equity("0358", "JIANGXI COPPER"),
  equity("0371", "BJ ENT WATER"),
  equity("0384", "CHINA GAS HOLD"),
  equity("0386", "SINOPEC CORP"),
  equity("0388", "HKEX"),
  equity("0390", "CHINA RAILWAY"),
  equity("0425", "MINTH GROUP"),
  equity("0512", "GRAND PHARMA"),
  equity("0522", "ASMPT"),
  equity("0576", "ZHEJIANGEXPRESS"),
  equity("0586", "CONCH VENTURE"),
  equity("0631", "SANY INT"),
  equity("0656", "FOSUN INTL"),
  equity("0669", "TECHTRONIC IND"),
  equity("0670", "CHINA EAST AIR"),
  equity("0688", "CHINA OVERSEAS"),
  equity("0696", "TRAVELSKY TECH"),
  equity("0697", "SHOUCHENG"),
  equity("0728", "CHINA TELECOM"),
  equity("0753", "AIR CHINA"),
  equity("0762", "CHINA UNICOM"),
  equity("0763", "ZTE"),
  equity("0772", "CHINA LIT"),
  equity("0780", "TONGCHENGTRAVEL"),
  equity("0788", "CHINA TOWER"),
  equity("0800", "WERIDE-W"),
  equity("0823", "LINK REIT"),
  equity("0836", "CHINA RES POWER"),
  equity("0853", "MICROPORT"),
  equity("0857", "PETROCHINA"),
  equity("0868", "XINYI GLASS"),
  equity("0880", "SJM HOLDINGS"),
  equity("0881", "ZHONGSHENG HLDG"),
  equity("0883", "CNOOC"),
  equity("0902", "HUANENG POWER"),
  equity("0914", "CONCH CEMENT"),
  equity("0916", "CHINA LONGYUAN"),
  equity("0939", "CCB"),
  equity("0941", "CHINA MOBILE"),
  equity("0956", "CHINA SUNTIEN"),
  equity("0960", "LONGFOR GROUP"),
  equity("0966", "CHINA TAIPING"),
  equity("0968", "XINYI SOLAR"),
  equity("0981", "SMIC"),
  equity("0991", "DATANG POWER"),
  equity("0992", "LENOVO GROUP"),
  equity("0998", "CITIC BANK"),
  equity("1030", "SEAZEN"),
  equity("1038", "CKI HOLDINGS"),
  equity("1044", "HENGAN INT"),
  equity("1055", "CHINA SOUTH AIR"),
  equity("1066", "WEIGAO GROUP"),
  equity("1070", "TCL ELECTRONICS"),
  equity("1072", "DONGFANG ELEC"),
  equity("1088", "CHINA SHENHUA"),
  equity("1093", "CSPC PHARMA"),
  equity("1099", "SINOPHARM"),
];

export const MARKET_INSTRUMENTS: readonly MarketInstrument[] = [
  ...indices,
  ...featuredEquities,
  ...additionalEquities,
];

export const MARKET_EQUITY_COUNT = MARKET_INSTRUMENTS.filter((item) => item.kind === "equity").length;
export const FEATURED_VENDOR_SYMBOLS = new Set(MARKET_INSTRUMENTS.filter((item) => item.featured).map((item) => item.vendorSymbol));
export const MARKET_INSTRUMENT_BY_VENDOR = new Map(MARKET_INSTRUMENTS.map((item) => [item.vendorSymbol, item]));

export function resolveMarketVendorSymbol(value: string) {
  const normalized = value.trim().toUpperCase();
  const direct = MARKET_INSTRUMENTS.find((item) => item.vendorSymbol === normalized || item.symbol === normalized);
  if (direct) return direct.vendorSymbol;
  const digits = normalized.replace(/\.HK$/, "").replace(/^0+(?=\d)/, "");
  return MARKET_INSTRUMENT_BY_VENDOR.has(`${digits}.HK`) ? `${digits}.HK` : undefined;
}

function equity(symbol: string, name: string, sector = "HK equities", featured = false): MarketInstrument {
  const display = symbol.replace(/^0+(?=\d)/, "").padStart(4, "0");
  const vendor = `${symbol.replace(/^0+(?=\d)/, "")}.HK`;
  return { symbol: display, vendorSymbol: vendor, name, sector, kind: "equity", currency: "HKD", featured };
}
