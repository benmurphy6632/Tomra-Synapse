"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import styles from "./greenComputing.module.css";

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
  query {
    engineOutputsAll: engineOutputsAll {
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

const POLL_INTERVAL_MS = 2000;

async function fetchAllEngineOutputs(): Promise<EngineOutput[]> {
  const endpoint =
    process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:8080/graphql";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: GRAPHQL_QUERY }),
      cache: "no-store",
    });

    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.engineOutputsAll ?? [];
  } catch {
    return [];
  }
}

function Donut({ label, value }: { label: string; value: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const duration = 1400;

      function animate(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);

        const eased = progress;
        setDisplayed(Math.round(eased * value));

        if (progress < 1) requestAnimationFrame(animate);
      }

      requestAnimationFrame(animate);
    }, 300);

    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <div className={styles.usageWrap}>
      <div
        className={styles.donut}
        style={{ "--p": displayed } as React.CSSProperties}
        data-value={`${displayed}%`}
      />
      <span className={styles.usageLabel}>{label}</span>
    </div>
  );
}

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
  tick: { fontSize: 10, fill: "rgba(255,255,255,0.35)" },
};

export default function GreenComputing() {
  const [data, setData] = useState<EngineOutput[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load(showLoading = false) {
      try {
        if (showLoading) setLoading(true);

        const outputs = await fetchAllEngineOutputs();

        if (isMounted) {
          setData(outputs);
        }
      } catch (err) {
        console.error("Failed to fetch Green Computing Data", err);
      } finally {
        if (isMounted && showLoading) {
          setLoading(false);
        }
      }
    }

    load(true);

    const interval = setInterval(() => {
      load(false);
    }, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const latest = data.length > 0 ? data[data.length - 1] : null;

  const powerUsage = latest?.powerUsage ?? 0;
  const powerPercent = Math.min((powerUsage / 100) * 100, 100);

  const latencySeries = useMemo(
    () =>
      data.map((d, i) => ({
        idx: i + 1,
        value: Number(((d.latency ?? 0) * 1000).toFixed(1)),
      })),
    [data],
  );

  const co2Series = useMemo(
    () =>
      data.map((d, i) => ({
        idx: i + 1,
        value: Number(((d.co2Emissions ?? 0) * 1000).toFixed(4)),
      })),
    [data],
  );

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function inverseScore(value: number, good: number, bad: number) {
    if (bad === good) return 100;
    const normalized = (value - good) / (bad - good);
    return clamp(100 - normalized * 100, 0, 100);
  }

  const LATENCY_GOOD_MS = 300;
  const LATENCY_BAD_MS = 2000;

  const POWER_GOOD_W = 10;
  const POWER_BAD_W = 100;

  const CO2_GOOD_MG = 0.15;
  const CO2_BAD_MG = 1.5;

  const avgLatencyMs =
    data.length > 0
      ? data.reduce((sum, d) => sum + (d.latency ?? 0) * 1000, 0) / data.length
      : 0;

  const avgPowerUsage =
    data.length > 0
      ? data.reduce((sum, d) => sum + (d.powerUsage ?? 0), 0) / data.length
      : 0;

  const avgCo2Mg =
    data.length > 0
      ? data.reduce((sum, d) => sum + (d.co2Emissions ?? 0) * 1000, 0) /
        data.length
      : 0;

  const latencyScore = inverseScore(
    avgLatencyMs,
    LATENCY_GOOD_MS,
    LATENCY_BAD_MS,
  );
  const powerScore = inverseScore(avgPowerUsage, POWER_GOOD_W, POWER_BAD_W);
  const co2Score = inverseScore(avgCo2Mg, CO2_GOOD_MG, CO2_BAD_MG);

  const efficiencyScore =
    latencyScore * 0.35 + powerScore * 0.35 + co2Score * 0.3;

  const scorePercent = clamp(efficiencyScore, 0, 100);

  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        <div className={styles.title}>Green Computing</div>
        <div className={styles.subtitle}>
          Real-time energy &amp; sustainability metrics
        </div>

        <div className={styles.grid}>
          <div className={`${styles.panel} ${styles.wide}`}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Power Draw</span>
              <button className={styles.panelHelp} aria-label="About Power Draw">
                ?
                <span className={styles.tooltip}>
                  System power consumption in watts. Lower values mean better
                  energy efficiency.
                </span>
              </button>
            </div>
            <div className={styles.panelHeader}>
              <p className={styles.panelSub}>System energy consumption</p>
              {loading ? (
                <span className={styles.panelValue}>Loading...</span>
              ) : (
                <span className={styles.panelValue}>
                  {powerUsage.toFixed(1)} W
                </span>
              )}
            </div>
            {!loading && (
              <>
                <div></div>
                <div className={styles.powerBar}>
                  <div
                    className={styles.powerBarFill}
                    style={{ width: `${powerPercent}%` }}
                  />
                </div>
                <div className={styles.powerLabels}>
                  <span>0 W</span>
                  <span>100 W</span>
                </div>
                <div className={styles.axisLabel}>
                  Peak:{" "}
                  {data.length > 0
                    ? Math.max(...data.map((d) => d.powerUsage ?? 0)).toFixed(3)
                    : 0}{" "}
                  W
                </div>
              </>
            )}
          </div>

          <div className={`${styles.panel} ${styles.panelNarrow}`}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>CPU / GPU Usage</span>
              <button
                className={styles.panelHelp}
                aria-label="About CPU/GPU Usage"
              >
                ?
                <span className={styles.tooltip}>
                  Compute utilisation levels. Percentage of available compute
                  capacity currently in use.
                </span>
              </button>
            </div>
            <p className={styles.panelSub}>Compute utilisation</p>
            <div className={styles.usageRow}>
              <Donut label="CPU" value={100} />
              <Donut label="GPU" value={0} />
            </div>
          </div>

          <div className={styles.colStack}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Latency</span>
                <button
                  className={styles.panelHelp}
                  aria-label="About Latency Panel"
                >
                  ?
                  <span className={styles.tooltip}>
                    Time taken to complete one inference request. Faster
                    responses improve efficiency and user experience.
                  </span>
                </button>
              </div>
              <div className={styles.panelSub}>
                <p className={styles.panelSub}>Inference response time</p>
                {loading ? (
                  <span className={styles.panelValue}>Loading...</span>
                ) : (
                  <span className={styles.chartValue}>
                    avg: {avgLatencyMs.toFixed(1)}ms
                  </span>
                )}
              </div>
              {!loading && latencySeries.length > 0 && (
                <div className={styles.chartWrap}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={latencySeries}
                      margin={{ top: 11, right: 12, left: 12, bottom: 8 }}
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="idx" {...axisProps} />
                      <YAxis {...axisProps} unit=" ms" />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v) => [`${v} ms`, "Latency"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#a9ba9d"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 4, fill: "#a9ba9d" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>CO₂ Emissions</span>
                <button
                  className={styles.panelHelp}
                  aria-label="About CO2 Emmisions Panel"
                >
                  ?
                  <span className={styles.tooltip}>
                    Estimated carbon emissions per inference request, shown in
                    milligrams of CO₂ equivalent.
                  </span>
                </button>
              </div>
              <div className={styles.panelSub}>
                <p className={styles.panelSub}>Carbon per inference request</p>
                {loading ? (
                  <span className={styles.panelValue}>Loading...</span>
                ) : (
                  <span className={styles.chartValue}>
                    avg: {avgCo2Mg.toFixed(3)}mgCO₂e
                  </span>
                )}
              </div>
              {!loading && co2Series.length > 0 && (
                <div className={styles.chartWrap}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={co2Series}
                      margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="idx" {...axisProps} />
                      <YAxis {...axisProps} unit=" mg" />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v) => [`${v} mg`, "CO₂"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#01796f"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 4, fill: "#01796f" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className={`${styles.panel} ${styles.wide}`}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Green Efficiency Score</span>
              <button
                className={styles.panelHelp}
                aria-label="About Green efficiency score"
              >
                ?
                <span className={styles.tooltip}>
                  A composite sustainability score from 0–100 based on average
                  latency, power draw, and CO₂ emissions across recent
                  inferences. Each metric is converted to a normalised
                  efficiency score and weighted into the final result (Latency
                  35%, Power 35%, CO₂ 30%). Higher values mean the system is
                  operating more efficiently and with lower environmental
                  impact.
                </span>
              </button>
            </div>
            <div className={styles.panelHeader}>
              <p className={styles.panelSub}>
                Composite sustainability index (0–100)
              </p>
              {loading ? (
                <span className={styles.panelValue}>Loading...</span>
              ) : (
                <span className={styles.panelValue}>
                  {efficiencyScore.toFixed(2)} / 100
                </span>
              )}
            </div>
            {!loading && (
              <div className={styles.efficiencyTrack}>
                <div
                  className={styles.efficiencyFill}
                  style={{ width: `${scorePercent}%` }}
                />
                <div style={{ left: `${scorePercent}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}