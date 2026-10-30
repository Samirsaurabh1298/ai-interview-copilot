import React from "react";
import { useTicketQueue } from "./useTicketQueue.js";
import type { Ticket, TicketPriority, TicketStatus } from "./types.js";

interface TicketQueueProps {
  initialTickets: Ticket[];
}

export const TicketQueue: React.FC<TicketQueueProps> = ({ initialTickets }) => {
  const {
    tickets,
    filteredCount,
    rawCount,
    filters,
    sort,
    updateFilters,
    updateSort,
    resolveTicket,
  } = useTicketQueue(initialTickets);

  return (
    <div className="ticket-queue-container" style={{ fontFamily: "sans-serif", padding: "1.5rem" }}>
      <header style={{ marginBottom: "1rem" }}>
        <h2>Support Triage Queue ({filteredCount} / {rawCount})</h2>
        <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
          <input
            type="text"
            placeholder="Search tickets by title or description..."
            value={filters.searchQuery || ""}
            onChange={(e) => updateFilters({ searchQuery: e.target.value })}
            style={{ padding: "0.5rem", width: "300px" }}
          />

          <select
            value={sort.order}
            onChange={(e) => updateSort({ field: "priority", order: e.target.value as "asc" | "desc" })}
            style={{ padding: "0.5rem" }}
          >
            <option value="desc">Priority: Urgent First</option>
            <option value="asc">Priority: Low First</option>
          </select>
        </div>
      </header>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {tickets.map((ticket) => (
          <li
            key={ticket.id}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "1rem",
              marginBottom: "0.5rem",
              backgroundColor: ticket.priority === "urgent" ? "#fff1f2" : "#ffffff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>{ticket.title}</h3>
              <span
                style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: "bold",
                  backgroundColor: ticket.priority === "urgent" ? "#f43f5e" : "#e2e8f0",
                  color: ticket.priority === "urgent" ? "#ffffff" : "#334155",
                }}
              >
                {ticket.priority.toUpperCase()}
              </span>
            </div>
            <p style={{ margin: "0.5rem 0", fontSize: "0.875rem", color: "#475569" }}>
              {ticket.description}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                {ticket.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: "#f1f5f9",
                      padding: "0.15rem 0.4rem",
                      borderRadius: "3px",
                      fontSize: "0.75rem",
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              {ticket.status !== "resolved" && (
                <button
                  onClick={() => resolveTicket(ticket.id)}
                  style={{
                    cursor: "pointer",
                    padding: "0.25rem 0.75rem",
                    background: "#0284c7",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                  }}
                >
                  Mark Resolved
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

