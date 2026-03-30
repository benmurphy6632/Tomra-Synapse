"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { usePathname } from "next/navigation";
import styles from "./ImageClassification.module.css";
import sortStyles from "./ImageClassSort.module.css";
import GridMode from "./GridMode";
import { fetchEngineOutputs, type EngineOutput } from "@/api/EngineOutput";
import { loadProjects } from "@/lib/projectsStore";

type ModelStatus = "Stable" | "Canary" | "Archived";
type SampleTarget = "Stable" | "Canary";
type ViewMode = "table" | "grid";
type SampleCountOption = 10 | 25 | 50 | 100 | "typed";
type ModelFilter = "All" | "Stable" | "Canary";
type FeedbackFilter = "up" | "down" | "unsure" | null;

const STORAGE_PREFIX = "modelVersions";
const IMAGE_CLASSIFICATION_FILTER_KEY = "imageClassificationInitialFilter";

function votesStorageKey(projectId: string) {
  return `grid_votes_v2::${projectId}`;
}

function storageKey(projectId: string, section: string) {
  return `${STORAGE_PREFIX}:${projectId}:${section}`;
}

const MODEL_STATUS_UPDATED_EVENT = "model-statuses-updated";
const POLL_INTERVAL_MS = 2000;

const SAMPLE_TARGET_OPTIONS: Array<{
  value: SampleTarget;
  label: string;
}> = [
  { value: "Stable", label: "Stable" },
  { value: "Canary", label: "Canary" },
];

const SAMPLE_COUNT_OPTIONS: SampleCountOption[] = [10, 25, 50, 100, "typed"];

function classificationRowsKey(projectId: string) {
  return `classificationRows:${projectId}`;
}

function classificationLoadedKey(projectId: string) {
  return `classificationLoaded:${projectId}`;
}

function classificationTotalKey(projectId: string) {
  return `classificationTotal:${projectId}`;
}

function getActiveModelName(
  statuses: Record<string, ModelStatus>,
  targetStatus: "Stable" | "Canary"
) {
  return (
    Object.entries(statuses).find(([, status]) => status === targetStatus)?.[0] ??
    "N/A"
  );
}

function buildRowKey(row: EngineOutput) {
  return [
    row.deviceId ?? "",
    row.imageName ?? "",
    row.predictedLabel ?? "",
    row.confidence ?? "",
    row.model ?? "",
    row.classId ?? "",
    row.imageURL ?? "",
  ].join("::");
}

function mergeUniqueRows(
  existingRows: EngineOutput[],
  incomingRows: EngineOutput[]
) {
  const seen = new Set(existingRows.map(buildRowKey));
  const appended: EngineOutput[] = [];

  for (const row of incomingRows) {
    const key = buildRowKey(row);
    if (!seen.has(key)) {
      seen.add(key);
      appended.push(row);
    }
  }

  return {
    mergedRows: [...existingRows, ...appended],
    newCount: appended.length,
  };
}

