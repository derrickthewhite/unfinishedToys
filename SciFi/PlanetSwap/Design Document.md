# Planet Broker

Manage an interplanetary empire by buying, building up, and defending planets.

Inspired by "Old Man's War" by John Scalzi.

## Core Data

### Planet Statistics

- Gravity
- Pressure
- Season length
- Oxygen
- Temperature
- Contaminants: present or not present, usually not present
  - Chlorine
  - Sulfur
  - Heavy metals
  - Radiation
  - Ammonia
- Biology
  - DNA version
    - DNA
    - MRL (L for lipid)
    - ABC (amino-based coding)
    - UGC (unique genetic code)
  - Protein code
    - Chirality (R or L)
    - Hydrophobic / structural (A, B, C, or D)
    - Charged (M, N, O, or P)
    - Reactive (X, Y, or Z)
- Ecology ratings: 0-10 scale for how strong the ecology is
  - Vibrance: strength of invasive species, weeds, etc.
  - Predator: how resilient, sneaky, or dangerous predators are to population and livestock
  - Pest: how resilient crop-eating pests are
  - Parasite: how dangerous and likely new parasites are from the ecology
- Mineral sites
  - Track only rare and ultra rare.
  - Most planets have 7-10 rare and 3-7 ultra rare sites.

### Race Statistics

Race stats come from planet stats.

### Population Types

- Children
- Farmers
- Miners
- Workers
- Researchers
- Educators
- Culturals
- Service
- Warriors

## Infrastructure

### Space Infrastructure

- Fighters
- Freighters
- Shuttles

### Planet Infrastructure

#### Space Layer

- Space stations
- Space elevators
- Orbital rings
- Jump beacon

#### Planet-side Layer

- Farms (raw)
- Farms (terraformed)
- Mines
  - Broader than a proper mine; also includes logging trucks and similar extraction equipment.
- Factories
- Fortifications
- Transports
- Military
- Housing
- Habitat

### Mine Types

- Organics: wood, petroleum, coal, etc.
- Silicates: concrete, brick, stone, sand, etc.
- Structural: iron, aluminum, copper, etc.
- Rare: 10 types
- Ultra rare: 20 types

### Infrastructure Levels

All infrastructure requires a base cost of 10 silicates and 5 structural.

| Level | Additional requirements | Output multiplier |
| --- | --- | --- |
| Powered | 3 labor + 5 structural | x1 |
| Powered II | 5 labor + 5 structural + 5 rare | x2 |
| Automated | 7 labor + 5 structural + 10 rare | x3 |
| Automated II | 10 labor + 5 structural + 10 rare + 5 ultra rare | x5 |
| Automated III | 15 labor + 5 structural + 10 rare + 10 ultra rare | x7 |
| Auto-maintained I | 20 labor + 5 structural + 10 rare + 15 ultra rare | x10 |
| Auto-maintained II | 25 labor + 5 structural + 10 rare + 20 ultra rare | x15 |

Each infrastructure takes a single unit of population to operate it. Its level increases how much it produces.

### Factory Types

- Planet infrastructures
  - Each infrastructure type needs its own factory.
- Parts
  - Allows bundling of rare elements for shipping and adapting later.

## Production Rules

### Basic Creation Rules

- Each population unit eats 1 food per year.
- Farms create a base of 10 food.
  - Output is modified by biological matching and infrastructure level.
  - Terraformed farms have strong advantages, but should be expensive.
- Every 5 farmer units create 1 child unit if food is available.
  - For now, only farmers create population growth.
- Mines create a base of 1 unit of the target resource.
- Factories create a base of 1 labor.
- A transport can move a base of 10 units.
- A freighter can move 1 unit.

### Additional Creation Rules

- Todo: prices for things other than mines, factories, and farms
- Todo: penalties for food production and other production

## Implementation Phases

1. Empire state: settled planets and known planets
2. Planet generation
3. Biological match scoring
4. Basic planet infrastructure
5. Run a basic turn
6. Population rules
7. Planet exploration
8. Trade system
9. Predator / prey / parasite penalties
10. Combat
11. Diplomacy

## Development Constraints

- Build UI and AI as development progresses.
- Build AI as an alternate UI.
- Keep model and UI separate.
- UI is a combination of HTML and JavaScript canvas.
- Long term, this should be able to run online through a database-backed system, so the model interface should stay clean.

## Clarifications Needed

- Define how race stats are derived from planet stats.
- Define the game time unit used for turns so food, growth, transport, and production rates share the same scale.
- Define the full population lifecycle: aging, conversion from children to adult roles, death, and reassignment between roles.
- Clarify whether infrastructure level affects build cost only, output only, staffing only, or some combination of all three.
- Clarify the difference between transports, freighters, and shuttles, especially for intra-planet vs. interplanetary logistics.
- Define what "1 labor" from factories means mechanically: build points, worker-equivalents, or a trade good.
- Define what rare and ultra rare resources actually do in the economy beyond infrastructure upgrades and parts bundling.
- Decide whether ecology penalties apply immediately on colonization, after population thresholds, or only when local farming / ranching exists.
- Decide what minimum playable slice is needed before combat and diplomacy are added, so scope stays controlled.

	


