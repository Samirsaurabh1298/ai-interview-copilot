# Reference Solution & Interviewer Guide: Support Ticket Queue

> **Confidential Interviewer Material** — For hiring panel evaluation and calibration only.

---

## 1. Root Cause Summary

In `src/useTicketQueue.ts`:
1. **Priority Sort Inversion:**
   ```ts
   // Defect:
   return sort.order === "desc" ? weightA - weightB : weightB - weightA;
   // Fix:
   return sort.order === "desc" ? weightB - weightA : weightA - weightB;
   ```
   When `order === "desc"`, `weightB - weightA` ensures higher weights (urgent = 4) precede lower weights (low = 1).
2. **In-place Array Mutation:**
   ```ts
   // Defect:
   result.sort(...)
   // Fix:
   const sorted = [...result].sort(...)
   ```
3. **Tag Filtering Edge Cases:**
   Ensure `ticket.tags` is defensively checked (`ticket.tags?.includes(tag)`).

---

## 2. Minimal Correct Diff

```diff
--- a/src/useTicketQueue.ts
+++ b/src/useTicketQueue.ts
@@ -39,7 +39,7 @@ export function useTicketQueue(initialTickets: Ticket[]) {
       // 4. Tag filter
       if (filters.tags && filters.tags.length > 0) {
-        const hasMatchingTag = filters.tags.every((tag) => ticket.tags.includes(tag));
+        const hasMatchingTag = filters.tags.every((tag) => Array.isArray(ticket.tags) && ticket.tags.includes(tag));
         if (!hasMatchingTag) return false;
       }

       return true;
     });

-    result.sort((a, b) => {
+    return [...result].sort((a, b) => {
       if (sort.field === "createdAt") {
         return sort.order === "asc"
           ? a.createdAt - b.createdAt
@@ -51,7 +51,7 @@ export function useTicketQueue(initialTickets: Ticket[]) {
       if (sort.field === "priority") {
         const weightA = PRIORITY_WEIGHTS[a.priority];
         const weightB = PRIORITY_WEIGHTS[b.priority];
-        return sort.order === "desc" ? weightA - weightB : weightB - weightA;
+        return sort.order === "desc" ? weightB - weightA : weightA - weightB;
       }

       if (sort.field === "title") {
```

---

## 3. Candidate Rubric Anchors

| Dimension | Rating 4 (Strong) | Rating 2 (Developing) |
| :--- | :--- | :--- |
| **Code Comprehension** | Immediately identifies lines 40 & 54 without modifying unrelated queue code. | Modifies React state setters, tries rewriting entire `useMemo`. |
| **AI Collaboration** | Asks targeted question: *"What is the standard comparator formula for descending numerical priority?"* | Pastes entire 100-line file into prompt repeatedly without context. |
| **Critical Evaluation** | Rejects any AI suggestion that introduces external libraries (Lodash) for simple array sorting. | Accepts complex mutations or adds unnecessary re-renders. |
| **Testing** | Adds or runs tests verifying that priority descending puts urgent first. | Submits without running `pnpm test`. |
