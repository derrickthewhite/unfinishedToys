# Hordes of the Things — Design

Hordes of the Things is a tabletop wargame. Measurements and rules below are given in real-world units.

This file is the living rules spec. How the browser prototype plays those rules is in [Prototype.md](Prototype.md). Implementation work is in [TODO.md](TODO.md).

## Measurements

- Board: 600 mm square
- Good-going grid: 40 mm squares
- Unit width: 40 mm
- Unit depth: 20 mm, 30 mm, or 40 mm (depends on unit)
- 100 paces = 25 mm

## Armies

- Each army totals exactly 24 army points (AP).
- Ownership is `player-1` and `player-2`. Presentation color and faction are chosen independently of ownership. Color is never an ownership key.
- Attacker and defender are opening roles only: they decide who places terrain and who deploys first. They do not identify players during the battle.
- Available factions are Panda, Undead, Goblin, Gunpowder, and Dinosaurs. Default rosters:

| Faction | Units |
|---|---|
| Panda | Blade, Spear, Shooter, Artillery, Knights, Hero |
| Undead | Blade, Spear, Warband, Horde, Riders, Magician |
| Goblin | Spear, Heavy-Warband, Shooter, Horde, Riders |
| Gunpowder | Blade, Shooter, Artillery, Riders |
| Dinosaurs | Heavy-Spear, Beasts, Flyers, Behemoth |

## Unit types

Name, class, value, depth, movement in paces (road / good / bad / water), strength vs infantry / strength vs mounted.

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
| Base | Infantry | 0 | varies | 0 | 0 | 0 | 0 | +6 | +6 |

Heavy-Spear and Heavy-Warband use their corresponding base type's combat-loss behavior. They cannot stack.

## Bases

A base is a stationary stronghold, not an army-list purchase. Only the defender has one. It is placed during terrain placement, before the armies deploy, and it stays where it was put.

- Each faction's base uses that faction's artwork. The shape is the art's outer edge, so curved and non-rectangular outlines block movement and count as contact. Against a curved base, a unit within 2 mm of that outline counts as touching it. It must fit inside 180 mm by 140 mm.
- It fights as infantry at +6 against both infantry and mounted troops, so enemies use their factor against foot. It does not move, form up, or join a formation.
- Everyone in contact with the base is one assault. Only the strongest enemy fights: the highest factor against foot, then the cheapest of those, then a random choice if several remain. Each other enemy in contact supports and gives the base -1. Supporters do not roll, recoil, or get destroyed by that assault. A file lined up behind the fighting unit still gives that unit its usual support.
- Flyers help as support whenever a ground unit is in contact. They fight the base only when no other enemy is touching it, and that assault cannot capture the base.
- A base has no flanks. Contact on any side is frontal, so it does not take the flank penalty.
- If the base loses a shooting or melee conflict, including a minor loss, its army loses the battle immediately.
- The base's nearest point stays within 400 paces of the center of the defender's board edge.
- The defender's deployment area stays the bottom quarter when the base leaves enough room. If the base fills that quarter, the defender may deploy farther forward, up to 120 mm in front of the base and no farther than the board's midline.

## Terrain

- The board is good going unless a feature covers it.
- Implemented types: road, good going, forest, swamp, water, and impassable. Roads are full-board horizontal or vertical strips. Other features use blob shapes.
- Forest and swamp are both bad going and rough terrain. They have the same movement and line-of-sight effects. A target shot at in a wood also takes +2. Swamp does not. There is no built-up area terrain yet.
- A unit samples its corners, center, and front and rear midpoints to determine the terrain it occupies. For movement, the path is sampled and the relevant allowance applies to the whole move.
- Any road sample takes precedence over every other sampled type, including water and impassable, so the unit uses its road allowance for that move.
- Impassable terrain cannot be entered or occupied. Water can be entered using the unit's water allowance.

## Movement

- Each round a player receives a number of moves equal to the roll of 1d6.
- An individual unit may rotate and translate freely as long as no corner travels farther than the move allowance through the worst terrain the move crosses.
- Road, good-going, bad-going, and water allowances come from the unit's type. Forest and swamp use the bad-going allowance. An impassable path is illegal. Road precedence applies when any sampled point of the move is on a road.
- A single unit that starts in legal edge contact with a friendly formation may rotate out through that starting contact, but it still must end clear of all collisions.
- Units may not move through each other or through impassable terrain.
- Left and right corners are interchangeable within the front pair and within the back pair when measuring travel. Front and back remain distinct except for in-place reversals that keep the base footprint fixed.
- Flyers ignore all terrain during movement, including water and impassable. An unengaged Flyer is non-blocking: it and other units may cross or end overlapping each other. A Flyer that begins in melee follows normal collision rules and must first move at least 20 mm generally backward, measured along its starting facing, before continuing the same move; lateral movement is allowed during that withdrawal.

## Formations

