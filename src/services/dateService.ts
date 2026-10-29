import {
  format,
  subDays,
  addDays,
  subWeeks,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  setDate,
  parseISO,
  isValid,
  isBefore,
} from "date-fns";

/**
 * Word to number mapping for relative phrases like "two days ago"
 */
const WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  a: 1,
  an: 1,
};

const DAY_OF_WEEK_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export interface ParsedDateResult {
  dateStr: string; // YYYY-MM-DD
  confidence: number;
  matchedPhrase?: string;
  isRelative: boolean;
}

export interface DateRangeResult {
  startDateStr: string; // YYYY-MM-DD
  endDateStr: string;   // YYYY-MM-DD
  label: string;
}

/**
 * Deterministically interprets relative or explicit date phrases.
 * Accepts a reference date (clock) so all tests and evaluations are 100% deterministic.
 */
export function parseRelativeDate(
  input: string,
  referenceDate: Date = new Date()
): ParsedDateResult | null {
  if (!input || typeof input !== "string") return null;

  const normalized = input.trim().toLowerCase();

  // 1. "N days ago" (e.g. "two days ago", "3 days ago") - check before yesterday so "two days ago, not yesterday" works!
  const daysAgoMatch = normalized.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\s+ago\b/
  );
  if (daysAgoMatch) {
    const rawNum = daysAgoMatch[1];
    const days = WORD_TO_NUMBER[rawNum] ?? parseInt(rawNum, 10);
    if (!isNaN(days)) {
      const target = subDays(referenceDate, days);
      return {
        dateStr: format(target, "yyyy-MM-dd"),
        confidence: 0.95,
        matchedPhrase: daysAgoMatch[0],
        isRelative: true,
      };
    }
  }

  // 2. "N weeks ago" (e.g. "three weeks ago", "1 week ago")
  const weeksAgoMatch = normalized.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+weeks?\s+ago\b/
  );
  if (weeksAgoMatch) {
    const rawNum = weeksAgoMatch[1];
    const weeks = WORD_TO_NUMBER[rawNum] ?? parseInt(rawNum, 10);
    if (!isNaN(weeks)) {
      const target = subWeeks(referenceDate, weeks);
      return {
        dateStr: format(target, "yyyy-MM-dd"),
        confidence: 0.95,
        matchedPhrase: weeksAgoMatch[0],
        isRelative: true,
      };
    }
  }

  // 3. Day before yesterday
  if (
    normalized.includes("day before yesterday") ||
    normalized.includes("the day before yesterday")
  ) {
    const target = subDays(referenceDate, 2);
    return {
      dateStr: format(target, "yyyy-MM-dd"),
      confidence: 1.0,
      matchedPhrase: "the day before yesterday",
      isRelative: true,
    };
  }

  // 4. Yesterday / Last night (ensure it's not negated with "not yesterday")
  const hasYesterday = /\byesterday\b/.test(normalized);
  const isNegatedYesterday = /\bnot\s+yesterday\b/.test(normalized);
  const hasLastNight = /\blast night\b/.test(normalized);

  if ((hasYesterday && !isNegatedYesterday) || hasLastNight) {
    const target = subDays(referenceDate, 1);
    return {
      dateStr: format(target, "yyyy-MM-dd"),
      confidence: 1.0,
      matchedPhrase: hasLastNight ? "last night" : "yesterday",
      isRelative: true,
    };
  }

  // 5. Today / This morning / This afternoon / This evening / Tonight
  const hasToday = /\btoday\b/.test(normalized);
  const isNegatedToday = /\bnot\s+today\b/.test(normalized);
  if (
    (hasToday && !isNegatedToday) ||
    /\bthis morning\b/.test(normalized) ||
    /\bthis afternoon\b/.test(normalized) ||
    /\bthis evening\b/.test(normalized) ||
    /\btonight\b/.test(normalized) ||
    /\bearlier today\b/.test(normalized)
  ) {
    return {
      dateStr: format(referenceDate, "yyyy-MM-dd"),
      confidence: 1.0,
      matchedPhrase: "today",
      isRelative: true,
    };
  }

  // 6. Tomorrow
  if (/\btomorrow\b/.test(normalized)) {
    const target = addDays(referenceDate, 1);
    return {
      dateStr: format(target, "yyyy-MM-dd"),
      confidence: 1.0,
      matchedPhrase: "tomorrow",
      isRelative: true,
    };
  }

  // 7. "Last [day-of-week]" (e.g., "last monday", "last friday", "last weekend")
  if (normalized.includes("last weekend") || normalized.includes("previous weekend")) {
    const currentDay = referenceDate.getDay();
    const daysBackToSat = currentDay === 6 ? 7 : (currentDay + 1) % 7 || 7;
    const target = subDays(referenceDate, daysBackToSat);
    return {
      dateStr: format(target, "yyyy-MM-dd"),
      confidence: 0.9,
      matchedPhrase: "last weekend",
      isRelative: true,
    };
  }

  const lastDayMatch = normalized.match(
    /\blast\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/
  );
  if (lastDayMatch) {
    const targetDayName = lastDayMatch[1];
    const targetDayIndex = DAY_OF_WEEK_MAP[targetDayName];
    const currentDayIndex = referenceDate.getDay();
    let diff = currentDayIndex - targetDayIndex;
    if (diff <= 0) {
      diff += 7;
    }
    const target = subDays(referenceDate, diff);
    return {
      dateStr: format(target, "yyyy-MM-dd"),
      confidence: 0.95,
      matchedPhrase: lastDayMatch[0],
      isRelative: true,
    };
  }

  // 8. "Earlier this week"
  if (normalized.includes("earlier this week")) {
    const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Monday
    const target = isBefore(weekStart, referenceDate) ? weekStart : subDays(referenceDate, 1);
    return {
      dateStr: format(target, "yyyy-MM-dd"),
      confidence: 0.85,
      matchedPhrase: "earlier this week",
      isRelative: true,
    };
  }

  // 9. "The first of this month" / "1st of this month"
  if (
    normalized.includes("first of this month") ||
    normalized.includes("1st of this month") ||
    normalized.includes("start of this month")
  ) {
    const target = startOfMonth(referenceDate);
    return {
      dateStr: format(target, "yyyy-MM-dd"),
      confidence: 0.95,
      matchedPhrase: "first of this month",
      isRelative: true,
    };
  }

  // 10. "On the 15th", "on the 1st", "on the 28th"
  const onTheDayMatch = normalized.match(/\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (onTheDayMatch) {
    const dayNum = parseInt(onTheDayMatch[1], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      try {
        const target = setDate(referenceDate, dayNum);
        return {
          dateStr: format(target, "yyyy-MM-dd"),
          confidence: 0.9,
          matchedPhrase: onTheDayMatch[0],
          isRelative: true,
        };
      } catch {
        // Fall through
      }
    }
  }

  // 11. "Last month"
  if (/\blast month\b/.test(normalized)) {
    const target = subMonths(referenceDate, 1);
    return {
      dateStr: format(target, "yyyy-MM-dd"),
      confidence: 0.85,
      matchedPhrase: "last month",
      isRelative: true,
    };
  }

  // 12. Standard ISO date (YYYY-MM-DD)
  const isoMatch = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const parsed = parseISO(isoMatch[0]);
    if (isValid(parsed)) {
      return {
        dateStr: isoMatch[0],
        confidence: 1.0,
        matchedPhrase: isoMatch[0],
        isRelative: false,
      };
    }
  }

  // 13. Month Name + Day (e.g., "October 24", "Oct 24", "24 October 2026", "24th Oct")
  const monthDayMatch = normalized.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/
  );
  if (monthDayMatch) {
    const monthStr = monthDayMatch[1];
    const dayNum = parseInt(monthDayMatch[2], 10);
    const yearNum = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : referenceDate.getFullYear();
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthIdx = months.findIndex((m) => monthStr.startsWith(m));
    if (monthIdx !== -1) {
      const target = new Date(yearNum, monthIdx, dayNum);
      if (isValid(target)) {
        return {
          dateStr: format(target, "yyyy-MM-dd"),
          confidence: 0.95,
          matchedPhrase: monthDayMatch[0],
          isRelative: false,
        };
      }
    }
  }

  // 14. Day + Month Name (e.g. "24th Oct", "25 October")
  const dayMonthMatch = normalized.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*(\d{4}))?\b/
  );
  if (dayMonthMatch) {
    const dayNum = parseInt(dayMonthMatch[1], 10);
    const monthStr = dayMonthMatch[2];
    const yearNum = dayMonthMatch[3] ? parseInt(dayMonthMatch[3], 10) : referenceDate.getFullYear();
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthIdx = months.findIndex((m) => monthStr.startsWith(m));
    if (monthIdx !== -1) {
      const target = new Date(yearNum, monthIdx, dayNum);
      if (isValid(target)) {
        return {
          dateStr: format(target, "yyyy-MM-dd"),
          confidence: 0.95,
          matchedPhrase: dayMonthMatch[0],
          isRelative: false,
        };
      }
    }
  }

  return null;
}

