var Space4x = Space4x || {};

Space4x.SETTINGS = Space4x.SETTINGS || {};

Space4x.SETTINGS["scratch-empire"] = (function () {
	const biomes = ["garden", "ocean", "swamp", "arid", "desert", "tundra", "barren", "toxic"];
	const foodMod = {
		garden: 0, ocean: -1, swamp: -1, arid: -1,
		desert: -2, tundra: -2, barren: 0, toxic: 0
	};
	const agriSlots = { large: 12, medium: 8, small: 4, tiny: 0 };
	const bodyKinds = ["gasGiant", "asteroidBelt", "large", "medium", "small", "tiny"];

	function tech(id, name, categoryId, tier, effects, summary) {
		const costs = [50, 100, 150, 200, 300, 500, 1000];
		return { id: id, name: name, categoryId: categoryId, tier: tier, cost: costs[tier], effects: effects, summary: summary || "" };
	}

	return {
		id: "scratch-empire",
		name: "Empire from scratch",
		startTechTier: 0,
		warpTechId: "wp0",
		foodPerPop: 1,
		starvationRatePercent: 10,
		growthRatePercent: 5,
		baseline: { speed: 2, range: 5 },
		transportScope: "empire",
		foodPerFreighter: 1,
		popMoveFreighterFactor: 5,
		troopMoveFreighterFactor: 1,
		combat: { model: "quick" },
		loyalty: {
			base: 80,
			cultureBonus: 20,
			foodPenalty: 10,
			starveMemoryPenalty: 10,
			policePenalty: 10,
			popsPerPolice: 5
		},
		revolt: {
			rebelTroopDefId: "militia"
		},
		richness: [
			{ id: "veryRich", name: "Very rich", industryPerPop: 2, weight: 1 },
			{ id: "rich", name: "Rich", industryPerPop: 1, weight: 2 },
			{ id: "normal", name: "Normal", industryPerPop: 0, weight: 3 },
			{ id: "poor", name: "Poor", industryPerPop: -1, weight: 2 },
			{ id: "veryPoor", name: "Very poor", industryPerPop: -2, weight: 1 }
		],
		asteroidRichness: [
			{ id: "normal", name: "Normal", industryPerPop: 0, weight: 3 },
			{ id: "rich", name: "Rich", industryPerPop: 1, weight: 4 },
			{ id: "veryRich", name: "Very rich", industryPerPop: 2, weight: 2 }
		],
		biomes: biomes,
		foodMod: foodMod,
		agriSlots: agriSlots,
		bodyKinds: bodyKinds,
		noAgriBiomes: { barren: true, toxic: true },
		jobOrder: ["idle", "agriculture", "greenhouse", "industry", "research"],
		jobs: {
			idle: { label: "Idle", product: null, base: 0, money: 0, cap: "uncapped" },
			agriculture: { label: "Agriculture", product: "food", base: 3, money: 1, cap: "agri", yield: "farmerBiome" },
			greenhouse: { label: "Greenhouse", product: "food", base: 3, money: 1, cap: "fromBuildings", yield: "foodBase" },
			industry: { label: "Industry", product: "industry", base: 3, money: 1, cap: "uncapped", yield: "industryRichness" },
			research: { label: "Research", product: "research", base: 3, money: 1, cap: "uncapped", yield: "workerBase" }
		},
		cultures: (function () {
			const wet = ["ocean", "swamp", "tundra"];
			const wetFarm = { type: "jobYield", jobs: ["agriculture", "greenhouse"], n: 1, biomes: wet };
			function c(id, name, art, effects, summary) {
				return { id: id, name: name, art: "assets/species/" + art, effects: effects || [], summary: summary || "" };
			}
			return [
				c("cat", "Cat", "Cat (Jaguar).svg"),
				c("centurion", "Centurion", "Centurion.svg"),
				c("crabbit", "Crabbit", "Crabbit.svg", [wetFarm], "+1 food per farmer on ocean, swamp, and tundra."),
				c("gaunt", "Gaunt", "Gaunt.svg", [{ type: "troopTsPct", pct: 20 }], "+20% troop strength."),
				c("greenBug", "Green Bug", "Green Bug D.svg", [{ type: "growthBase", n: 10 }], "Fed pops grow at 10% instead of 5%."),
				c("human", "Human", "Human A27.svg"),
				c("hmmm", "Hmmm", "hmmm A.svg", [{ type: "jobYield", job: "research", n: 1 }], "+1 research per scientist."),
				c("karkadann", "Karkadann", "Karkadann D.svg", [{ type: "jobYield", job: "industry", n: 1 }], "+1 industry per Industry worker."),
				c("keleni", "Keleni", "Keleni C.svg", [wetFarm], "+1 food per farmer on ocean, swamp, and tundra."),
				c("krouta", "Krouta", "Krouta C.svg", [{ type: "troopTsPct", pct: 20 }], "+20% troop strength."),
				c("loroko", "Loroko", "Loroko A.svg"),
				c("mogwai", "Mogwai", "Mogwai B.svg", [{ type: "jobYield", job: "research", n: 1 }], "+1 research per scientist."),
				c("nehudi", "Nehudi", "Nehudi D.svg"),
				c("ranathim", "Ranathim", "Ranathim B.svg", [{ type: "troopTsPct", pct: 20 }], "+20% troop strength."),
				c("snake", "Snake", "Snake (Black).svg"),
				c("squidling", "Squidling", "Squidling.svg", [wetFarm], "+1 food per farmer on ocean, swamp, and tundra."),
				c("temkor", "Temkor", "Temkor (Red).svg"),
				c("trader", "Trader", "Trader B.svg", [{ type: "moneyMult", mult: 1.5 }], "Working pops earn 1.5 money.")
			];
		}()),
		builds: {
			roboticFactory: {
				id: "roboticFactory", name: "Robotic factory", kind: "structure",
				cost: { industry: 25 }, upkeep: 1, requireTech: "ro0rf",
				effects: [{ type: "jobYieldCover", jobs: ["industry"], n: 2, cover: 1, product: "industry" }],
				summary: "Shop automation. Each building gives +2 industry to one Industry worker on this world."
			},
			greenhouse: {
				id: "greenhouse", name: "Greenhouse", kind: "structure",
				cost: { industry: 50 }, upkeep: 1, requireTech: "bi2gh", maxFrom: "agriPotential",
				forbidKinds: ["asteroidBelt", "gasGiant"], forbidBiomes: ["toxic"],
				effects: [{ type: "jobSlots", job: "greenhouse", n: 1 }, { type: "capDelta", cap: "agri", n: -1 }],
				summary: "Sealed farm. Converts one agriculture slot into a Greenhouse job that makes 3 food, including on barren worlds."
			},
			farmCylinder: {
				id: "farmCylinder", name: "Farm Cylinder", kind: "structure",
				cost: { industry: 250 }, upkeep: 1, requireTech: "bi3of", onlyKinds: ["asteroidBelt"],
				effects: [{ type: "capDelta", cap: "agri", n: 1 }],
				summary: "Spin habitat farm. Asteroid belts only. Adds one agriculture job slot; farmers here produce 3 food."
			},
			cropTweaks: {
				id: "cropTweaks", name: "Crop Tweaks", kind: "structure",
				cost: { industry: 100 }, requireTech: "bi1ct", unique: true,
				effects: [{ type: "jobYield", job: "agriculture", n: 1 }],
				summary: "One-time agronomy lab. Farmers on this world produce +1 food. No upkeep."
			},
			scienceBoard: {
				id: "scienceBoard", name: "Science Board", kind: "structure",
				cost: { industry: 100 }, upkeep: 2, requireTech: "so1sb", unique: true,
				effects: [{ type: "jobYield", job: "research", n: 1 }],
				summary: "Planetary academy. Every scientist on this world produces +1 research."
			},
			monetaryAgent: {
				id: "monetaryAgent", name: "Monetary Agent", kind: "structure",
				cost: { industry: 100 }, upkeep: 2, requireTech: "so1ec", unique: true,
				effects: [{ type: "moneyPerPop", n: 0.5 }],
				summary: "Local mint and ledgers. Unique. Working pops on this world earn +0.5 money."
			},
			heavyLaboratory: {
				id: "heavyLaboratory", name: "Heavy Laboratory", kind: "structure",
				cost: { industry: 50 }, upkeep: 1, requireTech: "ex2hl",
				effects: [{ type: "jobYieldCover", jobs: ["research"], n: 2, cover: 2, product: "research" }],
				summary: "Big instruments. Each building gives +2 research to two scientists on this world."
			},
			transmuter: {
				id: "transmuter", name: "Transmuter", kind: "structure",
				cost: { industry: 500 }, upkeep: 2, requireTech: "rx2nt", unique: true,
				effects: [
					{ type: "jobYield", job: "industry", n: 2, richness: ["veryRich"] },
					{ type: "jobYield", job: "industry", n: 1, richness: ["rich"] }
				],
				summary: "Turns ore into feedstock. Unique. Industry workers produce +2 industry on very rich worlds, +1 on rich worlds. No bonus on poorer worlds."
			},
			patriotBoard: {
				id: "patriotBoard", name: "Patriot Board", kind: "structure",
				cost: { industry: 100 }, upkeep: 1, requireTech: "so2pb", unique: true,
				effects: [{ type: "settlementLoyalty", n: 10 }, { type: "unitLoyalty", n: -25 }],
				summary: "Unique. +10 settlement loyalty, −25 unit loyalty. If the world goes, the garrison is more likely to go with it."
			},
			grandBarracks: {
				id: "grandBarracks", name: "Grand Barracks", kind: "structure",
				cost: { industry: 100 }, upkeep: 2, requireTech: "so2mp",
				effects: [{ type: "settlementLoyalty", n: -5 }, { type: "unitLoyaltyCover", n: 50, cover: 5 }],
				summary: "Each building: −5 settlement loyalty, +50 unit loyalty for five garrison units. Extra copies cover five more, in Police then Militia then the rest of the garrison list."
			},
			communityReactor: {
				id: "communityReactor", name: "Community Reactors", kind: "structure",
				cost: { industry: 50 }, upkeep: 1, requireTech: "rx1cr",
				effects: [{ type: "jobYieldCover", jobs: ["industry"], n: 1, cover: 5, product: "industry" }],
				summary: "Shared power grid. Each building gives +1 industry to five Industry workers."
			},
			spaceDock: {
				id: "spaceDock", name: "Space Dock", kind: "structure",
				cost: { industry: 400 }, upkeep: 2, requireTech: "ex0sc", unique: true,
				effects: [],
				summary: "Unique. Shipyard. This world cannot build ships until a Space Dock stands here."
			},
			surveyDish: {
				id: "surveyDish", name: "Survey Dish", kind: "structure",
				cost: { industry: 400 }, upkeep: 2, requireTech: "wp3sd", unique: true,
				effects: [{ type: "galaxyScan" }],
				summary: "Unique here. Reveals every planet and ship. Extra dishes on other worlds are backups."
			},
			carbonSynth: {
				id: "carbonSynth", name: "Carbon synthesizer", kind: "structure",
				cost: { industry: 50 }, upkeep: 1, requireTech: "ex1cs", unique: true,
				requireAgri: true, requireRichness: ["poor", "veryPoor"],
				effects: [{ type: "capDelta", cap: "agri", n: -1 }, { type: "jobYield", job: "industry", n: 1 }],
				summary: "Turns farmland into feedstock. Unique. −1 agriculture slot. Each Industry worker on this world produces +1 industry. Only on poor or very poor agri worlds."
			},
			spaceElevator: {
				id: "spaceElevator", name: "Space Elevator", kind: "structure",
				cost: { industry: 200 }, upkeep: 1, requireTech: "ex1se", unique: true,
				effects: [{ type: "buildCost", kinds: ["unit"], mult: 0.75 }],
				summary: "Orbital tether. Unique. Ships built here cost 25% less industry."
			},
			autoTransport: {
				id: "autoTransport", name: "Auto-transport network", kind: "structure",
				cost: { industry: 100 }, upkeep: 2, requireTech: "ro1at", unique: true,
				effects: [{ type: "jobYield", job: "industry", n: 1 }],
				summary: "Yard rails and lifts. Unique. Each Industry worker on this world produces +1 industry."
			},
			spy: {
				id: "spy", name: "Spy", kind: "spy",
				cost: { industry: 50 }, upkeep: 1,
				summary: "Trains an agent for the Spies screen. Assigned instantly. Upkeep 1. Idle spies do nothing."
			},
			police: { id: "police", name: "Police", kind: "troop", cost: { industry: 10 }, upkeep: 1, ts: 15, tags: ["Infantry", "Police"], glyph: { color: "#5b8def", shape: "shield" }, summary: "Local security. Stations at this world. 1 freighter to move. Combat later." },
			militia: { id: "militia", name: "Militia", kind: "troop", cost: { industry: 10 }, upkeep: 0.2, ts: 20, tags: ["Infantry", "Defensive"], glyph: { color: "#8a9070", shape: "square" }, summary: "Cheap garrison. Stations at this world. 1 freighter to move. Combat later." },
			infantry: { id: "infantry", name: "Infantry", kind: "troop", cost: { industry: 20 }, upkeep: 1, ts: 50, tags: ["Infantry"], glyph: { color: "#6b8f3d", shape: "square" }, summary: "Line infantry. Stations at this world. 1 freighter to move. Combat later." },
			elites: { id: "elites", name: "Elites", kind: "troop", cost: { industry: 40 }, upkeep: 2, ts: 120, tags: ["Infantry"], glyph: { color: "#d4a017", shape: "star" }, summary: "Heavy infantry. Stations at this world. 1 freighter to move. Combat later." },
			armor: { id: "armor", name: "Armor", kind: "troop", cost: { industry: 20 }, upkeep: 1, ts: 50, tags: ["Armor"], glyph: { color: "#a0652a", shape: "rect" }, summary: "Ground armor. Stations at this world. 1 freighter to move. Combat later." },
			mechs: { id: "mechs", name: "Mechs", kind: "troop", cost: { industry: 40 }, upkeep: 2, ts: 120, tags: ["Armor"], requireTech: "rx2mh", glyph: { color: "#7a8a9a", shape: "hex" }, summary: "Heavy walkers. Stations at this world. 1 freighter to move. Troop strength 120, Armor." },
			air: { id: "air", name: "Air", kind: "troop", cost: { industry: 100 }, upkeep: 4, ts: 100, tags: ["Air"], glyph: { color: "#4ec4d4", shape: "tri" }, summary: "Air wing. Stations at this world. 1 freighter to move. Combat later." },
			spaceFreighter: {
				id: "spaceFreighter", name: "Space freighters (×5)", kind: "abstract",
				cost: { industry: 25 }, requireTech: "rx0ip",
				effects: [{ type: "grantFreighters", n: 5 }],
				summary: "Adds five hulls to the empire freighter pool. Each hull hauls 1 food. Five hulls move one person. One hull moves one ground unit. 1 money if any hulls haul food, people, or troops this turn."
			},
			scout: {
				id: "scout", name: "Scout", kind: "unit",
				cost: { industry: 25 }, upkeep: 1, requireTech: "rx0ip", requireStructure: "spaceDock",
				summary: "Cheap hull. Any ship reveals a system on arrival; this is the early survey option. Needs a Space Dock. Needs Warp Drive to leave this star."
			},
			colonyShip: {
				id: "colonyShip", name: "Colony ship", kind: "unit",
				cost: { industry: 100 }, upkeep: 4, requireTech: "bi0ce", requireStructure: "spaceDock",
				effects: [{ type: "foundSettlement" }],
				summary: "Founds a new settlement on a legal empty world. Needs Contained Ecology, a Space Dock, and Warp Drive to leave this star."
			},
			cruiser: {
				id: "cruiser", name: "Cruiser", kind: "unit",
				cost: { industry: 200 }, upkeep: 4, requireStructure: "spaceDock",
				effects: [{ type: "combatStub" }],
				summary: "Combat hull. Needs a Space Dock. Weapons are a stub in this slice."
			},
			battleship: {
				id: "battleship", name: "Battleship", kind: "unit",
				cost: { industry: 400 }, upkeep: 8, requireStructure: "spaceDock",
				effects: [{ type: "combatStub" }],
				summary: "Heavy combat hull. Needs a Space Dock. Weapons are a stub in this slice."
			}
		},
		categories: [
			{ id: "warpPhysics", name: "Warp Physics" },
			{ id: "reactors", name: "Reactors" },
			{ id: "sociology", name: "Sociology" },
			{ id: "biology", name: "Biology" },
			{ id: "exoticMaterials", name: "Exotic Materials" },
			{ id: "robotics", name: "Machines" },
			{ id: "particlePhysics", name: "Particle Physics" }
		],
		techs: [
			tech("wp0", "Warp Drive", "warpPhysics", 0, [{ type: "warpDrive" }], "Ships may leave their star and travel the galaxy."),
			tech("wp1", "Vector Thrust", "warpPhysics", 1, [{ type: "speed", n: 1 }], "Sharper drive geometry. Colony ships move 1 hex farther each turn."),
			tech("wp1ad", "Afterdrive", "warpPhysics", 1, [{ type: "afterdrive" }], "Combat speed option. Does not change map speed. Not used in fights yet."),
			tech("wp2", "Tightbeam", "warpPhysics", 2, [{ type: "commsRange", n: 3 }], "Focused comms. Contact range is ship range plus 3."),
			tech("wp2ag", "Artificial Gravity", "warpPhysics", 2, [{ type: "unlockSettle", kind: "asteroidBelt" }], "Spin habitats. Colony ships can found settlements on asteroid belts."),
			tech("wp3", "Star Drive", "warpPhysics", 3, [{ type: "speed", n: 1 }], "Another speed step. Ships close distance faster."),
			tech("wp3sd", "Survey Dish", "warpPhysics", 3, [{ type: "unlockBuild", id: "surveyDish" }], "Unlocks Survey Dish: unique 400-industry building, upkeep 2. Reveals every planet and ship. Extra dishes on other worlds are backups."),
			tech("wp4", "Ansible", "warpPhysics", 4, [{ type: "commsRange", n: 5 }], "Instant signaling. Contact range is ship range plus 5."),
			tech("wp5", "High Warp", "warpPhysics", 5, [{ type: "speed", n: 1 }], "Cruise speed up again."),
			tech("wp6", "Warp Spine", "warpPhysics", 6, [{ type: "speed", n: 2 }], "Late-game engines. +2 speed."),
			tech("rx0ip", "Interplanetary Movement", "reactors", 0, [{ type: "unlockBuild", id: "spaceFreighter" }, { type: "unlockBuild", id: "scout" }], "In-system hulls. Unlocks freighter fleets and the Scout hull. Colony ships come from Contained Ecology. A Space Dock is still required to build ships."),
			tech("rx1", "Extended Coils", "reactors", 1, [{ type: "range", n: 2 }], "Ships may operate 2 hexes farther from a friendly colony."),
			tech("rx1cr", "Community Reactors", "reactors", 1, [{ type: "unlockBuild", id: "communityReactor" }], "Shared power. Unlocks Community Reactors: each building gives +1 industry to 5 Industry workers."),
			tech("rx2mh", "Mechs", "reactors", 2, [{ type: "unlockBuild", id: "mechs" }], "Unlocks Mechs: ground unit, 40 industry, upkeep 2, troop strength 120, Armor."),
			tech("rx2nt", "Nuclear Transmutation", "reactors", 2, [{ type: "unlockBuild", id: "transmuter" }], "Unlocks the Transmuter: unique 500-industry building, upkeep 2. Industry workers produce +2 industry on very rich worlds, +1 on rich worlds."),
			tech("rx3", "Deep Envelope", "reactors", 3, [{ type: "range", n: 3 }], "Operational range +3 from friendly stars."),
			tech("rx4", "Heavy Frame", "reactors", 4, [{ type: "shipSize", n: 1 }], "Larger hulls. Stub until ship classes exist."),
			tech("rx5", "Core Tap", "reactors", 5, [{ type: "industryPerPop", n: 1 }], "Industry workers produce +1 more."),
			tech("rx6", "Far Reach", "reactors", 6, [{ type: "range", n: 5 }], "Long legs. Range +5."),
			tech("so0ex", "Exotranslation", "sociology", 0, [{ type: "diplomacy" }], "Talk to other empires in contact range. Unlocks the Diplomacy screen."),
			tech("so1sb", "Science Board", "sociology", 1, [{ type: "unlockBuild", id: "scienceBoard" }], "A planetary academy. Unlocks Science Board: +1 research per scientist on that world, once per planet."),
			tech("so1ec", "Economics", "sociology", 1, [{ type: "unlockBuild", id: "monetaryAgent" }], "Unlocks Monetary Agent: unique 100-industry building, upkeep 2. Working pops on that world earn +0.5 money."),
			tech("so2pb", "Patriot Board", "sociology", 2, [{ type: "unlockBuild", id: "patriotBoard" }], "Unlocks Patriot Board: unique 100-industry building, upkeep 1. +10 settlement loyalty, −25 unit loyalty."),
			tech("so2mp", "Military Privilege", "sociology", 2, [{ type: "unlockBuild", id: "grandBarracks" }], "Unlocks Grand Barracks: 100 industry, upkeep 2. −5 settlement loyalty. +50 unit loyalty for five garrison units; extra copies cover five more."),
			tech("so2ap", "Armed Populace", "sociology", 2, [{ type: "militiaAsPolice", defId: "militia" }, { type: "unitLoyalty", defId: "militia", n: -10 }], "Militia count as police for settlement loyalty. Militia loyalty −10."),
			tech("so3", "Peer Review", "sociology", 3, [{ type: "researchPerPop", n: 1 }], "Scientists produce +1 research."),
			tech("so4", "Assimilation", "sociology", 4, [{ type: "stub", n: 1 }], "Culture capture. Not in this slice."),
			tech("so5", "Bureau", "sociology", 5, [{ type: "researchPerPop", n: 1 }], "Scientists produce +1 research."),
			tech("so6", "Hegemony", "sociology", 6, [{ type: "researchPerPop", n: 2 }], "Scientists produce +2 research."),
			tech("bi0ce", "Contained Ecology", "biology", 0, [{ type: "unlockBuild", id: "colonyShip" }], "Sealed life support. Unlocks colony ships. A Space Dock is still required to build them."),
			tech("bi1ct", "Crop Tweaking", "biology", 1, [{ type: "unlockBuild", id: "cropTweaks" }], "Unlocks Crop Tweaks: a one-time 100-industry building with no upkeep. Farmers on that world produce +1 food."),
			tech("bi1", "Organ Cloning", "biology", 1, [{ type: "growthRatePercent", n: 1 }], "Fed population accumulates growth 1% faster."),
			tech("bi2", "Crop Science", "biology", 2, [{ type: "foodPerFarmer", n: 1 }], "Farmers produce +1 food."),
			tech("bi2gh", "Exo-Greenhouses", "biology", 2, [{ type: "unlockBuild", id: "greenhouse" }], "Sealed farms. Unlocks Greenhouse: 3 food per worker, converts one agriculture slot. Works on barren worlds."),
			tech("bi3", "Organ Cloning II", "biology", 3, [{ type: "growthRatePercent", n: 1 }], "Another +1% growth."),
			tech("bi3cd", "Combat Drugs", "biology", 3, [{ type: "troopArmorPct", tags: ["Infantry"], pct: 10 }], "+10% troop strength for infantry. Instant; no building."),
			tech("bi3of", "Orbital Farming", "biology", 3, [{ type: "unlockBuild", id: "farmCylinder" }], "Unlocks Farm Cylinder: 250 industry, upkeep 1. Asteroid belts only. Adds one agriculture job slot."),
			tech("bi4", "Pathogen", "biology", 4, [{ type: "weapon", n: 1 }], "Bio-weapons. Combat stub."),
			tech("bi5", "Organ Cloning III", "biology", 5, [{ type: "growthRatePercent", n: 1 }], "Another +1% growth."),
			tech("bi6", "Closed Ecology", "biology", 6, [{ type: "foodPerFarmer", n: 1 }, { type: "growthRatePercent", n: 1 }], "Farmers +1 food and +1% growth."),
			tech("ex0sc", "Space Construction", "exoticMaterials", 0, [{ type: "unlockBuild", id: "spaceDock" }], "Unlocks the Space Dock. No ships can be built at a settlement until one stands there."),
			tech("ex1cs", "Mass Carbon Synthesis", "exoticMaterials", 1, [{ type: "unlockBuild", id: "carbonSynth" }], "Unlocks the Carbon synthesizer. Poor or very poor agri worlds: unique building, −1 agri slot, +1 industry per Industry worker."),
			tech("ex1se", "Space Elevator", "exoticMaterials", 1, [{ type: "unlockBuild", id: "spaceElevator" }], "Unlocks the Space Elevator. Unique. Ships built on that world cost 25% less."),
			tech("ex1ba", "Body Armor", "exoticMaterials", 1, [{ type: "troopArmorPct", pct: 20 }], "+20% troop strength. Instant; no building."),
			tech("ex2hl", "Heavy Laboratory", "exoticMaterials", 2, [{ type: "unlockBuild", id: "heavyLaboratory" }], "Unlocks Heavy Laboratory: each building gives +2 research to two scientists."),
			tech("ex2sc", "Superconductors", "exoticMaterials", 2, [{ type: "range", n: 1 }], "Low-loss power. Ships operate 1 hex farther from friendly colonies."),
			tech("ex3", "Armor Plate", "exoticMaterials", 3, [{ type: "armor", n: 1 }], "Ship armor. Combat stub."),
			tech("ex4", "Superalloys", "exoticMaterials", 4, [{ type: "industryPerPop", n: 1 }], "Industry workers produce +1 industry."),
			tech("ex5", "Lab Lattice", "exoticMaterials", 5, [{ type: "researchPerPop", n: 1 }], "Scientists produce +1 research."),
			tech("ex6", "Unobtainium", "exoticMaterials", 6, [{ type: "industryPerPop", n: 1 }, { type: "shipSize", n: 1 }], "+1 industry per worker. Ship size is a stub."),
			tech("ro0rf", "Robo Factories", "robotics", 0, [{ type: "unlockBuild", id: "roboticFactory" }], "Automated shops. Unlocks the Robotic factory: each building gives +2 industry to one Industry worker."),
			tech("ro1at", "Auto-transport", "robotics", 1, [{ type: "unlockBuild", id: "autoTransport" }], "Unlocks Auto-transport network: unique 100-industry building, upkeep 2. Each Industry worker on that world produces +1 industry."),
			tech("ro1ar", "Auto Repair", "robotics", 1, [{ type: "shipModule", id: "autoRepair" }], "Fits Auto Repair on every ship. No effect yet."),
			tech("ro2", "Servo Drill", "robotics", 2, [{ type: "unitBonus", n: 1 }], "Unit bonus. Not wired yet."),
			tech("ro3", "Auto-lathe", "robotics", 3, [{ type: "industryPerPop", n: 1 }], "Industry workers produce +1 industry."),
			tech("ro4", "Chassis", "robotics", 4, [{ type: "stubUnit", n: 1 }], "Unlocks a unit. Not in this slice."),
			tech("ro5", "Auto-lathe II", "robotics", 5, [{ type: "industryPerPop", n: 1 }], "Industry workers produce +1 industry."),
			tech("ro6", "Von Neumann", "robotics", 6, [{ type: "industryPerPop", n: 2 }], "Industry workers produce +2 industry."),
			tech("pp0", "Particle Beam", "particlePhysics", 0, [{ type: "weapon", n: 1 }], "Beam weapons. Combat stub."),
			tech("pp1", "Radio Scanner", "particlePhysics", 1, [{ type: "shipModule", id: "radioScanner" }], "Fits a Radio Scanner on every ship. No effect yet."),
			tech("pp1lr", "Laser Rifle", "particlePhysics", 1, [{ type: "troopWeapon", tags: ["Infantry"], n: 5 }, { type: "troopWeapon", tags: ["Air"], n: 20 }], "+5 troop strength for infantry, +20 for air. Weapons do not stack; use the best."),
			tech("pp2", "Deflector", "particlePhysics", 2, [{ type: "shield", n: 1 }], "Shields. Combat stub."),
			tech("pp3", "Beam Focus", "particlePhysics", 3, [{ type: "weapon", n: 1 }], "Harder beams. Combat stub."),
			tech("pp4", "Screen", "particlePhysics", 4, [{ type: "shield", n: 1 }], "Better shields. Combat stub."),
			tech("pp5", "Warhead", "particlePhysics", 5, [{ type: "weapon", n: 1 }], "Warheads. Combat stub."),
			tech("pp6", "Hard Shield", "particlePhysics", 6, [{ type: "shield", n: 2 }], "Heavy screens. Combat stub.")
		]
	};
}());
