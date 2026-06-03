# Hordes of the Things — Design

Hordes of the Things is a tabletop wargame. Measurements and rules below are given in real-world units.

## Measurements
- Board: 600 mm square
- Good-going grid: 40 mm squares
- Unit width: 40 mm
- Unit depth: 20 mm, 30 mm, or 40 mm (depends on unit)
- 100 paces = 25 mm

## Stats
- Units have separate movement values for: road, good going, bad going, and water.
- Some units may have the ability to fly.
- Units are classified as infantry or mounted.
- Units have separate strength values against infantry and against mounted units.
- Units belong to a small set of types; these types often have special effects against each other during combat resolution (for example, if knights win a minor victory against shooters the shooters are destroyed, while other unit types might merely recoil).

## Terrain
- By default the map is good going.
- Terrain features include: roads, water, hills, bad going (obstructs), bad going (non-obstructing), impassable (obstructs), impassable (non-obstructing).
- Roads are long and thin; other features may take arbitrary shapes.
- Features (other than hills) are defined by position, shape, and type.
- Hills have a crest marked as a point or a line.
- A unit with any part of it on a terrain feature is considered to be "in" that feature.

## Movement
- Each round a player receives a number of moves equal to the roll of a 1d6.
- When moving an individual unit, it may rotate and translate freely as long as the distance any corner moves is less than or equal to the move distance through the worst terrain it traverses.
- A single unit that starts in legal edge contact with a friendly formation may rotate out through that starting contact, but it still must end clear of all collisions.
- Units may not move through each other or through impassable terrain
- Formation rules:
  - A "formation" (units on the same side whose sides are neatly stacked) may move forward together as a single move.
  - "Rank formations" (units whose fronts form a line) may wheel about their front-right or front-left corner.
  - Wheeling keeps one front corner fixed as the pivot while the rest of the rank swings forward around it; the free end may not wheel backward.
  - "File formations" (units with fronts and backs in contact) may move forward with limited flexibility but must maintain front or rear contact.
  - Rank and file formations may convert into each other.
  - Subsections of a formation may be moved as a formation (you need not move the entire formation).
  - All formation moves are constrained by the rule that no unit corner may move farther than its allowed move through the worst terrain it crosses.
- Forming up: after normal moves, units that can reach an enemy by moving the configured form-up distance or less may form up (maintaining formation); a single front corner getting close enough is sufficient to trigger the form-up check, even when the final alignment requires rotation.
- Default form-up still prefers the usual face-to-face result, but a unit approaching from the side may instead finish with its front facing the enemy side if both of its starting front corners are at or just barely past the enemy front line from the enemy's point of view.
- Recoil: moving backwards equal to unit depth (a combat result).
- Retreat: moving backwards a specified amount; limited maneuver is allowed.

## Starting Unit Types
Name, class, value, depth, moves (road / good / bad / water), strength vs infantry / strength vs mounted

| Unit | Class | Value | Depth | Road | Good | Bad | Water | Str (Inf) | Str (Mount) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Blade | Infantry | 2 | 20 mm | 400 | 200 | 200 | 100 | +5 | +3 |
| Spear | Infantry | 2 | 20 mm | 400 | 200 | 200 | 100 | +4 | +4 |
| Warband | Infantry | 2 | 20 mm | 400 | 200 | 200 | 100 | +3 | +3 |
| Shooter | Infantry | 2 | 20 mm | 400 | 300 | 300 | 100 | +3 | +4 |
| Horde | Infantry | 1 | 40 mm | 400 | 200 | 200 | 100 | +2 | +2 |
| Knights | Mounted | 2 | 30 mm | 400 | 400 | 200 | 100 | +3 | +4 |
| Riders | Mounted | 2 | 30 mm | 500 | 500 | 200 | 100 | +3 | +3 |
| Hero | Mounted | 4 | 40 mm | 500 | 500 | 200 | 100 | +5 | +5 |

