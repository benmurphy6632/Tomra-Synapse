"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import LiveMetricsPanel from "./panels/LiveMetricsPanel";
import TrafficPanel from "./panels/TrafficPanel";
import ImageClassificationPanel from "./panels/ImageClassificationPanel";
import ModelVersionsPanel from "./panels/ModelVersionsPanel";
import type { EngineOutput } from "../../../api/EngineOutput";
import { loadProjects } from "@/lib/projectsStore";
import styles from "./Dashboard.module.css";

function classificationRowsKey(projectId: string) {
  return `classificationRows:${projectId}`;
}

function classificationLoadedKey(projectId: string) {
  return `classificationLoaded:${projectId}`;
}

function getProjectIdFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("projects");
  if (idx === -1) return null;
  const maybeId = parts[idx + 1];
  if (!maybeId || maybeId === "new") return null;
  return maybeId;
}

export default function Dashboard() {
  const pathname = usePathname();

  const currentProjectId = useMemo(() => {
    return getProjectIdFromPath(pathname) ?? "current";
  }, [pathname]);

  const projectName = useMemo(() => {
    if (typeof window === "undefined") return null;
    const projects = loadProjects();
    const project = projects.find((p) => p.id === currentProjectId);
    return project?.name ?? null;
  }, [currentProjectId]);

  const [engineOutputs, setEngineOutputs] = useState<EngineOutput[]>([]);
  const [hasLoadedClassification, setHasLoadedClassification] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadStoredData = () => {
      try {
        const loaded =
          localStorage.getItem(classificationLoadedKey(currentProjectId)) ===
          "true";
        const storedRows = localStorage.getItem(
          classificationRowsKey(currentProjectId),
        );

        setHasLoadedClassification(loaded);

        if (loaded && storedRows) {
          const parsed = JSON.parse(storedRows) as EngineOutput[];
          setEngineOutputs(Array.isArray(parsed) ? parsed : []);
        } else {
          setEngineOutputs([]);
        }
      } catch {
        setHasLoadedClassification(false);
        setEngineOutputs([]);
      }
    };

    loadStoredData();

    const handleClassificationUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ projectId?: string }>;
      const updatedProjectId = customEvent.detail?.projectId;
      if (!updatedProjectId || updatedProjectId === currentProjectId) {
        loadStoredData();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === classificationRowsKey(currentProjectId) ||
        event.key === classificationLoadedKey(currentProjectId)
      ) {
        loadStoredData();
      }
    };

    window.addEventListener(
      "classification-data-updated",
      handleClassificationUpdate as EventListener,
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        "classification-data-updated",
        handleClassificationUpdate as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [currentProjectId]);

  const top3Recent = useMemo(() => {
    if (!hasLoadedClassification) return [];

    return engineOutputs
      .slice(-3)
      .reverse()
      .map((output, index) => ({
        id: `${output.deviceId}-${output.imageName}-${index}`,
        label: output.predictedLabel,
        confidence: output.confidence,
      }));
  }, [engineOutputs, hasLoadedClassification]);

  const totalClassified = hasLoadedClassification ? engineOutputs.length : 0;

  const lastClassifiedDate = useMemo(() => {
    if (!hasLoadedClassification || engineOutputs.length === 0) return "N/A";
    const last = engineOutputs[engineOutputs.length - 1];
    return `${last.imageName} (${last.deviceId})`;
  }, [engineOutputs, hasLoadedClassification]);

  return (
    <div className={styles.shell}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.projectTitle}>
            {projectName ?? currentProjectId}
          </h1>
          <p className={styles.projectSub}>Project Dashboard</p>
        </div>
        <div className={styles.activeBadge}>
          <span className={styles.activeDot} />
          Active
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.leftCol}>
          <div className={styles.panelWrap}>
            <ImageClassificationPanel projectId={currentProjectId} />
          </div>
          <div className={styles.panelWrap}>
            <ModelVersionsPanel projectId={currentProjectId} />
          </div>
        </div>

        <div className={styles.rightCol}>
          <div className={styles.panelWrapTall}>
            <LiveMetricsPanel projectId={currentProjectId} />
          </div>
          <div className={styles.panelWrap}>
            <TrafficPanel projectId={currentProjectId} />
          </div>
        </div>
      </div>
    </div>
  );
}