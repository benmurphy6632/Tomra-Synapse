"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardPanelShell from "../DashboardPanelShell";

// ── Types ────────────────────────────────────────────────────────────────────

type EngineOutput = {
  deviceId: string;
  imageName: string;
  predictedLabel: string;
  confidence: number;
  model: string;
  classId: number;
  latency: number;
  imageURL: string;
  powerUsage: number;
  co2Emissions: number;
};

const GRAPHQL_QUERY = `
  query EngineOutputs($projectId: String!) {
    engineOutputs(projectId: $projectId) {
      deviceId
      imageName
      predictedLabel
      confidence
      latency
      powerUsage
      co2Emissions
    }
  }
`;

async function fetchOutputs(projectId: string): Promise<EngineOutput[]> {
  const endpoint =
    process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:8080/graphql";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: GRAPHQL_QUERY,
        variables: { projectId },
      }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.engineOutputs ?? [];
  } catch {
    return [];
  }
}

// ── SVG mini line chart ───────────────────────────────────────────────────────

function buildPath(
  points: number[],
  width: number,
  height: number,
  yMin: number,
  yMax: number,
): string {
  if (points.length < 2) return "";
  const range = yMax - yMin || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * width);
  const ys = points.map((v) => height - ((v - yMin) / range) * height);
  let d = `M ${xs[0]},${ys[0]}`;
  for (let i = 1; i < points.length; i++) {
    const cpx = (xs[i - 1] + xs[i]) / 2;
    d += ` C ${cpx},${ys[i - 1]} ${cpx},${ys[i]} ${xs[i]},${ys[i]}`;
  }
  return d;
}

function buildAreaPath(
  points: number[],
  width: number,
  height: number,
  yMin: number,
  yMax: number,
): string {
  if (points.length < 2) return "";
  const line = buildPath(points, width, height, yMin, yMax);
  const lastX = width;
  const firstX = 0;
  return `${line} L ${lastX},${height} L ${firstX},${height} Z`;
}

function MiniChart({
  points,
  yMin,
  yMax,
  color,
  gradientId,
  xLabels,
  unit,
}: {
  points: number[];
  yMin: number;
  yMax: number;
  color: string;
  gradientId: string;
  xLabels: string[];
  unit: string;
}) {
  const W = 800;
  const H = 90;
  const AXIS_H = 18;
  const chartH = H - AXIS_H;

  const linePath = buildPath(points, W, chartH, yMin, yMax);
  const areaPath = buildAreaPath(points, W, chartH, yMin, yMax);

  const yTicks = [yMin, (yMin + yMax) / 2, yMax].map(
    (v) => chartH - ((v - yMin) / (yMax - yMin || 1)) * chartH,
  );

  const lastX = W;
  const lastY =
    chartH - ((points[points.length - 1] - yMin) / (yMax - yMin || 1)) * chartH;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: "90px" }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((y, i) => (
        <line
          key={i}
          x1={0}
          y1={y}
          x2={W}
          y2={y}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
          strokeDasharray="4 6"
        />
      ))}

      <path d={areaPath} fill={`url(#${gradientId})`} />

      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <circle cx={lastX} cy={lastY} r={4} fill={color} opacity={0.9} />

      {xLabels.map((label, i) => (
        <text
          key={i}
          x={(i / (xLabels.length - 1)) * W}
          y={H - 3}
          textAnchor={
            i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"
          }
          fontSize={9}
          fill="rgba(199,199,199,0.35)"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div
      style={{ height: "90px" }}
      className="w-full flex items-center justify-center"
    >
      <span className="text-[rgba(199,199,199,0.25)] text-xs tracking-wide">
        {message}
      </span>
    </div>
  );
}

// ── Stat badge ────────────────────────────────────────────────────────────────

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{ borderColor: `${color}22` }}
      className="flex flex-col gap-[2px] px-3 py-2 rounded-lg border"
    >
      <span
        className="text-[10px] uppercase tracking-widest"
        style={{ color: `${color}88` }}
      >
        {label}
      </span>
      <span className="text-sm font-semibold leading-none" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

// ── Chart row ─────────────────────────────────────────────────────────────────

