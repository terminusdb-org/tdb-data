# UX Polish Review — tdb-data Frontend

Review conducted via Puppeteer in desktop (1440x900) and mobile (375x812) modes across all major pages.

## Critical Issues

### 1. StatusBar overflow on mobile
The status bar at the bottom of the page contains 6+ items (org/team, triples, indexed, types, documents, raw JSON) in a single non-wrapping flex row. On a 375px viewport, this overflows to 506px causing horizontal scroll.

**Fix**: Hide secondary items on mobile, show only org/team and triples. Add `overflow-x-auto` and `whitespace-nowrap` as fallback, or use a responsive collapse pattern.

### 2. Documents page table overflow on mobile
The documents table (943px wide) overflows on mobile with no horizontal scroll wrapper. The `main` element has `overflow-auto` but the table extends beyond it.

**Fix**: Wrap tables in a `div.overflow-x-auto` container. Consider hiding less important columns (Preview, Actions) on mobile.

### 3. Entity Resolution page overflow on mobile
Similar to documents — wide content causes 505px overflow in 375px viewport.

**Fix**: Add `overflow-x-auto` wrappers around wide content sections.

### 4. Raw JSON page header overflow on mobile
The header input and buttons overflow horizontally on mobile.

**Fix**: Make header wrap on mobile with `flex-wrap` and full-width inputs.

## High Priority

### 5. No loading skeleton/shimmer
All pages show blank or "Loading..." text. Skeleton screens would significantly improve perceived performance.

### 6. No empty state illustrations
Empty states (no documents, no embeddings, no results) are plain text. Adding icons or illustrations would improve the experience.

### 7. Mobile nav drawer lacks active state
The mobile slide-out nav drawer shows the same icon rail but doesn't indicate which page is active. The active highlighting fix (task 22) works on desktop but needs verification on mobile.

### 8. Header buttons not responsive on documents page
The documents page header has type selector, selection count, "Add to Working Set", "Project Selection", "Delete Selected", and "New Document" buttons all in one row. On mobile these overflow.

**Fix**: Use `flex-wrap` on the header container and make buttons full-width on mobile.

## Medium Priority

### 9. No breadcrumb navigation
Users have no way to see where they are in the hierarchy (org > team > branch > page). The sidebar shows the current page but not the data product context.

### 10. Search page filters not mobile-optimized
The search filters panel uses a fixed-width layout that doesn't adapt well to mobile. Consider a collapsible filter drawer on mobile.

### 11. Projection page controls cramped on mobile
The projection page has many controls (type selector, dimension toggle, working set toggle, color mode) that get cramped on mobile.

**Fix**: Group controls into a collapsible panel on mobile.

### 12. GraphQL page editor not responsive
The GraphQL query editor and results panel don't adapt to mobile — they need a stacked layout.

### 13. Schema page editor layout on mobile
The schema editor's split view (class list + editor) doesn't work well on mobile. Needs a tab-based or stacked layout.

## Low Priority

### 14. No dark mode support
All pages use light theme only. Adding dark mode would improve usability in low-light conditions.

### 15. No keyboard shortcuts
No keyboard shortcuts for navigation (e.g., `g d` for documents, `g s` for schema).

### 16. No undo for destructive actions
Delete operations use `window.confirm()` which is not accessible and doesn't support undo.

### 17. No toast notifications
Actions like document save, delete, insert show no success feedback. Toast notifications would confirm successful operations.

### 18. Icon-only sidebar lacks labels on desktop
The icon rail shows only icons with hover tooltips. New users may struggle to discover features. Consider an optional expanded mode with labels.
