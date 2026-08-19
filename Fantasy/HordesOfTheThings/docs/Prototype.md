# Prototype notes

How this browser prototype plays the rules in [Design.md](Design.md). Open `prototype.html` from the project folder. Asset URLs are root-relative (`assets/...`), so keep that file at the project root.

Run tests from this folder:

```powershell
npm test
```

That is `node --test test/**/*.test.js tools/**/*.test.js`.

## Layout

| Path | Role |
|---|---|
| `src/data.js`, `geometry.js`, `formation.js`, `history.js` | Shared data and helpers |
| `src/rules/` | Terrain, movement, shooting, melee, recoil, form-up |
| `src/board/` | Camera, pointer, handles, draft, interaction, render |
| `src/setup/` | Army builder, terrain placement, deployment, setup cameras, settings |
| `src/ai/` | Auto Deploy, Auto Move, shooting target picker |
| `src/controller.js` | Local / computer / remote player control and the computer driver |
| `src/app.js`, `boot.js` | Shell, wiring, page boot |
| `test/` | Node tests and harness |
| `tools/` | SVG cleaner and terrain export |
| `styles/prototype.css` | UI |
| `assets/` | Unit art and terrain outlines |

Modules are UMD: browser `<script>` tags in `prototype.html`, and `require()` from tests. Mixins still `install` onto one prototype.

## Identity

Keep these three concepts separate:

| Concept | Representation | Lifetime |
|---|---|---|
| Player identity | `player-1`, `player-2` | Whole game and saves |
| Display color | `state.players[playerId].colorId` | Chosen during setup (twelve colors, or Random until Accept) |
| Controller | `state.players[playerId].controller`: `local`, `computer`, or `remote` | Chosen during army builder. `remote` is reserved for a future online opponent and is a no-op in the driver. |
| Opening role | setup defender / attacker | Setup only |

Do not use attacker or defender as permanent player identifiers. The game bar, loss pills, and army columns show each army's color and faction (`Gold Dinosaurs`), not fixed Blue/Red sides. Blue and Red remain available as presentation colors. Legacy saves with `side: 'blue'` / `'red'` still load and normalize to player IDs.

## Setup

New games use guided setup instead of seeded armies: army builder → terrain placement → sequential unit deployment.

- Each army column has **Controlled by** (Local / Computer, with Online later disabled), plus color, faction, and force. Color, faction, and army can be left **Random**; those resolve when armies are accepted so the two sides never share a color or faction.
- Both players pick a color and faction, or leave them random. Game Settings can limit each faction to the unit types it has artwork for (on by default). Missing faction art falls back to the generic SVG.
- After armies are accepted, a coin flip chooses the defender. Terrain count is `2d4`, editable from 0 through 8. The defender places offers (forest, swamp, water, impassable, road), then deploys in the bottom quarter; the attacker deploys in the top quarter. Those edges become home edges for reserve.
- Every base corner must stay on the 600 mm board and in the assigned quarter, with no overlaps.
- During deployment the active player can Shift-click or marquee-select their units, drag, rotate, and reverse. Rank/file convert is hidden. Units return to the tray with Delete/Backspace, Return to Tray, or by dragging onto the tray.
- **Auto Deploy** places the active player's remaining tray, then leaves the result editable for a local player. If that army is already down, it recalls those units to the tray first. Same-type blocks prefer ranks about four wide; leftovers pack by formation count then speed; bad-going-tolerant troops bias toward forest/swamp; other troops keep clear of bad going underfoot and of forest, swamp, water, or impassable about 180 mm ahead. Artillery stays in the fighting line. Fast movers (Knights, Riders, Heroes, Behemoths) may use flanks after the main body. Flyers stay in their own formations. Attackers also use `getDeploymentMatchupScore`. Finish Deployment is still required for local players. A computer defender auto-places terrain and auto-confirms; a computer deployer auto-deploys and finishes after a short delay so the board can be watched.

## Play

- The canvas pans (right drag) and zooms (wheel around the cursor). Left click selects; drag on empty space marquees. The right-hand panel shows a single selected unit's art and stats.
- Game mode restricts movement to the active **local** player. Phases are `move`, `form-up`, `shooting`, and `melee`.
- Shooting declarations belong to the unit's owner, not the active player. You can still pick your own Shooters during the opponent's shooting phase. You cannot declare shots for a computer (or future remote) army. Artillery and Magicians stay own-turn-only.
- A computer player takes its own terrain, deployment, moves, form-up acknowledge, shooting picks, and melee resolve. Against a local human, combat aftermath still waits on **Acknowledged**. Two computers auto-advance combat after the same short look used for form-up; Pause still freezes the match so you can inspect. Form-up acknowledge is skipped for the computer after a short look. Pause/Resume appears when any side is a computer.
- Computer thinking uses a status pill, not the Auto Move modal, so the last move's ghosts stay visible. Minimum delay between computer actions is `COMPUTER_ACTION_DELAY_MS` (700 ms) in `src/data.js`.
- Form-up, shooting, and melee each leave aftermath ghosts (and combat totals) until **Acknowledged** advances the phase. Destroyed Hordes appear in reserve after that acknowledge. Local humans still click Acknowledged for combats; a computer vs computer match auto-acks after a short look. A computer skips form-up ack.
- Single-unit and formation moves are drafted first. Illegal positions highlight red instead of being blocked immediately. `Finish Move` commits; `Cancel Move` restores the draft origin; `Step` saves a legal intermediate and continues. Ghost bases stay at earlier positions. `Undo` steps back through committed formation adjustments.
- Rank handles: forward, wheel bubbles outside the ends, reverse on a square in front, convert on a square behind. File moves from the lead element inside a forward cone. Conversion ignores path crossings through the selected formation but the final pose must be legal.
- Edit mode bypasses turn rules for debugging: place, drag, rotate, delete, or destroy units, and edit the active side, remaining moves, and phase from the game bar. The computer driver is idle in edit mode.

## Auto Move

One legal move per click for the active **local** player during the move phase. A computer side uses the same search without the blocking modal. Candidates are every unmoved single and rank/file subset, not only the largest formation.

Search includes forward, rank wheels (15°/30°/45°), convert, reverse off a bad melee, and Horde reserve redeploy. Scoring terms: fight, advance, cohesion, terrain, dress, formation size, stack-break, recoil death, pinch relief. Weights live in `AUTO_MOVE_WEIGHTS` in `src/ai/move-score.js`. Skip if the best score is below `MIN_BENEFIT`.

Constraints: game mode, move phase, active side only; respect remaining moves and Magician cost 2; skip reserve units, already-moved units, and ensorcelled-return drafts; no opponent lookahead. Computer players also auto-pick shooting targets and auto-resolve melee. Against a local human they then wait for combat **Acknowledged**; computer vs computer auto-acks after the delay.

## Saves

The gear control and Saved Games modal work during setup and battle. Snapshots include players, phase/moves, units, terrain, losses, UI toggles, and for setup: `setupStage`, army drafts, terrain/deployment progress, and confirm dialogs. Cameras and current selections are not restored. Saves without `setupStage` load as in-game battles. Victory is inferred for edit-mode or older saves from board, reserve, and losses.
