# Move AI

The computer (and Auto Move) pick moves by generating legal candidates, simulating each one on a copy of the board, scoring the result, and choosing the highest-scoring option above a minimum benefit threshold.

## Module layout

| Module | Role |
|--------|------|
| `src/ai/move-candidates.js` | Builds candidate groups (unmoved formations) and move kinds to try |
| `src/ai/move-simulate.js` | Applies a candidate move, validates it, returns trial board + distance |
| `src/ai/move-score.js` | Scores before/after difference using weighted heuristics |
| `src/ai/move-apply.js` | Searches candidates, applies the chosen move in the app |
| `src/ai/move.js` | Re-exports the above for tests and tooling |

Form-up and melee previews use the same rules as the live game (`resolveAutomaticFormUp`, `previewMeleeCombats`).

## Candidate generation

For each unmoved friendly unit, the AI builds **groups**:

- Singles
- Rank subsets (contiguous same-facing units)
- File subsets

For each group it tries these **move kinds**:

| Kind | Applies to | Description |
|------|------------|-------------|
| `forward` | All groups | Max legal distance straight ahead (5 mm steps); also partial moves at ½ for most units, ½ and ¾ for fast units (good ≥ 125 mm), and ¼/½/¾ for Flyers |
| `sidestep-left` / `sidestep-right` | Singles | Max legal distance perpendicular to facing |
| `wheel-left` / `wheel-right` | Singles and ranks | Pivot wheel; probes max legal angle in 5° steps up to 45°, then tries that max plus any of 15°/30°/45° that fit |
| `convert` | Ranks and files | Rotate formation 90° (rank ↔ file) |
| `reverse` | Any | Reverse facing; offered when in bad melee or on swamp/water |
| `reserve-deploy` | Reserve recycle types (Horde) | Deploy from reserve onto the home edge |
| `ensorcelled-return` | Ensorcelled Hero/Magician in reserve | Return to the enemy edge (Hero) or within 250 paces of capture spot (Magician) |

Reserve deploy scans the home edge in 20 mm steps for legal positions (on edge, no overlap, 200-pace enemy clearance, not impassable). Ensorcelled returns skip the 200-pace clearance rule and cost **6 PIPs** while the ensorceller remains on the board (**0 PIPs** if the ensorceller is gone).

Singles use the same free-drag path validation as human single-unit moves. Sidesteps probe distance along the unit's right vector (left = negative right). Wheels rotate in place; they often fail to leave water when the unit's footprint stays in the pool — **sidestep is the reliable water escape**.

## Scoring

Each simulated move produces a **breakdown**; the total is a weighted sum (`AUTO_MOVE_WEIGHTS` in `move-score.js`).

### Combat (`fight`, `matchup`, `modifiers`, `newContact`)

Compares form-up melee previews before and after the move:

- **fight** — change in total combat factor advantage
- **matchup** — type matchup (`getDeploymentMatchupScore`) on new/changed contacts
- **modifiers** — stacked support, flank, overlap, etc.
- **newContact** — bonus for engaging; penalty for shuffling an existing fight without improvement

Unfavorable new contacts (e.g. a lone Horde stepping into a Spear) score badly here.

### Formation (`dress`, `formationSize`, `stackBreak`, `formationApproach`)

- **dress** — joining an existing rank/file partner
- **formationSize** — more units stacked in combat
- **stackBreak** — penalty for breaking an existing stack
- **formationApproach** — moving closer to same-type, same-facing friendlies without yet dressing

### Terrain (`terrain`)

Rewards leaving bad going; penalizes entering it.

- Severity delta (good < swamp/forest < water)
- Amplified when starting in swamp or worse
- **+1.2 flat bonus** when the unit footprint fully leaves water

Shooters that ignore bad going (e.g. Shooter) invert the preference.

### Movement quality

- **advance** — mean distance gained toward enemy centroid × √n; for reserve deploy, rewards positions closer to the enemy
- **reserveEntry** — bonus for returning a recycled Horde from reserve to the board
- **ensorcelledReturn** — large bonus for recovering ensorcelled units (`unit value × 2.5`, plus **+6** when the return costs 6 PIPs and enough moves remain)
- **cohesion** — tightening friendly spread (skipped for reserve deploy and ensorcelled return)
- **lateralReposition** — flat bonus for sidesteps that do not create or worsen combat
  - Base **+0.2** when fight/newContact are neutral
  - **+0.2 extra** when the same group's forward move scores below **0.25** (stuck forward — sidestep to reposition)