- A formation is same-side units whose sides are neatly stacked. It may move forward together as a single move.
- Rank formations (fronts in a line) may wheel about their front-right or front-left corner. One front corner stays fixed as the pivot; the free end may not wheel backward.
- File formations (fronts and backs in contact) may move forward with limited flexibility but must keep front or rear contact.
- Rank and file formations may convert into each other.
- Subsections of a formation may move as a formation; the whole formation need not move.
- All formation moves still obey the corner-travel limit through the worst terrain crossed.

## Form-up

After ordinary moves, any active-side unit or maintained formation that can reach an enemy by moving the form-up distance (20 mm) or less may form up while keeping formation. A single front corner getting close enough is enough to trigger the check, even when the final alignment needs rotation. Against a base, that distance is measured to the base outline. Every side of the base is a front: the formation faces the nearest side squarely and finishes with its front touching the outline.

Default form-up prefers face-to-face contact. A unit approaching from the side may instead finish with its front against the enemy side if both of its starting front corners are at or just barely past the enemy front line from the enemy's point of view.

Opposing lines that are nearly parallel and face each other form up unit-by-unit when elements are interleaved. Angled approaches use split form-up for oblique contacts. Only the angled elements that can individually reach contact move into it; a non-qualifying neighbor may slide sideways to avoid overlap.

## Reserve

Each player has a reserve lot off the left of the 600 mm board, aligned with their home edge (defender bottom, attacker top) and large enough for 24 Horde bases.

Destroyed Hordes go to that player's reserve instead of being removed, and count as lost until they return. During the owner's move phase, placing a reserve Horde onto the rear board edge costs one move. The unit must sit fully on-board, not on impassable terrain, and not within 200 paces of an enemy. It counts as having moved.

## Recoil and flee

- Recoil is a combat result: the unit moves backward by its own depth. A directly lined-up friendly rear element may be pushed.
- Recoil destroys the original recoiling unit if the destination or path would enter water or impassable terrain, or if it would run into rear or side enemy contact or an obstructing unit.
- Flyers that lose a minor battle recoil. A double destroys them only when the winner is a Hero, Magician, Flyers, or Shooters. A double from any other unit makes them recoil, then flee 600 paces straight backward. That flee ignores terrain and units.
- A Behemoth that loses to Artillery in shooting or melee first recoils normally, then flees 600 paces. It chooses the shallowest heading from straight backward that avoids enemies, bad going, water, and impassable terrain. It may pass through friends but cannot finish overlapping one. It is destroyed if every legal path needs more than a 90-degree turn from straight backward.

## Magicians

Magicians are mounted 4 AP units. Undead armies may include them.

- Any position change costs 2 moves. Declaring a ranged attack costs 2 moves when the shot is assigned.
- Unused moves carry from the move phase into shooting, so a Magician may move and shoot in the same turn if 4 moves are available.
- Magicians shoot up to 600 paces, base edge to base edge, at any enemy. They ignore units and obstacles for line of sight except impassable terrain, and cannot shoot while in melee. Shooting otherwise uses the same resolution as other ranged units.
- On a minor win against a Hero or Magician, the Magician ensorcels the loser instead of recoiling. A double still destroys. Heroes destroy Magicians when they win melee.
- Rolling a 1 on the attack die when shooting from range ensorcels the Magician; the shot still resolves normally.
- Ensorcelled Heroes and Magicians go to their owner's reserve lot and count as losses until they return. On the original owner's move phase they may return for 0 moves if the ensorceller is destroyed or ensorcelled, or 6 moves if the ensorceller remains on the board.
- Heroes return onto the enemy home edge. Magicians return to any legal position within 250 paces of the spot they were ensorcelled. Return placement does not require the 200-pace enemy clearance used for Horde redeploy.

## Combat

Each side in a fight rolls 1d6 and adds its strength against the opponent's class plus modifiers. The higher total wins. A double (winner's total at least twice the loser's) destroys the loser, except Flyers: a double destroys them only when the winner is a Hero, Magician, Flyers, or Shooters, and any other double makes them flee 600 paces. A minor win uses the type table below.

The shooting attacker does not suffer a loss result for losing its own ranged exchange. It can still be destroyed or recoiled when it is the target of enemy shooting.

### Shooting

- Only ranged units with a ranged profile and no current enemy front contact shoot.
- Shooters fire in every shooting phase, including the opponent's turn. A shot in one phase does not spend the shot for the other. Their firing area is a 200-pace deep box, 120 mm wide, projected from the front edge of the base.
- Artillery fires only during its own shooting phase, only if it did not move that turn, and uses a 500-pace deep, 120 mm-wide firing box.
- Line of sight is checked from the shooter's front edge to the nearest side of the target. Impassable terrain, other units, and rough ground block shots. Water and roads do not.
- A shot may travel through up to 50 paces of rough terrain at the shooter's end when the shooter is in bad going, and independently up to 50 paces at the target's end when the target is in bad going. Rough terrain farther from both endpoints blocks the shot.
- Shooting resolves once per target. Two units that shoot each other make one exchange and each side rolls once; the lower total suffers the result. If several shooters target the same enemy, the strongest single shooter supplies the attack strength. Two shooters give the defender −1; three or more give −2.
- A target in a wood takes +2 while being shot at. Shooters still ignore the bad-going penalty, but they do get this +2. Swamp does not give it.

