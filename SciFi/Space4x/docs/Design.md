# Space4x — Design

Working title. HTML + JavaScript canvas 4X. First slice is playable: open `index.html`.

First playable slice is **Empire from scratch**. The engine must stay generic enough for **SOW** (space opera war) and **Solar System** without rewriting settlements, pops, the local industry pool, or the turn loop.

## Goals

- **Settlement is the core object.** Production, pops, structures, and stationed units live on a settlement.
- **Flexible location.** A settlement points at `{ starId, bodyId, regionId? }`. Scratch-empire can use one settlement per planet. Solar System needs several settlements on Earth from the start of that setting.
- **Settings, not a single game.** A setting is a bundle: galaxy gen, start gen, tech gen, job/structure/unit tables, movement, transport. The engine loads tables; it does not assume 25 stars, garden biomes, or agriculture slots.
- **Data-driven.** Jobs, slot sources, output modifiers, and build catalogs are config. Training is a flag, off by default.
- **Model and UI stay separate.**
- **HTML shell + C discipline** for code (see Coding standards).

## Proposed folder layout

```
SciFi/Space4x/
  docs/Design.md
  index.html                 shell: Generation, chrome, canvas, panel slots
  css/space4x.css
  js/
    boot.js                  captureUi, bind, first sync
    state.js                 createInitialState, ids
    commands.js              named mutations (assignJob, endTurn, …)
    model/                   turn loop, food, starve, growth, research, move
    view/                    syncUiFromState, map canvas, list patchers
    gen/                     galaxy + start
    ai/dumb.js
  config/settings/           scratch-empire.js (sow / solar later)
```

No bundler. `<script>` tags in `index.html`. If tests land, wrap files as UMD so Node `require()` works (Hordes pattern). Model files must not touch `document`.

---

## Coding standards

**A:** the page is a real HTML shell. **C:** one plain `state`, commands mutate it, the view syncs from it. That pairing is mandatory for Space4x.

### State and commands

- `state` is a JSON-serializable object graph (numbers, strings, arrays, plain objects). No DOM nodes, no functions, no Knockout observables on it.
- The only writers of `state` are **named commands** (`assignJob`, `queueBuild`, `setResearch`, `endTurn`, `pickSettleBody`, …) and generators/AI that call those commands (or the same model functions).
- View code **reads** `state` and **never** stores game facts in the DOM (`data-*` for widget identity is fine; food totals are not).
- Canvas draws from `state`. Clicking the canvas calls a command with grid/star ids, not with pixels as truth.

### HTML and patching

- Chrome, Generation fields, Do-this **container**, settlement controls, research panel, End Turn, canvas — exist in `index.html` with **stable ids**.
- `captureUi()` runs once at boot and holds those nodes. Do not `getElementById` in a hot loop.
- `syncUiFromState()` (or per-panel `syncChrome`, `syncSettlement`, …) **patches** nodes: `textContent`, `.value`, `.disabled`, `.hidden`, canvas redraw.
- **Do not** replace a screen with `innerHTML` to refresh it. That is the usual AI failure mode (kills focus, duplicates listeners, hides structure).
- Dynamic **lists** (Do-this items, opponent slots, job rows): rebuild **that list root only**, or reuse children keyed by id. Never rebuild the ancestor that contains an input the player is editing.
- If a panel is a form, sync must not clobber an input that currently has focus (skip that field, or only write on open / on End Turn).

### JS shape

- **Factory functions**, not classes: `function createGame() { const game = {}; ... return game; }` same idea as RobotTrading/SpaceWars, with `const`/`let`.
- Prefer `const` / `let`. No modules-for-their-own-sake; one concern per file.
- **File size:** under **800** lines is the target. Under **1200** is mandatory — split the file (new concern, new factory) rather than grow it. Config tables can sit in their own files if a catalog would blow the cap.
- Config is data (`config/settings/scratch-empire.js` tables). View and model look up tables; they do not `if (setting === 'scratch')` for farming slots.
- AI is a function `dumbAi.chooseOrders(state, empireId)` that returns commands or calls them. Same model as the player.

### Boot loop

```
captureUi()
bindUi()          // addEventListener → commands
state = createInitialState() // or generate()
syncUiFromState()
requestRender()   // canvas; coalesce with rAF
```

After every command: mutate `state`, then `syncUiFromState()` + `requestRender()`. End Turn runs the seven phases on `state`, rebuilds Do-this as **data** on `state.todos`, then sync.

### Tests (when we add them)

Model and gen: pure functions, Node `node --test`. No jsdom required for turn/food/starve. View stays untested until it hurts.

---

## Engine vs setting

**Engine (shared):**