function ChartRow({
  label,
  currentValue,
  color,
  hasData,
  loading,
  children,
}: {
  label: string;
  currentValue?: string;
  color: string;
  hasData: boolean;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[3px] flex-1">
      <div className="flex items-baseline justify-between px-[2px]">
        <span
          className="text-[10px] uppercase tracking-widest"
          style={{ color: `${color}99` }}
        >
          {label}
        </span>
        {hasData && currentValue && (
          <span
            className="text-sm font-semibold leading-none"
            style={{ color }}
          >
            {currentValue}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {hasData ? (
          children
        ) : (
          <EmptyChart message={loading ? "Connecting…" : "No data yet"} />
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LiveMetricsPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<EngineOutput[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const results = await fetchOutputs(projectId);
    setData(results);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  const hasData = data.length > 0;

  const latencyPoints = data.map((o) =>
    parseFloat((o.latency * 1000).toFixed(1)),
  );
  const confPoints = data.map((o) =>
    parseFloat((o.confidence * 100).toFixed(1)),
  );
  const powerPoints = data.map((o) => parseFloat(o.powerUsage.toFixed(1)));

  const avgLatency = hasData
    ? latencyPoints.reduce((a, b) => a + b, 0) / latencyPoints.length
    : 0;
  const avgConf = hasData
    ? confPoints.reduce((a, b) => a + b, 0) / confPoints.length
    : 0;
  const avgPower = hasData
    ? powerPoints.reduce((a, b) => a + b, 0) / powerPoints.length
    : 0;

  const latestLatency = latencyPoints[latencyPoints.length - 1] ?? 0;
  const latestConf = confPoints[confPoints.length - 1] ?? 0;
  const latestPower = powerPoints[powerPoints.length - 1] ?? 0;

  const step = Math.max(1, Math.floor(data.length / 4));
  const xLabels = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((o) => o.imageName.replace(/\.[^.]+$/, "").slice(0, 7));

  const latY = hasData
    ? {
        min: Math.max(0, Math.min(...latencyPoints) - 5),
        max: Math.max(...latencyPoints) + 5,
      }
    : { min: 0, max: 100 };
  const powY = hasData
    ? {
        min: Math.max(0, Math.min(...powerPoints) - 2),
        max: Math.max(...powerPoints) + 2,
      }
    : { min: 0, max: 30 };

  return (
    <DashboardPanelShell
      href={`/projects/${projectId}/metrics`}
      ariaLabel="Go to Live Metrics"
      heightClass="h-[70vh]"
    >
      <div className="w-full h-full flex flex-col">
        <div className="px-[25px] pt-5 pb-3 flex items-start justify-between shrink-0 border-b border-[rgba(9,119,138,0.2)]">
          <div>
            <h1 className="font-semibold tracking-wide text-white leading-tight whitespace-nowrap text-[clamp(18px,2vw,36px)]">
              Recent Live Metrics
            </h1>
            <p className="text-[clamp(11px,0.9vw,13px)] text-[rgba(199,199,230,0.45)] tracking-wide mt-[2px]">
              {loading
                ? "Connecting to backend…"
                : hasData
                  ? `${data.length} classifications · refreshes every 10s`
                  : "Waiting for classifications"}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col px-[25px] py-2 overflow-hidden gap-3">
          <ChartRow
            label="Latency (ms)"
            currentValue={`${latestLatency} ms`}
            color="rgb(99,102,241)"
            hasData={hasData}
            loading={loading}
          >
            <MiniChart
              points={latencyPoints}
              yMin={latY.min}
              yMax={latY.max}
              color="rgb(99,102,241)"
              gradientId="grad-latency"
              xLabels={xLabels}
              unit="ms"
            />
          </ChartRow>

          <div className="h-[1px] bg-[rgba(9,119,138,0.2)] shrink-0" />

          <ChartRow
            label="Confidence (%)"
            currentValue={`${latestConf.toFixed(1)}%`}
            color="rgb(0,209,178)"
            hasData={hasData}
            loading={loading}
          >
            <MiniChart
              points={confPoints}
              yMin={0}
              yMax={100}
              color="rgb(0,209,178)"
              gradientId="grad-conf"
              xLabels={xLabels}
              unit="%"
            />
          </ChartRow>

          <div className="h-[1px] bg-[rgba(9,119,138,0.2)] shrink-0" />

          <ChartRow
            label="Power Draw (W)"
            currentValue={`${latestPower.toFixed(1)} W`}
            color="rgb(251,191,36)"
            hasData={hasData}
            loading={loading}
          >
            <MiniChart
              points={powerPoints}
              yMin={powY.min}
              yMax={powY.max}
              color="rgb(251,191,36)"
              gradientId="grad-power"
              xLabels={xLabels}
              unit="W"
            />
          </ChartRow>
        </div>
      </div>
    </DashboardPanelShell>
  );
}