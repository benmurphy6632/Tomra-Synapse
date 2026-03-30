"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import styles from "./ModelDeployment.module.css";
import { fetchFeedbackVotes, type FeedbackVote } from "@/api/FeedbackVote";

type MetricsView = "combined" | "stable" | "canary";
type VoteLabel = "UP" | "DOWN" | "UNSURE";

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

type EvaluatedOutput = EngineOutput & {
  vote: VoteLabel;
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
  tick: { fontSize: 12, fill: "rgba(255,255,255,0.42)" },
};

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

function getOutputVoteKey(item: { id: string }) {
  return String(item.id);
}

function getFeedbackVoteKey(item: { resultId: string }) {
  return String(item.resultId);
}

function buildEvaluatedOutputs(
  outputs: EngineOutput[],
  votes: FeedbackVote[],
): EvaluatedOutput[] {
  const voteMap = new Map<string, VoteLabel>();

  for (const vote of votes) {
    voteMap.set(getFeedbackVoteKey(vote), vote.vote as VoteLabel);
  }

  return outputs
    .map((output) => {
      const vote = voteMap.get(getOutputVoteKey(output));
      if (!vote) return null;

      return {
        ...output,
        vote,
      };
    })
    .filter((item): item is EvaluatedOutput => item !== null);
}

function computeConfusionAtThreshold(
  evaluated: EvaluatedOutput[],
  threshold: number,
) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  let unsure = 0;

  for (const item of evaluated) {
    if (item.vote === "UNSURE") {
      unsure++;
      continue;
    }

    const predictedPositive = item.confidence >= threshold;
    const actualPositive = item.vote === "UP";

    if (predictedPositive && actualPositive) tp++;
    else if (predictedPositive && !actualPositive) fp++;
    else if (!predictedPositive && actualPositive) tn++;
    else fn++;
  }

  return { tp, fp, tn, fn, unsure };
}

function buildRocCurve(evaluated: EvaluatedOutput[]) {
  const thresholds = Array.from({ length: 21 }, (_, i) => i / 20);

  const rocCurve = thresholds
    .map((threshold) => {
      const { tp, fp, tn, fn } = computeConfusionAtThreshold(
        evaluated,
        threshold,
      );

      const tpr = tp + fn > 0 ? tp / (tp + fn) : 0;
      const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;

      return {
        threshold,
        tpr: Number(tpr.toFixed(4)),
        fpr: Number(fpr.toFixed(4)),
      };
    })
    .sort((a, b) => a.fpr - b.fpr);

  let auc = 0;
  for (let i = 1; i < rocCurve.length; i++) {
    const prev = rocCurve[i - 1];
    const curr = rocCurve[i];
    auc += ((curr.fpr - prev.fpr) * (curr.tpr + prev.tpr)) / 2;
  }

  return {
    rocCurve,
    auc: Number(auc.toFixed(3)),
  };
}

function deriveMetrics(data: EngineOutput[], votes: FeedbackVote[]) {
  if (!data.length) return null;

  const avgConfidence =
    data.reduce((sum, item) => sum + item.confidence, 0) / data.length;

  const confidenceVariance =
    data.reduce(
      (sum, item) => sum + Math.pow(item.confidence - avgConfidence, 2),
      0,
    ) / data.length;

  const confidenceStdDev = Math.sqrt(confidenceVariance);

  const evaluated = buildEvaluatedOutputs(data, votes);

  const { tp, fp, tn, fn, unsure } = computeConfusionAtThreshold(
    evaluated,
    0.5,
  );

  const { rocCurve, auc } = buildRocCurve(evaluated);
  const judgedCount = tp + fp + tn + fn;

  return {
    avgConfidence,
    confidenceStdDev,
    tp,
    fp,
    fn,
    tn,
    unsure,
    rocCurve,
    auc: auc.toFixed(2),
    judgedCount,
    totalEvaluated: evaluated.length,
  };
}

