import { describe, it, expect } from "vitest";
import {
  parseRelativeDate,
  parseDateRange,
  formatFriendlyDate,
} from "../src/services/dateService";

describe("dateService - parseRelativeDate", () => {
  // Reference date: 2026-10-29 (matching current mock time)
  const refDate = new Date(2026, 9, 29, 11, 30, 0); // October 29, 2026 (Thursday)

  it("parses 'today' and 'this morning'", () => {
    const res1 = parseRelativeDate("I spent 500 today", refDate);
    expect(res1?.dateStr).toBe("2026-10-29");

    const res2 = parseRelativeDate("coffee this morning", refDate);
    expect(res2?.dateStr).toBe("2026-10-29");
  });

  it("parses 'yesterday' and 'last night'", () => {
    const res1 = parseRelativeDate("I spent ₹450 on dinner yesterday", refDate);
    expect(res1?.dateStr).toBe("2026-10-28");

    const res2 = parseRelativeDate("dinner last night", refDate);
    expect(res2?.dateStr).toBe("2026-10-28");
  });

  it("parses 'the day before yesterday'", () => {
    const res = parseRelativeDate(
      "I received ₹5,000 from a freelance project the day before yesterday",
      refDate
    );
    expect(res?.dateStr).toBe("2026-10-27");
  });

  it("parses 'two days ago' and '3 days ago'", () => {
    const res1 = parseRelativeDate("That was two days ago, not yesterday", refDate);
    expect(res1?.dateStr).toBe("2026-10-27");

    const res2 = parseRelativeDate("paid 3 days ago", refDate);
    expect(res2?.dateStr).toBe("2026-10-26");
  });

  it("parses 'three weeks ago'", () => {
    const res = parseRelativeDate("flight ticket 3 weeks ago", refDate);
    expect(res?.dateStr).toBe("2026-10-08");
  });

  it("parses 'last Monday' and 'last Friday'", () => {
    // refDate is Thursday 2026-10-29
    // Last Monday was 2026-10-26 (3 days ago)
    const resMonday = parseRelativeDate("dinner last monday", refDate);
    expect(resMonday?.dateStr).toBe("2026-10-26");

    // Last Friday was 2026-10-23 (6 days ago)
    const resFriday = parseRelativeDate("groceries last friday", refDate);
    expect(resFriday?.dateStr).toBe("2026-10-23");
  });

  it("parses 'first of this month'", () => {
    const res = parseRelativeDate("rent paid on the first of this month", refDate);
    expect(res?.dateStr).toBe("2026-10-01");
  });

  it("parses 'on the 15th'", () => {
    const res = parseRelativeDate("bill on the 15th", refDate);
    expect(res?.dateStr).toBe("2026-10-15");
  });

  it("handles month boundary transitions", () => {
    // refDate: 2026-11-01 (Nov 1)
    const nov1 = new Date(2026, 10, 1, 10, 0, 0);
    const yesterday = parseRelativeDate("yesterday", nov1);
    expect(yesterday?.dateStr).toBe("2026-10-31");

    const twoDaysAgo = parseRelativeDate("two days ago", nov1);
    expect(twoDaysAgo?.dateStr).toBe("2026-10-30");
  });

  it("handles year boundary transitions (Dec -> Jan)", () => {
    // refDate: 2027-01-01 (Jan 1)
    const jan1 = new Date(2027, 0, 1, 10, 0, 0);
    const yesterday = parseRelativeDate("yesterday", jan1);
    expect(yesterday?.dateStr).toBe("2026-12-31");

    const dayBeforeYesterday = parseRelativeDate("the day before yesterday", jan1);
    expect(dayBeforeYesterday?.dateStr).toBe("2026-12-30");
  });

  it("handles leap year boundaries correctly", () => {
    // 2024 is a leap year (Feb 29 exists)
    const march1Leap = new Date(2024, 2, 1, 10, 0, 0); // March 1, 2024
    const yesterdayLeap = parseRelativeDate("yesterday", march1Leap);
    expect(yesterdayLeap?.dateStr).toBe("2024-02-29");

    // 2025 is not a leap year (Feb has 28 days)
    const march1NonLeap = new Date(2025, 2, 1, 10, 0, 0); // March 1, 2025
    const yesterdayNonLeap = parseRelativeDate("yesterday", march1NonLeap);
    expect(yesterdayNonLeap?.dateStr).toBe("2025-02-28");
  });

  it("parses explicit ISO dates and formatted date strings", () => {
    const resIso = parseRelativeDate("payment on 2026-05-14", refDate);
    expect(resIso?.dateStr).toBe("2026-05-14");

    const resMonthDay = parseRelativeDate("shopping on Oct 24", refDate);
    expect(resMonthDay?.dateStr).toBe("2026-10-24");
  });
});

describe("dateService - parseDateRange", () => {
  const refDate = new Date(2026, 9, 29); // 2026-10-29

  it("resolves 'today'", () => {
    const range = parseDateRange("how much did I spend today?", refDate);
    expect(range.startDateStr).toBe("2026-10-29");
    expect(range.endDateStr).toBe("2026-10-29");
  });

  it("resolves 'yesterday'", () => {
    const range = parseDateRange("show expenses for yesterday", refDate);
    expect(range.startDateStr).toBe("2026-10-28");
    expect(range.endDateStr).toBe("2026-10-28");
  });

  it("resolves 'this month'", () => {
    const range = parseDateRange("how much did I earn this month?", refDate);
    expect(range.startDateStr).toBe("2026-10-01");
    expect(range.endDateStr).toBe("2026-10-31");
  });
});

describe("dateService - formatFriendlyDate", () => {
  const refDate = new Date(2026, 9, 29);

  it("formats today and yesterday with friendly terms", () => {
    expect(formatFriendlyDate("2026-10-29", refDate)).toBe("Today");
    expect(formatFriendlyDate("2026-10-28", refDate)).toBe("Yesterday");
    expect(formatFriendlyDate("2026-10-27", refDate)).toBe("The day before yesterday");
    expect(formatFriendlyDate("2026-10-15", refDate)).toBe("Oct 15, 2026");
  });
});

