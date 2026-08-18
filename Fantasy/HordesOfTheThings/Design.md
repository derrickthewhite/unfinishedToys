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
- Implemented terrain types are road, good going, forest, swamp, water, and impassable terrain. Roads are long, thin strips; the other implemented features may use arbitrary blob shapes.
- Forest and swamp are both bad going and rough terrain. They have identical movement, combat, and line-of-sight effects.
- A unit samples its corners, center, and front and rear midpoints to determine the terrain it occupies. For movement, the path is sampled and the relevant terrain allowance applies to the whole move.
- Any road sample takes precedence over every other sampled terrain type, including water and impassable terrain, so the unit uses its road movement allowance for that move.
- Impassable terrain cannot be entered or occupied. Water can be entered using the unit's water movement allowance.
- Hills, hill crests, and separate obstructing versus non-obstructing variants are not yet implemented in terrain data or rules.

## Movement
- Each round a player receives a number of moves equal to the roll of a 1d6.
- When moving an individual unit, it may rotate and translate freely as long as the distance any corner moves is less than or equal to the move distance through the worst terrain it traverses.
- Road, good-going, bad-going, and water movement allowances come from the unit's type. Forest and swamp use the bad-going allowance; an impassable path is illegal. Road precedence applies when any sampled point of the move is on a road.
- A single unit that starts in legal edge contact with a friendly formation may rotate out through that starting contact, but it still must end clear of all collisions.
- Units may not move through each other or through impassable terrain
- Flyers ignore all terrain during movement, including water and impassable terrain. An unengaged Flyer is non-blocking: it and other units may cross or end overlapping each other. A Flyer that begins in melee instead follows normal collision rules and must first move at least 20 mm generally backward, measured along its starting facing, before continuing the same move; lateral movement is allowed during that withdrawal.
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
- A recoil destroys the original recoiling unit if its destination enters water or impassable terrain, in addition to the existing unit-contact obstructions. Destroyed Hordes are sent to that player's reserve instead of being removed.
- Reserve: each player has a world-space reserve lot to the left of the 600 mm board, aligned with their home edge (defender bottom, attacker top) and large enough for 24 Horde bases. Clicking a reserve unit during the move phase spends one move to place it on that player's rear board edge, fully on-board, not on impassable terrain, and not within 200 paces of an enemy. The deployed unit counts as having moved. Hordes currently in reserve count as lost until they return.
- Magicians are mounted, 4 AP units. Undead armies may include them; other factions use the generic art in Edit Mode until faction artwork exists. Any position change costs 2 moves; declaring a ranged attack costs 2 moves when the shot is assigned. Unused PIPs carry from the move phase into shooting, so they may move and attack in the same turn if 4 moves are available. Magicians shoot up to 600 paces base edge to base edge at any enemy, ignore units and obstacles for line of sight except impassable terrain, and cannot shoot while in melee. Shooting uses the same resolution as other ranged units. On a minor win against a Hero or Magician, the Magician ensorcels the loser instead of recoiling; double still destroys. Heroes destroy Magicians when they win melee. Rolling a 1 on the attack die when shooting from range ensorcels the Magician; the shot still resolves normally. Ensorcelled Heroes and Magicians go to their owner's reserve lot and count as losses until they return. On the original owner's move phase they may return for 0 moves if the ensorceller is destroyed or ensorcelled, or 6 moves if the ensorceller remains on the board. Heroes return onto the enemy home edge. Magicians return to any legal position within 250 paces of the spot they were ensorcelled. Return placement does not require the 200-pace enemy clearance used for Horde redeploy.
- Retreat: moving backwards a specified amount; limited maneuver is allowed.

## Starting Unit Types
Name, class, value, depth, moves (road / good / bad / water), strength vs infantry / strength vs mounted

| Unit | Class | Value | Depth | Road | Good | Bad | Water | Str (Inf) | Str (Mount) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Blade | Infantry | 2 | 20 mm | 400 | 200 | 200 | 100 | +5 | +3 |
| Spear | Infantry | 2 | 20 mm | 400 | 200 | 200 | 100 | +4 | +4 |
| Heavy-Spear | Infantry | 3 | 30 mm | 400 | 200 | 200 | 100 | +5 | +5 |
| Warband | Infantry | 2 | 20 mm | 400 | 200 | 200 | 100 | +3 | +3 |
| Heavy-Warband | Infantry | 3 | 30 mm | 400 | 200 | 200 | 100 | +4 | +4 |
| Shooter | Infantry | 2 | 20 mm | 400 | 300 | 300 | 100 | +3 | +4 |
| Artillery | Infantry | 3 | 40 mm | 300 | 200 | 0 | 100 | +4 | +4 |
| Horde | Infantry | 1 | 40 mm | 400 | 200 | 200 | 100 | +2 | +2 |
| Knights | Mounted | 2 | 30 mm | 400 | 400 | 200 | 100 | +3 | +4 |
| Riders | Mounted | 2 | 30 mm | 500 | 500 | 200 | 100 | +3 | +3 |
| Hero | Mounted | 4 | 40 mm | 500 | 500 | 200 | 100 | +5 | +5 |
| Magician | Mounted | 4 | 40 mm | 500 | 500 | 200 | 100 | +4 | +4 |
| Beasts | Mounted | 2 | 30 mm | 400 | 400 | 400 | 100 | +3 | +4 |
| Flyers | Mounted | 2 | 30 mm | 1200 | 1200 | 1200 | 1200 | +2 | +2 |
| Behemoth | Mounted | 4 | 40 mm | 400 | 300 | 200 | 100 | +4 | +5 |

