export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface Ticket {
  id: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  tags: string[];
  assignedTo?: string;
  createdAt: number;
}

export interface FilterOptions {
  searchQuery?: string;
  status?: TicketStatus[];
  priority?: TicketPriority[];
  tags?: string[];
}

export type SortField = "createdAt" | "priority" | "title";
export type SortOrder = "asc" | "desc";

export interface SortOptions {
  field: SortField;
  order: SortOrder;
}
