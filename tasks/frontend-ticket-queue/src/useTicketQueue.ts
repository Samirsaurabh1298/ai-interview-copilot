import { useState, useMemo } from "react";
import type { Ticket, FilterOptions, SortOptions, TicketPriority } from "./types.js";

export const PRIORITY_WEIGHTS: Record<TicketPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

/**
 * Pure calculation logic for filtering and sorting support tickets.
 * Contains the candidate challenge logic.
 */
export function filterAndSortTickets(
  tickets: Ticket[],
  filters: FilterOptions,
  sort: SortOptions
): Ticket[] {
  const result = tickets.filter((ticket) => {
    // 1. Text search filter
    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const query = filters.searchQuery.toLowerCase();
      const matchesTitle = ticket.title.toLowerCase().includes(query);
      const matchesDesc = ticket.description.toLowerCase().includes(query);
      if (!matchesTitle && !matchesDesc) return false;
    }

    // 2. Status filter
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(ticket.status)) return false;
    }

    // 3. Priority filter
    if (filters.priority && filters.priority.length > 0) {
      if (!filters.priority.includes(ticket.priority)) return false;
    }

    // 4. Tag filter - [BUG 1: candidates must ensure all requested tags match, but handle empty tags safely]
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.every((tag) => ticket.tags && ticket.tags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    return true;
  });

  // 5. Sorting - Pure copy and standard descending priority comparison
  return [...result].sort((a, b) => {
    if (sort.field === "createdAt") {
      return sort.order === "asc"
        ? a.createdAt - b.createdAt
        : b.createdAt - a.createdAt;
    }

    if (sort.field === "priority") {
      const weightA = PRIORITY_WEIGHTS[a.priority];
      const weightB = PRIORITY_WEIGHTS[b.priority];
      return sort.order === "desc" ? weightB - weightA : weightA - weightB;
    }

    if (sort.field === "title") {
      const cmp = a.title.localeCompare(b.title);
      return sort.order === "asc" ? cmp : -cmp;
    }

    return 0;
  });
}

export function useTicketQueue(initialTickets: Ticket[]) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [filters, setFilters] = useState<FilterOptions>({});
  const [sort, setSort] = useState<SortOptions>({
    field: "createdAt",
    order: "desc",
  });

  const filteredAndSortedTickets = useMemo(() => {
    return filterAndSortTickets(tickets, filters, sort);
  }, [tickets, filters, sort]);

  const updateFilters = (newFilters: Partial<FilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const updateSort = (newSort: SortOptions) => {
    setSort(newSort);
  };

  const addTicket = (ticket: Ticket) => {
    setTickets((prev) => [ticket, ...prev]);
  };

  const resolveTicket = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: "resolved" } : t))
    );
  };

  return {
    tickets: filteredAndSortedTickets,
    rawCount: tickets.length,
    filteredCount: filteredAndSortedTickets.length,
    filters,
    sort,
    updateFilters,
    updateSort,
    addTicket,
    resolveTicket,
  };
}
