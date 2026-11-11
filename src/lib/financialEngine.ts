export interface EmployeeFinancialRate {
  userId: string;
  fullName: string;
  department: string;
  designation: string;
  costRate: number; // Internal cost per hour in USD
}

export interface ProjectFinancialItem {
  projectId: string;
  projectName: string;
  clientName: string;
  isBillable: boolean;
  billingType: string;
  billRate: number; // Client bill rate per hour in USD
  budgetHours: number;
  loggedHours: number;
  billableHours: number;
  revenue: number; // Billable hours * billRate
  laborCost: number; // Sum of (employee hours * employee costRate)
  grossProfit: number; // revenue - laborCost
  grossMarginPct: number; // (grossProfit / revenue) * 100
  marginBand: "healthy" | "watch" | "danger";
}

export interface PortfolioFinancialSummary {
  totalRevenue: number;
  totalLaborCost: number;
  totalGrossProfit: number;
  portfolioGrossMarginPct: number;
  marginBand: "healthy" | "watch" | "danger";
  activeProjectsCount: number;
  profitableProjectsCount: number;
  unprofitableProjectsCount: number;
}

export const DEFAULT_COST_RATES: Record<string, number> = {
  admin: 50,
  hr_manager: 35,
  project_manager: 45,
  employee: 30,
};

export const DEFAULT_BILL_RATE = 75; // $75/hr default client billing rate

/**
 * Calculates Project Gross Profit: Revenue - Labor Cost
 */
export function calculateGrossProfit(revenue: number, laborCost: number): number {
  return Math.round((revenue - laborCost) * 100) / 100;
}

/**
 * Calculates Gross Margin %: (Gross Profit / Revenue) * 100
 */
export function calculateGrossMarginPercentage(revenue: number, grossProfit: number): number {
  if (revenue <= 0) return 0;
  return Math.round((grossProfit / revenue) * 1000) / 10;
}

/**
 * Classifies Gross Margin RAG Band:
 * - >= 45%: Healthy
 * - 30% - 44.9%: Watch
 * - < 30%: Danger
 */
export function classifyMarginBand(marginPct: number): "healthy" | "watch" | "danger" {
  if (marginPct >= 45) return "healthy";
  if (marginPct >= 30) return "watch";
  return "danger";
}

/**
 * Evaluates full project financials from logs, projects, and cost rates
 */
export function evaluateProjectFinancials(
  projects: {
    id: string;
    name: string;
    is_billable?: boolean | null;
    billing_type?: string | null;
    budget_hours?: number | null;
    client_id?: string | null;
    clients?: { name: string } | null;
  }[],
  dailyLogs: {
    user_id: string;
    project_id: string;
    hours: number;
  }[],
  userCostRates: Map<string, number>,
  projectBillRates?: Map<string, number>
): {
  projectFinancials: ProjectFinancialItem[];
  portfolioSummary: PortfolioFinancialSummary;
} {
  let totalRevenue = 0;
  let totalLaborCost = 0;
  let profitableCount = 0;
  let unprofitableCount = 0;

  const projectFinancials: ProjectFinancialItem[] = projects.map((p) => {
    const isBillable = p.is_billable !== false;
    const billRate = projectBillRates?.get(p.id) || DEFAULT_BILL_RATE;
    const projectLogs = dailyLogs.filter((l) => l.project_id === p.id);

    let loggedHours = 0;
    let laborCost = 0;

    projectLogs.forEach((log) => {
      const h = Number(log.hours) || 0;
      loggedHours += h;
      const rate = userCostRates.get(log.user_id) || DEFAULT_COST_RATES.employee;
      laborCost += h * rate;
    });

    const billableHours = isBillable ? loggedHours : 0;
    const revenue = isBillable ? billableHours * billRate : 0;
    const grossProfit = calculateGrossProfit(revenue, laborCost);
    const grossMarginPct = calculateGrossMarginPercentage(revenue, grossProfit);
    const marginBand = classifyMarginBand(grossMarginPct);

    totalRevenue += revenue;
    totalLaborCost += laborCost;

    if (grossProfit >= 0) profitableCount++;
    else unprofitableCount++;

    return {
      projectId: p.id,
      projectName: p.name,
      clientName: (p.clients as any)?.name || "Internal",
      isBillable,
      billingType: p.billing_type || "t_and_m",
      billRate,
      budgetHours: Number(p.budget_hours) || 0,
      loggedHours: Math.round(loggedHours * 10) / 10,
      billableHours: Math.round(billableHours * 10) / 10,
      revenue: Math.round(revenue),
      laborCost: Math.round(laborCost),
      grossProfit: Math.round(grossProfit),
      grossMarginPct,
      marginBand,
    };
  });

  const totalGrossProfit = calculateGrossProfit(totalRevenue, totalLaborCost);
  const portfolioGrossMarginPct = calculateGrossMarginPercentage(totalRevenue, totalGrossProfit);
  const portfolioMarginBand = classifyMarginBand(portfolioGrossMarginPct);

  return {
    projectFinancials,
    portfolioSummary: {
      totalRevenue: Math.round(totalRevenue),
      totalLaborCost: Math.round(totalLaborCost),
      totalGrossProfit: Math.round(totalGrossProfit),
      portfolioGrossMarginPct,
      marginBand: portfolioMarginBand,
      activeProjectsCount: projects.length,
      profitableProjectsCount: profitableCount,
      unprofitableProjectsCount: unprofitableCount,
    },
  };
}