/**
 * Deterministically resolves a natural language date range (e.g. for financial queries)
 */
export function parseDateRange(
  input: string,
  referenceDate: Date = new Date()
): DateRangeResult {
  const normalized = input.trim().toLowerCase();

  // Today
  if (normalized.includes("today")) {
    const todayStr = format(referenceDate, "yyyy-MM-dd");
    return {
      startDateStr: todayStr,
      endDateStr: todayStr,
      label: "Today",
    };
  }

  // Yesterday
  if (normalized.includes("yesterday")) {
    const yestStr = format(subDays(referenceDate, 1), "yyyy-MM-dd");
    return {
      startDateStr: yestStr,
      endDateStr: yestStr,
      label: "Yesterday",
    };
  }

  // Last week
  if (normalized.includes("last week") || normalized.includes("previous week")) {
    const prevWeek = subWeeks(referenceDate, 1);
    const start = startOfWeek(prevWeek, { weekStartsOn: 1 });
    const end = endOfWeek(prevWeek, { weekStartsOn: 1 });
    return {
      startDateStr: format(start, "yyyy-MM-dd"),
      endDateStr: format(end, "yyyy-MM-dd"),
      label: "Last Week",
    };
  }

  // This week
  if (normalized.includes("this week")) {
    const start = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const end = endOfWeek(referenceDate, { weekStartsOn: 1 });
    return {
      startDateStr: format(start, "yyyy-MM-dd"),
      endDateStr: format(end, "yyyy-MM-dd"),
      label: "This Week",
    };
  }

  // Last month
  if (normalized.includes("last month") || normalized.includes("previous month")) {
    const prevMonth = subMonths(referenceDate, 1);
    const start = startOfMonth(prevMonth);
    const end = endOfMonth(prevMonth);
    return {
      startDateStr: format(start, "yyyy-MM-dd"),
      endDateStr: format(end, "yyyy-MM-dd"),
      label: "Last Month",
    };
  }

  // Default: This month
  const start = startOfMonth(referenceDate);
  const end = endOfMonth(referenceDate);
  return {
    startDateStr: format(start, "yyyy-MM-dd"),
    endDateStr: format(end, "yyyy-MM-dd"),
    label: "This Month",
  };
}

/**
 * Returns formatted friendly date (e.g., "Today", "Yesterday", or "Oct 28, 2026")
 */
export function formatFriendlyDate(
  dateStr: string,
  referenceDate: Date = new Date()
): string {
  try {
    const target = parseISO(dateStr);
    if (!isValid(target)) return dateStr;

    const todayStr = format(referenceDate, "yyyy-MM-dd");
    const yesterdayStr = format(subDays(referenceDate, 1), "yyyy-MM-dd");
    const dayBeforeYesterdayStr = format(subDays(referenceDate, 2), "yyyy-MM-dd");

    if (dateStr === todayStr) return "Today";
    if (dateStr === yesterdayStr) return "Yesterday";
    if (dateStr === dayBeforeYesterdayStr) return "The day before yesterday";

    return format(target, "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}
