# Frontend Engineer Assessment: Support Ticket Queue Triage

**Role:** Senior Frontend Engineer (React / TypeScript)  
**Time Limit:** 60 Minutes  
**Tool Policy:** Company AI Usage Gateway enabled ($0.25 USD pilot budget, warning at $0.20)  

---

## 1. Scenario & Problem Description

You are maintaining the Customer Support Engineering dashboard. Recently, after a state refactor in `useTicketQueue.ts`, customer success leads reported two regressions in the triage queue:

1. **Priority Inversion Regression:**
   When the queue is sorted by priority in descending order (`order: "desc"`), critical **urgent** incidents are placed at the bottom of the list instead of the top, delaying response to production outages.
2. **Tag Filtering Defect:**
   When applying multi-tag filters (`filters.tags`), tickets with empty or missing tag arrays can cause unhandled exceptions or incorrectly drop valid tickets. Furthermore, array sorting in `useMemo` mutates state in place.

---

## 2. Your Task

1. **Locate & Diagnose:**
   Examine [`src/useTicketQueue.ts`](./src/useTicketQueue.ts) and identify the defects.
2. **AI-Assisted Collaboration:**
   You may use the Copilot to ask questions, explain code flow, or evaluate potential patches. Keep queries concise to remain within your $0.25 token budget.
3. **Fix the Regressions:**
   - Ensure priority sorting properly maps: `urgent` (4) > `high` (3) > `medium` (2) > `low` (1).
   - Ensure pure, non-mutating sorting on copied arrays (`[...result].sort(...)`).
   - Ensure safe multi-tag filtering.
4. **Verification:**
   Run the test suite using:
   ```bash
   pnpm test
   ```
5. **Submission:**
   When all tests pass, provide your concise explanation covering:
   - Root cause identified
   - Your fix approach
   - Verification steps taken

---

## 3. Rubric Dimensions Evaluated

Your submission will be evaluated against the standard **7-Dimension Rubric**:
- Code Comprehension & Localization (20%)
- Problem Framing & Strategy (10%)
- AI Collaboration Efficiency (15%)
- Critical Evaluation of AI Output (15%)
- Debugging & Implementation Quality (20%)
- Testing & Verification Discipline (15%)
- Technical Explanation & Judgment (5%)