- Game / galaxy / star / body / settlement / pop / empire
- Job as data: product, output, slot cap source (uncapped, structure count, or a setting-provided function/table)
- Local `industryPool` and a build queue of catalog items
- Turn phases in fixed order
- Food as a **this-turn flow** (never stored)
- Pops: job, species, loyalty, culture slot, optional training
- Generic effects vocabulary (`addJobSlot`, `addTransport`, `foundSettlement`, `addUnit`, …)

**Setting (tables and generators):**

- What bodies exist, whether size/biome mean anything, slot and yield tables
- What you can build and what those builds do
- Map shape and movement
- Start generator and tech generator (**prereq** graph or **category** tiers)

Scratch-empire size slots and biome food penalties live **only** in that setting’s tables. SOW and Solar System replace them; they do not inherit “Large = 12 farms” unless they opt in.

---

## World hierarchy

```
Game
  settingId
  config
  galaxy
    stars[]
      bodies[]
        settlements[]
    lanes[]?                SOW
  empires[]                 // player + enabled AI slots
  opponentSlots[]
  units[]
```

Body fields the engine cares about: `id`, `starId`, `kind`, `settlePrerequisite`, `settlements[]`. `size` and `biome` are optional properties a setting may attach; scratch-empire uses them. Tiny, when that setting uses size, is always barren.

Settling gas giants and asteroid belts is a **prerequisite on the body kind** (tech or equivalent). Belts unlock first; giants take more. That rule can apply in any setting that has those kinds.

### Scratch-empire galaxy generation

This is the generator from the original spec. Numbers are **equal weights on the lists you gave** (six body results; eight biomes). If a result should be rarer, that is a table edit, not a new system.

**Stars:** 25 distinct points, uniform on the 30×30 grid.

**Bodies per star:** `max(0, 3d4 - 5)` (0–7, mean 2.5).

**Each body** — one roll on this table (weight 1 each):

| Result | Kind | Size | Biome |
| --- | --- | --- | --- |
| Gas giant | `gasGiant` | — | — |
| Asteroid belt | `asteroidBelt` | — | — |
| Large | `rocky` | large | roll biome |
| Medium | `rocky` | medium | roll biome |
| Small | `rocky` | small | roll biome |
| Tiny | `rocky` | tiny | always barren |

**Biome** (large / medium / small only), weight 1 each: Garden, Ocean, Swamp, Arid, Desert, Tundra, Barren, Toxic.

The **start generator** still places the homeworld in its own fair range (center: medium garden). Other bodies in that system use this table as usual.

SOW and Solar System replace this whole generator.

---

## Settlement

```
Settlement {
  id, name, empireId
  location: { starId, bodyId, regionId? }
  pops[]
  structures[]
  stationedUnitIds[]
  buildQueue[]              // items from the setting catalog
  industryPool              // local; persists. Food does not.
  starveAcc                 // 0–99 leftover toward the next starvation death
  growthAcc                 // 0–99 leftover toward the next birth; see Growth
}
```

No food stockpile. Industry is never empire-wide.

---

## Pops and jobs

```
Pop {
  id
  job                       // job id or idle
  species
  loyalty
  culture                   // reserved
  training?                 // only if setting enables training
}
```

Idle is allowed: no job product, no money, still eats.

Jobs are a setting table. Scratch-empire’s table:

| Job id | Product | Output per pop | Slot cap |
| --- | --- | --- | --- |
| `idle` | — | 0 | Uncapped |
| `agriculture` | food | 3 food + biome modifier + 1 money | Size table |
| `industry` | industry | 3 industry + 1 money | Uncapped |
| `research` | research | 3 research + 1 money | Uncapped |
| `greenhouse` | food | 3 food + 1 money | From Greenhouse buildings |

SOW and Solar System will add or replace jobs (soldiers, mining, etc.) in their own tables.

Each pop eats **1 food** per turn unless a setting says otherwise (scratch-empire default).

### Scratch-empire farming tables

**Slots** (who may work agriculture):

| Size | Slots |
| --- | ---: |
| Large | 12 |
| Medium | 8 |
| Small | 4 |
| Tiny | 0 |

Barren and Toxic: 0 slots until a structure/tech grants some. Tiny is always barren.

**Food per farmer** (after the base 3):

| Biome | Modifier | Food |
| --- | ---: | ---: |
| Garden | +0 | 3 |
| Ocean, Swamp, Arid | −1 | 2 |
| Desert, Tundra | −2 | 1 |
| Barren, Toxic | no farmers until slots exist | later |

Floor at 0. These numbers are scratch-empire config, not engine constants.

---

## Food (no preservation)

Food exists only during the turn it is produced.