## Combat
- Only ranged units with a ranged profile and no current enemy front contact participate in the shooting phase. Right now that means Shooters that are not already tied down by an enemy on their front, but the data model now supports additional ranged troop types later.
- Shooters fire only in the `shooting` phase. Their current firing area is a 200-pace deep box, 120 mm wide, projected from the front edge of the base.
- If the `Ranged Area` checkbox is enabled during shooting, each ranged unit's firing box is drawn on the map as a thin outline.
- Shooting line of sight is checked from the shooter's front edge to the nearest side of the target. Impassable terrain, other units, and rough ground block shots. Rough ground only allows sight through the first 50 paces when the line begins or ends inside that rough ground. Hill-crest blocking is still deferred until hill crests are modeled in terrain data.
- Shooting declarations are made before resolution. Clicking a ranged unit that is not tied down by enemy front contact highlights it and its valid targets; clicking a valid enemy target assigns that shot and draws a red arched arrow.
- Shooting currently resolves once per defender. If several shooters target the same enemy, the strongest single shooter supplies the attack strength and extra shooters apply only the defender penalty: 2 shooters gives the defender `-1`; 3 or more gives `-2`.
- A unit doing the shooting does not suffer a loss result for losing a ranged exchange during the shooting phase; it can still be destroyed or recoiled when it is the target of enemy shooting.
- `Resolve Shooting` resolves all declared shots, applies destruction or recoil, removes destroyed units from the board, records their point values in the loss bar, and advances to melee.
- Combat modifiers are now structured as composable rule fragments so later melee modifiers can be added without rewriting the resolver.
- Minor-loss outcomes currently follow the requested type table. Recoils move a unit backward by its own depth, may push a directly lined-up friendly rear element, and destroy the original recoiling unit if the recoil path would run into water, impassable terrain, rear or side enemy contact, or an obstructing unit. When recoil destroys a unit, the combat log prints the specific reason.
- The top bar now tracks total points lost by each side. Hovering the loss readout shows the list of destroyed units and their values.
- Melee is auto-detected in the `melee` phase. Every enemy pair whose fronts touch forms a combat, and front-to-rear contact also counts as a combat. If two otherwise idle enemy combatants are only touching side-to-side, they are also pulled into melee instead of being ignored.
- When a combatant is engaged in exactly one melee and does not already have enemy contact on its own front, it turns to face that opponent as combat starts by anchoring the turn on the shared contact edge rather than spinning around its center. This makes side-contact and other one-on-one non-frontal engagements resolve as facing combats while keeping the fight tied to the original contact line.
- Spears and Warbands can stack when two same-side, same-type elements share a facing and one element's front is flush against the other's side. Stacked pairs fight as one combatant and gain `+1` in melee.
- Melee-only penalties currently implemented are `-1` for flank attack, `-1` for rear attack when the rear attacker is not frontally engaged elsewhere, and overlap penalties from idle enemy elements that are touching the fighter's left or right flank without being in melee themselves.
- `Resolve Melee` resolves every detected melee at once, applies destruction or recoil, records losses, and shows the same ghosted aftermath review used for shooting.

## Movement Prototype

### Scope
- The current prototype lives in `prototype.html`, `prototype.css`, and `prototype.js` in this folder.
- The prototype is intentionally movement-focused and canvas-first. Combat, AI, persistence, and later phases are deferred.
- Unit state is stored as the left-front corner of the base plus a rotation value in radians.

### Default Prototype Map
- The board remains 600 mm square with good going as the baseline terrain.
- The good-going reference grid is drawn in 40 mm squares.
- Two roads cross the whole map and intersect at the center.
- One quadrant contains a water blob, one contains obstructing bad going (forest), one contains an impassable blob, and one contains non-obstructing bad going (swamp).
- The default setup also includes sample red and blue forces arranged so single-unit movement, rank movement, mounted movement, and file movement can be exercised immediately without seeded overlap.

### Shared Controls
- The prototype supports free camera pan and zoom on the canvas.
- Left click selects; clicking a selected single unit unselects it.
- Dragging on empty space produces an area-selection box.
- Right drag pans the camera; mouse wheel zooms around the cursor.
- Selected units are shown with a thicker border.

### Edit Mode
- Edit mode is for scenario setup and debugging geometry.
- The user can place new units, move selected units freely, and rotate a single selected unit with a rotation bubble.
- The game bar tracks and edits the active side, remaining moves, and current phase.
- The current prototype phases are `move` and `form up`.

