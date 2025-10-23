/**
 * Date Utility Functions
 * Helper functions for date calculations, especially for cost proration
 */

/**
 * Calculate the number of days between two dates (inclusive)
 */
export function daysBetween(startDate: Date, endDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / msPerDay) + 1; // +1 to make it inclusive
}

/**
 * Calculate overlap days between two date ranges
 * Returns 0 if ranges don't overlap
 *
 * @param period1Start - Start of first period
 * @param period1End - End of first period
 * @param period2Start - Start of second period
 * @param period2End - End of second period
 */
export function calculateOverlapDays(
  period1Start: Date,
  period1End: Date,
  period2Start: Date,
  period2End: Date
): number {
  // Find the latest start date and earliest end date
  const overlapStart = period1Start > period2Start ? period1Start : period2Start;
  const overlapEnd = period1End < period2End ? period1End : period2End;

  // If ranges don't overlap, return 0
  if (overlapStart > overlapEnd) {
    return 0;
  }

  return daysBetween(overlapStart, overlapEnd);
}

/**
 * Prorate cost based on overlap days
 *
 * @param totalCost - Total cost for the billing period
 * @param periodDays - Total days in the billing period
 * @param overlapDays - Number of days that overlap with query range
 */
export function prorateCostForPeriod(
  totalCost: number,
  periodDays: number,
  overlapDays: number
): number {
  if (periodDays <= 0) return 0;
  if (overlapDays <= 0) return 0;
  if (overlapDays > periodDays) return totalCost; // Full cost if overlap exceeds period

  const dailyRate = totalCost / periodDays;
  return dailyRate * overlapDays;
}

/**
 * Parse date string to Date object
 * Handles various formats: YYYY-MM-DD, ISO strings, etc.
 */
export function parseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return date;
}

/**
 * Format date to YYYY-MM-DD format (SQLite compatible)
 */
export function formatDateToSQLite(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date falls within a date range (inclusive)
 */
export function isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

/**
 * Calculate the end date for a billing period given a start date and period type
 *
 * @param startDate - Start date of the billing period
 * @param billingPeriod - Type of billing period
 */
export function calculateEndDate(startDate: Date, billingPeriod: string): Date {
  const result = new Date(startDate);

  switch (billingPeriod) {
    case 'daily':
      // End date is the same as start date
      return result;

    case 'weekly':
      result.setDate(result.getDate() + 6); // 7 days total (inclusive)
      return result;

    case 'monthly':
      result.setMonth(result.getMonth() + 1);
      result.setDate(0); // Last day of the month
      return result;

    case 'quarterly':
      result.setMonth(result.getMonth() + 3);
      result.setDate(0); // Last day of the quarter
      return result;

    default:
      // For 'custom' or unknown, return the same date (must be manually specified)
      return result;
  }
}

/**
 * Get the first day of the month for a given date
 */
export function getFirstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get the last day of the month for a given date
 */
export function getLastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
