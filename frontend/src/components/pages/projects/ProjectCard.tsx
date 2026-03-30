"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Project } from "@/types/project";
import styles from "./ProjectCard.module.css";

type Props = {
  project: Project;
  onOpen: () => void;
  onRequestDelete: () => void;
  isPinnedToTop?: boolean;
  onTogglePinToTop?: () => void;
};

const PINNED_PROJECTS_KEY = "pinnedProjectIds";

function formatCreatedDate(timestamp?: number) {
  if (!timestamp || Number.isNaN(timestamp)) return "—";

  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatLastUpdated(updatedText?: string) {
  if (!updatedText) return "Never opened";

  const timestamp = Number(updatedText);
  if (!Number.isFinite(timestamp)) return "Never opened";

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const days7Ms = 7 * dayMs;

  if (diffMs < 2 * minuteMs) return "Just Now";
  if (diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)} mins ago`;
  if (diffMs < 2 * hourMs) return "1 hour ago";
  if (diffMs < dayMs) return `${Math.floor(diffMs / hourMs)} hours ago`;
  if (diffMs < 2 * dayMs) return "Yesterday";
  if (diffMs < days7Ms) return `${Math.floor(diffMs / dayMs)} days ago`;

  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function readPinnedProjectIds() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(PINNED_PROJECTS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writePinnedProjectIds(ids: string[]) {
  if (typeof window === "undefined") return;

  localStorage.setItem(PINNED_PROJECTS_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("pinned-projects-updated"));
}

export default function ProjectCard({
  project,
  onOpen,
  onRequestDelete,
  isPinnedToTop = false,
  onTogglePinToTop,
}: Props) {
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState(
    formatLastUpdated(project.updatedText)
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPinnedToSidebar, setIsPinnedToSidebar] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLastUpdatedLabel(formatLastUpdated(project.updatedText));

    const interval = window.setInterval(() => {
      setLastUpdatedLabel(formatLastUpdated(project.updatedText));
    }, 30 * 1000);

    return () => window.clearInterval(interval);
  }, [project.updatedText]);

  useEffect(() => {
    function syncPinnedState() {
      setIsPinnedToSidebar(readPinnedProjectIds().includes(project.id));
    }

    syncPinnedState();

    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener(
      "pinned-projects-updated",
      syncPinnedState as EventListener
    );
    window.addEventListener("storage", syncPinnedState);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener(
        "pinned-projects-updated",
        syncPinnedState as EventListener
      );
      window.removeEventListener("storage", syncPinnedState);
    };
  }, [project.id]);

  function handleToggleSidebarPin() {
    const existing = readPinnedProjectIds();

    if (existing.includes(project.id)) {
      writePinnedProjectIds(existing.filter((id) => id !== project.id));
      setIsPinnedToSidebar(false);
      setMenuOpen(false);
      return;
    }

    writePinnedProjectIds([...existing, project.id]);
    setIsPinnedToSidebar(true);
    setMenuOpen(false);
  }

  function handleToggleTopPin() {
    onTogglePinToTop?.();
    setMenuOpen(false);
  }

  return (
    <div
      className={styles.projectCard}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open project ${project.name}`}
    >
      <div className={styles.projectTopRow}>
        <div className={styles.projectTitleRow}>
          <div className={styles.projectNameWrap}>
            <div className={styles.projectName}>{project.name}</div>

            {isPinnedToTop && (
              <Image
                src="/assets/pin.png"
                alt=""
                width={15}
                height={15}
                className={styles.titlePinIcon}
              />
            )}
          </div>

          <div className={styles.projectTopRight} ref={menuRef}>
            <button
              type="button"
              className={styles.moreBtn}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              aria-label={`More options for ${project.name}`}
              title="More options"
            >
              ...
            </button>

            {menuOpen && (
              <div
                className={styles.menu}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={handleToggleSidebarPin}
                >
                  <Image
                    src="/assets/pin.png"
                    alt=""
                    width={16}
                    height={16}
                    className={styles.menuIcon}
                  />
                  <span>
                    {isPinnedToSidebar
                      ? "Unpin from Sidebar"
                      : "Pin to Sidebar"}
                  </span>
                </button>

                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={handleToggleTopPin}
                >
                  <Image
                    src="/assets/pin.png"
                    alt=""
                    width={16}
                    height={16}
                    className={styles.menuIcon}
                  />
                  <span>
                    {isPinnedToTop
                      ? "Unpin from Top of Page"
                      : "Pin to Top of Page"}
                  </span>
                </button>
              </div>
            )}

            <button
              type="button"
              className={styles.deleteBtn}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRequestDelete();
              }}
            >
              Delete
            </button>
          </div>
        </div>

        <div className={styles.projectDesc}>{project.description || "—"}</div>
      </div>

      <div className={styles.metricsBar}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>Models</div>
          <div className={styles.metricValue}>{project.models}</div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricLabel}>Inferences</div>
          <div className={styles.metricValue}>{project.inferencesToday}</div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricLabel}>Created</div>
          <div className={styles.metricValue}>
            {formatCreatedDate(project.createdAt)}
          </div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricLabel}>Last Opened</div>
          <div className={styles.metricValue}>{lastUpdatedLabel}</div>
        </div>
      </div>
    </div>
  );
}