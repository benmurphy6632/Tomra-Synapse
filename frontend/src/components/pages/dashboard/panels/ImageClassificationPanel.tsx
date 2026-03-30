"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardPanelShell from "../DashboardPanelShell";

type EngineOutput = {
  deviceId: string;
  imageName: string;
  predictedLabel: string;
  confidence: number;
  model: string;
  classId: number;
  latency: number;
  imageURL: string;
  powerUsage: number;
  co2Emissions: number;
};

const GRAPHQL_QUERY = `
  query EngineOutputs($projectId: String!) {
    engineOutputs(projectId: $projectId) {
      deviceId
      imageName
      predictedLabel
      confidence
      model
      classId
      latency
      imageURL
      powerUsage
      co2Emissions
    }
  }
`;

async function fetchOutputs(projectId: string): Promise<EngineOutput[]> {
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
    return Array.isArray(json.data?.engineOutputs) ? json.data.engineOutputs : [];
  } catch {
    return [];
  }
}

function toTitleCaseLabel(label: string) {
  return label
    .trim()
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part
            ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            : part,
        )
        .join("-"),
    )
    .join(" ");
}

export default function ImageClassificationPanel({
  projectId,
}: {
  projectId: string;
}) {
  const [data, setData] = useState<EngineOutput[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const results = await fetchOutputs(projectId);
    setData(results);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  const getConfidenceColor = (confidence: number) => {
    const percent = confidence * 100;

    if (percent >= 85) return "text-[rgba(34,197,94,1)]";
    if (percent >= 70) return "text-[rgba(0,179,211,1)]";
    if (percent >= 50) return "text-[rgba(234,179,8,1)]";
    return "text-[rgba(239,68,68,1)]";
  };

  const rows = data.slice(-3).reverse();

  return (
    <DashboardPanelShell
      href={`/projects/${projectId}/classify`}
      ariaLabel="Go to Image Classification"
      heightClass="h-[30vh]"
    >
      <div className="w-full h-full flex flex-col">
        <div className="h-full flex flex-col overflow-hidden">
          <div className="px-[25px] pt-6">
            <h1
              className="
                max-w-[60%]
                font-semibold
                tracking-wide
                text-white
                leading-[1]
                whitespace-nowrap
                text-[clamp(18px,2vw,40px)]
              "
            >
              Recent Classifications
            </h1>

            <p className="-mt-2 text-[clamp(12px,1vw,14px)] text-[rgba(199,199,199,0.6)] tracking-wide">
              {loading
                ? "Connecting to backend…"
                : data.length > 0
                  ? "View Live Classification Results"
                  : "Waiting for classifications"}
            </p>
          </div>

          <div className="flex-1 mt-4 overflow-hidden flex flex-col items-center gap-[6px]">
            {loading ? (
              <div className="w-[80%] h-full flex items-center justify-center text-center text-[rgba(199,199,199,0.6)] text-sm pt-[8vh] opacity-60">
                Connecting to backend…
              </div>
            ) : rows.length === 0 ? (
              <div className="w-[80%] h-full flex items-center justify-center text-center text-[rgba(199,199,199,0.6)] text-sm pt-[8vh] opacity-60">
                No classifications available yet.
              </div>
            ) : (
              rows.map((item, index) => (
                <div
                  key={`${item.deviceId}-${item.imageName}-${index}`}
                  className="w-[80%] h-[40px] rounded-[1rem] border-[3px]
                             border-[rgba(9,119,138,0.527)]
                             flex items-center justify-between px-4
                             text-sm overflow-hidden shrink-0"
                >
                  <span className="ml-[12px] text-[rgba(199,199,199)] font-medium truncate">
                    {toTitleCaseLabel(item.predictedLabel)}
                  </span>

                  <span className="mr-[12px] text-[rgba(199,199,199)] whitespace-nowrap">
                    Confidence:{" "}
                    <span className={getConfidenceColor(item.confidence)}>
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardPanelShell>
  );
}