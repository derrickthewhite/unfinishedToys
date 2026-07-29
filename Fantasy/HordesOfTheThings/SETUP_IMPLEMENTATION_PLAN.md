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

### Verified

Run this from the repository root:

```powershell
node --test *.test.js
```

At the handoff point, all 98 discovered tests pass.

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

### 1. Add Setup Data and Terrain Factories

Primary files: `prototype-data.js`, `prototype-geometry.js`, `prototype-rules.js`

- Add constants for the 24-AP target, supported factions, offered terrain kinds, and deployment zones.
- Add terrain-candidate factories for forest, swamp, water, impassable terrain, and roads.
- Setup starts with `{ roads: [], features: [] }` and no units.
- Add rotation support to blob terrain in geometry drawing and containment checks.
- Preserve current road behavior by rotating roads in 90-degree increments between horizontal and vertical representations.
- Ensure rendered terrain and `getTerrainTypeAt` agree after movement and rotation.

### 2. Add Setup State and Pure Validation

Primary file: `prototype-app.js`

Add a top-level `setupStage`:

```text
army-builder -> terrain-placement -> unit-deployment -> game
```

Add serializable setup state for:

- both army drafts: color, faction, per-type count, total value
- defender player ID
- terrain count, three offered pieces, placed terrain, and selected terrain
- current deployment player and top/bottom zone assignment
- undeployed unit IDs and deployment validation

Implement focused helpers for army total/value validity, `2d4`, defender coin flip, terrain offer refresh, terrain completion, footprint containment in a deployment zone, overlap checks, and deployment completion.

Keep the existing movement/shooting/melee state model for `setupStage === 'game'`. Clear selection, drafts, and edit history when crossing setup stages.

### 3. Build the Army Builder

Primary files: `prototype.html`, `prototype.css`, `prototype-app.js`

- Add two player columns, not Blue/Red identity columns.
- Each column needs color selection, faction selection, all unit types, preview image, AP value, count decrement/increment controls, and `current / 24` total.
- Style totals distinctly when under, exact, and over the target.
- Disable the Accept action unless both totals are exactly 24.
- Confirm army acceptance with the generic setup confirmation modal.
- Render faction-specific previews using the existing `getUnitAssetPath` logic and preserve generic fallback.
- Use a responsive two-column desktop layout that becomes a one-column layout on narrow screens.

### 4. Build Terrain Placement and Confirmation

Primary files: `prototype.html`, `prototype.css`, `prototype-app.js`

- Add one generic confirmation modal, separate from save/load.
- Escape and backdrop dismissal must cancel the confirmation without changing state.
- After army confirmation, coin-flip and announce the defender using player color/faction labels.
- Display blank board, editable terrain count, placement progress, and three generated offers.
- Selecting an offer places it and immediately creates three fresh offers.
- The defender may select, move, and rotate placed terrain before confirming the completed board.
- Add setup-specific canvas pointer routing and visual selection/rotation controls. Do not invoke normal unit movement, selection, or combat behavior during this stage.

### 5. Build Sequential Deployment

Primary files: `prototype.html`, `prototype.css`, `prototype-app.js`, `prototype-geometry.js`

- Create selected units with `data.createUnit`, initially shown in an off-board deployment tray.
- Defender deploys first, then confirms. Attacker deploys afterward.
- Shade the active player's legal quarter on the canvas.
- A drop is valid only if every rotated unit corner lies within the player's assigned zone and it does not overlap another deployed unit.
- Invalid drops return the unit to the tray with a clear status message.
- Let players reposition legal deployed units before confirmation.
- Disable Finish until every unit for the active deployment player is validly deployed.
- After attacker confirmation, switch to `setupStage: 'game'`, initialize losses and turn state, roll the configured first player's movement count, and use existing game behavior.

### 6. Persistence, Documentation, and Tests

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