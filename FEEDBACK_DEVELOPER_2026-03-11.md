# Developer Feedback (Senior QA)

## Top priorities
1. **Fix menu selection contract on `/`**
   - Current: `SELECT * FROM menus ORDER BY day DESC LIMIT 1`
   - Problem: picks incomplete future drafts.
   - Required: select only menu with complete recipe set (or published status).

2. **Enforce data integrity between `menus` and `recipes`**
   - Add transactional pipeline write per day.
   - Add post-stage assertion: expected slots exist for both option types.
   - If assertion fails: rollback and log structured error.

3. **Unify semantics between UI and API**
   - `/api/menu/today` uses timezone-based date.
   - `/` currently uses latest row.
   - Decide one product rule and encode in shared service/repository method.

## Suggested implementation sketch
- Create `menuRepository.getDisplayMenu({mode:'today'|'latest-complete'})`
- Create `recipeRepository.hasCompleteSet(menuId)`
- Update `/` to use `latest-complete` (or `today-complete` based on product decision)
- Add guard in `menuCards`: hide/disable recipe links when not complete.

## Test cases to add (automated)
- Home page must not render recipe links for incomplete menu.
- If latest menu incomplete and previous complete exists, homepage uses previous complete.
- `/api/menu/today` returns 404 or explicit prep-state if today incomplete (based on product decision).

## Evidence snapshot
- Menus present: 2026-03-13 (0 recipes), 2026-03-12 (0), 2026-03-11 (10).
- Homepage rendered 2026-03-13 with recipe links => broken UX.
