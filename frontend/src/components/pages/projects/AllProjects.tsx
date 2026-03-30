"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import styles from "./AllProjects.module.css";

import type { Project, ProjectFormState } from "@/types/project";
import {
  loadProjects,
  saveProjects,
  slugify,
  upsertProject,
} from "@/lib/projectsStore";
import ProjectCard from "./ProjectCard";
import Sort, { type SortOption } from "./Sort";
import SearchBar from "./SearchBar";

const PINNED_TOP_PROJECTS_KEY = "pinnedTopProjectIds";
const STORAGE_PREFIX = "modelVersions";
const MODEL_COUNT_UPDATED_EVENT = "model-count-updated";

function classificationRowsKey(projectId: string) {
  return `classificationRows:${projectId}`;
}

function classificationTop4Key(projectId: string) {
  return `classificationTop4:${projectId}`;
}

function classificationLoadedKey(projectId: string) {
  return `classificationLoaded:${projectId}`;
}

function classificationTotalKey(projectId: string) {
  return `classificationTotal:${projectId}`;
}

function modelVersionsStorageKey(projectId: string, section: string) {
  return `${STORAGE_PREFIX}:${projectId}:${section}`;
}

function getInferenceCountText(projectId: string) {
  if (typeof window === "undefined") return "0";

  try {
    const total = localStorage.getItem(classificationTotalKey(projectId));
    return total ? `${Number(total)}` : "0";
  } catch {
    return "0";
  }
}