- **splitEfficiency** — penalty when a forward move is throttled by the slowest unit in a mixed group

### Ranged

- **stationaryShooter** — penalty for moving Artillery/Magician that already has a valid target
- **rangeBand** / **rangedOpportunity** — Magician range trade-offs

### Risk

- **recoilDeath** / **pinchRelief** — recoil into destruction or escaping a pinch

## Selection thresholds

Default **MIN_BENEFIT = 0.25**. If nothing clears that, fallbacks apply in order:

1. Best **ensorcelled return** with score ≥ 0.25
2. Best **reserve deploy** with score ≥ 0.25 when board moves fall short
3. Best move that **improves bad terrain** (swamp+ or leaves water) with score > 0
4. Best move that **fully clears water** from the unit footprint (any positive score)
5. Best **reserve deploy** or **ensorcelled return** with any positive score

When any unmoved friendly unit is still **in water**, a water-clearing move is preferred over a higher-scoring move that does not address water — knights and magicians get out before unrelated advances.

This prevents “do nothing” turns when a Magician is sitting in water but forward-only scoring was borderline, and prevents wheels that rotate in place without leaving the pool.

## Typical priorities

The AI does not use a fixed script; weights emerge from the breakdown. In practice:

1. **Ensorcelled return** — recovering a Hero/Magician from reserve (especially the 6-PIP return) outranks normal moves
2. **Escape water / bad going** — sidestep off terrain (high terrain weight); wheels are a fallback
2. **Stuck units** — sidestep when forward is weak but lateral is safe (center Blades, Hordes near swamp)
3. **Good combat** — favorable new contacts, stacked support
4. **Ranged hold** — keep Artillery/Magician on targets
5. **Advance** — move toward enemy when the above are neutral
6. **Formation** — dress scattered Hordes, approach friendlies via sidestep

Conservative behavior (Artillery holding, spears not blundering into shooters) is usually correct: those units score badly on fight/advance/ranged terms.

## Known gaps

- **No explicit “better matchup angle”** — sidesteps help terrain and formation but do not yet score “flank this Spear from the side”
- **Multi-turn plans** — each PIP is scored independently; no lookahead after a partial wheel
- **Competing PIPs** — with limited PIPs, scattered Hordes may move before a stuck Blade on the same turn; the Blade will move when it is the best remaining option

## Debugging

Use the Auto Move modal or console logs (`[Auto Move] planned`) to see the chosen move, distance, and full breakdown.

### AI Eval mode (in-game)

Open **Game Settings** and click **AI Evaluation** next to **Enter Edit Mode**. With one friendly unmoved unit selected during the move phase:

- Every scored candidate for that unit is drawn as a **shadow unit** at its destination
- A **label bubble** above each shadow shows the move name, score (✓ if ≥ `MIN_BENEFIT`), and per-candidate scoring time
- The status line summarizes total candidates and wall-clock search time

Implementation: `src/ai-evaluation.js`, `scoreAllMoveCandidatesAsync()` in `move-apply.js`, overlays in `src/board/render.js`.

Fixture saves for regression:

- `test/fixtures/stuck-move-save.json` — Undead turn, Magician in water, scattered Hordes, center Blade; also Panda Knights in water on player-1's turn
- `test/fixtures/melee-preview-crash-save.json` — form-up / melee preview stability

Run move AI tests:

```bash
node --test test/move-ai.test.js
```

## Example outcomes (stuck-move-save)

| Side | Unit | Problem | Chosen move |
|------|------|---------|-------------|
| Undead | Magician (unit-20) | In water, forward stays wet | `sidestep-left` 25 mm — fully off water |
| Undead | Blade (unit-11) | Forward ~0.16, bad center position | `sidestep-left` when other units already moved |
| Panda | Knights (unit-7/8) | In water at home edge | `sidestep-left` — clears water before Hero/Spear advances |
