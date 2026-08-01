/**
 * Gauge utility functions — extracted from DashboardGaugeChart.tsx
 *
 * Pure functions for budget gauge calculations.
 * Separated from the React component so they can be unit-tested
 * without a DOM environment.
 */

export interface GaugeData {
  totalBudget: number;
  usedBudget: number;
}

export interface GaugeCalculation {
  percentage: number;
  radius: number;
  strokeWidth: number;
  halfCircumference: number;
  strokeDashoffset: number;
}

/**
 * Calculate gauge percentage — clamped to 0-100, rounded.
 * Returns 0 if totalBudget is 0 or negative (avoids division by zero).
 */
export function calculateGaugePercentage(totalBudget: number, usedBudget: number): number {
  if (totalBudget <= 0) return 0;
  return Math.min(100, Math.round((usedBudget / totalBudget) * 100));
}

/**
 * Calculate all gauge SVG arc parameters from budget data.
 */
export function calculateGaugeArc(data: GaugeData): GaugeCalculation {
  const radius = 70;
  const strokeWidth = 14;
  const halfCircumference = Math.PI * radius; // ≈ 219.9
  const percentage = calculateGaugePercentage(data.totalBudget, data.usedBudget);
  const strokeDashoffset = halfCircumference * (1 - percentage / 100);

  return {
    percentage,
    radius,
    strokeWidth,
    halfCircumference,
    strokeDashoffset,
  };
}

/**
 * Determine the gauge status label based on percentage.
 * - < 70% → "ปกติ" (normal)
 * - 70-89% → "ใกล้เต็ม" (near full)
 * - ≥ 90% → "เกินงบ" (over budget)
 */
export function getGaugeStatusLabel(percentage: number): string {
  if (percentage >= 90) return "เกินงบ";
  if (percentage >= 70) return "ใกล้เต็ม";
  return "ปกติ";
}