function getModelCount(projectId: string) {
  if (typeof window === "undefined") return 0;

  try {
    const raw = localStorage.getItem(modelVersionsStorageKey(projectId, "addedModels"));
    if (!raw) return 0;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function getLastOpenedTimestamp(project: Project) {
  const updated = Number(project.updatedText);
  if (Number.isFinite(updated) && updated > 0) return updated;
  return project.createdAt ?? 0;
}

function readPinnedTopProjectIds() {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(PINNED_TOP_PROJECTS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writePinnedTopProjectIds(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PINNED_TOP_PROJECTS_KEY, JSON.stringify(ids));
}

function normalizeProjectName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function AllProjects() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectFormState>({
    name: "",
    description: "",
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("last-opened");
  const [pinnedTopIds, setPinnedTopIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [nameError, setNameError] = useState("");

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<"ask" | "type">("ask");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const syncProjectCardData = useCallback((inputProjects: Project[]) => {
    return inputProjects.map((project) => ({
      ...project,
      inferencesToday: getInferenceCountText(project.id),
      models: getModelCount(project.id),
    }));
  }, []);

  useEffect(() => {
    setHydrated(true);
    const storedProjects = loadProjects();
    setProjects(syncProjectCardData(storedProjects));
    setPinnedTopIds(readPinnedTopProjectIds());
  }, [syncProjectCardData]);

  useEffect(() => {
    if (!hydrated) return;
    saveProjects(projects);
  }, [projects, hydrated]);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setOpen(true);
      router.replace("/projects");
    }
  }, [searchParams, router]);

  useEffect(() => {
    const handleProjectCardDataUpdated = () => {
      setProjects((prev) => syncProjectCardData(prev));
    };

    window.addEventListener(
      "classification-data-updated",
      handleProjectCardDataUpdated as EventListener
    );

    window.addEventListener(
      MODEL_COUNT_UPDATED_EVENT,
      handleProjectCardDataUpdated as EventListener
    );

    window.addEventListener("storage", handleProjectCardDataUpdated);

    return () => {
      window.removeEventListener(
        "classification-data-updated",
        handleProjectCardDataUpdated as EventListener
      );

      window.removeEventListener(
        MODEL_COUNT_UPDATED_EVENT,
        handleProjectCardDataUpdated as EventListener
      );

      window.removeEventListener("storage", handleProjectCardDataUpdated);
    };
  }, [syncProjectCardData]);

  function openModal() {
    setOpen(true);
    setNameError("");
  }

  function closeModal() {
    setOpen(false);
    setForm({ name: "", description: "" });
    setNameError("");
  }

  function onCreate() {
    const name = form.name.trim().replace(/\s+/g, " ");
    const description = form.description.trim();

    if (!name) {
      setNameError("Project Name is required");
      return;
    }

    const duplicateExists = projects.some(
      (project) => normalizeProjectName(project.name) === normalizeProjectName(name)
    );

    if (duplicateExists) {
      setNameError("There is already an existing project with this name");
      return;
    }

    const projectId = slugify(name);
    if (!projectId) {
      setNameError("Project name is invalid");
      return;
    }

    const now = Date.now();

    const newProject: Project = {
      id: projectId,
      name,
      description,
      status: "Active",
      models: getModelCount(projectId),
      inferencesToday: getInferenceCountText(projectId),
      updatedText: String(now),
      createdAt: now,
    };

    const nextProjects = upsertProject(projects, newProject);
    const syncedProjects = syncProjectCardData(nextProjects);

    setProjects(syncedProjects);
    saveProjects(syncedProjects);

    localStorage.removeItem(classificationRowsKey(projectId));
    localStorage.removeItem(classificationTop4Key(projectId));
    localStorage.removeItem(classificationLoadedKey(projectId));
    localStorage.removeItem(classificationTotalKey(projectId));

    window.dispatchEvent(
      new CustomEvent("classification-data-updated", {
        detail: { projectId },
      }),
    );

    window.dispatchEvent(
      new CustomEvent(MODEL_COUNT_UPDATED_EVENT, {
        detail: { projectId },
      }),
    );

    setNameError("");
    setOpen(false);
    router.push(`/projects/${projectId}`);
  }

  function handleOpenProject(projectId: string) {
    const now = Date.now();

    setProjects((prev) => {
      const next = prev.map((project) =>
        project.id === projectId
          ? {
              ...project,
              updatedText: String(now),
            }
          : project
      );

      saveProjects(next);
      return next;
    });

    router.push(`/projects/${projectId}`);
  }

  function requestDelete(projectId: string) {
    setConfirmDeleteId(projectId);
    setDeleteStep("ask");
    setDeleteConfirmText("");
  }

  function cancelDelete() {
    setConfirmDeleteId(null);
    setDeleteStep("ask");
    setDeleteConfirmText("");
  }

  function goToTypeStep() {
    setDeleteStep("type");
    setDeleteConfirmText("");
  }

  function confirmDelete() {
    if (!confirmDeleteId) return;
    if (deleteConfirmText !== "DELETE") return;

    const next = projects.filter((p) => p.id !== confirmDeleteId);
    setProjects(next);
    saveProjects(next);

    const nextPinnedTopIds = pinnedTopIds.filter((id) => id !== confirmDeleteId);
    setPinnedTopIds(nextPinnedTopIds);
    writePinnedTopProjectIds(nextPinnedTopIds);

    localStorage.removeItem(classificationRowsKey(confirmDeleteId));
    localStorage.removeItem(classificationTop4Key(confirmDeleteId));
    localStorage.removeItem(classificationLoadedKey(confirmDeleteId));
    localStorage.removeItem(classificationTotalKey(confirmDeleteId));
    localStorage.removeItem(modelVersionsStorageKey(confirmDeleteId, "descriptions"));
    localStorage.removeItem(modelVersionsStorageKey(confirmDeleteId, "statuses"));
    localStorage.removeItem(modelVersionsStorageKey(confirmDeleteId, "addedModels"));

    window.dispatchEvent(
      new CustomEvent("classification-data-updated", {
        detail: { projectId: confirmDeleteId },
      }),
    );

    window.dispatchEvent(
      new CustomEvent(MODEL_COUNT_UPDATED_EVENT, {
        detail: { projectId: confirmDeleteId },
      }),
    );

    cancelDelete();
  }

  function togglePinToTop(projectId: string) {
    setPinnedTopIds((prev) => {
      const next = prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId];

      writePinnedTopProjectIds(next);
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;

    nameInputRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const sortedProjects = useMemo(() => {
    const pinnedProjects: Project[] = [];
    const unpinnedProjects: Project[] = [];

    for (const project of projects) {
      if (pinnedTopIds.includes(project.id)) {
        pinnedProjects.push(project);
      } else {
        unpinnedProjects.push(project);
      }
    }

    const pinnedInStoredOrder = pinnedTopIds
      .map((id) => pinnedProjects.find((project) => project.id === id))
      .filter((project): project is Project => Boolean(project));

    const sortedUnpinned = [...unpinnedProjects];

    switch (sortBy) {
      case "most-active":
        sortedUnpinned.sort(
          (a, b) => Number(b.inferencesToday || 0) - Number(a.inferencesToday || 0)
        );
        break;

      case "title-az":
        sortedUnpinned.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        );
        break;

      case "created-oldest":
        sortedUnpinned.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        break;

      case "created-newest":
        sortedUnpinned.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        break;

      case "last-opened":
      default:
        sortedUnpinned.sort(
          (a, b) => getLastOpenedTimestamp(b) - getLastOpenedTimestamp(a)
        );
        break;
    }

    return [...pinnedInStoredOrder, ...sortedUnpinned];
  }, [projects, sortBy, pinnedTopIds]);

  const displayedProjects = useMemo(() => {
    const trimmedSearch = searchTerm.trim().toLowerCase();

    if (!trimmedSearch) return sortedProjects;

    return sortedProjects.filter((project) =>
      project.name.trim().toLowerCase().startsWith(trimmedSearch)
    );
  }, [sortedProjects, searchTerm]);

  const hasProjects = useMemo(
    () => hydrated && projects.length > 0,
    [hydrated, projects.length],
  );

  const hasVisibleProjects = displayedProjects.length > 0;

  const duplicateNameExists = useMemo(() => {
    const trimmedName = form.name.trim();
    if (!trimmedName) return false;

    return projects.some(
      (project) =>
        normalizeProjectName(project.name) === normalizeProjectName(trimmedName)
    );
  }, [projects, form.name]);

  return (
    <div className={styles.shell}>
      <div className={styles.mainArea}>
        <div className={styles.page}>
          <div className={styles.headerRow}>
            <h1 className={styles.title}>Projects Dashboard</h1>

            <div className={styles.headerActions}>
              {hasProjects && (
                <SearchBar value={searchTerm} onChange={setSearchTerm} />
              )}

              {hasProjects && <Sort value={sortBy} onChange={setSortBy} />}

              <button className={styles.newProjectBtn} onClick={openModal}>
                New Project
              </button>
            </div>
          </div>

          <div className={styles.content}>
            {!hasProjects && (
              <div className={styles.placeholderCard}>
                <div className={styles.placeholderTitle}>No Projects Yet</div>
                <div className={styles.placeholderText}>
                  Click{" "}
                  <button onClick={openModal} className={styles.inlineLink}>
                    New Project
                  </button>{" "}
                  to create your first one.
                </div>
              </div>
            )}

            {hasProjects && !hasVisibleProjects && (
              <div className={styles.placeholderCard}>
                <div className={styles.placeholderTitle}>No Matching Projects</div>
                <div className={styles.placeholderText}>
                  No projects start with "{searchTerm.trim()}".
                </div>
              </div>
            )}

            {hasProjects && hasVisibleProjects && (
              <div className={styles.projectsGrid}>
                {displayedProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onOpen={() => handleOpenProject(p.id)}
                    onRequestDelete={() => requestDelete(p.id)}
                    isPinnedToTop={pinnedTopIds.includes(p.id)}
                    onTogglePinToTop={() => togglePinToTop(p.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {open && (
            <div
              className={styles.overlay}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeModal();
              }}
            >
              <div className={styles.modal}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>Create New Project</h2>
                  <button className={styles.closeBtn} onClick={closeModal}>
                    ✕
                  </button>
                </div>

                <form
                  className={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();
                    onCreate();
                  }}
                >
                  <label className={styles.label}>
                    Project Name
                    <input
                      ref={nameInputRef}
                      className={styles.input}
                      value={form.name}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, name: e.target.value }));
                        setNameError("");
                      }}
                      placeholder="e.g. Waste-Sorter v2"
                      maxLength={60}
                    />
                  </label>

                  {nameError && (
                    <div className={styles.errorText}>{nameError}</div>
                  )}

                  <label className={styles.label}>
                    Project Description
                    <textarea
                      className={styles.textarea}
                      value={form.description}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="What is this project for?"
                      rows={5}
                      maxLength={400}
                    />
                  </label>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={closeModal}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className={styles.primaryBtn}
                      disabled={form.name.trim().length === 0}
                      title={
                        form.name.trim().length === 0
                          ? "Project Name is required"
                          : duplicateNameExists
                            ? "there is already an existing project with this name"
                            : "Create project"
                      }
                    >
                      Create Project
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {confirmDeleteId && (
            <div
              className={styles.overlay}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) cancelDelete();
              }}
            >
              <div className={styles.confirmModal}>
                <div className={styles.confirmTitle}>Delete Project?</div>

                {deleteStep === "ask" && (
                  <>
                    <div className={styles.confirmText}>
                      This will remove the project from your dashboard.
                    </div>

                    <div className={styles.confirmActions}>
                      <button
                        className={styles.secondaryBtn}
                        onClick={cancelDelete}
                      >
                        Cancel
                      </button>

                      <button
                        className={styles.dangerBtn}
                        onClick={goToTypeStep}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}

                {deleteStep === "type" && (
                  <>
                    <div className={styles.confirmText}>
                      Type <span className={styles.deleteKeyword}>DELETE</span>{" "}
                      to confirm.
                    </div>

                    <input
                      className={styles.confirmInput}
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder='Type "DELETE"'
                      autoFocus
                    />

                    <div className={styles.confirmActions}>
                      <button
                        className={styles.secondaryBtn}
                        onClick={cancelDelete}
                      >
                        Cancel
                      </button>

                      <button
                        className={styles.primaryBtn}
                        disabled={deleteConfirmText !== "DELETE"}
                        onClick={confirmDelete}
                      >
                        Confirm
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}