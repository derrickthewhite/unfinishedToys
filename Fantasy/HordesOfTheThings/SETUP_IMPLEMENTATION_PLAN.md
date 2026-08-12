# Guided Setup Implementation Plan

This document records the intended implementation of guided battle setup and the current handoff point.

## Current Status

### Completed: Player Identity Foundation

The application no longer treats display colors as gameplay identities.

- Permanent ownership uses `player-1` and `player-2`.
- A player configuration supplies selected presentation color and faction.
- Newly created and seeded units use `playerId`.
- `activePlayerId`, player-keyed losses, rendering colors, combat logs, selection ownership, shooting, form-up, and persistence use player identity.
- Existing Blue/Red saves still load: legacy units, active-side values, and loss maps are normalized during load.
- The current HTML selector values are player IDs, while labels remain Blue and Red as the default presentation choices.
- `data.createUnit(type, playerId, faction, pose, allocateUnitId)` is available and creates independent nested stats objects.

The compatibility helpers in `prototype-rules.js` and `prototype-app.js` intentionally accept legacy `side: 'blue'` and `side: 'red'` fixture/save data during this migration. New production state should use `playerId`.

### Completed: Army Builder

New games now begin at `setupStage: 'army-builder'` with an empty board and two independent player-ID-keyed army drafts.

- `ARMY_POINT_TARGET` is 24 and supported factions are exported from `prototype-data.js`.
- Player color choices now include Blue, Red, Green, and Gold. Color remains a presentation property only.
- The responsive builder has one column per player, faction-specific unit previews, AP values, decrement/increment controls, and live `value / 24 AP` totals.
- The Accept button only enables when both forces total exactly 24 AP.
- Accepting opens a setup confirmation modal. Confirming advances to the explicit `terrain-placement` handoff state; no terrain behavior is claimed or simulated yet.
- Existing board/game controls are hidden during active setup stages.

### Completed: Terrain Placement

Army confirmation now initializes the terrain stage instead of a placeholder.

- A `2d4` roll determines the editable terrain target, constrained to 0 through 8.
- The defender is chosen by a coin flip and stored as `setup.terrain.defenderPlayerId`; display color remains separate from that temporary role.
- Three random offers are generated from forest, swamp, water, impassable terrain, and road. Selecting an offer adds it to the board and refreshes all three offers.
- Placed terrain can be selected and dragged on the dedicated setup canvas. Blob terrain rotates in 45-degree increments; roads switch between horizontal and vertical.
- Blob draw and hit-test geometry both honor rotation, so terrain visuals and `getTerrainTypeAt` agree.
- Confirming only becomes available once the placed count matches the target. Its confirmation locks terrain and advances to `unit-deployment`.

### Completed: Sequential Unit Deployment

- Terrain confirmation initializes a dedicated deployment canvas and tray from the accepted army drafts.
- The defender deploys all units in the bottom quarter first; the attacker then deploys all units in the top quarter.
- Every deployment and reposition checks every rotated base corner against the assigned quarter and rejects polygon overlap with all deployed units.
- Deployed units are created through `data.createUnit`, retaining player ID, faction, and configured rendering color.
- The active player cannot finish until every drafted unit is legally deployed. After attacker confirmation, the setup transitions to game mode with the defender taking the first move roll.
- Deployment input is isolated in `prototype-unit-deployment.js`; the main battle-board pointer handlers remain unchanged while battle-board refactoring is paused.

### Verified

Run this from the repository root:

```powershell
node --test *.test.js
```

The focused application suite has 52 passing tests, including deployment snapping, pointer-release handling, setup-camera pan/zoom, save guards, and setup-skipping game loads. The full `node --test *.test.js` suite has 118 passing tests.

## Core Model

Keep these three concepts separate:

| Concept | Representation | Lifetime |
|---|---|---|
| Player identity | `player-1`, `player-2` | Whole game and saves |
| Display color | `state.players[playerId].colorId` | Selected during setup |
| Opening role | `setup.defenderPlayerId` and derived attacker | Setup only |

Do not use `attacker` or `defender` as permanent player identifiers. They determine terrain/deployment order but should not control normal alternating turns.

## Product Decisions