1. **Production:** each settlement emits food from its farmers.
2. **Allocate and transport:** assign who eats (rules below). Local food needs no hull. Each unit of food that changes settlement costs **1 freighter**. Hulls completed this construction phase count. Unused food spoils.
3. **Eat:** each settlement’s pops consume from food **present** after that assignment (`foodPresent` for starvation).

Chrome shows this turn’s production vs demand, predicted assignment by priority, and hulls used — never a stored food number.

### Who eats when food or hulls are short

Same priority whether the bottleneck is **food** or **freighters**. Higher priority can pull exports away from lower-priority local pops (a remote farmer is fed before a homeworld factory worker). Eating food that is already on the settlement does not use a hull; imports do.

**Class 1 — farmers.** Every agriculture pop in the empire. Local production covers local farmers first (no hull). Remaining hungry farmers import, using hulls, before anyone in class 2–3 eats.

**Class 2 — settlements that have farmers.** After all farmers who can be fed are fed, remaining pops on those same settlements (idle, industry, research, etc.) eat. Local leftover, then imports.

**Class 3 — everyone else.** Settlements with **no** farmers share whatever food and hulls remain, **proportional to population**.

If a class cannot be fully fed, stop there: lower classes get nothing. Inside class 1 or 2, if that class is still short, split the remaining food for that class **proportional to demand** in that class (farmer count for class 1; remaining hungry pops for class 2), then the same integer rule as class 3.

### Proportional split → integers

Shares are `F * pop_i / P` (or demand_i / demandTotal inside a short class). They must become integers that **sum to exactly F**.

1. Give each settlement `ceil(share)`.
2. While the total is greater than `F`, subtract 1 from the **largest** current allotment. Ties: largest population, then stable id.

Largest worlds absorb the rounding; a 1-pop colony is less likely to lose its only meal to a fraction. Allotment never goes below 0. `F` is the food actually deliverable to that class this turn (`min(food still unassigned, hulls still free for the imports that assignment would need)`).

After assignment, `foodPresent` on a settlement is local food kept + imports received. Starvation uses unfed = pops − foodPresent as already specified.

---

## Starvation

Phase 6, after transport. Unfed pops = `max(0, pops - foodPresent)`. If that is 0, set `starveAcc = 0` and stop.

Rate is **10% of current unfed pops per turn**, of the *current* unfed count (geometric decay / half-life), not 10% of the original total (which would hit zero in ten turns).

Fully starving examples: 10 pops and 0 food → about 1 death this turn; ~6.6 turns to half remaining (`0.9^t = 0.5`); after 10 turns ~35% still alive, not 0%.

A next-turn **productivity hit** is still optional and not in v1; pop loss is the whole starvation effect for now.

### Deterministic 10% (remainder, no RNG)

`floor(n * 0.1)` never kills a 1-pop colony. Rolling 10% per pop needs RNG. One integer on the settlement is enough:

```
unfed = max(0, pops.length - foodPresent)
if (unfed === 0) { starveAcc = 0; return }

starveAcc += unfed * 10          // 10% in percent-pops
deaths = min(pops.length, floor(starveAcc / 100))
starveAcc -= deaths * 100
// remove `deaths` pops
```

`starveAcc` stays in `0..99`. A 1-pop, 0-food colony adds 10 per turn and dies on the 10th starving turn. An 8-pop, 0-food colony adds 80/turn → a death every time the running total crosses a multiple of 100 (~0.8 pops/turn). A 1-food miss on 8 pops is `unfed = 1` → same slow 10-turn fuse as a lone colonist, not an 8-pop wipe.

Fully fed resets the accumulator so an old famine does not dump a stored death the next time they miss a meal.

Remove idle pops first, then any stable order (end of the list). No dice. Dead pops free their job slot. Rate `10` is a setting number (`starvationRatePercent`), not an engine constant.

---

## Growth

After starvation (new phase 7). **Default 5%** of **fed** pops this turn (`pops.length - unfed` after deaths). Techs modify the percent (setting base + tech delta; floor at 0).

Same remainder trick as starvation, no RNG:

```
fed = min(foodPresent, popsBeforeStarve)   // meals served; unfed survivors do not grow
rate = 5 + techGrowthDelta
if (fed === 0) { growthAcc = 0; return }

growthAcc += fed * rate
births = floor(growthAcc / 100)
growthAcc -= births * 100
// add `births` idle pops (empire default species/loyalty, from nowhere)
```

An 8-pop fully fed world adds 40/turn → a birth every 2–3 turns. A fed 1-pop colony adds 5/turn → a second pop on turn 20. Doubling time at constant 5% is about 14 turns once the world is large.

Unfed pops do not contribute. If the whole settlement is unfed, `fed = 0` and there is no growth this turn (`growthAcc` keeps — or reset; **reset if `fed === 0`** so a famine does not store a birth). Empty settlement: `growthAcc = 0`.

