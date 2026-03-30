"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import styles from "./modelV.module.css";
import { loadProjects } from "@/lib/projectsStore";

const DESCRIPTION_MAX_LENGTH = 50;
const STORAGE_PREFIX = "modelVersions";
const MODEL_STATUS_UPDATED_EVENT = "model-statuses-updated";
const MODEL_COUNT_UPDATED_EVENT = "model-count-updated";
const IMAGE_CLASSIFICATION_FILTER_KEY = "imageClassificationInitialFilter";

type ModelStatus = "Stable" | "Canary" | "Archived";

type AvailableModel = {
  name: string;
};

type AddedModel = {
  name: string;
  addedAt: string;
};

type ActionMenuState = {
  modelName: string;
  x: number;
  y: number;
} | null;

const AVAILABLE_MODEL_NAMES: string[] = [
  "edge-resnet50-v1",
  "edge-resnet50-v2",
  "edge_timm_imagenet_21k",
  "edge-efficientnet-b0_v1",
  "edge-efficientnet-b1_v1",
  "edge-efficientnet-b2_v1",
  "edge-efficientnet-b3_v1",
  "edge-efficientnet-b4_v1",
  "edge-efficientnet-b5_v1",
  "edge-efficientnet-b6_v1",
  "edge-efficientnet-b7_v1",
  "edge-googlenet_v1",
  "edge-wide_resnet-50_v1",
  "edge-wide_resnet-50_v2",
  "edge-resnet101_v1",
  "edge-resnet101_v2",
  "edge-resnet152_v1",
  "edge-resnet152_v2",
  "edge-mobilenetv2_v1",
  "edge-mobilenetv2_v2",
  "edge-mobilenetv3small_v1",
  "edge-mobilenetv3large_v1",
  "edge-alexnet_v1",
  "edge-shufflenet_v1",
  "edge-densenet201_v1",
  "edge-squeezenet1_1_v1",
  "edge-resnex101_32x8_v1",
  "edge-resnex101_32x8_v2",
  "edge-convnext_base_v1",
];

const AVAILABLE_MODELS: AvailableModel[] = AVAILABLE_MODEL_NAMES.map((name) => ({
  name,
}));

