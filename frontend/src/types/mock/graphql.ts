// Based on schema.grapghqls
export interface Health {
    status: string;
    uptime: number;
    classifierEngine: ClassifierEngine;
    edgeNodes: ServiceStatus[];
    latencySeries: TimeSeriesPoint[];
    requestRateSeries: TimeSeriesPoint[];
    errorRateSeries: TimeSeriesPoint[];
    modelMetrics: ModelMetrics;
    confusionMatrix: ConfusionMatrix;
    rocCurve: RocPoint[];
    auc: number;
}

export interface ClassifierEngine {
  avgLatency: number;
  requestRate: number;
  errorRate: number;
}

export interface ServiceStatus {
    name: string;
    status: string;
}

export interface TimeSeriesPoint {
  time: number;
  value: number;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface ConfusionMatrix {
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
  truePositive: number;
}

export interface RocPoint {
  fpr: number;
  tpr: number;
}

// model versions
export interface Model {
    version: string;
    status: string;
    accuracy: number;
    deployed: string;
    description: string;
}

// Query response types
export interface HealthQuery {
    health: Health;
}

export interface modelVersionsQuery {
    modelVersions: Model[];
}