# Auto Move / Battle AI Implementation Plan

Goal: an in-game **Auto Move** control that chooses and executes one legal move per click for the active player during the move phase. Candidate groups include every unmoved rank/file subset and single — not only the largest formation — so the AI can tighten the army instead of spreading it out.

## Phase 0 — Skeleton (done)

- `prototype-move-ai.js` module with scoring weights, candidate discovery, forward probe, and `autoMove()` orchestration.
- **Auto Move** button in the game action bar (move phase only).
- Cancels any open draft, selects the winning group, applies the move, and calls `finishDraft()`.
- Status line summarizes distance and score breakdown.
- Node tests for candidate enumeration, global group selection, PIP cost, and end-to-end `autoMove()`.

## Phase 1 — Forward-only MVP (done)

- For **every** legal unmoved candidate group (singles, rank/file subsets, maximal segments): binary-search max legal forward distance via `validateDraftState`.
- Score post-form-up board with weighted terms:
  - **Fight** — delta in active-side melee factor sum (`previewMeleeCombats` after `resolveAutomaticFormUp`).
  - **Advance** — sum of each moved unit's closing distance to the enemy centroid (material moved, not mean length).
  - **Cohesion** — active army mean distance to friendly centroid decreases.
  - **Terrain** — role-aware severity improvement (`sampleUnitTerrain`).
- Pick the globally best `(group, distance)`; skip if score is below `MIN_BENEFIT`.
- Apply through extracted `applyForwardMove(distance)` on the board interaction mixin.

## Phase 2 — Fight quality (done)

- Deployment matchup table (`getDeploymentMatchupScore`) applied to new/changed contacts involving moved units.
- Preview modifier delta rewards `stacked` and penalizes `flank-attacked` / `overlapped` on the active side.
- New melee contacts score higher than shuffling an existing engagement without improving advantage.

## Phase 3 — Formation and support (done)

- Dress scoring when a moved unit joins an existing unmoved rank/file (`dress` weight).
- Formation-size bonus when combats gain stacked support without losing it (`formationSize` weight).
- Stack-break penalty when a move dissolves a stacked melee unless fight delta dominates total score (`stackBreak` weight).
- Snap-aware forward simulation already handles dressing candidates for singles and files.

## Phase 4 — Recoil risk (done)

- `scoreRecoilRisk()` simulates one-depth recoil via `rules.resolveRecoil` for moved units entering/in melee after form-up.
- Heavy `recoilDeath` penalty when friendly units would be destroyed (water, impassable, rear enemy contact, blocked path).
- `pinchRelief` bonus when a move steps a unit out of a recoil-death pinch.

## Phase 5 — Richer search (done)

- Extended candidate search: forward (existing), rank wheel steps (15°/30°/45° left/right), rank/file convert, reverse off bad melees, and Horde reserve redeploy samples.
- `simulateMoveCandidate()` validates all move kinds through `validateDraftState` / reserve legality checks.
- Brief pre-apply preview ghost via `state.autoMovePreview` (reuses form-up preview overlay in `getFormUpPreview()`).
- `autoMove()` dispatches apply by `moveKind` (forward, alternate formation moves, reserve deploy).

## Architecture

| File | Role |
|------|------|
| `prototype-move-ai.js` | Pure scoring/probe helpers + `autoMove()` install |
| `prototype-board-interaction.js` | `findMaxForwardDistance`, `applyForwardMove` (shared with manual max-forward handle) |
| `prototype-app.js` | Script install, UI capture/bind, button visibility |
| `prototype-move-ai.test.js` | Unit and harness tests |

## Constraints

- Game mode, move phase, active side only; no shooting/melee phase automation yet.
- Respect `remainingMoves` and `getDraftMoveCost` (Magician = 2).
- Skip units in reserve, already moved, or ensorcelled return drafts.
- No opponent lookahead in v1.

## Tuning

Weights live in `AUTO_MOVE_WEIGHTS` at the top of `prototype-move-ai.js`. Adjust after playtests rather than hard-coding strategy in candidate order.