New pops appear **after** this turn’s meal, so they do not eat until next turn. They are idle until assigned. No housing cap in scratch-empire v1 (Solar System habitats can add one later).

---

## Turn loop

**End Turn** phases, in order:

1. **Movement and combat** — setting movement rules. Captured settlements produce for the new owner this turn. Out-of-range ships walk toward the nearest friendly colony star. Player colony ships that end on a star with empty legal bodies **do not found yet** — they spawn a `pickSettleBody` todo. AI founds the first legal body immediately. Stub: no fights.
2. **Production** — pops emit food (this-turn only), industry (into local pool), research (pending), money (empire, assumed). Idle: nothing.
3. **Research application** — add pending points; complete or roll early finish at ≥ 50% with `chance = (percentDone - 50) * 2%`. Finished tech can unlock builds in phase 4 this turn.
4. **Construction** — spend local `industryPool` down `buildQueue`. Leftover stays. Completions exist before transport (new freighters haul this turn; new Robotic Factories do **not** re-job pops until next production).
5. **Transport** — assign and move this turn’s food (farmer / farming-world / proportional rules). **1 food per freighter** for each unit that leaves its origin settlement.
6. **Starvation** — eat present food; spoil the rest; remainder-accumulator pop loss.
7. **Growth** — remainder-accumulator births from **fed** pops at 5% (plus tech).

---

## Construction

Meaningless without a catalog. Each setting has a **build catalog**. The engine only knows: an item has a local industry cost, a kind (`structure` | `unit` | `abstract`), and a list of effects.

```
BuildDef {
  id, name, kind
  cost: { industry }
  effects[]
}

QueueItem {
  defId
  progress                  // industry already applied
  target?                   // e.g. colony-ship destination
}
```

**Construction phase:** apply pool to the front of the queue. When `progress >= cost`, complete, run effects, continue with remainder on the next item if any. Multi-turn builds are just not enough industry yet.

No time-in-turns separate from cost unless a setting adds one.

### Iconic catalog (v1 identity per setting)

These are the three things that should feel like “this setting.” More entries come later; the engine must not assume this list.

#### Scratch-empire

| Build | Cost | Kind | Effect |
| --- | ---: | --- | --- |
| **Colony ship** | 100 | unit | Phase 1: move with current speed/range. Empty grid stops allowed. Human: on ending at a star, **Do-this** pick a legal empty body. AI: first legal body. Founding consumes the ship and spawns **one idle pop from nowhere**. |
| **Robotic factory** | 25 | structure | `jobYieldCover`: +2 industry to one Industry worker per copy. |
| **Space freighter** | 25 | abstract | `+1` empire freighter. Carries **1 food**. Hauls this turn if completed this construction phase. |

New-colony pop: empire default species/loyalty, idle, no structures, `industryPool` 0, `starveAcc` 0. It eats 1 food that same turn’s phase 6; without a farmer or one incoming freighter it starts the 10-turn starve fuse.

With 8 pops on industry only (~24/turn), a colony ship is about four turns plus leftover; a factory or freighter about one turn. One new colony needs **1 freighter** to stay fed if it is not farming. Exporting a homeworld surplus of 16 food would need 16 hulls — logistics is the expansion brake.

#### SOW

| Build | Cost | Kind | Effect (intent; details later) |
| --- | ---: | --- | --- |
| **Infantry** | 25 | unit | Ground troops. Cheap mass for the war. |
| **Cruiser** | 200 | unit | Line warship. Lane movement. |
| **Fortress shield** | 100 | structure | Settlement/system defense. |

SOW’s catalog is military. Economy/resources for this setting are a later table; these three still spend **local industry**.

#### Solar System

| Build | Cost | Kind | Effect (intent; details later) |
| --- | ---: | --- | --- |
| **Mining site** | 20 | structure | Cheap extraction; extra industry and/or a mining job/resource. |
| **Habitat** | 100 | structure | Room for pops / another foothold on a body (fits multi-settlement Earth and later Luna/Mars). |
| **Space elevator** | 1000 | structure | Huge; bulk Earth–orbit transport. Likely unique per body. |

Elevator at 1000 is a long project (or a late-game spike). Mining site is the spam build. Habitat is how Earth stays many settlements instead of one blob.

Garrison (troops-from-a-building) was an early scratch-empire sketch. It is **not** in the v1 iconic three; add it later if that setting wants a static defense besides ships.

---

## Units and transport

```
Unit {
  id, defId, empireId
  location                  // scratch-empire: {x, y} on the grid; optional starId if on a star
}
```

