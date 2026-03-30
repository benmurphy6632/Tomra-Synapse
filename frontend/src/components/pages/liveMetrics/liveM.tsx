"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, usePathname } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import styles from "./liveM.module.css";
import { loadProjects } from "@/lib/projectsStore";

interface EngineOutput {
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
}

type ModelStatus = "Stable" | "Canary" | "Archived";
type MetricsView = "combined" | "stable" | "canary";

const STORAGE_PREFIX = "modelVersions";
const MODEL_STATUS_UPDATED_EVENT = "model-statuses-updated";

function storageKey(projectId: string, section: string) {
  return `${STORAGE_PREFIX}:${projectId}:${section}`;
}

const GRAPHQL_QUERY = `
  query EngineOutputs($projectId: String!) {
    engineOutputs(projectId: $projectId) {
      deviceId
      imageName
      predictedLabel
      confidence
      model
      classId
      latency
      imageURL
      powerUsage
      co2Emissions
    }
  }
`;

async function fetchEngineOutputs(projectId: string): Promise<EngineOutput[]> {
  const endpoint =
    process.env.NEXT_PUBLIC_GRAPHQL_URL!;

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

function deriveMetrics(data: EngineOutput[]) {
  if (!data.length) return null;

  const avgLatency = data.reduce((s, d) => s + d.latency, 0) / data.length;
  const avgConfidence =
    data.reduce((s, d) => s + d.confidence, 0) / data.length;
  const totalCO2 = data.reduce((s, d) => s + d.co2Emissions, 0);
  const avgPower = data.reduce((s, d) => s + d.powerUsage, 0) / data.length;

  const latencySeries = data.map((d, i) => ({
    idx: i + 1,
    value: parseFloat((d.latency * 1000).toFixed(1)),
  }));

  const confidenceSeries = data.map((d, i) => ({
    idx: i + 1,
    value: parseFloat((d.confidence * 100).toFixed(1)),
  }));

  const co2Series = data.map((d, i) => ({
    idx: i + 1,
    value: parseFloat((d.co2Emissions * 1000).toFixed(4)),
  }));

  const labelCounts: Record<string, number> = {};
  for (const d of data) {
    labelCounts[d.predictedLabel] = (labelCounts[d.predictedLabel] ?? 0) + 1;
  }

  const labelDist = Object.entries(labelCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const uniqueClasses = new Set(data.map((d) => d.predictedLabel)).size;

  return {
    avgLatency,
    avgConfidence,
    totalCO2,
    avgPower,
    latencySeries,
    confidenceSeries,
    co2Series,
    labelDist,
    total: data.length,
    uniqueClasses,
    models: [...new Set(data.map((d) => d.model))],
  };
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#05080f",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#cbd5e1",
  },
};

const axisProps = {
  stroke: "rgba(255,255,255,0.12)",
  tick: { fontSize: 11, fill: "rgba(255,255,255,0.35)" },
};

function ChartPanel({
  title,
  value,
  valueColor = "#22d3ee",
  children,
  fullWidth = false,
}: {
  title: string;
  value: string;
  valueColor?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? styles.panelFull : styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>{title}</span>
        <span className={styles.panelValue} style={{ color: valueColor }}>
          {value}
        </span>
      </div>
      <div className={styles.chartBody}>{children}</div>
    </div>
  );
}

export default function LiveMetrics() {
  const params = useParams();
  const pathname = usePathname();
  const rawProjectId = params?.projectId;
  const projectId = Array.isArray(rawProjectId)
    ? rawProjectId[0]
    : rawProjectId ?? "unknown-project";

  const currentProjectId = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("projects");
    if (idx === -1) return projectId;
    const maybeId = parts[idx + 1];
    if (!maybeId || maybeId === "new") return projectId;
    return maybeId;
  }, [pathname, projectId]);

  const projectName = useMemo(() => {
    if (typeof window === "undefined") return null;
    const projects = loadProjects();
    const project = projects.find((p) => p.id === currentProjectId);
    return project?.name ?? null;
  }, [currentProjectId]);

  const [data, setData] = useState<EngineOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [stableModelName, setStableModelName] = useState<string | null>(null);
  const [canaryModelName, setCanaryModelName] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<MetricsView>("combined");

  const refresh = useCallback(async () => {
    const results = await fetchEngineOutputs(currentProjectId);
    setData(results);
    setLastRefresh(new Date());
    setLoading(false);
  }, [currentProjectId]);

  const hydrateModelStatuses = useCallback(() => {
    try {
      const storedStatuses = localStorage.getItem(
        storageKey(currentProjectId, "statuses"),
      );

      const parsed: Record<string, ModelStatus> = storedStatuses
        ? JSON.parse(storedStatuses)
        : {};

      const stableEntry =
        Object.entries(parsed).find(([, status]) => status === "Stable") ?? null;
      const canaryEntry =
        Object.entries(parsed).find(([, status]) => status === "Canary") ?? null;

      setStableModelName(stableEntry?.[0] ?? null);
      setCanaryModelName(canaryEntry?.[0] ?? null);
    } catch {
      setStableModelName(null);
      setCanaryModelName(null);
    }
  }, [currentProjectId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    hydrateModelStatuses();

    const handleModelStatusesUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{
        projectId?: string;
        statuses?: Record<string, ModelStatus>;
      }>;

      if (
        customEvent.detail?.projectId &&
        customEvent.detail.projectId !== currentProjectId
      ) {
        return;
      }

      hydrateModelStatuses();
    };

    window.addEventListener(
      MODEL_STATUS_UPDATED_EVENT,
      handleModelStatusesUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        MODEL_STATUS_UPDATED_EVENT,
        handleModelStatusesUpdated as EventListener,
      );
    };
  }, [hydrateModelStatuses, currentProjectId]);

  useEffect(() => {
    if (selectedView === "stable" && !stableModelName) {
      setSelectedView("combined");
    }

    if (selectedView === "canary" && !canaryModelName) {
      setSelectedView("combined");
    }
  }, [selectedView, stableModelName, canaryModelName]);

  const filteredData = useMemo(() => {
    if (selectedView === "stable") {
      return stableModelName
        ? data.filter((row) => row.model === stableModelName)
        : [];
    }

    if (selectedView === "canary") {
      return canaryModelName
        ? data.filter((row) => row.model === canaryModelName)
        : [];
    }

    return data;
  }, [data, selectedView, stableModelName, canaryModelName]);

  const metrics = deriveMetrics(filteredData);

  const selectedViewLabel =
    selectedView === "stable"
      ? stableModelName
        ? `Stable - ${stableModelName}`
        : "Stable - No model selected"
      : selectedView === "canary"
        ? canaryModelName
          ? `Canary - ${canaryModelName}`
          : "Canary - No model selected"
        : "Summary View";

  const currentModelLabel =
    selectedView === "stable"
      ? stableModelName ?? "no model"
      : selectedView === "canary"
        ? canaryModelName ?? "no model"
        : null;

  const BAR_COLORS = [
    "#60a5fa",
    "#34d399",
    "#f472b6",
    "#fbbf24",
    "#a78bfa",
    "#22d3ee",
    "#fb923c",
    "#4ade80",
  ];

  if (loading) {
    return (
      <div className={styles.shell}>
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Fetching classification data…</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={styles.shell}>
        <div className={styles.page}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.pageHeader}>
                {projectName ?? currentProjectId}
              </h1>
              <p className={styles.pageSubline}>Live Metrics</p>
            </div>
          </div>

          <div className={styles.viewToggleRow}>
            <button
              type="button"
              className={`${styles.viewToggleButton} ${
                selectedView === "combined" ? styles.viewToggleButtonActive : ""
              }`}
              onClick={() => setSelectedView("combined")}
            >
              Summary
            </button>

            <button
              type="button"
              className={`${styles.viewToggleButton} ${
                selectedView === "stable" ? styles.viewToggleButtonActive : ""
              }`}
              onClick={() => setSelectedView("stable")}
              disabled={!stableModelName}
            >
              {stableModelName ? `Stable - ${stableModelName}` : "Stable - No model"}
            </button>

            <button
              type="button"
              className={`${styles.viewToggleButton} ${
                selectedView === "canary" ? styles.viewToggleButtonActive : ""
              }`}
              onClick={() => setSelectedView("canary")}
              disabled={!canaryModelName}
            >
              {canaryModelName
                ? `Canary - ${canaryModelName}`
                : "Canary - No model"}
            </button>
          </div>

          <div className={styles.viewHint}>
            Currently selected: <span>{selectedViewLabel}</span>
          </div>

          <div className={styles.panelEmptyState}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>No Metrics Available</span>
              <span
                className={styles.panelValue}
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                Waiting for data
              </span>
            </div>

            <div className={styles.emptyPanelBody}>
              <div className={styles.emptyIcon}>◌</div>
              <p className={styles.emptyTitle}>No classifications yet</p>
              <p className={styles.emptySub}>
                {selectedView === "combined"
                  ? "Results will appear here once the edge device starts classifying images."
                  : `No outputs found yet for ${selectedViewLabel}.`}
              </p>
              <button className={styles.retryBtn} onClick={refresh}>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.pageHeader}>
              {projectName ?? currentProjectId}
            </h1>
            <div className={styles.pageSubline}>
              Live Metrics
              {lastRefresh && (
                <span className={styles.refreshTime}>
                  {" "}
                  · Updated {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.viewToggleRow}>
          <button
            type="button"
            className={`${styles.viewToggleButton} ${
              selectedView === "combined" ? styles.viewToggleButtonActive : ""
            }`}
            onClick={() => setSelectedView("combined")}
          >
            Summary
          </button>

          <button
            type="button"
            className={`${styles.viewToggleButton} ${
              selectedView === "stable" ? styles.viewToggleButtonActive : ""
            }`}
            onClick={() => setSelectedView("stable")}
            disabled={!stableModelName}
          >
            {stableModelName ? `Stable - ${stableModelName}` : "Stable - No model"}
          </button>

          <button
            type="button"
            className={`${styles.viewToggleButton} ${
              selectedView === "canary" ? styles.viewToggleButtonActive : ""
            }`}
            onClick={() => setSelectedView("canary")}
            disabled={!canaryModelName}
          >
            {canaryModelName
              ? `Canary - ${canaryModelName}`
              : "Canary - No model"}
          </button>
        </div>

        <div className={styles.viewHint}>
          Currently selected: <span>{selectedViewLabel}</span>
        </div>
        <div className={styles.statsGrid}>
          <div className={styles.card}>
            <div
              className={
                selectedView === "combined" ? styles.cardCompact : ""
              }
            >
              <div className={styles.cardLabel}>System Status</div>
              <div className={`${styles.cardValue} ${styles.green}`}>
                {metrics.total > 0 ? "healthy" : "idle"}
              </div>
              {selectedView !== "combined" && currentModelLabel && (
                <div className={styles.cardSub}>{currentModelLabel}</div>
              )}
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Total Classifications</div>
            <div className={`${styles.cardValue} ${styles.cyan}`}>
              {metrics.total.toLocaleString()}
            </div>
            <div className={styles.cardSub}>
              {metrics.uniqueClasses} unique classes
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Avg Latency</div>
            <div className={`${styles.cardValue} ${styles.blue}`}>
              {(metrics.avgLatency * 1000).toFixed(0)}ms
            </div>
            <div className={styles.cardSub}>per image</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Avg Power Draw</div>
            <div className={`${styles.cardValue} ${styles.amber}`}>
              {metrics.avgPower.toFixed(1)} W
            </div>
            <div className={styles.cardSub}>edge device</div>
          </div>
        </div>

        <div className={styles.chartGrid}>
          <ChartPanel
            title="Latency (ms)"
            value={`${(metrics.avgLatency * 1000).toFixed(0)}ms`}
            valueColor="#60a5fa"
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={metrics.latencySeries}
                margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="idx" {...axisProps} />
                <YAxis {...axisProps} unit=" ms" width={60} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [`${v} ms`, "Latency"]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#60a5fa" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title="Confidence (%)"
            value={`${(metrics.avgConfidence * 100).toFixed(1)}%`}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={metrics.confidenceSeries}
                margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="idx" {...axisProps} />
                <YAxis {...axisProps} unit="%" domain={[0, 100]} width={50} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [`${v}%`, "Confidence"]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#22d3ee" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>

        <ChartPanel
          title="CO₂ Emissions (mg per image)"
          value={`${(metrics.totalCO2 * 1000).toFixed(3)} mg total`}
          valueColor="#f87171"
          fullWidth
        >
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={metrics.co2Series}
              margin={{ top: 8, right: 16, bottom: 8, left: 20 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="idx" {...axisProps} />
              <YAxis {...axisProps} unit=" mg" width={70} />
              <Tooltip
                {...tooltipStyle}
                formatter={(v) => [`${v} mg`, "CO₂"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#f87171"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#f87171" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Top Predicted Labels"
          value={`${metrics.uniqueClasses} classes`}
          valueColor="#a78bfa"
          fullWidth
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={metrics.labelDist}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 8, left: 32 }}
            >
              <CartesianGrid
                stroke="rgba(255,255,255,0.06)"
                horizontal={false}
              />
              <XAxis type="number" {...axisProps} />
              <YAxis
                type="category"
                dataKey="label"
                {...axisProps}
                width={160}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(v) => [`${v} images`, "Count"]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {metrics.labelDist.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <div className={styles.panel} style={{ marginTop: "1.5rem" }}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Recent Classifications</span>
            <span
              className={styles.panelValue}
              style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}
            >
              {filteredData.length} total
            </span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Label</th>
                  <th>Confidence</th>
                  <th>Latency</th>
                  <th>Power</th>
                  <th>CO₂</th>
                  <th>Device</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredData]
                  .reverse()
                  .slice(0, 10)
                  .map((row, i) => (
                    <tr key={i}>
                      <td className={styles.dimText}>{row.imageName}</td>
                      <td className={styles.labelCell}>{row.predictedLabel}</td>
                      <td>
                        <span
                          className={styles.pill}
                          style={{
                            background:
                              row.confidence > 0.6
                                ? "rgba(52,211,153,0.15)"
                                : row.confidence > 0.3
                                  ? "rgba(251,191,36,0.15)"
                                  : "rgba(248,113,113,0.15)",
                            color:
                              row.confidence > 0.6
                                ? "#34d399"
                                : row.confidence > 0.3
                                  ? "#fbbf24"
                                  : "#f87171",
                          }}
                        >
                          {(row.confidence * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className={styles.dimText}>
                        {(row.latency * 1000).toFixed(0)} ms
                      </td>
                      <td className={styles.dimText}>
                        {row.powerUsage.toFixed(1)} W
                      </td>
                      <td className={styles.dimText}>
                        {(row.co2Emissions * 1000).toFixed(4)} mg
                      </td>
                      <td className={styles.dimText}>{row.deviceId}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}