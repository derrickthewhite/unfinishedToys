# Diplomacy Encounters — diplomacy system

This document describes how AI factions choose actions during an encounter.

## Overview

Each encounter locks two stance samples for its whole duration:

- **Fear (F)** — how scared *they* are of *you* (from relative combat value).
- **Trust (T)** — how much they expect good faith from history with you.

Those samples are drawn once when AI stance is first needed (debug peek or first AI decision) and reused for every round of that encounter. Action picks still roll each round.

## Fear

Fear comes from present fighting strength (`sideStrength`), not from the log.

1. Compute their CV vs your CV (with monster/mage modifiers, hunger on the player side, etc.).
2. Convert the strength ratio into a win probability, then **Fear ≈ 1 − P(they win)**.
3. Apply the leader’s **ΔFear** (±20% at worldgen) to the center.
4. Build a band `[lo, hi]` (narrow 15% or wide 30% if illusions/ghosts/mages/monsters are involved).
5. **Sample F uniformly inside `[lo, hi]`** and lock it.

### Fear bands

| Band | Range |
|------|--------|
| Bold | `F < 0.40` |
| Uneasy | `0.40 ≤ F < 0.60` |
| Afraid | `F ≥ 0.60` |

## Trust

Trust is a running estimate from the faction log, starting from a prior:

| Faction | Prior center | Prior width |
|---------|--------------|-------------|
| Politics edge `faction → player` | that seeded trust (player edges 35–65%, mark still hostile) | 0.40 |
| Hostile mark (no politics yet) | 0.20 | 0.40 |
| Loner (no politics yet) | 0.35 | 0.40 |
| Other civilized (no politics yet) | 0.50 | 0.40 |

History moves the center and width (gifts, greets, attacks, trades, mixed signals widen width, consistency narrows it). Width is clamped to about 12%–70%.

For the encounter:

1. Take log trust center/width.
2. Shift center by the leader’s **ΔTrust** (±20% at worldgen).
3. Shift center again by **party trust** from hirelings and captives you bring:
   - Attitude uses politics of their home faction toward the people you meet (same faction = friendly).
   - Hirelings: friendly → +, hostile → −. Captives flip the sign.
   - **1** matching person is worth **±5%**; **2+** is worth **±10%** (friendly and hostile buckets count separately).
   - Wary/unknown attitudes do not move trust.
4. Rebuild `[lo, hi]` from that shifted center and width.
5. **Sample T uniformly inside `[lo, hi]`** and lock it.

Beasts / animal encounters have no Trust sample.

### Trust bands

| Band | Range |
|------|--------|
| Hostile | `T < 0.40` |
| Wary | `0.40 ≤ T < 0.60` |
| Friendly | `T ≥ 0.60` |

## Leaders

Each leader rolls:

- `deltaFear ∈ [-0.20, +0.20]`
- `deltaTrust ∈ [-0.20, +0.20]`

Fear deltas bake into the Fear band before sampling. Trust deltas shift the Trust band before sampling.

## Decision grid (civilized / loners)

Unless a special case or override applies, pick an action from the Fear × Trust cell using the weights below (normalized to 100%).

### Outcome table

| | **Hostile** `T < 0.4` | **Wary** `0.4 ≤ T < 0.6` | **Friendly** `T ≥ 0.6` |
|--|--|--|--|
| **Bold** `F < 0.4` | **Seize 45%**, Attack 35%, Capture 20% | Intimidate 40%, Greet 35%, Seize 25% | Trade 30%*, Greet 35%, Gift 35% |
| **Uneasy** `0.4 ≤ F < 0.6` | Intimidate 40%, Attack 40%, Retreat 20% | Intimidate 35%, Greet 35%, Retreat 30% | Greet 35%, Gift 35%, Trade 30%* |
| **Afraid** `F ≥ 0.6` | Run 45%, Retreat 45%, **Gift 10%** | Retreat 40%, Run 35%, **Gift 25%** | Gift 40%, Greet 35%, Retreat 25% |

\*If trade is not allowed yet (round 1), Trade weight is removed and the remaining actions are renormalized (typically Greet/Gift 50/50 on bold/uneasy friendly).

Notes:

- **Bold × Hostile** leans hard into **Seize** so grabby behavior is obvious.
- **Afraid × Hostile** still offers gift, but only **10%** (vs **25%** when wary).
- Unavailable Seize/Capture fall back to Attack.

### Special: very wide trust on first meeting

If `trust.width > 0.45` and this is round 1 of the encounter:

| Action | Chance |
|--------|--------|
| Intimidate | 50% |
| Retreat | 50% |

(This replaces the old intimidate/greet coin flip.)

### Overrides (after the grid)

1. **Hostile mark:** if they are the campaign’s hostile faction and `F < 0.60`, 35% chance to force **Attack**.
2. **Post-intimidate trade window:** if intimidate opened trade and `F < 0.45` and `T > 0.30`, force **Trade**.

## Beasts / animals

No Trust. From the locked Fear sample:

| Fear | Action |
|------|--------|
| `F ≥ 0.60` | Run |
| `0.40 ≤ F < 0.60` | Retreat |
| `F < 0.40` | Attack |

## Debug mode

Menu → **Debug mode**. On an encounter, a white panel shows:

- Locked Fear/Trust samples and bands
- Decision cell and weight table
- Action rolls and overrides

Peeking restores RNG for action rolls so the preview matches the next real decision without burning those rolls. Fear/Trust stay locked for the encounter either way.

## Player-facing actions (reminder)

Player choices still drive the matrix resolution in `encounter.js` (attack, intimidate, gift, greet, seize, capture, retreat, run, trade). AI stance only chooses *their* action; outcomes (hold ground, battle, trade opening, etc.) come from the action pair table.