### Melee

- Melee is auto-detected. Every enemy pair whose fronts touch forms a combat. Front-to-rear contact also counts. Two otherwise idle enemies that only touch side-to-side are pulled into melee.
- When two or more elements touch the same enemy, that is one combat. The element facing that enemy's front is the fighter. The other contacts support the combat and still count as flank or rear attacks. They do not roll a second fight.
- When one unit's front is already on the contact, against an enemy side or rear, that unit stays put. The unit that was contacted turns square to that front and slides so the two fronts coincide. It does all of the moving, including when its side is as long as the enemy front.
- Otherwise, a combatant in exactly one melee and without enemy contact on its own front turns to face that opponent as combat starts, anchoring the turn on the shared contact edge rather than spinning around its center.
- Spears and Warbands can stack when two same-side, same-type elements share a facing and one element's front is flush against the other's side. Stacked pairs fight as one combatant and gain +1 in melee. Heavy-Spears and Heavy-Warbands cannot stack.

### Combat modifiers

- Forest and swamp are bad going for combat. A unit in bad going takes −2 unless its type ignores that penalty. Warbands, Heavy-Warbands, Shooters, and Beasts ignore it. A unit takes that terrain penalty at most once.
- A mounted attacker in good going takes −2 when fighting an opponent in bad going. A mounted unit already standing in bad going does not take a second terrain penalty.
- Melee-only: −1 for flank attack; −1 for rear attack when the rear attacker is not frontally engaged elsewhere; −1 per overlap on a flank. An idle enemy overlaps by touching that flank, or by standing in the fighting enemy's rank where that rank extends past the fighter. A gap or a step in the rank still counts. One overlap per side.

### Minor-loss outcomes

First matching row wins. Heavy-Spear counts as Spear; Heavy-Warband counts as Warband. If nothing matches, the loser recoils.

| Loser | Condition | Outcome |
|---|---|---|
| Flyers | Minor loss | Recoil |
| Flyers | Double by Hero, Magician, Flyers, or Shooters | Destroyed |
| Flyers | Double by any other unit | Recoil, then flee 600 paces |
| Behemoth | Winner is Artillery | Recoil, then flee 600 paces |
| Magician | Winner is Hero, melee | Destroyed |
| Hero or Magician | Winner is Magician | Ensorcelled |
| Hero | Other minor losses | Recoil |
| Beasts | Melee, winner is mounted | Destroyed |
| Artillery | Melee | Destroyed |
| Shooter | Shooting | Recoil |
| Shooter | Melee, winner is mounted | Destroyed |
| Riders | Loser in bad going | Destroyed |
| Knights | Loser in bad going | Destroyed |
| Knights | Melee, winner is Shooter | Destroyed |
| Spear, Blade, or Horde | Winner is Warband | Destroyed |
| Spear, Blade, or Horde | Winner is Knights, loser not in bad going | Destroyed |

Knights therefore lose their minor-win destruction against Spears, Blades, and Hordes when the loser is in bad going. Riders and Knights that lose in bad going are destroyed rather than recoiling.

## Turn sequence

In game mode, after the last move is spent:

1. Form-up runs automatically.
2. Shooting: declare shots, then resolve them.
3. Melee: detect and resolve all current combats.
4. Victory is checked once, after melee, before the turn would pass. Losses from shooting and melee in the same turn are totaled first.

Unused Magician moves carry into shooting. Magicians who cannot afford the 2 leftover moves to declare a shot do not count as able to shoot.

## Victory

A side loses when it has lost at least half of its starting army value **and** has lost more AP than the opponent. Starting army value is captured when deployment finishes. The defender also loses immediately if its base loses a conflict.

Victory is checked once per turn, after melee, not after individual shooting or melee resolutions. Reserve and ensorcelled units count toward losses while they remain off the board. Returning a unit from reserve clears its loss entry.

If both sides reach half losses with equal AP lost, the battle continues until one side leads on casualties.

## Rules not yet in the prototype

These are intended game rules. They are not implemented. Tracking the work to add them lives in [TODO.md](TODO.md).

### Hills

Hills and hill crests exist as terrain. Features may be obstructing or non-obstructing. Hill crests block shooting line of sight. Exact movement, combat, and crest geometry are still to be specified when the terrain data exists.

### Rivers

Rivers are a distinct feature from the current water blobs. They need movement, crossing, and a decision on whether roads or bridges change terrain precedence.

### Roads

Implemented roads are one full-board horizontal or vertical strip. Crooked routes and forks are legal road shapes in the design, but they need geometry and sampling rules that the current strip model does not provide.

### Retreat

Retreat is a combat movement result: the unit moves backward a specified distance, with limited maneuver allowed. It is not the same as recoil (one base depth, no maneuver) or Behemoth flee.

### Lurkers

Lurkers begin off-board or are removed from the board, then enter during play using reserve-style placement. They are a further reserve type alongside Hordes.