Scratch-empire freighters stay **abstract** (a count on the empire). Each moves **1 food** per turn. Colony ships are real units (phase 1 movement, consumed on founding). SOW cruisers/infantry are real units. Solar System may treat elevator capacity as abstract local transport rather than hulls.

`transportScope: empire | system | body` is per setting. Scratch-empire: empire. Solar System: body/system. SOW: likely lanes.

---

## Movement (scratch-empire)

Movement is a **setting + tech** rule, not an engine constant. SOW uses lanes; Solar System uses in-system burns. Scratch-empire uses a **reactor** on the 30×30 integer grid.

Units live on grid points, not only on stars. **Empty cells are legal stops.** A colony ship can sit in deep space between jumps. Founding still requires arriving at the target star’s cell and a still-valid empty body.

Two stats (both Euclidean). **Baseline** (no research): speed 2, range 5. **Warp Physics** raises speed (and later comms). **Reactors** raises range (and ship size / industry). Ships use the empire’s current totals, not a single “best reactor” blob.

| Stat | Basic reactor | Meaning |
| --- | ---: | --- |
| **Speed** | 2 | Max distance of one move this turn, current cell → destination cell, straight line. |
| **Range** | 5 | Max distance from a **friendly settlement’s star**. The ship must start and end the move inside this envelope. |

```
dist(a, b) = sqrt((ax - bx)^2 + (ay - by)^2)
legal move if dist(from, to) <= speed
         and dist(to, nearestFriendlyStar) <= range
         and to is on the map (0..29)
```

Speed 2 from `(10,10)`: `(10,12)` and `(11,11)` are ok; `(12,11)` (√5 ≈ 2.24) is not. Range 5 from a home star at `(10,10)`: a ship may occupy empty `(14,13)` (√(16+9)=5) but not `(15,13)` (√(25+9)≈5.83).

Range is why empty stops need a number: without it a speed-2 ship could crawl the whole map. Range is the leash from owned worlds; speed is how far it crawls along that leash each turn.

Friendly envelope is computed from settlements at the **start** of the movement phase (a colony founded this phase does not extend range until next turn). If a ship is **outside range** (lost colony, better envelope shrunk): it is given an automatic order toward the **nearest remaining friendly colony star** (Euclidean). It still moves at most `speed` per turn and must stop on legal grid cells. It cannot found until it is inside the envelope again.

Colony ship: queued with a **target star** (body chosen on arrival for the human). Each movement phase it may move up to **speed** toward that star, ending on empty grid or on a star. If out of range, ignore the target and walk home instead.

---

## Empire and research

```
Empire {
  id, name, isPlayer
  stockpiles: { money }
  transport: { freighters }
  modifiers                 // summed from completed techs
  research: {
    model                   // 'category' | 'prereq'
    currentProjectId
    progress
    cost
    categoryTier            // category model: next tier per category (starts at 1)
    completedTechIds[]
  }
}
```

**Early finish** (both models): after this turn’s points are applied, if progress ≥ 50% of cost, roll once:

```
chance = (percentDone - 50) * 2%
```

50% → 0%; 75% → 50%; 90% → 80%. At 100% it completes without a roll. Overflow: stub **wastes** leftover points. Switching projects **saves progress per tech id**.

---

## Tech trees

The engine supports **two** layouts. A setting picks one. A full tree is the rest of the game (hulls, guns, buildings). Scratch-empire uses a **stub category tree** so research still runs.

### Model A — Prereq (Civ-style)

Each tech has `prereqs[]`. Available = all prereqs done. Pick any available tech. For a later setting (SOW can be a small stable tree). Not used in the scratch-empire stub.

```
TechDef { id, name, cost, prereqs: [techId], effects[] }
```

### Model B — Category (scratch-empire)

You research **one tech from a category** at that category’s current **tier**. Finishing it grants effects and bumps **that category** to the next tier. Other picks at the same tier, when they exist, are skipped — that is how space-opera techs can be unguaranteed.

```
CategoryDef { id, name }
TechDef { id, name, categoryId, tier, cost, effects[] }
```

Categories do not block each other. **Later:** each tier has a pool of 2–3 techs; the run offers a subset. **Stub:** exactly **one** tech per category per tier, all guaranteed.

### Cost rungs

Next tier uses this multiple of the category base. **Most categories base 100:**

| Tier | × | Cost (base 100) |
| ---: | ---: | ---: |
| 1 | 1 | 100 |
| 2 | 1.5 | 150 |
| 3 | 2 | 200 |
| 4 | 3 | 300 |
| 5 | 5 | 500 |
| 6 | 10 | 1000 |

Rounded 1.5× ladder, not `100 × 1.5^(n-1)`. Stub: every category starts at 100.

### Scratch-empire categories (stub)