function shuffleRows(rows: EngineOutput[]) {
  const copy = [...rows];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function formatPredictedLabel(label?: string) {
  if (!label) return "";
  return label
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getVoteKey(projectId: string, row: EngineOutput) {
  return `${String(projectId).trim()}::${String(row.id)}`;
}

export default function ImageClassification({
  projectId,
}: {
  projectId: string;
}) {
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

  const [rows, setRows] = useState<EngineOutput[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelStatuses, setModelStatuses] = useState<Record<string, ModelStatus>>(
    {}
  );

  const [reviewedOnly, setReviewedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [sampleTarget, setSampleTarget] = useState<SampleTarget>("Stable");
  const [sampleTargetMenuOpen, setSampleTargetMenuOpen] = useState(false);
  const [sampleCountOption, setSampleCountOption] =
    useState<SampleCountOption>(10);
  const [customSampleCount, setCustomSampleCount] = useState("");
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sampleRows, setSampleRows] = useState<EngineOutput[] | null>(null);
  const [activeSample, setActiveSample] = useState<{
    role: SampleTarget;
    modelName: string;
    count: number;
  } | null>(null);
  const [modelFilter, setModelFilter] = useState<ModelFilter>("All");
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilter>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const pollingRef = useRef(false);
  const targetDropdownRef = useRef<HTMLDivElement | null>(null);
  const targetButtonRef = useRef<HTMLButtonElement | null>(null);
  const targetOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const loaded = localStorage.getItem(
        classificationLoadedKey(currentProjectId)
      );
      const storedRows = localStorage.getItem(
        classificationRowsKey(currentProjectId)
      );

      if (loaded === "true" && storedRows) {
        const parsed = JSON.parse(storedRows) as EngineOutput[];
        const safeRows = Array.isArray(parsed) ? parsed : [];

        setRows(safeRows);
        localStorage.setItem(
          classificationTotalKey(currentProjectId),
          String(safeRows.length)
        );
      } else {
        setRows([]);
        localStorage.setItem(classificationTotalKey(currentProjectId), "0");
      }
    } catch {
      setRows([]);
      localStorage.setItem(classificationTotalKey(currentProjectId), "0");
    }
  }, [currentProjectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedFilter = sessionStorage.getItem(
      IMAGE_CLASSIFICATION_FILTER_KEY
    );

    if (
      savedFilter === "All" ||
      savedFilter === "Stable" ||
      savedFilter === "Canary"
    ) {
      setModelFilter(savedFilter);
      setViewMode("grid");
      sessionStorage.removeItem(IMAGE_CLASSIFICATION_FILTER_KEY);
    }

    setReviewedOnly(false);
    setSampleRows(null);
    setActiveSample(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const statusesKey = storageKey(currentProjectId, "statuses");

    const loadStatuses = () => {
      try {
        const storedStatuses = localStorage.getItem(statusesKey);
        setModelStatuses(storedStatuses ? JSON.parse(storedStatuses) : {});
      } catch {
        setModelStatuses({});
      }
    };

    loadStatuses();

    const handleStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        projectId?: string;
        statuses?: Record<string, ModelStatus>;
      }>;

      if (customEvent.detail?.projectId === currentProjectId) {
        setModelStatuses(customEvent.detail.statuses ?? {});
      } else {
        loadStatuses();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === statusesKey) {
        loadStatuses();
      }
    };

    window.addEventListener(MODEL_STATUS_UPDATED_EVENT, handleStatusUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(MODEL_STATUS_UPDATED_EVENT, handleStatusUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [currentProjectId]);

  useEffect(() => {
    if (!sampleTargetMenuOpen) return;

    const selectedIndex = SAMPLE_TARGET_OPTIONS.findIndex(
      (option) => option.value === sampleTarget
    );
    const target =
      targetOptionRefs.current[selectedIndex] ?? targetOptionRefs.current[0];
    target?.focus();
  }, [sampleTargetMenuOpen, sampleTarget]);

  useEffect(() => {
    if (!sampleTargetMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!targetDropdownRef.current) return;
      if (!targetDropdownRef.current.contains(event.target as Node)) {
        setSampleTargetMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSampleTargetMenuOpen(false);
        targetButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [sampleTargetMenuOpen]);

  useEffect(() => {
    if (!sortMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!sortMenuRef.current) return;
      if (!sortMenuRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSortMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [sortMenuOpen]);

  const syncRows = useCallback(
    async (showSpinner = false) => {
      if (pollingRef.current) return;

      pollingRef.current = true;

      if (showSpinner) {
        setLoading(true);
      } else {
        setIsSyncing(true);
      }

      try {
        setError(null);

        const incomingRows = await fetchEngineOutputs(currentProjectId);

        let nextRows: EngineOutput[] = [];
        let newCount = 0;

        setRows((prevRows) => {
          const result = mergeUniqueRows(prevRows, incomingRows);
          nextRows = result.mergedRows;
          newCount = result.newCount;
          return result.mergedRows;
        });

        if (typeof window !== "undefined") {
          const storedRowsRaw = localStorage.getItem(
            classificationRowsKey(currentProjectId)
          );
          const storedRows = storedRowsRaw
            ? ((JSON.parse(storedRowsRaw) as EngineOutput[]) ?? [])
            : [];

          const storedMerge = mergeUniqueRows(storedRows, incomingRows);

          localStorage.setItem(
            classificationRowsKey(currentProjectId),
            JSON.stringify(storedMerge.mergedRows)
          );
          localStorage.setItem(classificationLoadedKey(currentProjectId), "true");
          localStorage.setItem(
            classificationTotalKey(currentProjectId),
            String(storedMerge.mergedRows.length)
          );

          window.dispatchEvent(
            new CustomEvent("classification-data-updated", {
              detail: {
                projectId: currentProjectId,
                added: newCount,
                rows: nextRows,
                total: storedMerge.mergedRows.length,
              },
            })
          );
        }
      } catch {
        setError("Failed to fetch classification results.");
      } finally {
        pollingRef.current = false;
        setLoading(false);
        setIsSyncing(false);
      }
    },
    [currentProjectId]
  );

  useEffect(() => {
    syncRows(true);

    const interval = window.setInterval(() => {
      syncRows(false);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [syncRows]);

  const stats = useMemo(() => {
    const avgConf =
      rows.length === 0
        ? 0
        : rows.reduce((s, r) => s + r.confidence, 0) / rows.length;

    return {
      lastBatch: rows.length,
      avgConf,
      activeStableModel: getActiveModelName(modelStatuses, "Stable"),
      activeCanaryModel: getActiveModelName(modelStatuses, "Canary"),
    };
  }, [rows, modelStatuses]);

  const displayedRows = useMemo(() => {
    let sourceRows = sampleRows ?? rows;

    let votes: Record<string, string | null> = {};

    if (typeof window !== "undefined") {
      try {
        const storedVotes = localStorage.getItem(
          votesStorageKey(currentProjectId)
        );
        votes = storedVotes ? JSON.parse(storedVotes) : {};
      } catch {
        votes = {};
      }
    }

    if (modelFilter === "Stable" || modelFilter === "Canary") {
      const targetModelName =
        modelFilter === "Stable"
          ? stats.activeStableModel
          : stats.activeCanaryModel;

      if (!targetModelName || targetModelName === "N/A") {
        return [];
      }

      sourceRows = sourceRows.filter((row) => row.model === targetModelName);
    }

    if (feedbackFilter) {
      sourceRows = sourceRows.filter((row) => {
        const key = getVoteKey(currentProjectId, row);
        return votes[key] === feedbackFilter;
      });
    }

    if (!reviewedOnly || typeof window === "undefined") {
      return sourceRows;
    }

    return sourceRows.filter((row) => {
      const key = getVoteKey(currentProjectId, row);
      return votes[key] !== undefined && votes[key] !== null;
    });
  }, [
    sampleRows,
    rows,
    modelFilter,
    reviewedOnly,
    stats.activeStableModel,
    stats.activeCanaryModel,
    currentProjectId,
    feedbackFilter,
  ]);

  const confidenceClass = (conf: number) => {
    const pct = conf * 100;
    if (pct >= 85) return styles.confHigh;
    if (pct >= 70) return styles.confGood;
    if (pct >= 50) return styles.confWarn;
    return styles.confLow;
  };

  const openSampleModal = () => {
    setSampleError(null);
    setSampleTarget("Stable");
    setSampleTargetMenuOpen(false);
    setSampleCountOption(10);
    setCustomSampleCount("");
    setSampleModalOpen(true);
  };

  const closeSampleModal = () => {
    setSampleModalOpen(false);
    setSampleTargetMenuOpen(false);
    setSampleError(null);
  };

  const clearSample = () => {
    setSampleRows(null);
    setActiveSample(null);
  };

  const getRequestedSampleCount = () => {
    if (sampleCountOption === "typed") {
      return Number.parseInt(customSampleCount, 10);
    }

    return sampleCountOption;
  };

  const handleSelectSampleTarget = (nextValue: SampleTarget) => {
    setSampleTarget(nextValue);
    setSampleTargetMenuOpen(false);
    targetButtonRef.current?.focus();
  };

  const handleTargetButtonKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>
  ) => {
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setSampleTargetMenuOpen(true);
    }
  };

  const handleTargetOptionKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (index + 1) % SAMPLE_TARGET_OPTIONS.length;
      targetOptionRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex =
        (index - 1 + SAMPLE_TARGET_OPTIONS.length) % SAMPLE_TARGET_OPTIONS.length;
      targetOptionRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      targetOptionRefs.current[0]?.focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      targetOptionRefs.current[SAMPLE_TARGET_OPTIONS.length - 1]?.focus();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setSampleTargetMenuOpen(false);
      targetButtonRef.current?.focus();
    }
  };

  const applySample = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const targetModelName =
      sampleTarget === "Stable"
        ? stats.activeStableModel
        : stats.activeCanaryModel;

    if (!targetModelName || targetModelName === "N/A") {
      setSampleError(`No active ${sampleTarget.toLowerCase()} model is set.`);
      return;
    }

    const requestedCount = getRequestedSampleCount();

    if (!Number.isFinite(requestedCount) || requestedCount < 1) {
      setSampleError("Please enter a valid number of images.");
      return;
    }

    const eligibleRows = rows.filter((row) => {
      return (
        row.model === targetModelName && (row.imageURL ?? "").trim() !== ""
      );
    });

    if (eligibleRows.length === 0) {
      setSampleError(
        `No classified images are currently available for ${targetModelName}.`
      );
      return;
    }

    const actualCount = Math.min(requestedCount, eligibleRows.length);
    const nextSample = shuffleRows(eligibleRows).slice(0, actualCount);

    setSampleRows(nextSample);
    setActiveSample({
      role: sampleTarget,
      modelName: targetModelName,
      count: actualCount,
    });
    setViewMode("grid");
    setSampleModalOpen(false);
    setSampleTargetMenuOpen(false);
    setSampleError(null);
  };

  const selectedTargetLabel =
    SAMPLE_TARGET_OPTIONS.find((option) => option.value === sampleTarget)?.label ??
    "Stable";

  const selectedFilterLabel =
    modelFilter === "All"
      ? "All Models"
      : modelFilter === "Stable"
      ? "Stable Model"
      : "Canary Model";

  const toolbarActions = (
    <>
      <div className={sortStyles.sortWrap} ref={sortMenuRef}>
        <span className={sortStyles.sortLabel}>Sort by</span>

        <div className={sortStyles.dropdown}>
          <button
            type="button"
            className={sortStyles.sortButton}
            onClick={() => setSortMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={sortMenuOpen}
          >
            <span className={sortStyles.sortButtonText}>
              {selectedFilterLabel}
            </span>
            <span
              className={`${sortStyles.chevron} ${
                sortMenuOpen ? sortStyles.chevronOpen : ""
              }`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>

          {sortMenuOpen && (
            <div className={sortStyles.menu} role="menu">
              <button
                type="button"
                className={`${sortStyles.option} ${
                  modelFilter === "All" ? sortStyles.optionSelected : ""
                }`}
                onClick={() => {
                  setModelFilter("All");
                  setSortMenuOpen(false);
                }}
              >
                <span>All Models</span>
                {modelFilter === "All" && (
                  <span className={sortStyles.checkmark}>✓</span>
                )}
              </button>

              <button
                type="button"
                className={`${sortStyles.option} ${
                  modelFilter === "Stable" ? sortStyles.optionSelected : ""
                }`}
                onClick={() => {
                  setModelFilter("Stable");
                  setSortMenuOpen(false);
                }}
              >
                <span>Stable Model</span>
                {modelFilter === "Stable" && (
                  <span className={sortStyles.checkmark}>✓</span>
                )}
              </button>

              <button
                type="button"
                className={`${sortStyles.option} ${
                  modelFilter === "Canary" ? sortStyles.optionSelected : ""
                }`}
                onClick={() => {
                  setModelFilter("Canary");
                  setSortMenuOpen(false);
                }}
              >
                <span>Canary Model</span>
                {modelFilter === "Canary" && (
                  <span className={sortStyles.checkmark}>✓</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className={styles.reviewSampleBtn}
        onClick={openSampleModal}
      >
        Review Sample
      </button>

      {activeSample && (
        <button
          type="button"
          className={styles.clearSampleBtn}
          onClick={clearSample}
        >
          Clear Sample
        </button>
      )}
    </>
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.shell}>
        <div className={styles.page}>
          <div className={styles.wrapper}>
            <div className={styles.pageHeaderBlock}>
              <h1 className={styles.pageTitle}>
                {projectName ?? currentProjectId}
              </h1>
              <p className={styles.pageSubtitle}>Image Classification</p>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.card}>
                <div className={styles.cardLabel}>Classified</div>
                <div className={styles.cardValueCyan}>
                  {stats.lastBatch} images
                </div>
                <div className={styles.cardSub}>from edge devices</div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardLabel}>Avg Confidence</div>
                <div className={styles.cardValueGreen}>
                  {(stats.avgConf * 100).toFixed(1)}%
                </div>
                <div className={styles.cardSub}>across all results</div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardLabel}>Active Stable Model</div>
                <div className={styles.cardValueWhite}>
                  {stats.activeStableModel}
                </div>
                <div className={styles.cardSub}>stable deployment target</div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardLabel}>Active Canary Model</div>
                <div className={styles.cardValueWhite}>
                  {stats.activeCanaryModel}
                </div>
                <div className={styles.cardSub}>canary deployment target</div>
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.panelTitle}>Classification Results</div>
                  <div className={styles.panelSubtitle}>
                    Results auto-update while classification is running
                    {isSyncing ? " • syncing..." : ""}
                  </div>
                  {activeSample && (
                    <div className={styles.sampleNotice}>
                      Showing {activeSample.count} random sample
                      {activeSample.count === 1 ? "" : "s"} from{" "}
                      {activeSample.role.toLowerCase()} model{" "}
                      <span className={styles.sampleNoticeModel}>
                        {activeSample.modelName}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <GridMode
                projectId={currentProjectId}
                rows={displayedRows}
                loading={loading}
                error={error}
                mode={viewMode}
                onModeChange={setViewMode}
                feedbackFilter={feedbackFilter}
                onFeedbackFilterChange={(nextFilter) =>
                  setFeedbackFilter((current) =>
                    current === nextFilter ? null : nextFilter
                  )
                }
                extraActions={toolbarActions}
                renderTable={(openPreview) => (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead className={styles.thead}>
                        <tr className={styles.headRow}>
                          <th className={styles.th}>Preview</th>
                          <th className={styles.th}>Device ID</th>
                          <th className={styles.th}>Image Name</th>
                          <th className={styles.th}>Predicted Label</th>
                          <th className={styles.th}>Confidence</th>
                          <th className={styles.th}>Model</th>
                          <th className={styles.th}>Class ID</th>
                        </tr>
                      </thead>

                      <tbody className={styles.tbody}>
                        {displayedRows.map((r, index) => {
                          const imageSrc = (r.imageURL ?? "").trim();
                          const canPreview = imageSrc !== "";
                          const displayLabel = formatPredictedLabel(
                            r.predictedLabel
                          );

                          return (
                            <tr
                              key={`${buildRowKey(r)}-${index}`}
                              className={`${styles.bodyRow} ${
                                canPreview ? styles.clickableRow : ""
                              }`}
                              onClick={
                                canPreview ? () => openPreview(r) : undefined
                              }
                              tabIndex={canPreview ? 0 : -1}
                              onKeyDown={
                                canPreview
                                  ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        openPreview(r);
                                      }
                                    }
                                  : undefined
                              }
                              aria-label={
                                canPreview
                                  ? `Open preview for ${
                                      r.imageName || displayLabel
                                    }`
                                  : undefined
                              }
                            >
                              <td className={styles.td}>
                                {canPreview ? (
                                  <img
                                    src={imageSrc}
                                    alt={r.imageName || displayLabel}
                                    className={styles.previewThumb}
                                    draggable={false}
                                  />
                                ) : (
                                  <div className={styles.previewUnavailable}>
                                    No image
                                  </div>
                                )}
                              </td>

                              <td className={`${styles.td} ${styles.mono}`}>
                                {r.deviceId}
                              </td>
                              <td className={`${styles.td} ${styles.mono}`}>
                                {r.imageName}
                              </td>
                              <td className={`${styles.td} ${styles.linkish}`}>
                                {displayLabel}
                              </td>
                              <td className={styles.td}>
                                <span
                                  className={`${styles.conf} ${confidenceClass(
                                    r.confidence
                                  )}`}
                                >
                                  {(r.confidence * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className={styles.td}>{r.model}</td>
                              <td className={`${styles.td} ${styles.mono}`}>
                                {r.classId}
                              </td>
                            </tr>
                          );
                        })}

                        {displayedRows.length === 0 && !loading && (
                          <tr>
                            <td className={styles.empty} colSpan={7}>
                              {activeSample
                                ? "No sampled images to display."
                                : "No classification results loaded yet."}
                            </td>
                          </tr>
                        )}

                        {loading && displayedRows.length === 0 && (
                          <tr>
                            <td className={styles.empty} colSpan={7}>
                              Loading...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              />

              <div className={styles.panelFooterSpace} />
            </div>
          </div>
        </div>
      </div>

      {sampleModalOpen && (
        <div className={styles.modalOverlay} onClick={closeSampleModal}>
          <div
            className={styles.sampleModal}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.sampleModalHeader}>
              <div>
                <div className={styles.sampleModalTitle}>Review Sample</div>
                <div className={styles.sampleModalSubtitle}>
                  Select a deployment target and sample size
                </div>
              </div>

              <button
                type="button"
                className={styles.sampleModalClose}
                onClick={closeSampleModal}
                aria-label="Close review sample modal"
              >
                ✕
              </button>
            </div>

            <form className={styles.sampleForm} onSubmit={applySample}>
              <div className={styles.sampleField}>
                <span className={styles.sampleLabel}>Model target</span>

                <div
                  className={styles.sampleDropdownWrap}
                  ref={targetDropdownRef}
                >
                  <button
                    ref={targetButtonRef}
                    type="button"
                    className={styles.sampleDropdownButton}
                    onClick={() => setSampleTargetMenuOpen((prev) => !prev)}
                    onKeyDown={handleTargetButtonKeyDown}
                    aria-haspopup="listbox"
                    aria-expanded={sampleTargetMenuOpen}
                    aria-label={`Review sample model target ${selectedTargetLabel}`}
                  >
                    <span className={styles.sampleDropdownButtonText}>
                      {selectedTargetLabel}
                    </span>
                    <span
                      className={`${styles.sampleDropdownChevron} ${
                        sampleTargetMenuOpen
                          ? styles.sampleDropdownChevronOpen
                          : ""
                      }`}
                      aria-hidden="true"
                    >
                      ▾
                    </span>
                  </button>

                  {sampleTargetMenuOpen && (
                    <div
                      className={styles.sampleDropdownMenu}
                      role="listbox"
                      aria-label="Review sample model target"
                    >
                      {SAMPLE_TARGET_OPTIONS.map((option, index) => {
                        const selected = option.value === sampleTarget;

                        return (
                          <button
                            key={option.value}
                            ref={(element) => {
                              targetOptionRefs.current[index] = element;
                            }}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={`${styles.sampleDropdownOption} ${
                              selected
                                ? styles.sampleDropdownOptionSelected
                                : ""
                            }`}
                            onClick={() => handleSelectSampleTarget(option.value)}
                            onKeyDown={(event) =>
                              handleTargetOptionKeyDown(event, index)
                            }
                          >
                            <span>{option.label}</span>
                            {selected && (
                              <span
                                className={styles.sampleDropdownCheckmark}
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.sampleField}>
                <span className={styles.sampleLabel}>Number of images</span>

                <div className={styles.sampleCountRow}>
                  {SAMPLE_COUNT_OPTIONS.filter((option) => option !== "typed").map(
                    (option) => {
                      const selected = option === sampleCountOption;

                      return (
                        <button
                          key={String(option)}
                          type="button"
                          className={`${styles.sampleCountOption} ${
                            selected ? styles.sampleCountOptionSelected : ""
                          }`}
                          onClick={() => setSampleCountOption(option)}
                        >
                          {option}
                        </button>
                      );
                    }
                  )}

                  <input
                    className={`${styles.sampleInlineInput} ${
                      sampleCountOption === "typed"
                        ? styles.sampleInlineInputActive
                        : ""
                    }`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={customSampleCount}
                    onFocus={() => setSampleCountOption("typed")}
                    onChange={(event) => {
                      setSampleCountOption("typed");
                      setCustomSampleCount(event.target.value.replace(/\D/g, ""));
                    }}
                    placeholder="Type amount"
                    aria-label="Custom sample amount"
                  />
                </div>
              </div>

              {sampleError && (
                <div className={styles.sampleError}>{sampleError}</div>
              )}

              <div className={styles.sampleActions}>
                <button
                  type="button"
                  className={styles.sampleCancelBtn}
                  onClick={closeSampleModal}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.sampleSubmitBtn}>
                  Show Sample
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}