- Each army must total exactly 24 AP before it can be accepted.
- Both players select a color and faction; both may select Panda or Undead.
- Missing faction-specific unit artwork must fall back to generic unit art.
- A random coin flip selects the defender after both armies are accepted.
- Terrain count defaults to the result of `2d4`, then may be edited from 0 through 8.
- Terrain offers include forest, swamp, water, impassable terrain, and roads.
- The defender places terrain, then deploys all units before the attacker.
- Deployment zones are strict: all corners of a base must remain in the assigned top or bottom quarter of the board.
- Which player gets top/bottom deployment is a player-ID assignment, independent of color and defender role.

## Remaining Work

### 1. Resume Battle-Board Refactoring After Deployment Is Testable

The canvas event-registration boundary remains in `prototype-board-input.js`. The complete battle-board interaction slice now lives in `prototype-board-interaction.js`: camera conversion, pan/zoom, pointer down/move/up, placement, selection, marquee selection, handles, rotations, reversals, rank/file conversion, and movement/edit draft bookkeeping. Its method bodies were moved out of `prototype-app.js` as one unit.

Recommended extraction order:

1. Extract board rendering as a separate slice: render scheduling, board/terrain/unit drawing, overlays, ghosts, selection handles, and asset drawing/loading. Keep setup-canvas rendering separate because its module already depends on the shared board draw methods.
2. Extract game-flow and combat orchestration: draft lifecycle, move completion, form-up, shooting/melee phase state, turn advancement, and combat-resolution display state.
3. Revisit persistence after deployment is complete so saves preserve deployment progress and setup state, then keep the persistence module as the sole save/load implementation.

For every slice, use `apply_patch` for both source deletion and destination addition so the editor's AI change set matches Git's working-tree change set. Validate with the focused application tests before any adjacent refactor.

### 2. Persistence, Documentation, and Tests

Primary files: `prototype-app.js`, `Design.md`, `prototype-app.test.js`, `prototype-geometry.test.js`, `prototype-rules.test.js`

- Persist player configuration, `setupStage`, setup drafts, terrain/deployment progress, units, terrain, losses, and game state.
- Preserve legacy Blue/Red save migration.
- Update `Design.md` after the workflow is implemented; do not use it as this implementation handoff document.
- Add focused tests for:
  - color/role/player-ID separation
  - legacy save migration
  - exact-24 army validation
  - terrain offer refresh and completion
  - rotated terrain geometry/rules
  - strict deployment zones, including rotated footprints
  - defender-before-attacker order
  - setup-to-game handoff
  - setup save/load resumption
- Run `node --test *.test.js` after each completed slice.

## Planned Game Extensions

- Add reserve deployment for units such as Hordes and future Lurkers: these units begin off-board or are removed from the board, then enter during play using the deployment tray and placement validation as shared foundations.
- Expand the presentation palette with additional player colors while preserving player IDs as ownership keys.
- Add a check to make sure that 
- Add automatic army deployment: group like units into formations, favor bad-going units near or toward appropriate terrain, group fast movers, and, when attacking, align likely favorable matchups where practical.
- Add further armies once their artwork is available.
- Add an optional game-start mode that limits each faction to an allowed unit roster.
- Add more unit types.
- Move the cheating-oriented Edit Mode behind an extra-click modal or settings control.

## Future Terrain Investigations

- Make generated terrain shapes feel more organic while preserving consistent draw and hit-test geometry.
- Make terrain configuration customizable: migrate from hard-coded paths toward terrain assets, then add a modal for adjusting random offer weights and adding or removing available terrain features.
- Analyze crooked and forked roads against the current road sampling and movement calculations before adding either shape. The present rule model assumes one full-board horizontal or vertical strip, so routes and junctions need deliberate geometry/rules support.
- Add rivers as a distinct terrain feature, including movement, crossing, and whether roads/bridges alter their precedence.

## Important Existing Extension Points

- `prototype-data.js`: player palette/defaults, unit template data, `createUnit`, default terrain/unit factories.
- `prototype-app.js`: `createInitialState`, `captureUi`, `bindUi`, pointer handlers, `syncUiFromState`, `render`, `drawTerrain`, `drawUnits`, save/load normalization.
- `prototype-geometry.js`: `pointInBlob`, `drawBlob`, `getUnitCorners`, polygon overlap helpers.
- `prototype-rules.js`: `getTerrainTypeAt`, movement terrain sampling, player-ID ownership comparisons, shooting, form-up, melee.

## Constraints

- Do not reintroduce color names as ownership keys.
- Do not make normal combat turns depend on defender/attacker.
- Keep public APIs and unrelated movement/combat behavior stable.
- Preserve current generic asset fallback for faction-art gaps.
- Keep changes narrowly scoped and run the Node test suite after each substantive implementation slice.