Combat, spies, morale, ship size, comms, and extra units are **empire numbers** until those systems exist. Industry, research, food, growth, speed, and range apply now.

| Category | Theme |
| --- | --- |
| **Warp Physics** | Ship **speed**, star drives, **comms range** |
| **Reactors** | Ship **range**, ship **size**, **industry** |
| **Sociology** | **Research**; later morale, assimilation, spy, unit bonuses |
| **Biology** | **Growth**, **food**; later weapons, spy, soldiers |
| **Exotic Materials** | Ship size, industry, armor, research |
| **Robotics** | Industry, units and unit bonuses |
| **Particle Physics** | Combat: shields and weapons |

#### Stub catalog (one tech per tier)

**Warp Physics**

| T | Cost | Tech | Effect |
| ---: | ---: | --- | --- |
| 1 | 100 | Vector Thrust | speed +1 (2→3) |
| 2 | 150 | Tightbeam | commsRange +3 |
| 3 | 200 | Star Drive | speed +1 |
| 4 | 300 | Ansible | commsRange +5 |
| 5 | 500 | High Warp | speed +1 |
| 6 | 1000 | Warp Spine | speed +2 |

**Reactors**

| T | Cost | Tech | Effect |
| ---: | ---: | --- | --- |
| 1 | 100 | Extended Coils | range +2 (5→7) |
| 2 | 150 | Heat Recycle | industry +1 / industry pop |
| 3 | 200 | Deep Envelope | range +3 |
| 4 | 300 | Heavy Frame | shipSize +1 |
| 5 | 500 | Core Tap | industry +1 / industry pop |
| 6 | 1000 | Far Reach | range +5 |

**Sociology**

| T | Cost | Tech | Effect |
| ---: | ---: | --- | --- |
| 1 | 100 | Archives | research +1 / research pop |
| 2 | 150 | Civic Code | loyalty +10 (unused) |
| 3 | 200 | Peer Review | research +1 / research pop |
| 4 | 300 | Assimilation | stub flag |
| 5 | 500 | Bureau | research +1 / research pop |
| 6 | 1000 | Hegemony | research +2 / research pop |

**Biology**

| T | Cost | Tech | Effect |
| ---: | ---: | --- | --- |
| 1 | 100 | Vitalism | growthRatePercent +1 (5→6) |
| 2 | 150 | Crop Science | food +1 / farmer |
| 3 | 200 | Vitalism II | growth +1 |
| 4 | 300 | Pathogen | weapon stub +1 |
| 5 | 500 | Vitalism III | growth +1 |
| 6 | 1000 | Closed Ecology | food +1 / farmer, growth +1 |

**Exotic Materials**

| T | Cost | Tech | Effect |
| ---: | ---: | --- | --- |
| 1 | 100 | Light Alloys | industry +1 / industry pop |
| 2 | 150 | Lab Glass | research +1 / research pop |
| 3 | 200 | Armor Plate | armor stub +1 |
| 4 | 300 | Superalloys | industry +1 / industry pop |
| 5 | 500 | Lab Lattice | research +1 / research pop |
| 6 | 1000 | Unobtainium | industry +1, shipSize +1 |

**Robotics**

| T | Cost | Tech | Effect |
| ---: | ---: | --- | --- |
| 1 | 100 | Tool Arms | industry +1 / industry pop |
| 2 | 150 | Servo Drill | unit bonus stub |
| 3 | 200 | Auto-lathe | industry +1 / industry pop |
| 4 | 300 | Chassis | stub unit unlock |
| 5 | 500 | Auto-lathe II | industry +1 / industry pop |
| 6 | 1000 | Von Neumann | industry +2 / industry pop |

**Particle Physics**

| T | Cost | Tech | Effect |
| ---: | ---: | --- | --- |
| 1 | 100 | Particle Beam | weapon stub +1 |
| 2 | 150 | Deflector | shield stub +1 |
| 3 | 200 | Beam Focus | weapon stub +1 |
| 4 | 300 | Screen | shield stub +1 |
| 5 | 500 | Warhead | weapon stub +1 |
| 6 | 1000 | Hard Shield | shield stub +2 |

Stack additively. Job bonuses apply after biome modifiers. Robo-industry pops count as industry pops for industry bonuses. Expanding pools per tier and rolling a subset is how the stub becomes the real game — not by inventing hulls in this pass.

---

## Starting positions

Generated, never hardcoded. Same API for every setting: `generateStart(setting, galaxy, rng)`.

**Scratch-empire center of range:** 8 pops, medium garden, 0 freighters. **Jobs start idle**; the player assigns on turn 1. A setting/generation flag `autoAssignJobs` can fill jobs without a prompt (needed for Solar System Earth, and for all AI). The assignment table itself is per setting (scratch-empire: farmers up to agri slots, then industry, then research — only used when auto is on).

