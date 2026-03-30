"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { usePathname } from "next/navigation";
import styles from "./ModelDeployment.module.css";
import { loadProjects } from "@/lib/projectsStore";
import ModelPerformance from "./ModelPerformance";
import { fetchFeedbackVotes, type FeedbackVote } from "@/api/FeedbackVote";

const timeLabels = [
  "0m",
  "5m",
  "10m",
  "15m",
  "20m",
  "25m",
  "30m",
  "35m",
  "40m",
  "45m",
  "50m",
  "55m",
];

const TRAFFIC_SPLIT_UPDATED_EVENT = "model-traffic-split-updated";
const MODEL_STATUS_UPDATED_EVENT = "model-statuses-updated";
const STORAGE_PREFIX = "modelVersions";

const START_SESSION_MUTATION = `
  mutation StartSession(
    $projectId: String!
    $stableModel: String
    $canaryModel: String
    $stablePercent: Int!
    $canaryPercent: Int!
  ) {
    startSession(
      projectId: $projectId
      stableModel: $stableModel
      canaryModel: $canaryModel
      stablePercent: $stablePercent
      canaryPercent: $canaryPercent
    ) {
      sessionId
      projectId
      stableModel
      canaryModel
      stablePercent
      canaryPercent
      status
    }
  }
`;

type ModelStatus = "Stable" | "Canary" | "Archived";
type LoadButtonState = "idle" | "loading" | "loaded";
type ChartViewMode = "both" | "stable" | "canary";

interface EngineOutput {
  id: string;
  deviceId: string;
  imageName: string;
  predictedLabel: string;
  confidence: number;
  model: string;
  classId: number;
  latency: number;
  imageURL: string;
}

type ModelComparisonMetrics = {
  model: string;
  up: number;
  down: number;
  unsure: number;
  reviewedCount: number;
  accuracy: number;
  avgLatency: number;
  errorRate: number;
  requestCount: number;
  latencySeries: Array<{ idx: number; value: number }>;
  errorSeries: Array<{ idx: number; value: number }>;
};

type AnalysisTone = "good" | "bad" | "neutral";

type CanaryAnalysisGauge = {
  key: "latency" | "errorRate";
  title: string;
  value: number;
  tone: AnalysisTone;
  primaryText: string;
  secondaryText: string;
};

const GRAPHQL_QUERY = `
  query EngineOutputs($projectId: String!) {
    engineOutputs(projectId: $projectId) {
      id
      deviceId
      imageName
      predictedLabel
      confidence
      model
      classId
      latency
      imageURL
    }
  }
`;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function modelTrafficSplitKey(projectId: string) {
  return `modelTrafficSplit:${projectId}`;
}

function modelStatusesKey(projectId: string) {
  return `${STORAGE_PREFIX}:${projectId}:statuses`;
}

function getOutputVoteKey(item: { id: string }) {
  return String(item.id);
}

function getFeedbackVoteKey(item: { resultId: string }) {
  return String(item.resultId);
}

