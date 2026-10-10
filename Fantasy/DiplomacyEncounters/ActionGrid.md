# Diplomacy Encounters — action grid

This is the **resolution** table: what happens when your action meets theirs. Who *picks* an action is in [Diplomacy.md](Diplomacy.md). Resolution lives in `js/encounter.js` (`DE.resolveRound`).

Rows are **you**. Columns are **them**.

## Actions and classes

Nine actions collapse into five classes. Same class, same cell. **Defend** uses the Intimidate class. **Occupy** uses the Assault class.

| Class | Actions |
|--------|---------|
| **Assault** | Attack, Seize, Capture, Occupy |
| **Intimidate** | Intimidate, Defend |
| **Open** | Gift, Greet, Trade |
| **Retreat** | Retreat |
| **Run** | Run |

Trade is **blocked on round 1** (first meeting). After that it is an Open action like Greet.

**Defend** is only offered to a side that holds a village or the player camp (a camp raid). **Occupy** is only offered to the side attacking that site.

**Occupy (if you hold):** take remaining site captives, gold, food, magic, and kits. Does not annex the village.

## How to read an outcome

| Flag | Meaning |
|------|---------|
| **You hold** | Encounter ends. March **progresses** (depth advances, remaining −1). |
| **They hold** | Encounter ends. March **does not** progress. |
| **Both hold** | Encounter ends. You still progress (player hold is what the march uses). |
| **Neither holds** | Encounter ends. No progress. |
| **Another** | Same encounter, another round. No progress yet. |
| **Trade** | Trade screen opens. Both sides hold, then you progress. |
| **Battle** | Real fight (casualties). Winner holds. |
| **Display fight** | Strength is compared, **no casualties**. Winner holds. |

Seize / Capture only pay out if **that side wins a real fight** (or catches a runner). Attack is the same fight without spoils.

---

## Class grid

| You ↓ \ Them → | Assault | Intimidate | Open | Retreat | Run |
|--|--|--|--|--|--|
| **Assault** | Real fight. Both sides take **+5%** casualties. Winner holds. Spoils if the winner Seized or Captured. | Real fight. Both sides take **−5%** casualties (less bloody). Winner holds. | Real fight. **You** get **+20%** CV. If you win, they take an extra **+5%** casualties. Winner holds. Spoils if you Seized/Captured and won. | Same as Assault vs Intimidate: real fight, **−5%** casualties, winner holds. | **50%** they escape (you hold, no fight). **50%** you catch them (they take casualties, you hold, **50%** spoils). |
| **Intimidate** | Real fight, **−5%** casualties, winner holds. | Special — see below. | **Another** round. If they Gift or Trade, trade may open next (AI can be forced to Trade). **Second** Intimidate vs Open: **you hold**, encounter ends. | **You hold.** No fight. | **You hold.** No fight. |
| **Open** | Real fight. **They** get **+20%** CV. If they win, you take extra **+5%** casualties. Winner holds. | **Another** round. If you Gift or Trade, they may Trade next. **Second** Open vs Intimidate: **they hold**. | **Both hold.** Trade opens. Gifts may move (your gift can be refused). | **You hold.** They leave. | **You hold.** They flee. |
| **Retreat** | Real fight, **−5%** casualties, winner holds. | **They hold.** No fight. | **They hold.** You leave. | **Neither holds.** Both withdraw. | **You hold** (orderly withdrawal vs a rout). |
| **Run** | **50%** you escape (they hold, no fight). **50%** they catch you (you take casualties, they hold, **50%** spoils). | **They hold.** No fight. | **They hold.** You flee. | **They hold** (they withdraw in order, you bolt). | **Neither holds.** Both flee. |

---

## Intimidate vs Intimidate

Roll once:

| Chance | Result |
|--------|--------|
| **15%** | Real fight, both sides **−5%** casualties. Winner holds. |
| **35%** | Display fight (no casualties). Winner holds. |
| **50%** | Stalemate. **Another** round. |

---

## Assault fights (Attack / Seize / Capture)

Default battle: winner inflicts casualties at **20%** of their CV, loser at **40%**, then ± the cell’s casualty delta.

Cell modifiers (applied on top of that):

| Pair | CV | Extra casualties |
|------|----|------------------|
| Assault vs Assault | even | both **+5%** |
| Assault vs Intimidate or Retreat | even | both **−5%** |
| Assault vs Open | assaulter **×1.20** | the Open side takes **+5%** more if they lose |
| Assault vs Run (caught) | no full battle | runner takes **40%** of the assaulter’s CV as a casualty budget; **50%** chance of Seize/Capture spoils |

**Seize (if you win):** half their gold, or half their food, or one weapon kit (kit seize can wound/kill the bearer).

**Capture (if you win):** that unit is taken captive (and counts dead in the fight). Preferred as a casualty target during the battle.

A **real** battle win also: salvage kits from the dead, **50%** chance to kill their leader, and if they are a loner **50%** chance that beast is gone for the campaign.

Display fights do **not** teach monster types, kill leaders, or drop kits.

---

## Open vs Open (Gift / Greet / Trade)

Encounter ends with **both holding** and the **trade** screen.

- **Greet / Trade:** no goods move until you actually trade.
- **Your Gift:** they may refuse. If they accept, goods move to them.
- **Their Gift:** always moves to you (including monster advice, which marks that monster known).

---

## Repeat Intimidate vs Open

If the **previous** round was Intimidate vs Open (either way), and this round is the same pairing again, it does **not** go another round:

- You Intimidate, they stay Open → **you hold**.
- They Intimidate, you stay Open → **they hold**.

---

## Mission progress (after the encounter ends)

Only **your** hold flag advances the march. Both-hold (peaceful Open) still counts as you holding. Another-round results never spend remaining encounters.