SOW generates a theater (several settlements, ships, infantry). Solar System generates Earth as **multiple** settlements, not one.

---

## Settings

### 1. Empire from scratch (first slice)

One homeworld, 25 stars on 30×30, `3d4-5` bodies. Movement: baseline speed 2 / range 5; **Warp Physics** and **Reactors** raise them. Empty grid stops allowed. Rapid expansion. **Category** tech tree (stub: one tech per tier; later a subset of each tier’s pool so space-opera techs are not guaranteed). Base resources: food, local industry, money, research. Iconic builds: colony ship, robotic factory, freighter. Farming tables above. Food assignment: farmers → farming settlements → others proportional (largest rounded down).

### 2. SOW

Already an empire; the game is a war. Hyperspace **lanes**. Minimal tech change — a small **prereq** tree (or already unlocked) fits better than scratch-empire categories. More complex resources (tables later). Iconic builds: infantry, cruiser, fortress shield. Start generator places a theater.

### 3. Solar System

One star. Earth is many settlements (`regionId`). Belt settle-tech before giant settle-tech. Radical tree each run — **category** model with a wilder offer subset than scratch-empire. Transport is local first. Iconic builds: mining site, habitat, space elevator. Do not flatten Earth to one settlement.

### Shared vs override

Shared: settlement, pops, local industry, perishable food, turn order, build queue + effect list, screens.

Override: map, movement (drive vs lanes vs in-system), jobs, slot/yield tables, catalog, transport scope, food-assignment tables if a setting wants different priorities, start gen, **tech model** (category vs prereq) and catalog.

---

## Opponents (AI)

Empires are the same object whether human or AI. `isPlayer` plus `aiId` (null for the human).

v1: **at least one AI opponent**, personality **Dumb**. The engine takes a **list of opponent slots** that can be enabled or disabled independently (put in / take out) and later filled with different `aiId`s. Count is not a special case — it is `slots.filter(enabled).length`.

```
OpponentSlot { id, aiId, enabled, displayName? }
AiDef { id, name }           // v1: only 'dumb'
```

**Dumb** (v1): same rules as the player, no combat smarts. Auto-assigns jobs (farmers to cap, then industry, then research). If no research project, picks the first category with a remaining stub tech. Builds robotic factory, then freighters if any owned world would starve without hulls, then a colony ship when it can afford one. Colony ships go to the nearest empty legal body in range. Never waits on the Do-this queue.

**Victory (stub):** last empire that still has at least one settlement wins. An empire with 0 settlements and 0 colony ships is eliminated (ships in space with no colony are already walking home and cannot found if they have no envelope — if they have no settlements they are out). Refine later.

Player vs 0 AIs is allowed (sandbox) via disabling every slot; Generation default is **1** Dumb enabled.

---

## Screens

HTML chrome and panels. Canvas for maps. Model does not draw.

### Flow

```
Main menu → Generation → (first turn) Galaxy map + Do-this queue
         ↘ load (later)
```

End Turn runs the seven phases for **all** empires (player orders already set; AI fills orders at the start of that resolution, or in a silent AI planning step before phase 1). Then turn number increments and the **Do-this queue** is rebuilt for the player.

### Main menu

New Game, later Load / Save. New Game opens Generation.

### Generation

This is the new-game screen. It must stay generic: it edits a `GameConfig` bag, then calls `generate(settingId, config, seed)`.

v1 controls (scratch-empire enabled; other settings visible but can be greyed):

| Control | Default (scratch-empire) | Notes |
| --- | --- | --- |
| **Game type** | Empire from scratch | Setting: scratch / SOW / solar |
| **Seed** | random | Editable |
| **Map width × height** | 30 × 30 | “Size of area” |
| **Star systems** | 25 | Clamped to unique grid points |
| **Opponent slots** | one Dumb, enabled | Add/remove rows; each row: AI type + enabled checkbox (in/out) |
| **Auto-assign jobs** | off for the human | On = no “assign work” todos; AI always auto |

Start Game generates galaxy, places each enabled empire (player + AIs) via the start generator, then enters the map.

### Persistent chrome (in-game)

- Setting name, turn, **End Turn**
- Money, research (name + % + early-finish if ≥ 50%)
- This-turn food produced vs needed, freighters used/capacity
- No empire industry, no food stockpile
- **Do-this count** (badge). Click opens the queue if it is not already up.
- Alerts: starvation, idle (if auto-assign off), no research project, ships walking home

### Do-this queue

A list at **the start of the player’s turn** (after the previous resolution). Not a separate game mode — a panel over the map, or a sidebar. Each item jumps to the relevant screen.

