export interface PayCycleRange {
  startDate: Date;
  endDate: Date;
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string; // YYYY-MM-DD ISO with 23:59:59
  label: string;
  shortLabel: string;
}

export type PayCycleType = 'calendar' | 'salary';

/**
 * Returns the PayCycleRange for a given target month or date, taking into account
 * the user's payCycleType ('calendar' | 'salary') and salaryDay (1-31).
 */
export function getPayCycleRange(
  targetMonth?: string | Date | null,
  payCycleType: PayCycleType = 'calendar',
  salaryDay: number = 28
): PayCycleRange {
  const pad = (n: number) => String(n).padStart(2, '0');

  // Handle 'all' case
  if (typeof targetMonth === 'string' && targetMonth === 'all') {
    return {
      startDate: new Date(0),
      endDate: new Date(2099, 11, 31, 23, 59, 59, 999),
      startDateStr: '1970-01-01',
      endDateStr: '2099-12-31T23:59:59.999Z',
      label: 'All Time',
      shortLabel: 'All Time'
    };
  }

  // Calendar Mode or salaryDay <= 1
  if (payCycleType === 'calendar' || salaryDay <= 1) {
    let year: number;
    let month: number; // 0-indexed

    if (typeof targetMonth === 'string' && targetMonth.match(/^\d{4}-\d{2}$/)) {
      const [y, m] = targetMonth.split('-').map(Number);
      year = y;
      month = m - 1;
    } else if (targetMonth instanceof Date) {
      year = targetMonth.getFullYear();
      month = targetMonth.getMonth();
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth();
    }

    const startDate = new Date(year, month, 1, 0, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = new Date(year, month, lastDay, 23, 59, 59, 999);

    const fullLabel = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const shortLabel = startDate.toLocaleString('default', { month: 'short', year: 'numeric' });

    return {
      startDate,
      endDate,
      startDateStr: `${year}-${pad(month + 1)}-01`,
      endDateStr: `${year}-${pad(month + 1)}-${pad(lastDay)}T23:59:59.999Z`,
      label: fullLabel,
      shortLabel
    };
  }

  // Salary Mode (payCycleType === 'salary' and salaryDay > 1)
  let year: number;
  let month: number; // 0-indexed target cycle month

  if (typeof targetMonth === 'string' && targetMonth.match(/^\d{4}-\d{2}$/)) {
    const [y, m] = targetMonth.split('-').map(Number);
    year = y;
    month = m - 1;
  } else if (targetMonth instanceof Date) {
    const d = targetMonth;
    if (d.getDate() >= salaryDay) {
      // Payday reached, active cycle is for next month label
      year = d.getFullYear();
      month = d.getMonth() + 1;
    } else {
      year = d.getFullYear();
      month = d.getMonth();
    }
  } else {
    // Current date
    const d = new Date();
    if (d.getDate() >= salaryDay) {
      year = d.getFullYear();
      month = d.getMonth() + 1;
    } else {
      year = d.getFullYear();
      month = d.getMonth();
    }
  }

  // Start date: Previous month, day salaryDay (clamped)
  const prevMonthMaxDays = new Date(year, month, 0).getDate();
  const actualStartDay = Math.min(salaryDay, prevMonthMaxDays);
  const startDate = new Date(year, month - 1, actualStartDay, 0, 0, 0, 0);

  // End date: Target month, day (salaryDay - 1) (clamped)
  const currentMonthMaxDays = new Date(year, month + 1, 0).getDate();
  const actualEndDay = Math.min(salaryDay - 1, currentMonthMaxDays);
  const endDate = new Date(year, month, actualEndDay, 23, 59, 59, 999);

  const formatDateLabel = (d: Date) => d.toLocaleDateString('default', { month: 'short', day: 'numeric' });

  const label = `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`;
  const shortLabel = label;

  return {
    startDate,
    endDate,
    startDateStr: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`,
    endDateStr: `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T23:59:59.999Z`,
    label,
    shortLabel
  };
}

/**
 * Checks if a given date string or Date object falls inside a PayCycleRange.
 */
export function isDateInPayCycle(dateInput: string | Date, range: PayCycleRange): boolean {
  let d: Date;
  if (typeof dateInput === 'string') {
    // Standardize ISO date string or YYYY-MM-DD
    if (dateInput.length === 10) {
      d = new Date(`${dateInput}T12:00:00.000Z`);
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = dateInput;
  }

  if (isNaN(d.getTime())) return false;
  return d.getTime() >= range.startDate.getTime() && d.getTime() <= range.endDate.getTime();
}

/**
 * Given a month string like '2026-08', returns previous month string '2026-07'.
 */
export function getPrevMonthString(monthStr: string): string {
  if (monthStr === 'all') return 'all';
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/**
 * Given a month string like '2026-08', returns next month string '2026-09'.
 */
export function getNextMonthString(monthStr: string): string {
  if (monthStr === 'all') return 'all';
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m, 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