export default function ModelPerformance({
  projectId,
  stableModelName,
  canaryModelName,
  hasStableModel,
  hasCanaryModel,
}: {
  projectId: string;
  stableModelName: string;
  canaryModelName: string;
  hasStableModel: boolean;
  hasCanaryModel: boolean;
}) {
  const [data, setData] = useState<EngineOutput[]>([]);
  const [feedbackVotes, setFeedbackVotes] = useState<FeedbackVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPerformanceView, setSelectedPerformanceView] =
    useState<MetricsView>("combined");

  const refresh = useCallback(async () => {
    try {
      const [results, votes] = await Promise.all([
        fetchEngineOutputs(projectId),
        fetchFeedbackVotes(projectId),
      ]);

      setData(results);
      setFeedbackVotes(votes);
    } catch (error) {
      console.error("Failed to fetch model performance:", error);
      setData([]);
      setFeedbackVotes([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (selectedPerformanceView === "stable" && !hasStableModel) {
      setSelectedPerformanceView("combined");
    }

    if (selectedPerformanceView === "canary" && !hasCanaryModel) {
      setSelectedPerformanceView("combined");
    }
  }, [selectedPerformanceView, hasStableModel, hasCanaryModel]);

  const performanceData = useMemo(() => {
    if (selectedPerformanceView === "stable") {
      return hasStableModel
        ? data.filter((row) => row.model === stableModelName)
        : [];
    }

    if (selectedPerformanceView === "canary") {
      return hasCanaryModel
        ? data.filter((row) => row.model === canaryModelName)
        : [];
    }

    if (hasStableModel && hasCanaryModel) {
      return data.filter(
        (row) => row.model === stableModelName || row.model === canaryModelName,
      );
    }

    if (hasStableModel) {
      return data.filter((row) => row.model === stableModelName);
    }

    if (hasCanaryModel) {
      return data.filter((row) => row.model === canaryModelName);
    }

    return data;
  }, [
    data,
    selectedPerformanceView,
    hasStableModel,
    hasCanaryModel,
    stableModelName,
    canaryModelName,
  ]);

  const metrics = useMemo(() => {
    return deriveMetrics(performanceData, feedbackVotes);
  }, [performanceData, feedbackVotes]);

  const selectedPerformanceViewLabel =
    selectedPerformanceView === "stable"
      ? hasStableModel
        ? `Stable - ${stableModelName}`
        : "Stable - No model"
      : selectedPerformanceView === "canary"
        ? hasCanaryModel
          ? `Canary - ${canaryModelName}`
          : "Canary - No model"
        : "Combined View";

  return (
    <>
      <div className={styles.sectionTitle}>Model Performance</div>

      <div className={styles.viewToggleRow}>
        <button
          type="button"
          className={`${styles.viewToggleButton} ${
            selectedPerformanceView === "combined"
              ? styles.viewToggleButtonActive
              : ""
          }`}
          onClick={() => setSelectedPerformanceView("combined")}
        >
          Summary
        </button>

        <button
          type="button"
          className={`${styles.viewToggleButton} ${
            selectedPerformanceView === "stable"
              ? styles.viewToggleButtonActive
              : ""
          }`}
          onClick={() => setSelectedPerformanceView("stable")}
          disabled={!hasStableModel}
        >
          {hasStableModel ? `Stable - ${stableModelName}` : "Stable - No model"}
        </button>

        <button
          type="button"
          className={`${styles.viewToggleButton} ${
            selectedPerformanceView === "canary"
              ? styles.viewToggleButtonActive
              : ""
          }`}
          onClick={() => setSelectedPerformanceView("canary")}
          disabled={!hasCanaryModel}
        >
          {hasCanaryModel ? `Canary - ${canaryModelName}` : "Canary - No model"}
        </button>
      </div>

      <div className={styles.modelGrid}>
        {loading ? (
          <div className={styles.panel}>
            <p className={styles.loadingText}>Fetching Model data....</p>
          </div>
        ) : !metrics ? (
          <div className={styles.panel}>
            <p className={styles.emptyTitle}>No Model results yet</p>
            <p className={styles.emptySub}>
              {selectedPerformanceView === "combined"
                ? "Results will appear here once you have reviewed classified images."
                : `No outputs found yet for ${selectedPerformanceViewLabel}.`}
            </p>
          </div>
        ) : (
          <>
            <div className={styles.panel}>
              <div className={styles.modelLeft}>
                <div className={styles.metricsRow}>
                  <div className={styles.card}>
                    <div className={styles.cardLabelRow}>
                      <div className={styles.cardLabel}>Precision</div>
                      <div className={styles.tooltipWrap}>
                        <span className={styles.infoDot}>?</span>
                        <div className={styles.tooltipBox}>
                          The Standard Deviation of All Predicted Confidence
                          Scores
                        </div>
                      </div>
                    </div>

                    <div className={styles.metricValue}>
                      {(metrics.confidenceStdDev * 100).toFixed(1)}%
                    </div>
                    <div className={styles.cardSub}>across all images</div>
                  </div>

                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Avg Confidence</div>
                    <div className={styles.metricValue}>
                      {(metrics.avgConfidence * 100).toFixed(1)}%
                    </div>
                    <div className={styles.cardSub}>across all images</div>
                  </div>
                </div>

                <div className={`${styles.card} ${styles.confusionCard}`}>
                  <div className={styles.cardLabelRow}>
                    <div className={styles.cardLabel}>Confusion Matrix</div>
                    <div className={styles.tooltipWrap}>
                      <span className={styles.infoDot}>?</span>
                      <div className={styles.tooltipBox}>
                        <div>
                          True Positive: Correct Prediction with Confidence &gt;
                          50%
                        </div>
                        <div>
                          False Positive: Incorrect Prediction with Confidence
                          &gt; 50%
                        </div>
                        <div>
                          False Negative: Incorrect Prediction with Confidence
                          &lt; 50%
                        </div>
                        <div>
                          True Negative: Correct Prediction with Confidence
                          &lt; 50%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.matrixGrid}>
                    <div className={`${styles.matrixCell} ${styles.valueTP}`}>
                      {metrics.tp}
                      <div className={styles.matrixLabel}>True Positive</div>
                    </div>

                    <div className={`${styles.matrixCell} ${styles.valueFP}`}>
                      {metrics.fp}
                      <div className={styles.matrixLabel}>False Positive</div>
                    </div>

                    <div className={`${styles.matrixCell} ${styles.valueFN}`}>
                      {metrics.fn}
                      <div className={styles.matrixLabel}>False Negative</div>
                    </div>

                    <div className={`${styles.matrixCell} ${styles.valueTN}`}>
                      {metrics.tn}
                      <div className={styles.matrixLabel}>True Negative</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div className={`${styles.cardLabelRow} ${styles.panelTitleRow}`}>
                  <span className={styles.panelTitle}>
                    Confidence vs Feedback ROC Curve
                  </span>

                  <div className={styles.tooltipWrap}>
                    <span className={styles.infoDot}>?</span>
                    <div className={styles.tooltipBox}>
                      <div>
                        Shows how well model confidence separates predictions
                        reviewers approved from those they rejected.
                      </div>
                      <div style={{ marginTop: "6px" }}>
                        Higher AUC means confidence aligns better with human
                        feedback.
                      </div>
                      <div style={{ marginTop: "8px" }}>
                        <strong>AUC bands:</strong>
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        0.90–1.00: confidence aligns very strongly with feedback.
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        0.70–0.89: confidence is useful but not perfectly
                        calibrated.
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        Around 0.50: confidence is not much better than random.
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        Below 0.50: higher confidence may be aligning with wrong
                        predictions.
                      </div>
                    </div>
                  </div>
                </div>

                <span className={styles.panelValue}>
                  AUC: {metrics.auc} · Predictions Reviewed: {metrics.judgedCount}
                </span>
              </div>

              <div className={styles.chartBody}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.rocCurve}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="fpr"
                      {...axisProps}
                      domain={[0, 1]}
                      label={{
                        value: "FPR",
                        position: "insideBottom",
                        offset: -2,
                        fill: "rgba(255,255,255,0.3)",
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      dataKey="tpr"
                      {...axisProps}
                      domain={[0, 1]}
                      label={{
                        value: "TPR",
                        angle: -90,
                        position: "insideLeft",
                        fill: "rgba(255,255,255,0.3)",
                        fontSize: 11,
                      }}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value, name) => [
                        value,
                        name === "tpr" ? "TPR" : "FPR",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="tpr"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}