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
- Every deployment and reposition checks every rotated base corner against the 600 mm board and the assigned quarter, and rejects polygon overlap with all deployed units.
- The active player can Shift-click or marquee-select their own units, drag them, and use rotate/reverse handles. Convert handles are hidden. Returning units to the tray works from Delete/Backspace, a Return to Tray button, or dragging a selection onto the tray; tray entries can be clicked then placed or dragged onto the board.
- Deployed units are created through `data.createUnit`, retaining player ID, faction, and configured rendering color.
- The active player cannot finish until every drafted unit is legally deployed. After attacker confirmation, the setup transitions to game mode with the defender taking the first move roll.
- Deployment canvas pointer events reuse battle-board pan, marquee, drag, rotate, and reverse through a temporary canvas/camera swap. Tray placement, legality restore, and return-to-tray stay in `prototype-unit-deployment.js`.

### Completed: Battle-Board Rendering Extraction

Board canvas drawing now lives in `prototype-board-render.js`.

- Render scheduling, board/terrain/unit layers, shooting and combat overlays, ghosts, selection-handle drawing, and unit asset lookup/loading moved as one mixin.
- Setup-canvas renderers still call shared `drawTerrain` / `getUnitAssetPath` through the installed prototype methods.
- `resizeCanvas` / `syncCanvasResolution` and DOM sync (`syncUiFromState`, `renderSelectionInfo`) remain in `prototype-app.js`.

### Completed: Game-Flow And Combat Orchestration Extraction

Turn and combat orchestration now lives in `prototype-game-flow.js`.

- Move completion, form-up, shooting/melee phase state, turn advancement, combat resolution bookkeeping, and draft/selection analysis moved as one mixin.
- App shell, setup helpers, player identity helpers, and DOM sync remain in `prototype-app.js`.
- Interaction draft primitives remain in `prototype-board-interaction.js`.

### Completed: Persistence Module

Save/load lives in `prototype-persistence.js` as the sole implementation.

- In-game snapshots include players, active player, phase/moves, units, terrain, losses, and UI toggles.
- Setup snapshots add `setupStage` plus army drafts, terrain/deployment progress, and confirm-armies / confirm-terrain dialogs. Cameras and current selections are not restored.
- Legacy Blue/Red unit `side` values and loss maps normalize to `player-1` / `player-2` on load. Saves without `setupStage` still load as in-game battles.
- The existing gear icon and Saved Games modal are used for both setup and battle.

### Completed: Automatic Army Deployment

Deployment includes an **Auto Deploy** control for the active player's remaining tray. If that army is already fully deployed, the control stays enabled and recalls those units to the tray before placing them again. Grouping, scoring, and placement live in `prototype-ai.js`.

- Same-type formations prefer side-by-side ranks capped at about four elements. Leftovers pack to minimize formation count, then good-going slowdown, and will not pair units whose good-going speeds differ by 300 or more. Larger formations place first; sister ranks are preferred, and if depth overlap is required the larger body stays in front.
- Terrain is scored per base: bad-going-tolerant troops (Warbands, Heavy-Warbands, Beasts, Shooters) favor forest/swamp underfoot; other troops keep their whole footprint out. A frontage-wide corridor about 180 mm ahead is sampled so good-going troops avoid forest, swamp, water, and impassable terrain in their approach lane. Forest or swamp ahead of Shooters is treated as mixed.
- Artillery stays in the fighting line. Fast movers are Knights, Riders, Heroes, and Behemoths. Flyers stay in their own formations.
- Defenders use terrain and formation heuristics only. Attackers also score placements with `getDeploymentMatchupScore` / `DEPLOYMENT_MATCHUP_BONUSES`.
- Results stay editable; Finish Deployment is still required.
- Default facing is unchanged; depth defaults to mid-quarter unless the role asks for behind.

### Verified

Run this from the repository root:

```powershell
node --test *.test.js
```

The focused application suite includes deployment snapping, Auto Deploy, Shift/marquee selection, return-to-tray, tray drag-and-drop, pointer-release handling, setup-camera pan/zoom, and setup save/load resumption. The full `node --test *.test.js` suite has 132 passing tests.

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
- Deployment zones are strict: all corners of a base must remain on the 600 mm board and in the assigned top or bottom quarter.
- Which player gets top/bottom deployment is a player-ID assignment, independent of color and defender role.

