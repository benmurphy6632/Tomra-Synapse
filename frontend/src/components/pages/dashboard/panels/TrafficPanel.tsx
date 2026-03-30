"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardPanelShell from "../DashboardPanelShell";
import styles from "../Dashboard.module.css";

const DEFAULT_CANARY_PERCENT = 30;
const TRAFFIC_SPLIT_UPDATED_EVENT = "model-traffic-split-updated";

function modelTrafficSplitKey(projectId: string) {
  return `modelTrafficSplit:${projectId}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readCanaryPercent(projectId: string) {
  if (typeof window === "undefined") return DEFAULT_CANARY_PERCENT;

  try {
    const stored = localStorage.getItem(modelTrafficSplitKey(projectId));
    if (!stored) return DEFAULT_CANARY_PERCENT;

    const parsed = Number(stored);
    return Number.isFinite(parsed)
      ? clamp(Math.round(parsed), 0, 100)
      : DEFAULT_CANARY_PERCENT;
  } catch {
    return DEFAULT_CANARY_PERCENT;
  }
}

export default function TrafficPanel({ projectId }: { projectId: string }) {
  const [canaryPercent, setCanaryPercent] = useState(DEFAULT_CANARY_PERCENT);

  useEffect(() => {
    const loadTrafficSplit = () => {
      setCanaryPercent(readCanaryPercent(projectId));
    };

    loadTrafficSplit();

    const handleTrafficSplitUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<any>;
      if (
        !customEvent.detail?.projectId ||
        customEvent.detail.projectId === projectId
      ) {
        loadTrafficSplit();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === modelTrafficSplitKey(projectId)) {
        loadTrafficSplit();
      }
    };

    window.addEventListener(
      TRAFFIC_SPLIT_UPDATED_EVENT,
      handleTrafficSplitUpdate as EventListener,
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        TRAFFIC_SPLIT_UPDATED_EVENT,
        handleTrafficSplitUpdate as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [projectId]);

  const stablePercent = useMemo(() => 100 - canaryPercent, [canaryPercent]);

  return (
    <DashboardPanelShell
      href={`/projects/${projectId}/deployment`}
      ariaLabel="Go to Model Deployment"
      heightClass="h-[14vh]"
    >
      <div className={styles.trafficContainer}>
        <div className={styles.trafficTitle}>Target Traffic Distribution</div>

        <div className={styles.trafficLegend}>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendCanary}`} />
            <span className={styles.legendLabel}>Canary</span>
            <span className={styles.legendPercent}>{canaryPercent}%</span>
          </div>

          <div className={styles.legendDivider} />

          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.legendStable}`} />
            <span className={styles.legendLabel}>Stable</span>
            <span className={styles.legendPercent}>{stablePercent}%</span>
          </div>
        </div>

        <div className={styles.trafficBarWrapper}>
          <div className={styles.trafficBar}>
            <div
              className={styles.barCanary}
              style={{ left: "0%", width: `${canaryPercent}%` }}
            />

            <div
              className={styles.barStable}
              style={{
                left: `${canaryPercent}%`,
                width: `${stablePercent}%`,
              }}
            />
          </div>

          <div className={styles.trafficLabels}></div>
        </div>
      </div>
    </DashboardPanelShell>
  );
}