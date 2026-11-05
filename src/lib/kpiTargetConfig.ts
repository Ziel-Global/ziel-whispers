export interface KpiTargetConfig {
  companyUtilizationMin: number;
  companyUtilizationMax: number;
  billableUtilizationTarget: number;
  logComplianceTarget: number;
  onTimeDeliveryTarget: number;
  grossMarginTarget: number;
  maxBlockerAgeDays: number;
  budgetBurnWarningPct: number;
  budgetBurnCriticalPct: number;
  burnoutUtilizationPct: number;
}

export const DEFAULT_KPI_TARGETS: KpiTargetConfig = {
  companyUtilizationMin: 75,
  companyUtilizationMax: 85,
  billableUtilizationTarget: 70,
  logComplianceTarget: 90,
  onTimeDeliveryTarget: 85,
  grossMarginTarget: 45,
  maxBlockerAgeDays: 3,
  budgetBurnWarningPct: 75,
  budgetBurnCriticalPct: 90,
  burnoutUtilizationPct: 105,
};

const STORAGE_KEY = "ziel_kpi_targets_config_v1";

export function loadKpiTargets(): KpiTargetConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_KPI_TARGETS;
    return { ...DEFAULT_KPI_TARGETS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_KPI_TARGETS;
  }
}

export function saveKpiTargets(config: KpiTargetConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save KPI targets to localStorage:", e);
  }
}

export function resetKpiTargets(): KpiTargetConfig {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to reset KPI targets:", e);
  }
  return DEFAULT_KPI_TARGETS;
}