## Remaining Work

### 1. Resume Battle-Board Refactoring After Deployment Is Testable

The canvas event-registration boundary remains in `prototype-board-input.js`. The complete battle-board interaction slice now lives in `prototype-board-interaction.js`: camera conversion, pan/zoom, pointer down/move/up, placement, selection, marquee selection, handles, rotations, reversals, rank/file conversion, and movement/edit draft bookkeeping. Its method bodies were moved out of `prototype-app.js` as one unit.

Recommended extraction order:

1. ~~Extract board rendering into `prototype-board-render.js`.~~ **Done** — checklist retained below as the completed contract.
2. ~~Extract game-flow and combat orchestration into `prototype-game-flow.js`.~~ **Done** — checklist retained below as the completed contract.
3. ~~Revisit persistence so the persistence module is the sole save/load implementation.~~ **Done** — in-game and setup snapshots share the same slot list.

For every slice, use `apply_patch` for both source deletion and destination addition so the editor's AI change set matches Git's working-tree change set. Validate with the focused application tests before any adjacent refactor.

#### Game-flow extraction checklist

New module: `prototype-game-flow.js`, installed like the other mixins. Depends on `prototype-geometry.js` and `prototype-rules.js`.

**Move these methods as one unit** (bodies leave `prototype-app.js`):

- Move / draft completion: `stepSingleDraft`, `finishDraft`, `endMovePhase`, `evaluateDraft`, `updateSelectionAnalysis`
- Turn / phase orchestration: `resetMovedFlags`, `setPhase`, `advanceToNextTurn`, `maybeAutoAdvanceCombatPhase`, `acknowledgePhase`
- Form-up: `getFormUpPreview`, `beginFormUpPhase`
- Shooting state: `initializeShootingPhase`, `getShootingState`, `hasAnyShootingAttacks`, `getDeclaredTargetIds`, `needsShootingDeclaration`, `isUnitShootingParticipant`, `handleShootingClick`, `resolveShootingPhase`
- Melee state: `initializeMeleePhase`, `getMeleeState`, `isUnitMeleeParticipant`, `isUnitCombatParticipant`, `resolveMeleePhase`
- Combat resolution bookkeeping: `rollDie`, `recordLosses`, `buildCombatResolution`, `logCombatResults`, `getCombatUnit`, `getCombatSideLabel`, `describeCombatUnits`, `describeCombatantById`, `formatCombatModifiers`, `getLossSummary`, `hasUnitMovedThisTurn`

**Keep in `prototype-app.js`:**

- App shell: constructor, `captureUi`, `bindUi`, `onKeyDown`, `setMode`, canvas sizing
- Setup confirmation helpers and player identity helpers
- Shared lookups: `getUnitById`, `getSelectedUnits`, `getSingleSelectedUnit`
- DOM sync: `updateStatus`, `syncUiFromState`
- Selection panel rendering now lives in `prototype-selection-panel.js`
- Interaction draft primitives already in `prototype-board-interaction.js` (`ensureDraft`, `commitDraftStep`, `cancelDraft`, edit undo)

**Leave behind and call through `this` (do not drag into the game-flow module):**

- Player helpers: `getUnitPlayerId`, `getPlayerLabel`, `getOpponentPlayerId`
- Interaction: `cancelDraft`
- Render helpers: `hasUnitMoved`, `requestRender`
- App glue: `syncUiFromState`, `updateStatus`, `getUnitById`, `getSelectedUnits`

**Wiring:**

- `require('./prototype-game-flow.js')` + factory arg + `gameFlow.install(HordesPrototype)` in `prototype-app.js`
- `<script src="prototype-game-flow.js"></script>` in `prototype.html` before `prototype-app.js`
- Run `node --test *.test.js` after the slice

#### Board-render extraction checklist

New module: `prototype-board-render.js`, installed like the other mixins. Depends on `prototype-data.js`, `prototype-geometry.js`, and `prototype-rules.js`.

**Move these methods as one unit** (bodies leave `prototype-app.js`):

