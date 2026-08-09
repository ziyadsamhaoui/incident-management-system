// ── Analytics & Quality Engineering types ────────
// Mirrors the backend dto/analytics records (no fabricated fields).

/** One time bucket of the volume/speed series. */
export interface VolumeSpeedBucket {
  label: string;
  reported: number;
  resolved: number;
  nonResolved: number;
  mttrHours: number | null;
  timeToClaimHours: number | null;
}

export interface VolumeSpeedTotals {
  reported: number;
  resolved: number;
  nonResolved: number;
  /** RESOLVED share of evaluated incidents, in percent. */
  resolutionRatePct: number;
  mttrHours: number | null;
  timeToClaimHours: number | null;
}

/** Period-over-period percentage change. */
export interface MetricDelta {
  /** Percentage delta; null when not computable (previous period empty). */
  pct: number | null;
  /** true → increase is an improvement (resolution rate). */
  goodWhenUp: boolean;
}

export interface VolumeSpeedDeltas {
  reported: MetricDelta | null;
  resolutionRate: MetricDelta | null;
  mttr: MetricDelta | null;
  timeToClaim: MetricDelta | null;
}

export interface DepartmentVolume {
  name: string;
  count: number;
}

export interface VolumeSpeedResponse {
  buckets: VolumeSpeedBucket[];
  totals: VolumeSpeedTotals;
  deltas: VolumeSpeedDeltas | null;
  departments: DepartmentVolume[];
}

/** One Pareto category row, sorted descending with cumulative share. */
export interface ParetoCategory {
  name: string;
  count: number;
  cumulativePct: number;
}

/** "N of M categories account for P% of all recorded incidents". */
export interface ParetoInsight {
  categoriesTo80: number;
  totalCategories: number;
  pctCovered: number;
}

export interface ParetoResponse {
  categories: ParetoCategory[];
  totalCount: number;
  insight: ParetoInsight | null;
}

/** One non-zero cell of the Hour × DayOfWeek matrix. */
export interface HeatmapCell {
  /** 0 = Monday … 6 = Sunday (ISO, Monday-first). */
  dayOfWeek: number;
  /** 0–23 local hour. */
  hour: number;
  count: number;
}

export interface HeatmapResponse {
  cells: HeatmapCell[];
  totalCount: number;
}

/** Rule-based repeat-incident signal (≥ 3 same station+category in 14 days). */
export interface RepeatSignal {
  stationId: number | null;
  stationCode: string | null;
  categoryId: number | null;
  categoryName: string | null;
  departmentName: string | null;
  incidentCount: number;
  firstOccurrence: string | null;
  lastOccurrence: string | null;
  latestReference: string | null;
  latestIncidentId: number | null;
}

export interface RepeatSignalResponse {
  signals: RepeatSignal[];
}

/** One row of the ADMIN-scoped team workload table. */
export interface WorkloadEntry {
  userId: number | null;
  firstName: string;
  lastName: string;
  claimedCount: number;
  resolvedCount: number;
  nonResolvedCount: number;
  evaluatedCount: number;
  avgResolutionHours: number | null;
}