function storageKey(projectId: string, section: string) {
  return `${STORAGE_PREFIX}:${projectId}:${section}`;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ModelVersions() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
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

  const [models] = useState<AvailableModel[]>(AVAILABLE_MODELS);
  const [addedModels, setAddedModels] = useState<AddedModel[]>([]);
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, ModelStatus>>({});
  const [hasHydratedProjectState, setHasHydratedProjectState] = useState(false);

  const [editingDescription, setEditingDescription] = useState<string | null>(
    null
  );
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [actionMenu, setActionMenu] = useState<ActionMenuState>(null);
  const [isAddModelsOpen, setIsAddModelsOpen] = useState(false);

  const descriptionInputRef = useRef<HTMLInputElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const statusClass = (status: ModelStatus) => {
    switch (status) {
      case "Stable":
        return styles.badgeStable;
      case "Canary":
        return styles.badgeCanary;
      default:
        return styles.badgeArchived;
    }
  };

  const getStatusForModel = (modelName: string): ModelStatus => {
    return statuses[modelName] ?? "Archived";
  };

  const getActionsForStatus = (status: ModelStatus) => {
    switch (status) {
      case "Archived":
        return [
          { label: "Promote to Canary", nextStatus: "Canary" as ModelStatus },
        ];
      case "Canary":
        return [{ label: "Archive", nextStatus: "Archived" as ModelStatus }];
      case "Stable":
        return [{ label: "Archive", nextStatus: "Archived" as ModelStatus }];
      default:
        return [];
    }
  };

  useEffect(() => {
    setHasHydratedProjectState(false);

    setAddedModels([]);
    setDescriptions({});
    setStatuses({});
    setEditingDescription(null);
    setDescriptionDraft("");
    setActionMenu(null);
    setIsAddModelsOpen(false);
    setError(null);

    let nextDescriptions: Record<string, string> = {};
    let nextStatuses: Record<string, ModelStatus> = {};
    let nextAddedModels: AddedModel[] = [];

    try {
      const storedDescriptions = localStorage.getItem(
        storageKey(projectId, "descriptions")
      );
      nextDescriptions = storedDescriptions ? JSON.parse(storedDescriptions) : {};
    } catch {
      nextDescriptions = {};
    }

    try {
      const storedStatuses = localStorage.getItem(
        storageKey(projectId, "statuses")
      );
      nextStatuses = storedStatuses ? JSON.parse(storedStatuses) : {};
    } catch {
      nextStatuses = {};
    }

    try {
      const storedAddedModels = localStorage.getItem(
        storageKey(projectId, "addedModels")
      );

      if (storedAddedModels) {
        const parsed = JSON.parse(storedAddedModels);

        if (Array.isArray(parsed)) {
          nextAddedModels = parsed
            .map((item) => {
              if (typeof item === "string") {
                return {
                  name: item,
                  addedAt: new Date().toISOString(),
                };
              }

              if (
                item &&
                typeof item === "object" &&
                typeof item.name === "string"
              ) {
                return {
                  name: item.name,
                  addedAt:
                    typeof item.addedAt === "string"
                      ? item.addedAt
                      : new Date().toISOString(),
                };
              }

              return null;
            })
            .filter((item): item is AddedModel => item !== null);
        }
      }
    } catch {
      nextAddedModels = [];
    }

    setDescriptions(nextDescriptions);
    setStatuses(nextStatuses);
    setAddedModels(nextAddedModels);
    setHasHydratedProjectState(true);
  }, [projectId]);

  useEffect(() => {
    if (!hasHydratedProjectState) return;

    localStorage.setItem(
      storageKey(projectId, "descriptions"),
      JSON.stringify(descriptions)
    );
  }, [descriptions, projectId, hasHydratedProjectState]);

  useEffect(() => {
    if (!hasHydratedProjectState) return;

    localStorage.setItem(
      storageKey(projectId, "statuses"),
      JSON.stringify(statuses)
    );

    window.dispatchEvent(
      new CustomEvent(MODEL_STATUS_UPDATED_EVENT, {
        detail: { projectId, statuses },
      })
    );
  }, [statuses, projectId, hasHydratedProjectState]);

  useEffect(() => {
    if (!hasHydratedProjectState) return;

    localStorage.setItem(
      storageKey(projectId, "addedModels"),
      JSON.stringify(addedModels)
    );

    window.dispatchEvent(
      new CustomEvent(MODEL_COUNT_UPDATED_EVENT, {
        detail: {
          projectId,
          count: addedModels.length,
        },
      })
    );
  }, [addedModels, projectId, hasHydratedProjectState]);

  useEffect(() => {
    if (editingDescription !== null) {
      descriptionInputRef.current?.focus();
      descriptionInputRef.current?.select();
    }
  }, [editingDescription]);

  useEffect(() => {
    if (!actionMenu && !isAddModelsOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (actionMenuRef.current && !actionMenuRef.current.contains(target)) {
        setActionMenu(null);
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionMenu(null);
        setIsAddModelsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [actionMenu, isAddModelsOpen]);

  const startEditingDescription = (modelName: string) => {
    setEditingDescription(modelName);
    setDescriptionDraft(descriptions[modelName] ?? "");
  };

  const commitDescriptionEdit = () => {
    if (editingDescription === null) return;

    setDescriptions((prev) => ({
      ...prev,
      [editingDescription]: descriptionDraft
        .trim()
        .slice(0, DESCRIPTION_MAX_LENGTH),
    }));

    setEditingDescription(null);
    setDescriptionDraft("");
  };

  const cancelDescriptionEdit = () => {
    setEditingDescription(null);
    setDescriptionDraft("");
  };

  const handleDescriptionKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commitDescriptionEdit();
      return;
    }

    if (event.key === "Escape") {
      cancelDescriptionEdit();
    }
  };

  const openActionMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    modelName: string
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();

    setActionMenu({
      modelName,
      x: rect.right,
      y: rect.bottom + 8,
    });
  };

  const applyModelStatusAction = (modelName: string, nextStatus: ModelStatus) => {
    setStatuses((prev) => {
      const nextStatuses = { ...prev };

      if (nextStatus === "Stable") {
        Object.keys(nextStatuses).forEach((key) => {
          if (nextStatuses[key] === "Stable") {
            nextStatuses[key] = "Archived";
          }
        });
      }

      if (nextStatus === "Canary") {
        Object.keys(nextStatuses).forEach((key) => {
          if (nextStatuses[key] === "Canary") {
            nextStatuses[key] = "Archived";
          }
        });
      }

      nextStatuses[modelName] = nextStatus;
      return nextStatuses;
    });

    setActionMenu(null);
  };

  const isModelAdded = (modelName: string) => {
    return addedModels.some((item) => item.name === modelName);
  };

  const toggleModelInProject = (model: AvailableModel) => {
    const exists = addedModels.some((item) => item.name === model.name);

    if (exists) {
      setAddedModels((prev) => prev.filter((item) => item.name !== model.name));
      setDescriptions((prev) => {
        const next = { ...prev };
        delete next[model.name];
        return next;
      });
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[model.name];
        return next;
      });
      setActionMenu((prev) => (prev?.modelName === model.name ? null : prev));
      setEditingDescription((prev) => (prev === model.name ? null : prev));
      return;
    }

    const now = new Date().toISOString();

    setAddedModels((prev) => [
      ...prev,
      {
        name: model.name,
        addedAt: now,
      },
    ]);

    setStatuses((prev) => ({
      ...prev,
      [model.name]: prev[model.name] ?? "Archived",
    }));
  };

  if (error) {
    return (
      <div className="mb-4 p-1 rounded-2xl bg-gray-900 text-red-500">
        Error: {error}
      </div>
    );
  }

  const activeMenuStatus =
    actionMenu !== null ? getStatusForModel(actionMenu.modelName) : null;
  const activeMenuActions =
    activeMenuStatus !== null ? getActionsForStatus(activeMenuStatus) : [];

  return (
    <div className={styles.wrapper}>
      <div className={styles.shell}>
        <div className={styles.page}>
          <div className={styles.wrapper}>
            <h1 className={styles.pageHeader}>
              {projectName ?? currentProjectId}
            </h1>
            <p className={styles.pageSubline}>Model Versions</p>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.panelTitle}>Available Models</div>
                  <div className={styles.panelSubtitle}>
                    Add models from the classification engine
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.addModelsButton}
                  onClick={() => setIsAddModelsOpen(true)}
                >
                  Add Models
                </button>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead className={styles.thead}>
                    <tr className={styles.headRow}>
                      <th className={styles.th}>Model Name</th>
                      <th className={styles.th}>Status</th>
                      <th className={styles.th}>Deployed</th>
                      <th className={styles.th}>Description</th>
                      <th className={styles.th}>Actions</th>
                    </tr>
                  </thead>

                  <tbody className={styles.tbody}>
                    {addedModels.length === 0 ? (
                      <tr>
                        <td className={styles.empty} colSpan={5}>
                          No models added yet
                        </td>
                      </tr>
                    ) : (
                      addedModels.map((model, index) => {
                        const status = getStatusForModel(model.name);
                        const isEditing = editingDescription === model.name;
                        const description = descriptions[model.name] ?? "";
                        const trimmedDescription = description.trim();

                        return (
                          <tr
                            key={`${projectId}-${model.name}-${index}`}
                            className={styles.bodyRow}
                          >
                            <td className={styles.td}>
                              {status === "Stable" || status === "Canary" ? (
                                <button
                                  type="button"
                                  className={styles.modelLinkButton}
                                  onClick={() => {
                                    sessionStorage.setItem(
                                      IMAGE_CLASSIFICATION_FILTER_KEY,
                                      status
                                    );
                                    router.push(`/projects/${projectId}/classify`);
                                  }}
                                >
                                  {model.name}
                                </button>
                              ) : (
                                model.name
                              )}
                            </td>

                            <td className={styles.td}>
                              <span className={statusClass(status)}>
                                {status}
                              </span>
                            </td>

                            <td className={styles.td}>
                              {formatDate(model.addedAt)}
                            </td>

                            <td className={styles.td}>
                              {isEditing ? (
                                <input
                                  ref={descriptionInputRef}
                                  type="text"
                                  value={descriptionDraft}
                                  maxLength={DESCRIPTION_MAX_LENGTH}
                                  onChange={(event) =>
                                    setDescriptionDraft(event.target.value)
                                  }
                                  onBlur={commitDescriptionEdit}
                                  onKeyDown={handleDescriptionKeyDown}
                                  className={styles.descriptionInput}
                                />
                              ) : (
                                <button
                                  type="button"
                                  className={styles.descriptionButton}
                                  onClick={() =>
                                    startEditingDescription(model.name)
                                  }
                                >
                                  {trimmedDescription || "Add description"}
                                </button>
                              )}
                            </td>

                            <td className={styles.td}>
                              <button
                                type="button"
                                className={styles.actionsButton}
                                onClick={(event) =>
                                  openActionMenu(event, model.name)
                                }
                              >
                                Actions
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.panelFooterSpace} />
            </div>
          </div>
        </div>
      </div>

      {isAddModelsOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsAddModelsOpen(false)}
        >
          <div
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>
                  Models in Classification Engine
                </div>
                <div className={styles.modalSubtitle}>
                  Click a model to add or remove it from the table
                </div>
              </div>

              <button
                type="button"
                className={styles.modalCloseButton}
                onClick={() => setIsAddModelsOpen(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalScrollArea}>
                {loading ? (
                  <div className={styles.empty}>Loading...</div>
                ) : models.length === 0 ? (
                  <div className={styles.empty}>No model data available</div>
                ) : (
                  <div className={styles.modelList}>
                    {models.map((model, index) => {
                      const checked = isModelAdded(model.name);

                      return (
                        <button
                          key={`${projectId}-${model.name}-${index}`}
                          type="button"
                          className={styles.modelListItemButton}
                          onClick={() => toggleModelInProject(model)}
                        >
                          <div className={styles.modelListItemRow}>
                            <div>
                              <div className={styles.modelListName}>
                                {model.name}
                              </div>
                              <div className={styles.modelListMeta}>
                                {checked
                                  ? "Added to Available Models"
                                  : "Click to add to Available Models"}
                              </div>
                            </div>

                            <span
                              className={`${styles.checkBox} ${
                                checked ? styles.checkBoxChecked : ""
                              }`}
                              aria-hidden="true"
                            >
                              {checked ? "✓" : ""}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {actionMenu && activeMenuActions.length > 0 ? (
        <div
          ref={actionMenuRef}
          className={styles.actionMenu}
          style={{
            top: actionMenu.y,
            left: actionMenu.x,
          }}
        >
          {activeMenuActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={styles.actionMenuItem}
              onClick={() =>
                applyModelStatusAction(actionMenu.modelName, action.nextStatus)
              }
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}