### Game Mode
- Game mode restricts interaction to the active side and tracks moves through the game bar.
- Single-unit moves are drafted first: illegal positions are highlighted in red instead of being blocked immediately.
- A move is only committed when `Finish Move` is clicked.
- Single-unit drafts may also use `Step` to save a valid intermediate position and continue from there while keeping ghost markers for earlier positions.
- The move toolbar can also preview automatic form-up results as translucent future-position ghosts before the phase actually ends; this preview is toggleable from the toolbar and with the `P` shortcut.
- `Cancel Move` restores the original position for the current draft.
- Drafted and dragged units show translucent ghost bases at their origin so the prior position remains visible while adjusting.
- Click selection and area selection are both supported.
- If the selection is not a legal single unit, rank, or file formation, the selected units show an invalid red border.

### Formation Drafting
- Formation adjustments are drafted and may be stacked before spending a move.
- Rank formations can move forward as a group and wheel around either front corner using side bubbles placed just outside the formation.
- Rank and file formations can reverse in place from a square bubble positioned in front of the formation center.
- Reversing a rank preserves a single aligned front line for the whole formation rather than reversing each element independently.
- Rank and file formations can also convert using a square bubble behind the formation. Conversion rotates every selected element by 90 degrees and re-forms the group as either a rank or a file while keeping base contact.
- File-to-rank conversion anchors the new rank's front line on the side of the file that is closest to the board center, and the transformed rank faces toward the board center when that result is legal.
- Rank-to-file conversion anchors one long side of the new file on the old front edge of the rank, with the body of the new file staying on the same side of that line as the original formation body.
- Conversion prefers outcomes that face toward the board center, but it will fall back to the mirrored 90-degree outcome if that is the legal version. Path crossings through the selected formation are ignored during the conversion, but the final converted formation still has to be legal against terrain and all units.
- Conversion allowance is checked from the units' final center displacement rather than sampled corner-arc travel so normal 200-pace formations can complete practical rank/file transforms.
- File formations move from the lead element and allow limited lateral deviation within a forward cone.
- Formation adjustments do not spend additional moves until `Finish Move` is pressed.
- `Undo` steps backward through committed formation adjustments until the original draft state is reached.

### Prototype Legality Checks
- The prototype evaluates movement legality using the current design goal that no unit corner may travel farther than the unit's move allowance through the worst terrain it crosses.
- Left and right corners are treated as interchangeable within the front pair and within the back pair when measuring travel; front and back remain distinct except for explicit in-place reversals that keep the base footprint fixed.
- Impassable terrain and unit overlap are treated as illegal.
- Illegal draft states are shown visually in red so movement bugs can be diagnosed without silently blocking the interaction.

### Follow-Up Work
- Refine file-formation follow behavior and rank/file conversion.
- Expand terrain editing and scenario persistence once the movement model is stable.

### Prototype Phase Flow
- When the last move is spent in game mode, the prototype automatically enters `form up`.
- Form up is automatic: any active-side unit or maintained formation that can rotate to face an enemy and align a front corner to an enemy corner within the configured form-up distance is moved into contact.
- Units moved by form up leave their pre-form-up positions behind as translucent ghost bases until `Acknowledged` is clicked.
- `Acknowledged` advances from `form up` to `shooting`, then from `shooting` to `melee`.
- Shooting is interactive, resolves declared ranged attacks, then waits on an aftermath review before `Acknowledged` advances to melee.
- Melee is auto-detected, resolves all current combats at once, then leaves the aftermath on screen until `Acknowledged` clears it.
- Combat aftermath keeps numeric result labels and translucent ghost bases for destroyed participants so the resolved fight can still be reviewed before `Acknowledged` clears it.
- Numeric combat result labels render above the units during aftermath review, and each resolved fight is logged to the console with combatants, team colors, unit types, modifiers, die rolls, totals, outcome, and the named destruction rule when one applies.

### Handle Icons
- Rotation bubbles are slightly smaller and now show a curved-arrow icon rotated 180 degrees; left-side rank handles mirror that icon.
- The formation reverse control uses a square bubble with a vertical bidirectional arrow icon.