- Scheduling / main pass: `requestRender`, `render`
- Board layers: `drawBoard`, `drawTerrain`, `drawUnits`, `drawGhostUnits`, `drawMarquee`
- Overlays: `drawShootingOverlays`, `drawShootingArrow`, `drawCombatResolutionOverlays`
- Ghost helpers that only exist to feed drawing: `collectGhostUnits`, `hasUnitMoved`
- Unit drawing / assets: `drawUnitBase`, `getUnitAssetPath`, `getUnitAsset`, `drawUnitAsset`, `drawUnitArrow`, `drawUnitText`
- Handles: `drawSelectionHandles`, `drawRotateHandle`, `drawReverseHandle`, `drawConvertHandle`, `drawArrowHead`
- Asset path constants currently at the top of `prototype-app.js`: `PANDA_UNIT_ASSET_PATHS`, `UNDEAD_UNIT_ASSET_PATHS`, `UNIT_ASSET_PATHS`

**Keep in `prototype-app.js`:**

- `resizeCanvas` and `syncCanvasResolution` (canvas lifecycle / DPR sizing; `render` continues to call `this.syncCanvasResolution`)
- `renderSelectionInfo` lives in `prototype-selection-panel.js`; `syncUiFromState` remains in `prototype-app.js`
- Setup-canvas renderers (`renderTerrainPlacement`, `renderUnitDeployment`, offer previews) — they stay in their modules and keep calling shared `drawTerrain` / `getUnitAssetPath` via the mixin
- Constructor fields `unitAssetCache` and `renderQueued`

**Leave behind and call through `this` (do not drag into the render module):**

- Player helpers: `getPlayerColors`, `getUnitPlayerId`
- Interaction: `getSelectionHandles`
- Game/combat predicates used while drawing: `needsShootingDeclaration`, `isUnitCombatParticipant`, `getShootingState`, `getFormUpPreview`, `getUnitById`

**Wiring:**

- `require('./prototype-board-render.js')` + factory arg + `boardRender.install(HordesPrototype)` in `prototype-app.js`
- `<script src="prototype-board-render.js"></script>` in `prototype.html` before `prototype-app.js`
- Run `node --test *.test.js` after the slice

### 2. Persistence, Documentation, and Tests

Primary files: `prototype-persistence.js`, `Design.md`, `prototype-app.test.js`, `prototype-setup.test.js`, `prototype-ai.test.js`

**Done:**

- Persistence lives only in `prototype-persistence.js` (save/load/list/delete + legacy Blue/Red unit and loss normalization).
- In-game and guided-setup saves share the same local-storage slot list and record shape.
- Setup snapshots store `setupStage`, army drafts, player presentation, terrain/deployment progress, units, terrain, and confirm-armies / confirm-terrain dialogs.
- Cameras, tray/unit selection, and pointer interaction are not restored.
- Legacy saves without `setupStage` still load as in-game battles.
- Focused tests cover army validation, terrain/deployment flow, deployment zones/order/handoff, setup save/load resumption, and legacy game loads.

**Still open:**

- Update `Design.md` remaining prototype-scope leftovers if needed.
- Run `node --test *.test.js` after each completed slice.

## Planned Game Extensions

- Add reserve deployment for units such as Hordes and future Lurkers: these units begin off-board or are removed from the board, then enter during play using the deployment tray and placement validation as shared foundations.
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

- `prototype-data.js`: player palette/defaults, unit template data, `createUnit`, default terrain/unit factories, auto-deploy matchup scoring.
- `prototype-app.js`: `createInitialState`, `captureUi`, `bindUi`, player helpers, DOM `syncUiFromState`.
- `prototype-board-render.js`: battle-board render scheduling, terrain/unit/overlay/handle drawing, asset lookup/loading.
- `prototype-game-flow.js`: move completion, form-up, shooting/melee phases, turn advancement, combat resolution state.
- `prototype-unit-deployment.js`: sequential deployment, tray placement validation.
- `prototype-ai.js`: Auto Deploy grouping, scoring, and placement. First slice of opponent/setup AI.
- `prototype-geometry.js`: `pointInBlob`, `drawBlob`, `getUnitCorners`, polygon overlap helpers.
- `prototype-rules.js`: `getTerrainTypeAt`, movement terrain sampling, player-ID ownership comparisons, shooting, form-up, melee.

## Constraints

- Do not reintroduce color names as ownership keys.
- Do not make normal combat turns depend on defender/attacker.
- Keep public APIs and unrelated movement/combat behavior stable.
- Preserve current generic asset fallback for faction-art gaps.
- Keep changes narrowly scoped and run the Node test suite after each substantive implementation slice.