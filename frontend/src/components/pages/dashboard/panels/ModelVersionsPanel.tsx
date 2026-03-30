"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardPanelShell from "../DashboardPanelShell";

type ModelStatus = "Stable" | "Canary" | "Archived";

type AddedModel = {
  name: string;
  addedAt: string;
};

const STATUS_STYLES: Record<ModelStatus, string> = {
  Stable: "bg-[rgba(99,102,235,1)] text-white",
  Canary: "bg-[rgba(0,179,211,1)] text-black",
  Archived: "bg-[rgba(60,60,60,1)] text-[rgba(199,199,199,0.7)]",
};

const STORAGE_PREFIX = "modelVersions";
const MODEL_STATUS_UPDATED_EVENT = "model-statuses-updated";

function storageKey(projectId: string, section: string) {
  return `${STORAGE_PREFIX}:${projectId}:${section}`;
}

function StatusPill({ status }: { status: ModelStatus }) {
  return (
    <span
      className={`px-[7px] py-[3px] rounded-full text-[14px] tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export default function ModelVersionsPanel({
  projectId,
}: {
  projectId: string;
}) {
  const [addedModels, setAddedModels] = useState<AddedModel[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ModelStatus>>({});

  const loadProjectModels = () => {
    try {
      const storedAddedModels = localStorage.getItem(
        storageKey(projectId, "addedModels"),
      );

      if (!storedAddedModels) {
        setAddedModels([]);
        return;
      }

      const parsed = JSON.parse(storedAddedModels);

      if (!Array.isArray(parsed)) {
        setAddedModels([]);
        return;
      }

      const normalized: AddedModel[] = parsed
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

      setAddedModels(normalized);
    } catch {
      setAddedModels([]);
    }
  };

  const loadStatuses = () => {
    try {
      const storedStatuses = localStorage.getItem(
        storageKey(projectId, "statuses"),
      );

      setStatuses(storedStatuses ? JSON.parse(storedStatuses) : {});
    } catch {
      setStatuses({});
    }
  };

  useEffect(() => {
    loadProjectModels();
    loadStatuses();

    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ projectId?: string }>;
      const updatedProjectId = customEvent.detail?.projectId;

      if (!updatedProjectId || updatedProjectId === projectId) {
        loadStatuses();
        loadProjectModels();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === storageKey(projectId, "addedModels") ||
        event.key === storageKey(projectId, "statuses")
      ) {
        loadProjectModels();
        loadStatuses();
      }
    };

    window.addEventListener(
      MODEL_STATUS_UPDATED_EVENT,
      handleUpdate as EventListener,
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        MODEL_STATUS_UPDATED_EVENT,
        handleUpdate as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [projectId]);

  const getStatus = (modelName: string): ModelStatus => {
    return statuses[modelName] ?? "Archived";
  };

  const displayedModels = useMemo(() => {
    const stableModel =
      addedModels.find((model) => getStatus(model.name) === "Stable") ?? null;

    const canaryModel =
      addedModels.find((model) => getStatus(model.name) === "Canary") ?? null;

    const archivedModels = addedModels.filter(
      (model) => getStatus(model.name) === "Archived",
    );

    const selected: AddedModel[] = [];
    const usedNames = new Set<string>();

    if (stableModel) {
      selected.push(stableModel);
      usedNames.add(stableModel.name);
    }

    if (canaryModel && !usedNames.has(canaryModel.name)) {
      selected.push(canaryModel);
      usedNames.add(canaryModel.name);
    }

    for (const archivedModel of archivedModels) {
      if (selected.length >= 3) break;
      if (usedNames.has(archivedModel.name)) continue;

      selected.push(archivedModel);
      usedNames.add(archivedModel.name);
    }

    return selected.slice(0, 3);
  }, [addedModels, statuses]);

  return (
    <DashboardPanelShell
      href={`/projects/${projectId}/models`}
      ariaLabel="Go to Model Versions"
      heightClass="h-[45vh]"
    >
      <div className="w-full h-full flex flex-col">
        <div className="px-[25px] pt-4 shrink-0">
          <h1 className="font-semibold tracking-wide text-white leading-[1] text-[clamp(16px,2vw,36px)]">
            Available Models
          </h1>
          <p className="mt-[2px] text-[clamp(11px,1vw,13px)] text-[rgba(199,199,199,0.6)] tracking-wide">
            Current Models & Status
          </p>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col items-center justify-evenly px-0 gap-[6px]">
          {displayedModels.length === 0 ? (
            <div className="text-[rgba(199,199,199,0.6)] text-sm opacity-60 pt-[8vh]">
              No models added yet
            </div>
          ) : (
            displayedModels.map((model) => {
              const status = getStatus(model.name);

              return (
                <div
                  key={model.name}
                  className="
                    w-[80%] rounded-[0.75rem] border-[3px]
                    border-[rgba(9,119,138,0.6)]
                    flex items-center justify-between px-4
                    text-sm overflow-hidden shrink-0
                    h-[clamp(40px,6vh,60px)]
                  "
                >
                  <span className="ml-[1vh] text-white font-bold tracking-wide whitespace-nowrap text-[clamp(14px,1.4vw,18px)]">
                    {model.name}
                  </span>

                  <div className="flex items-center gap-2 shrink-0 mr-[1vh]">
                    <StatusPill status={status} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardPanelShell>
  );
}