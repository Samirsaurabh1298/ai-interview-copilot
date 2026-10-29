import { describe, it, expect } from "vitest";
import { filterAndSortTickets } from "./useTicketQueue.js";
import type { Ticket } from "./types.js";

const SAMPLE_TICKETS: Ticket[] = [
  {
    id: "tick-1",
    title: "Database connection timeout in production",
    description: "API gateway returns 504 on user login during traffic surge.",
    priority: "urgent",
    status: "open",
    tags: ["backend", "database", "incident"],
    createdAt: 1700000000000,
  },
  {
    id: "tick-2",
    title: "Button alignment misaligned on Safari mobile",
    description: "Cancel button overflows viewport on iPhone 13.",
    priority: "low",
    status: "open",
    tags: ["frontend", "safari"],
    createdAt: 1700000001000,
  },
  {
    id: "tick-3",
    title: "Payment gateway webhook signature mismatch",
    description: "Stripe webhook signature validation fails intermittently.",
    priority: "high",
    status: "in_progress",
    tags: ["payments", "backend"],
    createdAt: 1700000002000,
  },
  {
    id: "tick-4",
    title: "Update copyright year in footer",
    description: "Footer still displays 2024 instead of current year.",
    priority: "low",
    status: "resolved",
    tags: [],
    createdAt: 1700000003000,
  },
];

describe("Ticket Queue Filtering & Sorting", () => {
  it("filters tickets by search query in title or description", () => {
    const filtered = filterAndSortTickets(
      SAMPLE_TICKETS,
      { searchQuery: "timeout" },
      { field: "createdAt", order: "desc" }
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("tick-1");
  });

  it("filters tickets by status", () => {
    const filtered = filterAndSortTickets(
      SAMPLE_TICKETS,
      { status: ["open"] },
      { field: "createdAt", order: "desc" }
    );
    expect(filtered).toHaveLength(2);
  });

  it("filters by tags without throwing when tickets have empty tags", () => {
    const filtered = filterAndSortTickets(
      SAMPLE_TICKETS,
      { tags: ["backend"] },
      { field: "createdAt", order: "desc" }
    );
    expect(filtered).toHaveLength(2);
  });

  it("sorts tickets descending by priority: urgent -> high -> medium -> low", () => {
    const sorted = filterAndSortTickets(
      SAMPLE_TICKETS,
      {},
      { field: "priority", order: "desc" }
    );
    expect(sorted[0]?.priority).toBe("urgent");
    expect(sorted[1]?.priority).toBe("high");
    expect(sorted[2]?.priority).toBe("low");
  });
});