## Combat
- Only ranged units with a ranged profile and no current enemy front contact participate in the shooting phase.
- Shooters fire only in the `shooting` phase. Their current firing area is a 200-pace deep box, 120 mm wide, projected from the front edge of the base. Artillery fires only during its own shooting phase, only if it did not move that turn, and uses a 500-pace deep, 120 mm-wide firing box.
- If the `Ranged Area` checkbox is enabled during shooting, each ranged unit's firing box is drawn on the map as a thin outline.
- Shooting line of sight is checked from the shooter's front edge to the nearest side of the target. Impassable terrain, other units, and rough ground block shots. Rough ground only allows sight through the first 50 paces when the line begins or ends inside that rough ground. Hill-crest blocking is still deferred until hill crests are modeled in terrain data.
- Forest and swamp are rough terrain for shooting line of sight. A shot may travel through up to 50 paces of rough terrain at the shooter's end when the shooter is in bad going, and independently up to 50 paces at the target's end when the target is in bad going; rough terrain farther from both endpoints blocks the shot. Impassable terrain blocks every shooting line that crosses it, while water and roads do not block line of sight.
- Shooting declarations are made before resolution. Clicking a ranged unit that is not tied down by enemy front contact highlights it and its valid targets; clicking a valid enemy target assigns that shot and draws a red arched arrow.
- Shooting currently resolves once per defender. If several shooters target the same enemy, the strongest single shooter supplies the attack strength and extra shooters apply only the defender penalty: 2 shooters gives the defender `-1`; 3 or more gives `-2`.
- A unit doing the shooting does not suffer a loss result for losing a ranged exchange during the shooting phase; it can still be destroyed or recoiled when it is the target of enemy shooting.
- `Resolve Shooting` is always available during the shooting phase, even with no shots declared. If any units can still shoot, a confirmation modal asks whether to skip them. Magicians who do not have the 2 leftover PIPs needed to declare an attack do not count as able to shoot. Declared shots then resolve, apply destruction or recoil, send destroyed Hordes to reserve after the aftermath is acknowledged, remove other destroyed units from the board, record their point values in the loss bar, and advance to melee.
- Combat modifiers are now structured as composable rule fragments so later melee modifiers can be added without rewriting the resolver.
- Forest and swamp are bad going for combat. A unit in bad going takes `-2` unless its type ignores the bad-going penalty; Warbands, Heavy-Warbands, Shooters, and Beasts ignore it. A mounted attacker also takes `-2` when fighting an opponent in bad going, unless it is already receiving the same `-2` bad-going penalty.
- Riders and Knights that lose in bad going are destroyed rather than recoiling. Knights also lose their minor-win destruction effect against Spears, Blades, and Hordes when the losing unit is in bad going.
- Beasts are destroyed when they lose a melee combat against mounted troops.
- Artillery is destroyed if it loses a melee combat, even on a minor loss that would normally cause a recoil.
- Flyers that lose a battle first recoil normally, then flee 600 paces straight backward. Their flee movement ignores terrain and units; the normal rule that a shooting attacker does not lose its declared shooting exchange still applies.
- A Behemoth that loses to Artillery in shooting or melee first recoils normally, then flees 600 paces. It selects the shallowest direction from straight backward that avoids enemies, bad going, water, and impassable terrain; it may pass through friends but cannot finish overlapping one. It is destroyed if every legal path requires more than a 90-degree turn from straight backward.
- Minor-loss outcomes currently follow the requested type table. Recoils move a unit backward by its own depth, may push a directly lined-up friendly rear element, and destroy the original recoiling unit if the recoil path would run into water, impassable terrain, rear or side enemy contact, or an obstructing unit. When recoil destroys a unit, the combat log prints the specific reason.
- The top bar now tracks total points lost by each side. Hovering the loss readout shows the list of destroyed units and their values.
- Melee is auto-detected in the `melee` phase. Every enemy pair whose fronts touch forms a combat, and front-to-rear contact also counts as a combat. If two otherwise idle enemy combatants are only touching side-to-side, they are also pulled into melee instead of being ignored.
- When a combatant is engaged in exactly one melee and does not already have enemy contact on its own front, it turns to face that opponent as combat starts by anchoring the turn on the shared contact edge rather than spinning around its center. This makes side-contact and other one-on-one non-frontal engagements resolve as facing combats while keeping the fight tied to the original contact line.
- Spears and Warbands can stack when two same-side, same-type elements share a facing and one element's front is flush against the other's side. Stacked pairs fight as one combatant and gain `+1` in melee. Heavy-Spears and Heavy-Warbands use their corresponding base type's combat behavior but cannot stack.
- Melee-only penalties currently implemented are `-1` for flank attack, `-1` for rear attack when the rear attacker is not frontally engaged elsewhere, and overlap penalties from idle enemy elements that are touching the fighter's left or right flank without being in melee themselves.
- `Resolve Melee` resolves every detected melee at once, applies destruction or recoil, records losses, and shows the same ghosted aftermath review used for shooting. After **Acknowledged**, destroyed Hordes appear in that player's reserve lot.