function readModelStatuses(projectId: string): Record<string, ModelStatus> {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(modelStatusesKey(projectId));
    if (!stored) return {};

    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function fetchEngineOutputs(projectId: string): Promise<EngineOutput[]> {
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

function buildVotesForOutputs(outputs: EngineOutput[], votes: FeedbackVote[]) {
  const outputKeySet = new Set(
    outputs.map((output) => getOutputVoteKey(output)),
  );

  return votes.filter((vote) => outputKeySet.has(getFeedbackVoteKey(vote)));
}

function buildLatencySeriesFromOutputs(outputs: EngineOutput[]) {
  return outputs.map((output, index) => ({
    idx: index + 1,
    value: Number((output.latency * 1000).toFixed(1)),
  }));
}

function buildErrorSeriesFromOutputs(
  outputs: EngineOutput[],
  votes: FeedbackVote[],
  bucketCount = 12,
) {
  if (!outputs.length) return [];

  const bucketSize = Math.max(1, Math.ceil(outputs.length / bucketCount));
  const series: Array<{ idx: number; value: number }> = [];

  let cumulativeDown = 0;
  let cumulativeTotal = 0;

  for (let i = 0; i < outputs.length; i += bucketSize) {
    const bucket = outputs.slice(i, i + bucketSize);
    const bucketKeys = new Set(
      bucket.map((output) => getOutputVoteKey(output)),
    );

    const bucketVotes = votes.filter((vote) =>
      bucketKeys.has(getFeedbackVoteKey(vote)),
    );

    const judgedVotes = bucketVotes.filter((vote) => vote.vote !== "UNSURE");
    const down = judgedVotes.filter((vote) => vote.vote === "DOWN").length;
    const total = judgedVotes.length;

    cumulativeDown += down;
    cumulativeTotal += total;

    series.push({
      idx: cumulativeTotal,
      value:
        cumulativeTotal > 0
          ? Number((cumulativeDown / cumulativeTotal).toFixed(3))
          : 0,
    });
  }

  return series;
}

function computeModelMetrics(
  model: string,
  outputs: EngineOutput[],
  votes: FeedbackVote[],
): ModelComparisonMetrics {
  const modelOutputs = outputs.filter((output) => output.model === model);
  const modelVotes = buildVotesForOutputs(modelOutputs, votes);

  const up = modelVotes.filter((vote) => vote.vote === "UP").length;
  const down = modelVotes.filter((vote) => vote.vote === "DOWN").length;
  const unsure = modelVotes.filter((vote) => vote.vote === "UNSURE").length;

  const judged = up + down;
  const reviewedCount = up + down + unsure;
  const accuracy = judged > 0 ? up / judged : 0;
  const errorRate = judged > 0 ? down / judged : 0;

  const avgLatency =
    modelOutputs.length > 0
      ? modelOutputs.reduce((sum, output) => sum + output.latency, 0) /
        modelOutputs.length
      : 0;

  return {
    model,
    up,
    down,
    unsure,
    reviewedCount,
    accuracy,
    errorRate,
    avgLatency: Number((avgLatency * 1000).toFixed(2)),
    requestCount: modelOutputs.length,
    latencySeries: buildLatencySeriesFromOutputs(modelOutputs),
    errorSeries: buildErrorSeriesFromOutputs(modelOutputs, votes),
  };
}

function buildCanaryAnalysisGauges(
  stableMetrics: ModelComparisonMetrics | null,
  canaryMetrics: ModelComparisonMetrics | null,
): CanaryAnalysisGauge[] {
  if (!stableMetrics || !canaryMetrics) {
    return [
      {
        key: "latency",
        title: "Latency",
        value: 0,
        tone: "neutral",
        primaryText: "Waiting for data",
        secondaryText: "Need both Stable and Canary model traffic",
      },
      {
        key: "errorRate",
        title: "Error Rate",
        value: 0,
        tone: "neutral",
        primaryText: "Waiting for data",
        secondaryText: "Need reviewed outputs to compare quality",
      },
    ];
  }

  const latencyDeltaPct =
    stableMetrics.avgLatency > 0
      ? ((stableMetrics.avgLatency - canaryMetrics.avgLatency) /
          stableMetrics.avgLatency) *
        100
      : 0;

  const errorDeltaPct =
    stableMetrics.errorRate > 0
      ? ((stableMetrics.errorRate - canaryMetrics.errorRate) /
          stableMetrics.errorRate) *
        100
      : 0;

  const canaryBetterLatency = latencyDeltaPct >= 0;
  const canaryBetterError = errorDeltaPct >= 0;

  return [
    {
      key: "latency",
      title: "Latency",
      value: clamp(Math.abs(latencyDeltaPct), 0, 100),
      tone: canaryBetterLatency ? "good" : "bad",
      primaryText: `${Math.abs(latencyDeltaPct).toFixed(1)}%`,
      secondaryText: canaryBetterLatency ? "Canary is faster" : "Canary is slower",
    },
    {
      key: "errorRate",
      title: "Error Rate",
      value: clamp(Math.abs(errorDeltaPct), 0, 100),
      tone: canaryBetterError ? "good" : "bad",
      primaryText: `${Math.abs(errorDeltaPct).toFixed(1)}%`,
      secondaryText: canaryBetterError
        ? "Canary has lower error"
        : "Canary has higher error",
    },
  ];
}

function buildPath(
  values: number[],
  min: number,
  max: number,
  width: number,
  height: number,
) {
  if (values.length === 0) return "";

  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = index * stepX;
      const ratio = (value - min) / (max - min || 1);
      const y = height - ratio * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function ChartToggle({
  value,
  onChange,
}: {
  value: ChartViewMode;
  onChange: (next: ChartViewMode) => void;
}) {
  const options: Array<{ value: ChartViewMode; label: string }> = [
    { value: "both", label: "Both" },
    { value: "stable", label: "Stable" },
    { value: "canary", label: "Canary" },
  ];

  return (
    <div
      style={{
        display: "inline-flex",
        gap: "0.35rem",
        padding: "0.25rem",
        borderRadius: "999px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
      }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`${styles.viewToggleButton} ${
            value === option.value ? styles.viewToggleButtonActive : ""
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MLineChart({
  title,
  stable,
  canary,
  min,
  max,
  yLabels,
  xLabels,
  viewMode,
  onChangeViewMode,
}: {
  title: string;
  stable: number[];
  canary: number[];
  min: number;
  max: number;
  yLabels: string[];
  xLabels?: string[];
  viewMode: ChartViewMode;
  onChangeViewMode: (next: ChartViewMode) => void;
}) {
  const width = 560;
  const height = 210;

  const showStable = viewMode === "both" || viewMode === "stable";
  const showCanary = viewMode === "both" || viewMode === "canary";

  const stablePath = showStable ? buildPath(stable, min, max, width, height) : "";
  const canaryPath = showCanary ? buildPath(canary, min, max, width, height) : "";

  return (
    <div className={styles.chartPanel}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "0.85rem",
          flexWrap: "wrap",
        }}
      >
        <div className={styles.sectionTitle}>{title}</div>
        <ChartToggle value={viewMode} onChange={onChangeViewMode} />
      </div>

      <div className={styles.chartFrame}>
        <div className={styles.yAxis}>
          {yLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className={styles.chartArea}>
          <div className={styles.gridLines}>
            {yLabels.map((label) => (
              <div key={label} className={styles.gridLine} />
            ))}
          </div>

          <svg
            viewBox={`0 0 ${width} ${height}`}
            className={styles.chartSvg}
            preserveAspectRatio="none"
          >
            {showStable && <path d={stablePath} className={styles.lineStable} />}
            {showCanary && <path d={canaryPath} className={styles.lineCanary} />}
          </svg>

          {xLabels && (
            <div className={styles.xAxis}>
              {xLabels.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  status,
  statusTone,
  metrics,
  dotClassName,
}: {
  title: string;
  status: string;
  statusTone: "blue" | "cyan";
  metrics: Array<{ label: string; value: string }>;
  dotClassName: string;
}) {
  return (
    <div className={styles.modelCard}>
      <div className={styles.modelHeader}>
        <div className={styles.modelTitleWrap}>
          <span className={`${styles.modelDot} ${dotClassName}`} />
          <div className={styles.modelTitle}>{title}</div>
        </div>

        <span
          className={`${styles.statusBadge} ${
            statusTone === "blue" ? styles.statusBlue : styles.statusCyan
          }`}
        >
          {status}
        </span>
      </div>

      <div className={styles.metricGrid}>
        {metrics.map((metric) => (
          <div key={metric.label} className={styles.metricBox}>
            <div className={styles.metricLabel}>{metric.label}</div>
            <div className={styles.metricValueRow}>
              <span className={styles.metricValue}>{metric.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalysisDonut({
  title,
  value,
  tone,
  primaryText,
  secondaryText,
}: CanaryAnalysisGauge) {
  return (
    <div className={styles.analysisGaugeCard}>
      <div className={styles.analysisGaugeTitle}>{title}</div>

      <div
        className={`${styles.analysisDonut} ${
          tone === "good"
            ? styles.analysisDonutGood
            : tone === "bad"
              ? styles.analysisDonutBad
              : styles.analysisDonutNeutral
        }`}
        style={{ "--p": value } as CSSProperties}
        data-value={primaryText}
      />

      <div
        className={`${styles.analysisGaugeText} ${
          tone === "good"
            ? styles.analysisItemGood
            : tone === "bad"
              ? styles.analysisItemBad
              : styles.analysisItemNeutral
        }`}
      >
        {secondaryText}
      </div>
    </div>
  );
}

export default function ModelDeployment({ projectId }: { projectId: string }) {
  const pathname = usePathname();

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

  const [targetCanaryPercent, setTargetCanaryPercent] = useState(30);
  const [displayCanaryPercent, setDisplayCanaryPercent] = useState(30);
  const [isDragging, setIsDragging] = useState(false);

  const [editingField, setEditingField] = useState<"stable" | "canary" | null>(
    null,
  );
  const [editValue, setEditValue] = useState("");
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [isNoModelsModalOpen, setIsNoModelsModalOpen] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [loadButtonState, setLoadButtonState] =
    useState<LoadButtonState>("idle");

  const [latencyChartView, setLatencyChartView] =
    useState<ChartViewMode>("both");
  const [errorChartView, setErrorChartView] =
    useState<ChartViewMode>("both");

  const [modelStatuses, setModelStatuses] = useState<
    Record<string, ModelStatus>
  >({});
  const [hasHydratedStatuses, setHasHydratedStatuses] = useState(false);

  const [data, setData] = useState<EngineOutput[]>([]);
  const [feedbackVotes, setFeedbackVotes] = useState<FeedbackVote[]>([]);

  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const stableInputRef = useRef<HTMLInputElement | null>(null);
  const canaryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(modelTrafficSplitKey(currentProjectId));
      if (!stored) return;

      const parsed = Number(stored);
      const clamped = Number.isFinite(parsed) ? clamp(parsed, 0, 100) : 30;

      setTargetCanaryPercent(clamped);
      setDisplayCanaryPercent(clamped);
    } catch {
      // ignore storage errors
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setHasHydratedStatuses(false);

    const storedStatuses = readModelStatuses(currentProjectId);
    setModelStatuses(storedStatuses);

    const handleStatusesUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{
        projectId?: string;
        statuses?: Record<string, ModelStatus>;
      }>;

      if (customEvent.detail?.projectId !== currentProjectId) return;
      setModelStatuses(customEvent.detail.statuses ?? {});
    };

    window.addEventListener(
      MODEL_STATUS_UPDATED_EVENT,
      handleStatusesUpdated as EventListener,
    );

    setHasHydratedStatuses(true);

    return () => {
      window.removeEventListener(
        MODEL_STATUS_UPDATED_EVENT,
        handleStatusesUpdated as EventListener,
      );
    };
  }, [currentProjectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(
        modelTrafficSplitKey(currentProjectId),
        String(targetCanaryPercent),
      );

      window.dispatchEvent(
        new CustomEvent(TRAFFIC_SPLIT_UPDATED_EVENT, {
          detail: {
            projectId: currentProjectId,
            canaryPercent: targetCanaryPercent,
          },
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [currentProjectId, targetCanaryPercent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasHydratedStatuses) return;

    try {
      localStorage.setItem(
        modelStatusesKey(currentProjectId),
        JSON.stringify(modelStatuses),
      );

      window.dispatchEvent(
        new CustomEvent(MODEL_STATUS_UPDATED_EVENT, {
          detail: {
            projectId: currentProjectId,
            statuses: modelStatuses,
          },
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [modelStatuses, currentProjectId, hasHydratedStatuses]);

  useEffect(() => {
    let active = true;

    const refreshComparison = async () => {
      try {
        const [results, votes] = await Promise.all([
          fetchEngineOutputs(currentProjectId),
          fetchFeedbackVotes(currentProjectId),
        ]);

        if (!active) return;
        setData(results);
        setFeedbackVotes(votes);
      } catch {
        if (!active) return;
        setData([]);
        setFeedbackVotes([]);
      }
    };

    refreshComparison();
    const id = setInterval(refreshComparison, 10000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [currentProjectId]);

  const stableModelName = useMemo(() => {
    const entry = Object.entries(modelStatuses).find(
      ([, status]) => status === "Stable",
    );
    return entry?.[0] ?? "None";
  }, [modelStatuses]);

  const canaryModelName = useMemo(() => {
    const entry = Object.entries(modelStatuses).find(
      ([, status]) => status === "Canary",
    );
    return entry?.[0] ?? "None";
  }, [modelStatuses]);

  const hasStableModel = stableModelName !== "None";
  const hasCanaryModel = canaryModelName !== "None";

  const stableMetrics = useMemo(() => {
    if (!hasStableModel) return null;
    return computeModelMetrics(stableModelName, data, feedbackVotes);
  }, [hasStableModel, stableModelName, data, feedbackVotes]);

  const canaryMetrics = useMemo(() => {
    if (!hasCanaryModel) return null;
    return computeModelMetrics(canaryModelName, data, feedbackVotes);
  }, [hasCanaryModel, canaryModelName, data, feedbackVotes]);

  const errorXAxisLabels = useMemo(() => {
    const lastStable =
      stableMetrics?.errorSeries[stableMetrics.errorSeries.length - 1]?.idx ?? 0;

    const lastCanary =
      canaryMetrics?.errorSeries[canaryMetrics.errorSeries.length - 1]?.idx ?? 0;

    const max = Math.max(lastStable, lastCanary);

    if (!max) return [];

    const steps = 5;
    return Array.from({ length: steps }, (_, i) =>
      Math.round((i / (steps - 1)) * max).toString(),
    );
  }, [stableMetrics, canaryMetrics]);

  useEffect(() => {
    if (hasCanaryModel && !hasStableModel) {
      setTargetCanaryPercent(100);
      setDisplayCanaryPercent(100);
    }
  }, [hasCanaryModel, hasStableModel]);

  const roundedCanaryPercent = useMemo(
    () => Math.round(displayCanaryPercent),
    [displayCanaryPercent],
  );
  const roundedStablePercent = 100 - roundedCanaryPercent;

  const setCanaryPercentClamped = useCallback((value: number) => {
    setTargetCanaryPercent(clamp(value, 0, 100));
  }, []);

  const updateFromClientX = useCallback((clientX: number) => {
    const track = sliderTrackRef.current;
    if (!track) return;

    const rect = track.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const nextCanary = ratio * 100;

    setTargetCanaryPercent(nextCanary);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setEditingField(null);
    setIsDragging(true);
    updateFromClientX(event.clientX);
  };

  const startEditing = (field: "stable" | "canary") => {
    setEditingField(field);
    setEditValue(
      field === "stable"
        ? String(roundedStablePercent)
        : String(roundedCanaryPercent),
    );
  };

  const commitEdit = useCallback(() => {
    if (editingField === null) return;

    const trimmed = editValue.trim();

    if (trimmed === "") {
      setEditingField(null);
      setEditValue("");
      return;
    }

    const parsed = Number(trimmed);

    if (!Number.isFinite(parsed)) {
      setEditingField(null);
      setEditValue("");
      return;
    }

    const clampedValue = clamp(Math.round(parsed), 0, 100);

    if (editingField === "canary") {
      setCanaryPercentClamped(clampedValue);
    } else {
      setCanaryPercentClamped(100 - clampedValue);
    }

    setEditingField(null);
    setEditValue("");
  }, [editValue, editingField, setCanaryPercentClamped]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue("");
  }, []);

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commitEdit();
      return;
    }

    if (event.key === "Escape") {
      cancelEdit();
    }
  };

  const promoteCanaryToStable = useCallback(() => {
    setModelStatuses((prev) => {
      const nextStatuses: Record<string, ModelStatus> = { ...prev };

      const currentCanaryEntry = Object.entries(nextStatuses).find(
        ([, status]) => status === "Canary",
      );

      if (!currentCanaryEntry) {
        return prev;
      }

      const [currentCanaryModelName] = currentCanaryEntry;

      Object.keys(nextStatuses).forEach((key) => {
        if (nextStatuses[key] === "Stable") {
          nextStatuses[key] = "Archived";
        }
      });

      nextStatuses[currentCanaryModelName] = "Stable";
      return nextStatuses;
    });

    setCanaryPercentClamped(0);
    setIsPromoteModalOpen(false);
  }, [setCanaryPercentClamped]);

  const rollbackToStableOnly = useCallback(() => {
    setModelStatuses((prev) => {
      const nextStatuses: Record<string, ModelStatus> = { ...prev };

      const currentCanaryEntry = Object.entries(nextStatuses).find(
        ([, status]) => status === "Canary",
      );

      if (!currentCanaryEntry) {
        return prev;
      }

      const [currentCanaryModelName] = currentCanaryEntry;
      nextStatuses[currentCanaryModelName] = "Archived";

      return nextStatuses;
    });

    setCanaryPercentClamped(0);
  }, [setCanaryPercentClamped]);

  const handleStartSession = useCallback(async () => {
    if (isStartingSession) return;

    if (!hasStableModel && !hasCanaryModel) {
      setIsNoModelsModalOpen(true);
      return;
    }

    let stableModel: string | null = null;
    let canaryModel: string | null = null;
    let stablePercent = 0;
    let canaryPercent = 0;

    if (hasStableModel && hasCanaryModel) {
      stableModel = stableModelName;
      canaryModel = canaryModelName;
      stablePercent = roundedStablePercent;
      canaryPercent = roundedCanaryPercent;
    } else if (hasStableModel) {
      stableModel = stableModelName;
      stablePercent = 100;
    } else if (hasCanaryModel) {
      canaryModel = canaryModelName;
      canaryPercent = 100;
    }

    try {
      setIsStartingSession(true);
      setLoadButtonState("loading");

      const response = await fetch("http://localhost:8080/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: START_SESSION_MUTATION,
          variables: {
            projectId: currentProjectId,
            stableModel,
            canaryModel,
            stablePercent,
            canaryPercent,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Start session failed with status ${response.status}`);
      }

      const json = await response.json();

      if (json.errors?.length) {
        throw new Error(
          json.errors[0].message || "GraphQL startSession failed",
        );
      }

      console.log("Active session saved:", json.data?.startSession);

      setLoadButtonState("loaded");
    } catch (error) {
      console.error("Failed to start session:", error);
      setLoadButtonState("idle");
    } finally {
      setIsStartingSession(false);
    }
  }, [
    isStartingSession,
    hasStableModel,
    hasCanaryModel,
    currentProjectId,
    stableModelName,
    canaryModelName,
    roundedStablePercent,
    roundedCanaryPercent,
  ]);

  useEffect(() => {
    if (editingField === "stable") {
      stableInputRef.current?.focus();
      stableInputRef.current?.select();
    } else if (editingField === "canary") {
      canaryInputRef.current?.focus();
      canaryInputRef.current?.select();
    }
  }, [editingField]);

  useEffect(() => {
    const animate = () => {
      setDisplayCanaryPercent((current) => {
        const diff = targetCanaryPercent - current;

        if (Math.abs(diff) < 0.05) {
          return targetCanaryPercent;
        }

        return current + diff * 0.18;
      });

      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetCanaryPercent]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      updateFromClientX(event.clientX);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, updateFromClientX]);

  useEffect(() => {
    if (!isPromoteModalOpen) return;

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPromoteModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isPromoteModalOpen]);

  useEffect(() => {
    if (!isNoModelsModalOpen) return;

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNoModelsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isNoModelsModalOpen]);

  useEffect(() => {
    setLoadButtonState("idle");
  }, [
    stableModelName,
    canaryModelName,
    roundedStablePercent,
    roundedCanaryPercent,
  ]);

  const latencyStable = useMemo(
    () => stableMetrics?.latencySeries.map((point) => point.value) ?? [],
    [stableMetrics],
  );

  const latencyCanary = useMemo(
    () => canaryMetrics?.latencySeries.map((point) => point.value) ?? [],
    [canaryMetrics],
  );

  const errorStable = useMemo(
    () => stableMetrics?.errorSeries.map((point) => point.value) ?? [],
    [stableMetrics],
  );

  const errorCanary = useMemo(
    () => canaryMetrics?.errorSeries.map((point) => point.value) ?? [],
    [canaryMetrics],
  );

  const allLatencyValues = [...latencyStable, ...latencyCanary].filter(
    (value) => value > 0,
  );

  const latencyMin = allLatencyValues.length
    ? Math.max(0, Math.floor(Math.min(...allLatencyValues) - 5))
    : 0;

  const latencyMax = allLatencyValues.length
    ? Math.ceil(Math.max(...allLatencyValues) + 5)
    : 50;

  const canaryAnalysisGauges = useMemo(() => {
    return buildCanaryAnalysisGauges(stableMetrics, canaryMetrics);
  }, [stableMetrics, canaryMetrics]);

  return (
    <>
      <div className={styles.shell}>
        <div className={styles.page} data-project-id={currentProjectId}>
          <div className={styles.headerBlock}>
            <h1 className={styles.pageTitle}>
              {projectName ?? currentProjectId}
            </h1>
            <p className={styles.pageSubtitle}>Model Deployment</p>
          </div>

          <div className={styles.trafficCard}>
            <div className={styles.trafficHeader}>
              <div className={styles.sectionTitle}>Target Traffic Distribution</div>

              <button
                type="button"
                className={styles.startSessionBtn}
                onClick={handleStartSession}
                disabled={loadButtonState !== "idle"}
              >
                {loadButtonState === "loading"
                  ? "Loading..."
                  : loadButtonState === "loaded"
                    ? "Models Loaded"
                    : "Load Models"}
              </button>
            </div>

            <div className={styles.legendRow}>
              <div className={styles.legendItem}>
                <span
                  className={`${styles.legendDot} ${styles.legendStable}`}
                />
                <span className={styles.legendLabel}>Stable Model</span>

                <div className={styles.percentSlot}>
                  {editingField === "stable" ? (
                    <input
                      ref={stableInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={editValue}
                      onChange={(event) => {
                        const digitsOnly = event.target.value.replace(
                          /\D/g,
                          "",
                        );
                        setEditValue(digitsOnly);
                      }}
                      onBlur={commitEdit}
                      onKeyDown={handleEditKeyDown}
                      className={styles.percentInput}
                      aria-label="Stable traffic percentage"
                    />
                  ) : (
                    <button
                      type="button"
                      className={styles.percentButton}
                      onClick={() => startEditing("stable")}
                    >
                      {roundedStablePercent}%
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.legendDivider} />

              <div className={styles.legendItem}>
                <span
                  className={`${styles.legendDot} ${styles.legendCanary}`}
                />
                <span className={styles.legendLabel}>Canary Model</span>

                <div className={styles.percentSlot}>
                  {editingField === "canary" ? (
                    <input
                      ref={canaryInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={editValue}
                      onChange={(event) => {
                        const digitsOnly = event.target.value.replace(
                          /\D/g,
                          "",
                        );
                        setEditValue(digitsOnly);
                      }}
                      onBlur={commitEdit}
                      onKeyDown={handleEditKeyDown}
                      className={styles.percentInput}
                      aria-label="Canary traffic percentage"
                    />
                  ) : (
                    <button
                      type="button"
                      className={styles.percentButton}
                      onClick={() => startEditing("canary")}
                    >
                      {roundedCanaryPercent}%
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.sliderWrap}>
              <div
                ref={sliderTrackRef}
                className={styles.sliderTrack}
                onPointerDown={handlePointerDown}
                role="slider"
                aria-label="Canary traffic percentage"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(targetCanaryPercent)}
              >
                <div
                  className={styles.sliderStableFill}
                  style={{ width: `${displayCanaryPercent}%` }}
                />
                <div
                  className={styles.sliderCanaryFill}
                  style={{ left: `${displayCanaryPercent}%` }}
                />
                <div
                  className={styles.sliderThumb}
                  style={{ left: `${displayCanaryPercent}%` }}
                />
              </div>

              <div className={styles.sliderLabels}>
                <span>All traffic to Stable</span>
                <span>All traffic to Canary</span>
              </div>
            </div>

            <div className={styles.presetRow}>
              <button
                type="button"
                className={styles.presetBtn}
                onClick={() => setCanaryPercentClamped(0)}
              >
                100% Stable
              </button>
              <button
                type="button"
                className={styles.presetBtn}
                onClick={() => setCanaryPercentClamped(10)}
              >
                10% Canary
              </button>
              <button
                type="button"
                className={styles.presetBtn}
                onClick={() => setCanaryPercentClamped(30)}
              >
                30% Canary
              </button>
              <button
                type="button"
                className={styles.presetBtn}
                onClick={() => setCanaryPercentClamped(50)}
              >
                50% Canary
              </button>
            </div>
          </div>

          <div className={styles.twoCol}>
            <StatCard
              title={`Stable Model - ${stableModelName}`}
              status="Production"
              statusTone="blue"
              dotClassName={styles.dotStable}
              metrics={[
                {
                  label: "Inferences",
                  value: stableMetrics ? `${stableMetrics.requestCount}` : "-",
                },
                {
                  label: "Avg Latency",
                  value: stableMetrics
                    ? `${stableMetrics.avgLatency.toFixed(2)} ms`
                    : "-",
                },
                {
                  label: "Error Rate",
                  value: stableMetrics
                    ? `${(stableMetrics.errorRate * 100).toFixed(1)}%`
                    : "-",
                },
                {
                  label: "Predictions Reviewed",
                  value: stableMetrics ? `${stableMetrics.reviewedCount}` : "-",
                },
              ]}
            />

            <StatCard
              title={`Canary Model - ${canaryModelName}`}
              status="Testing"
              statusTone="cyan"
              dotClassName={styles.dotCanary}
              metrics={[
                {
                  label: "Inferences",
                  value: canaryMetrics ? `${canaryMetrics.requestCount}` : "-",
                },
                {
                  label: "Avg Latency",
                  value: canaryMetrics
                    ? `${canaryMetrics.avgLatency.toFixed(2)} ms`
                    : "-",
                },
                {
                  label: "Error Rate",
                  value: canaryMetrics
                    ? `${(canaryMetrics.errorRate * 100).toFixed(1)}%`
                    : "-",
                },
                {
                  label: "Predictions Reviewed",
                  value: canaryMetrics ? `${canaryMetrics.reviewedCount}` : "-",
                },
              ]}
            />
          </div>

          <div className={styles.twoCol}>
            <MLineChart
              title="Latency Comparison"
              stable={latencyStable}
              canary={latencyCanary}
              min={latencyMin}
              max={latencyMax}
              yLabels={[
                String(latencyMax),
                String(Math.round((latencyMax * 2 + latencyMin) / 3)),
                String(Math.round((latencyMax + latencyMin * 2) / 3)),
                String(latencyMin),
              ]}
              viewMode={latencyChartView}
              onChangeViewMode={setLatencyChartView}
            />

            <MLineChart
              title="Error Rate Comparison"
              stable={errorStable}
              canary={errorCanary}
              min={0}
              max={1}
              yLabels={["1", "0.75", "0.5", "0.25", "0"]}
              xLabels={errorXAxisLabels}
              viewMode={errorChartView}
              onChangeViewMode={setErrorChartView}
            />
          </div>

          <ModelPerformance
            projectId={currentProjectId}
            stableModelName={stableModelName}
            canaryModelName={canaryModelName}
            hasStableModel={hasStableModel}
            hasCanaryModel={hasCanaryModel}
          />

          <div className={styles.twoColBottom}>
            <div className={styles.analysisCard}>
              <div className={styles.analysisTitle}>
                Canary Performance Analysis
              </div>

              <div className={styles.analysisGaugeGrid}>
                {canaryAnalysisGauges.map((gauge) => {
                  const { key, ...rest } = gauge;
                  return <AnalysisDonut key={key} {...rest} />;
                })}
              </div>
            </div>

            <div className={styles.actionsCard}>
              <div className={styles.sectionTitle}>Deployment Actions</div>

              <button
                type="button"
                className={styles.promoteBtn}
                onClick={() => setIsPromoteModalOpen(true)}
                disabled={!hasCanaryModel}
              >
                <span>✓ Promote Canary to Stable</span>
                <span className={styles.actionMeta}>
                  {hasCanaryModel
                    ? `${canaryModelName} → Production`
                    : "No Canary Model"}
                </span>
              </button>

              <button
                type="button"
                className={styles.rollbackBtn}
                onClick={rollbackToStableOnly}
                disabled={!hasCanaryModel}
              >
                <span>⚠ Rollback to Stable Only</span>
                <span className={styles.actionMeta}>
                  {hasCanaryModel
                    ? `Disable Canary (${canaryModelName})`
                    : "No Canary Model"}
                </span>
              </button>

              <div className={styles.infoNotice}>
                ⓘ Actions will affect live traffic. Current split:{" "}
                {roundedStablePercent}% Stable, {roundedCanaryPercent}% Canary
              </div>
            </div>
          </div>
        </div>
      </div>

      {isPromoteModalOpen && (
        <div
          className={styles.confirmOverlay}
          onClick={() => setIsPromoteModalOpen(false)}
        >
          <div
            className={styles.confirmModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmTitle}>Promote Canary Model</div>

            <div className={styles.confirmText}>
              Are you sure you want to promote the current Canary Model to
              stable? This will archive the current Stable Model.
            </div>

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmPrimaryBtn}
                onClick={promoteCanaryToStable}
              >
                Promote
              </button>

              <button
                type="button"
                className={styles.confirmSecondaryBtn}
                onClick={() => setIsPromoteModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isNoModelsModalOpen && (
        <div
          className={styles.confirmOverlay}
          onClick={() => setIsNoModelsModalOpen(false)}
        >
          <div
            className={styles.confirmModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmTitle}>No Models Selected</div>

            <div className={styles.confirmText}>
              Please assign at least one model as Stable or Canary before
              loading models.
            </div>

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmPrimaryBtn}
                onClick={() => setIsNoModelsModalOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}