Items are data (`TodoItem { type, settlementId?, unitId?, starId? }`). Settings and flags decide which types appear. The human can End Turn with leftover **advisory** items; **blocking** items must be resolved (or the ship/order cancelled).

| Type | When | Blocking? | v1 |
| --- | --- | --- | --- |
| `assignJobs` | Settlement has idle pops and `autoAssignJobs` is off | No | Yes. “Assign work here.” |
| `pickTech` | No current research project and at least one tech remains | No | Yes. “Pick a new technology.” |
| `pickSettleBody` | Colony ship ended on a star with one or more empty legal bodies | **Yes** | Yes. “Pick a planet to settle in this system.” |
| `outOfRange` | Ship is walking home automatically | No | Informational. |
| later | Combat, diplomacy, completed research pick, etc. | | |

`pickSettleBody`: if several bodies, player chooses one; ship is consumed, 1 pop from nowhere. If the only body is illegal (giant without tech, already taken), no found — item explains why. Auto-found without a prompt is **off** for the human so the queue can ask; AI founds the first legal body without UI.

New idle pops from growth spawn an `assignJobs` on the following turn.

### Galaxy map (canvas)

30×30 (or Generation size). Stars as points. Owned systems marked by empire color. Ships on empty cells as small markers. Click star → system view. Click ship → select (orders later). Grid optional, faint.

### System view

Bodies of one star: kind, size, biome, settlements, empty slots. Colony ship here: same `pickSettleBody` action. Click settlement → settlement panel.

### Settlement

Jobs (including idle), slot bars, production preview, local industry pool + build queue (this setting’s catalog), structures, stationed units, food/starvation prediction. Assigning jobs clears that settlement’s `assignJobs` todo.

### Research

Category list (scratch-empire): tier, stub tech, cost, saved progress. Choosing a project clears `pickTech`. Prereq-tree layout only for model A settings.

### Empire

List of settlements with idle/starve warnings. Totals. Opponent list (who is still in). No global industry spend.

### Turn report

After End Turn, optional log: phases, shipments, spoilage, deaths, births, techs, AI foundings. Can be skipped with a checkbox later.

---

## Clarifications

Resolved:

- Food cannot be preserved; surplus spoils after eating.
- Starvation: 10% of **unfed** pops per turn (half-life, not linear wipe); deterministic remainder accumulator; idle die first; fully fed resets acc. Optional productivity hit is **not** in v1.
- Size/biome farming tables are scratch-empire only.
- Industry is local. Idle pops allowed.
- Pops: species, loyalty, culture slot, optional training.
- Turn order: Movement/Combat → Production → Research → Construction → Transport → Starvation → **Growth**.
- Pop growth: **5%** of fed pops per turn (tech modifies); remainder accumulator; births are idle and eat next turn.
- Scratch-empire body gen: 25 stars; `3d4-5` bodies; **equal weight** on gas giant / belt / large / medium / small / tiny; biomes equal on the eight types; tiny always barren.
- Starts generated; scratch-empire center = 8 pops, medium garden, 0 freighters; **jobs idle** unless `autoAssignJobs`.
- Colony ship: **Do-this** pick a body in that system (blocking). AI auto-picks the first legal body. 1 pop from nowhere.
- Out of range: auto-move toward **nearest remaining friendly colony**.
- v1: **Dumb AI**, opponent **slots** enable/disable independently. Default one enabled. Stub victory: last empire with a settlement.
- Screens: Generation (type, map size, star count, AI slots, auto-assign), chrome, map, system, settlement, research, empire, turn report, **Do-this queue**.
- v1 catalogs: scratch (colony 100, factory 25, freighter 25); SOW (infantry 25, cruiser 200, fortress shield 100); solar (elevator 1000, mining 20, habitat 100).
- First slice is scratch-empire; engine stays generic.

Still open:

1. Optional starvation productivity hit (deferred).
2. Money sinks. Research overflow (stub: waste).
3. Exact SOW / solar build effects; SOW extra resources; Earth region schema.
4. Category offer-subset generator (real unguaranteed techs). Second+ techs per tier.
5. Richer victory / diplomacy.
6. Non-equal body/biome weights if the flat table is wrong.
7. Dumb AI tuning (build order is a first guess).

---

## What to plan next

Scratch-empire v1 is specified through screens, Do-this, Generation, and a Dumb AI. Remaining planning is polish or “rest of the game”:

1. Wireframe-level layout only if you want pixel placement before code (optional).
2. Real combat / extra hulls on the category tree.
3. SOW and solar Generation fields (lanes, Earth regions) when those settings are built.

Implementation can start: Generation shell → model turn loop → map + settlement + Do-this (patch sync) → Dumb AI. Coding standards above are in force before the first `index.html`.