## Movement Prototype

### Scope
- The current prototype lives in `prototype.html`, `prototype.css`, and the `prototype-*.js` modules in this folder.
- The prototype is canvas-first and now covers guided setup, movement, shooting, melee, and local-storage saves for in-game state.
- Unit state is stored as the left-front corner of the base plus a rotation value in radians.

### Default Prototype Map
- The board remains 600 mm square with good going as the baseline terrain.
- The good-going reference grid is drawn in 40 mm squares.
- New games use guided setup (army builder → terrain placement → sequential unit deployment) instead of seeded blue/red sample armies.
- Edit mode can still place free units for debugging.

### Guided Setup And Auto Deploy
- Each army must total exactly 24 AP. Both players choose a presentation color and faction independently of ownership IDs (`player-1` / `player-2`). Available factions are Panda, Undead, Goblin, Gunpowder, and Dinosaurs. Twelve presentation colors are available. By default, Game Settings limits each faction to the unit types it has artwork for.
- After armies are accepted, a coin flip chooses the temporary defender. The defender places terrain, then deploys in the bottom quarter; the attacker deploys afterward in the top quarter. Those top/bottom assignments become each player's home edge for reserve deployment.
- Deployment requires every base corner to stay on the 600 mm board and in the assigned quarter, with no overlaps.
- During deployment, the active player can Shift-click or marquee-select their units, drag them, and use rotate/reverse handles. Rank/file convert is not available. Units can be returned to the tray with Delete/Backspace, the Return to Tray button, or by dragging them onto the tray. Tray units can be clicked then placed, or dragged onto the board.
- **Auto Deploy** places the active player's remaining tray units, then leaves them editable. If that player's army is already fully deployed, Auto Deploy stays available and recalls those units to the tray before placing them again:
  - Same-type blocks prefer ranks up to about four wide, sharing one front line. Leftovers then pack to minimize formation count, then total good-going slowdown, without pairing units whose good-going speeds differ by 300 or more. Larger formations place first; sister ranks are preferred over depth overlap, and if they must overlap the larger body stays in front.
  - Terrain is scored per base: bad-going-tolerant troops (Warbands, Heavy-Warbands, Beasts, Shooters) bias toward forest/swamp underfoot, while other troops must keep their whole footprint out. Auto Deploy samples a frontage-wide corridor about 180 mm ahead so good-going troops do not sit in front of forest, swamp, water, or impassable terrain. Forest or swamp ahead of Shooters is treated as mixed rather than a strong plus or minus.
  - Artillery stays in the fighting line. Fast movers are Knights, Riders, Heroes, and Behemoths; they may use flanks after the main body is down. Flyers stay in their own formations.
  - Defenders use terrain and formation heuristics. Attackers also use a scored matchup table (`getDeploymentMatchupScore`) to align against the defender's line where practical.
  - Facing stays the default for the quarter; depth prefers mid-zone unless a rear/flank role asks for behind.
- The gear control and Saved Games modal work during setup and battle. Setup snapshots use the same slot list and restore `setupStage`, army drafts, terrain/deployment progress, and any open confirm-armies or confirm-terrain dialog. Cameras and current selections are not restored. Default setup save names use the matchup, screen, and date.

### Shared Controls
- The prototype supports free camera pan and zoom on the canvas.
- Left click selects; clicking a selected single unit unselects it.
- Dragging on empty space produces an area-selection box.
- Right drag pans the camera; mouse wheel zooms around the cursor.
- Selected units are shown with a thicker border. The right-hand selection panel shows a single selected unit's artwork and stats during battle and deployment.

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