"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import styles from "./GridMode.module.css";
import { EngineOutput } from "../../../api/EngineOutput";

type ViewMode = "table" | "grid";
type Vote = "up" | "down" | "unsure" | null;

const STORAGE_PREFIX = "grid_votes_v2";
const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_GRAPHQL_URL!;

function confidenceClass(conf: number) {
  const pct = conf * 100;
  if (pct >= 85) return styles.confHigh;
  if (pct >= 70) return styles.confGood;
  if (pct >= 50) return styles.confWarn;
  return styles.confLow;
}

function basename(input: string) {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";
  const normalized = trimmed.replaceAll("\\", "/");
  return (normalized.split("/").pop() ?? "").trim();
}

function formatPredictedLabel(label?: string) {
  if (!label) return "";
  return label.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildVoteKey(projectId: string, row: EngineOutput) {
  return `${String(projectId).trim()}::${String(row.id)}`;
}

function getVoteStatsFromVotes(votes: Record<string, Vote>) {
  let up = 0;
  let down = 0;
  let unsure = 0;

  Object.values(votes).forEach((vote) => {
    if (vote === "up") up += 1;
    if (vote === "down") down += 1;
    if (vote === "unsure") unsure += 1;
  });

  return { up, down, unsure };
}

function CardImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={styles.imgFallback}>
        <div className={styles.imgFallbackIcon}>🖼️</div>
        <div className={styles.imgFallbackText}>Image unavailable</div>
      </div>
    );
  }

  return (
    <img
      className={styles.img}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}

function ThumbUpIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 11v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3Zm2 10h7.3a2 2 0 0 0 1.96-1.6l1.2-6A2 2 0 0 0 17.5 11H14V7.5a2.5 2.5 0 0 0-2.5-2.5h-.35a1 1 0 0 0-.95.68L9 9.5V21Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ThumbDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 13V3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3Zm2-10h7.3a2 2 0 0 1 1.96 1.6l1.2 6A2 2 0 0 1 17.5 13H14v3.5A2.5 2.5 0 0 1 11.5 19h-.35a1 1 0 0 1-.95-.68L9 14.5V3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UnsureIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2a5 5 0 0 1 3.54 8.54C14.83 11.25 14 12.1 14 13v1a2 2 0 0 1-4 0v-1c0-1.84 1.17-3.37 2.46-4.46A1 1 0 1 0 11 7.27 5 5 0 0 1 12 2ZM12 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function GridMode({
  projectId,
  rows,
  loading,
  error,
  renderTable,
  initialMode = "table",
  mode,
  onModeChange,
  feedbackFilter,
  onFeedbackFilterChange,
  extraActions,
}: {
  projectId: string;
  rows: EngineOutput[];
  loading: boolean;
  error: string | null;
  renderTable: (openPreview: (row: EngineOutput) => void) => React.ReactNode;
  initialMode?: ViewMode;
  mode?: ViewMode;
  onModeChange?: (mode: ViewMode) => void;
  feedbackFilter?: Vote;
  onFeedbackFilterChange?: (filter: Exclude<Vote, null>) => void;
  extraActions?: ReactNode;
}) {
  const [internalMode, setInternalMode] = useState<ViewMode>(initialMode);
  const currentMode = mode ?? internalMode;

  const [selected, setSelected] = useState<{
    row: EngineOutput;
    src: string;
    chosenName: string;
  } | null>(null);

  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}::${projectId}`,
    [projectId],
  );

  const [votes, setVotes] = useState<Record<string, Vote>>({});

  const voteStats = useMemo(() => {
    return getVoteStatsFromVotes(votes);
  }, [votes]);

  const setModeValue = (nextMode: ViewMode) => {
    if (mode === undefined) {
      setInternalMode(nextMode);
    }
    onModeChange?.(nextMode);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(storageKey);
      setVotes(stored ? JSON.parse(stored) : {});
    } catch {
      setVotes({});
    }
  }, [storageKey]);

  const persist = (nextVotes: Record<string, Vote>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextVotes));
      window.dispatchEvent(
        new CustomEvent("classification-data-updated", {
          detail: { projectId },
        }),
      );
    } catch {
      // ignore storage errors
    }
  };

  const voteFeedback = async (
    currentProjectId: string,
    resultId: string | number,
    model: string,
    imageName: string,
    deviceId: string,
    imageURL: string,
    vote: string,
  ) => {
    await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          mutation VoteFeedback(
            $projectId: String!,
            $resultId: ID!,
            $model: String!,
            $imageName: String!,
            $deviceId: String!,
            $imageURL: String!,
            $vote: VoteType!
          ) {
            voteFeedback(
              projectId: $projectId,
              resultId: $resultId,
              model: $model,
              imageName: $imageName,
              deviceId: $deviceId,
              imageURL: $imageURL,
              vote: $vote
            )
          }
        `,
        variables: {
          projectId: currentProjectId,
          resultId: String(resultId),
          model,
          imageName,
          deviceId,
          imageURL,
          vote,
        },
      }),
    });
  };

  const removeVote = async (
    currentProjectId: string,
    resultId: string | number,
  ) => {
    await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          mutation RemoveVote(
            $projectId: String!,
            $resultId: ID!
          ) {
            removeVote(
              projectId: $projectId,
              resultId: $resultId
            )
          }
        `,
        variables: {
          projectId: currentProjectId,
          resultId: String(resultId),
        },
      }),
    });
  };

  const setVote = async (key: string, next: Vote, row: EngineOutput) => {
    const previous = votes[key] ?? null;
    const finalVote: Vote = previous === next ? null : next;

    const optimisticVotes = { ...votes };

    if (finalVote === null) {
      delete optimisticVotes[key];
    } else {
      optimisticVotes[key] = finalVote;
    }

    setVotes(optimisticVotes);
    persist(optimisticVotes);

    try {
      if (finalVote === null) {
        await removeVote(projectId, row.id);
      } else {
        await voteFeedback(
          projectId,
          row.id,
          row.model,
          row.imageName,
          row.deviceId,
          row.imageURL,
          finalVote.toUpperCase(),
        );
      }
    } catch {
      const revertedVotes = { ...votes };
      setVotes(revertedVotes);
      persist(revertedVotes);
    }
  };

  const safeRows = useMemo(() => {
    return (rows ?? []).filter((row) => (row.imageURL ?? "").trim() !== "");
  }, [rows]);

  const openPreview = (row: EngineOutput) => {
    const src = (row.imageURL ?? "").trim();
    if (!src) return;

    const chosenName = basename(row.imageName || src) || "classification-image";
    setSelected({ row, src, chosenName });
  };

  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected]);

  const handleDownloadImage = async () => {
    if (!selected) return;

    try {
      const response = await fetch(selected.src);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = selected.chosenName || "classification-image";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error("Failed to download image:", downloadError);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.left}>
          <div className={styles.modePills}>
            <button
              className={`${styles.pill} ${
                currentMode === "table" ? styles.pillActive : ""
              }`}
              onClick={() => setModeValue("table")}
              type="button"
            >
              Table
            </button>
            <button
              className={`${styles.pill} ${
                currentMode === "grid" ? styles.pillActive : ""
              }`}
              onClick={() => setModeValue("grid")}
              type="button"
            >
              Grid
            </button>
          </div>

          <div className={styles.count}>
            {safeRows.length} result{safeRows.length === 1 ? "" : "s"}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`${styles.thumbBtn} ${styles.thumbUpBtn} flex items-center gap-1 ${
                feedbackFilter === "up" ? styles.thumbSelectedUp : ""
              }`}
              onClick={() => onFeedbackFilterChange?.("up")}
              aria-pressed={feedbackFilter === "up"}
              title="Filter by thumbs up"
            >
              <ThumbUpIcon className={styles.thumbIcon} />
              {voteStats.up}
            </button>

            <button
              type="button"
              className={`${styles.thumbBtn} ${styles.thumbDownBtn} flex items-center gap-1 ${
                feedbackFilter === "down" ? styles.thumbSelectedDown : ""
              }`}
              onClick={() => onFeedbackFilterChange?.("down")}
              aria-pressed={feedbackFilter === "down"}
              title="Filter by thumbs down"
            >
              <ThumbDownIcon className={styles.thumbIcon} />
              {voteStats.down}
            </button>

            <button
              type="button"
              className={`${styles.thumbBtn} ${styles.unsureBtn} flex items-center gap-1 ${
                feedbackFilter === "unsure" ? styles.unsureSelected : ""
              }`}
              onClick={() => onFeedbackFilterChange?.("unsure")}
              aria-pressed={feedbackFilter === "unsure"}
              title="Filter by unsure"
            >
              <UnsureIcon className={styles.thumbIcon} />
              {voteStats.unsure}
            </button>
          </div>
        </div>

        <div className={styles.right}>{extraActions}</div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {currentMode === "table" ? (
        <div className={styles.contentArea}>{renderTable(openPreview)}</div>
      ) : (
        <div className={styles.contentArea}>
          {safeRows.length === 0 ? (
            <div className={styles.empty}>No image results available.</div>
          ) : (
            <div className={styles.gridWrap}>
              <div className={styles.grid}>
                {safeRows.map((r) => {
                  const voteKey = buildVoteKey(projectId, r);
                  const vote = votes[voteKey] ?? null;

                  return (
                    <button
                      key={voteKey}
                      type="button"
                      className={`${styles.card} ${styles.cardButton}`}
                      onClick={() => openPreview(r)}
                    >
                      <div className={styles.media}>
                        <CardImage
                          src={(r.imageURL ?? "").trim()}
                          alt={
                            r.imageName ||
                            formatPredictedLabel(r.predictedLabel)
                          }
                        />

                        <div className={styles.badges}>
                          <span
                            className={`${styles.confBadge} ${confidenceClass(
                              r.confidence,
                            )}`}
                          >
                            {(r.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className={styles.meta}>
                        <div
                          className={styles.predictedLabel}
                          title={formatPredictedLabel(r.predictedLabel)}
                        >
                          {formatPredictedLabel(r.predictedLabel)}
                        </div>

                        <div className={styles.subRow}>
                          <div className={styles.subItem} title={r.model}>
                            {r.model}
                          </div>
                          <div className={styles.dot}>•</div>
                          <div className={styles.subItem} title={r.deviceId}>
                            {r.deviceId}
                          </div>
                        </div>

                        <div className={styles.bottomRow}>
                          <div className={styles.fileRow} title={r.imageName}>
                            {basename(r.imageName)}
                          </div>

                          <div
                            className={styles.cardThumbs}
                            aria-label="Feedback"
                          >
                            <button
                              type="button"
                              className={`${styles.thumbBtn} ${styles.thumbUpBtn} ${
                                vote === "up" ? styles.thumbSelectedUp : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setVote(voteKey, "up", r);
                              }}
                              aria-label="Thumbs up"
                              title="Thumbs up"
                            >
                              <ThumbUpIcon className={styles.thumbIcon} />
                            </button>

                            <button
                              type="button"
                              className={`${styles.thumbBtn} ${styles.thumbDownBtn} ${
                                vote === "down" ? styles.thumbSelectedDown : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setVote(voteKey, "down", r);
                              }}
                              aria-label="Thumbs down"
                              title="Thumbs down"
                            >
                              <ThumbDownIcon className={styles.thumbIcon} />
                            </button>

                            <button
                              type="button"
                              className={`${styles.thumbBtn} ${styles.unsureBtn} ${
                                vote === "unsure" ? styles.unsureSelected : ""
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setVote(voteKey, "unsure", r);
                              }}
                              aria-label="Unsure"
                              title="Unsure"
                            >
                              <UnsureIcon className={styles.thumbIcon} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className={styles.modalOverlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.modalClose}
              onClick={() => setSelected(null)}
              type="button"
            >
              ✕
            </button>

            <div className={styles.modalBody}>
              <div className={styles.modalImageWrap}>
                <CardImage src={selected.src} alt={selected.chosenName} />
              </div>

              <div className={styles.modalInfo}>
                <div className={styles.modalTitle}>
                  {formatPredictedLabel(selected.row.predictedLabel)}
                </div>

                <div className={styles.modalStatRow}>
                  <span className={styles.modalKey}>Confidence</span>
                  <span className={styles.modalValue}>
                    {(selected.row.confidence * 100).toFixed(1)}%
                  </span>
                </div>

                <div className={styles.modalStatRow}>
                  <span className={styles.modalKey}>Device</span>
                  <span className={styles.modalValueMono}>
                    {selected.row.deviceId}
                  </span>
                </div>

                <div className={styles.modalStatRow}>
                  <span className={styles.modalKey}>Model</span>
                  <span className={styles.modalValue}>
                    {selected.row.model}
                  </span>
                </div>

                <div className={styles.modalStatRow}>
                  <span className={styles.modalKey}>Class ID</span>
                  <span className={styles.modalValueMono}>
                    {selected.row.classId}
                  </span>
                </div>

                <div className={styles.modalStatRow}>
                  <span className={styles.modalKey}>File</span>
                  <span className={styles.modalValueMono}>
                    {selected.chosenName}
                  </span>
                </div>

                <button
                  type="button"
                  className={styles.downloadBtn}
                  onClick={handleDownloadImage}
                >
                  Download Image
                </button>

                <div className={styles.modalHint}>
                  Click outside or press <span className={styles.kbd}>Esc</span>{" "}
                  to close
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}