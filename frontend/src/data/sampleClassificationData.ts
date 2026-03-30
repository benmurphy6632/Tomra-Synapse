export type SampleClassificationTableRow = {
  id: string;
  imageId: string;
  predictedLabel: string;
  confidence: number;
  modelVersion: string;
  latencyMs: number;
  requestId: string;
  engine: string;
  date: string;
  timestamp: string;
};

export type SampleClassificationItem = {
  id: string;
  label: string;
  confidence: number; // average confidence for this label
};

const LABELS = [
  "Plastic Bottle",
  "Aluminium Can",
  "Cardboard",
  "Glass",
  "Battery",
  "Metal Scrap",
];

/**
 * Deterministic PRNG (Mulberry32)
 * Ensures server + client generate the exact same sample data.
 */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 1337; // change this if you want a different (but still deterministic) dataset
const rand = mulberry32(SEED);

// Utility: random integer in range (deterministic)
function randomInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// Utility: random float (2 decimal places, deterministic)
function randomFloat(min: number, max: number) {
  return parseFloat((rand() * (max - min) + min).toFixed(2));
}

// Utility: random string (deterministic)
function randomString(length: number) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(rand() * chars.length));
  }
  return result;
}

// Utility: format time in a deterministic way (UTC)
function formatTimeUTC(date: Date) {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function generateSampleClassificationData(): SampleClassificationTableRow[] {
  const rowCount = randomInt(25, 125);
  const rows: SampleClassificationTableRow[] = [];

  // Use an explicit UTC base time
  const baseTime = new Date("2026-02-07T18:00:00Z");
  let currentTime = new Date(
    baseTime.getTime() + randomInt(0, 2 * 60 * 60 * 1000) // within 2 hours
  );

  for (let i = 0; i < rowCount; i++) {
    // Ensure each next row is later than the previous
    currentTime = new Date(currentTime.getTime() + randomInt(1000, 8000)); // +1–8s

    rows.push({
      id: `cls_${i.toString().padStart(3, "0")}`,
      imageId: `img_${randomString(8)}`,
      predictedLabel: LABELS[randomInt(0, LABELS.length - 1)],
      confidence: randomFloat(0.7, 0.99),
      modelVersion: "v2.5.1",
      latencyMs: randomInt(25, 120),
      requestId: `req_${randomString(9)}`,
      engine: "edge-cls-03",
      date: "2026/02/07",
      timestamp: formatTimeUTC(currentTime),
    });
  }

  return rows;
}

export function getTopAvgConfidenceLabels(
  rows: SampleClassificationTableRow[],
  topN: number = 4
): SampleClassificationItem[] {
  if (!rows || rows.length === 0) return [];

  const agg = new Map<string, { sum: number; count: number }>();

  for (const r of rows) {
    const prev = agg.get(r.predictedLabel) ?? { sum: 0, count: 0 };
    prev.sum += r.confidence;
    prev.count += 1;
    agg.set(r.predictedLabel, prev);
  }

  const averages = Array.from(agg.entries()).map(([label, { sum, count }]) => ({
    label,
    avg: count === 0 ? 0 : sum / count,
  }));

  averages.sort((a, b) => b.avg - a.avg);

  return averages.slice(0, topN).map((x, i) => ({
    id: String(i + 1),
    label: x.label,
    confidence: parseFloat(x.avg.toFixed(2)),
  }));
}

// ✅ Deterministic exports (safe for SSR + hydration)
export const sampleClassificationTableData: SampleClassificationTableRow[] =
  generateSampleClassificationData();

export const sampleClassificationData: SampleClassificationItem[] =
  getTopAvgConfidenceLabels(sampleClassificationTableData, 4);

export const sampleTotalClassified: number = sampleClassificationTableData.length;

export const sampleLastClassifiedDate: string =
  sampleClassificationTableData.length > 0
    ? `${sampleClassificationTableData[sampleClassificationTableData.length - 1].date} ${
        sampleClassificationTableData[sampleClassificationTableData.length - 1].timestamp
      }`
    : "N/A";
