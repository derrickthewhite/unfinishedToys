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
		const costs = [50, 100, 150, 200, 300, 500, 1000, 1500, 2000];
		return { id: id, name: name, categoryId: categoryId, tier: tier, cost: costs[tier], effects: effects, summary: summary || "" };
	}

	return {
		id: "scratch-empire",
		name: "Empire from scratch",
		startTechTier: 0,
		warpTechId: "wp0",
		foodPerPop: 1,
		starvationRatePercent: 10,
		shipTechCategories: ["warpPhysics", "reactors", "exoticMaterials", "particlePhysics"],
		growthRatePercent: 5,
		baseline: { speed: 2, range: 5 },
		transportScope: "empire",
		foodPerFreighter: 1,
		popMoveFreighterFactor: 5,
		troopMoveFreighterFactor: 1,
		combat: { model: "quick" },
		spaceCombat: {
			grid: { w: 120, h: 80 },
			speed: 10,
			missileSpeedMult: 2,
			fighterSpeedMult: 1.5,
			turnStepDeg: 15,
			turnCost: 2,
			attackSkill: 100,
			dodgeSkill: 50,
			missileSkill: 70,
			missileEvasion: 0,
			rangePenaltyPerSquare: 1,
			shieldRegenPct: 25,
			maxDesignsPerHull: 6,
			facings: ["front", "right", "back", "left"],
			nScalesExistingShips: true
		},
		ai: {
			threatHorizon: 5,
			otherWarCommit: 0.4,
			sharedWarCommit: 0.25,
			warAttitude: -25,
			warStrengthRatio: 1.05,
			peaceAttitude: 10,
			peaceStrengthRatio: 0.7,
			invadeStrengthRatio: 1.1
		},
		shipArt: {
			cruiser: [
				"assets/ships/Cruiser/cruiser-1.svg",
				"assets/ships/Cruiser/crusier-2.svg",
				"assets/ships/Cruiser/crusier-3.svg",
				"assets/ships/Cruiser/cruiser-4.svg",
				"assets/ships/Cruiser/cruiser-5.svg",
				"assets/ships/Cruiser/cruiser-6.svg",
				"assets/ships/Cruiser/cruiser-7.svg",
				"assets/ships/Cruiser/cruiser-8.svg"
			],
			defenseStation: [
				"assets/ships/Battleship/Battleship-1.svg",
				"assets/ships/Battleship/Battleship-2.svg",
				"assets/ships/Battleship/Battleship-3.svg"
			],
			missile: [
				"assets/ships/missile.svg"
			],
			scout: [
				"assets/ships/scout.svg"
			],
			colonyShip: [
				"assets/ships/colony.svg"
			],
			battleship: [
				"assets/ships/Battleship/Battleship-1.svg",
				"assets/ships/Battleship/Battleship-2.svg",
				"assets/ships/Battleship/Battleship-3.svg",
				"assets/ships/Battleship/Battleship-4.svg",
				"assets/ships/Battleship/Battleship-5.svg"
			]
		},
		spaceLoad: {
			lightCannon: { id: "lightCannon", name: "Laser Beam", kind: "beam", size: 10, range: 40, damage: [1, 5], requireTech: "pp0", summary: "Baseline optical beam. Long range." },
			particleBeam: {
				id: "particleBeam", name: "Rail Gun", kind: "beam", size: 20, range: 40, damage: [4, 14],
				damageFalloff: true, rangePenaltyMult: 1.25, requireTech: "ex1rg",
				summary: "Heavy slug thrower. Half damage beyond half range; +25% range accuracy penalty."
			},
			maserBeam: {
				id: "maserBeam", name: "Maser Beam", kind: "beam", size: 12, range: 38, damage: [3, 11],
				attackSkill: 20, requireTech: "pp1ms", summary: "Microwave laser. Very accurate."
			},
			ionBolt: { id: "ionBolt", name: "Ion Bolt", kind: "beam", size: 10, range: 15, damage: [2, 9], disable: true, requireTech: "pp2ib", summary: "Short ion burst. Disable (stub)." },
			massDriver: {
				id: "massDriver", name: "Mass Driver", kind: "beam", size: 24, range: 35, damage: [7, 18],
				damageFalloff: true, requireTech: "ex2md", summary: "Heavy kinetic launcher. Half damage beyond half range."
			},
			pulseArray: { id: "pulseArray", name: "Pulse Array", kind: "beam", size: 14, range: 22, damage: [4, 10], requireTech: "pp2pa", summary: "Rapid pulse fire." },
			gaussCannon: {
				id: "gaussCannon", name: "Gauss Cannon", kind: "beam", size: 11, range: 24, damage: [9, 20],
				damageFalloff: true, requireTech: "ex4gc", summary: "Magnetic accelerator. Half damage beyond half range."
			},
			plasmaBolts: { id: "plasmaBolts", name: "Plasma Bolts", kind: "beam", size: 13, range: 14, damage: [4, 11], burn: true, requireTech: "rx2pb", summary: "Short-range plasma. Burn (stub)." },
			phasers: { id: "phasers", name: "Phasers", kind: "beam", size: 15, range: 24, damage: [4, 12], requireTech: "pp3ph", summary: "Phaser banks." },
			focusedBeam: {
				id: "focusedBeam", name: "Focused Lance", kind: "beam", size: 16, range: 32, damage: [5, 16],
				damageFalloff: true, requireTech: "pp3fl", summary: "Long-range focused beam. Half damage beyond half range."
			},
			blasters: { id: "blasters", name: "Blasters", kind: "beam", size: 9, range: 12, damage: [5, 14], requireTech: "pp3bl", summary: "Close-range blaster turrets." },
			plasmaBeam: {
				id: "plasmaBeam", name: "Plasma Beam", kind: "beam", size: 18, range: 22, damage: [4, 10],
				armorDamageMult: 1.5, burn: true, requireTech: "rx3pb",
				summary: "+50% damage vs armor. Burn (stub). Medium accuracy."
			},
			destructors: { id: "destructors", name: "Destructors", kind: "beam", size: 16, range: 24, damage: [6, 16], requireTech: "pp4ds", summary: "Pure-energy destructor beam." },
			protonBeam: { id: "protonBeam", name: "Proton Beam", kind: "beam", size: 18, range: 30, damage: [5, 14], requireTech: "pp4pb", summary: "Long-range proton stream." },
			phaseCutter: {
				id: "phaseCutter", name: "Phase Cutter", kind: "beam", size: 18, range: 28, damage: [6, 18],
				phaseExploit: 0.2, requireTech: "pp4pc", summary: "Phase exploitation: +20% vs targets hit last turn."
			},
			graserBeam: {
				id: "graserBeam", name: "Graser Beam", kind: "beam", size: 16, range: 32, damage: [7, 17],
				splitArmorStructure: true, attackSkill: 8, requireTech: "pp5gr",
				summary: "Gamma laser. Splits damage between armor and structure. High accuracy."
			},
			neutronBeam: {
				id: "neutronBeam", name: "Neutron Beam", kind: "beam", size: 20, range: 30, damage: [7, 18],
				splitArmorStructure: true, requireTech: "pp5nb", summary: "Neutron radiation. Splits damage between armor and structure."
			},
			disintegrators: { id: "disintegrators", name: "Disintegrators", kind: "beam", size: 11, range: 14, damage: [7, 18], requireTech: "pp5di", summary: "Short-range disintegration beam." },
			fusionBeam: { id: "fusionBeam", name: "Fusion Beam", kind: "beam", size: 20, range: 26, damage: [8, 20], burn: true, requireTech: "rx6fb", summary: "Fusion plasma lance. Burn (stub)." },
			forceBolt: {
				id: "forceBolt", name: "Force Bolt", kind: "beam", size: 14, range: 16, damage: [4, 10],
				knockFacing: 30, requireTech: "pp6fb", summary: "Kinetic shock bolt. Random ±30° facing knock."
			},
			gravitonBeam: {
				id: "gravitonBeam", name: "Graviton Beam", kind: "beam", size: 22, range: 32, damage: [7, 18],
				ignoreShields: true, requireTech: "pp7gb", summary: "Graviton stream. Ignores shields."
			},
			gravityGun: {
				id: "gravityGun", name: "Gravity Gun", kind: "beam", size: 16, range: 14, damage: [6, 16],
				moveDebuff: 0.25, requireTech: "pp6gg", summary: "Gravitic shear. −25% move for one turn."
			},
			novaProjector: { id: "novaProjector", name: "Nova Projector", kind: "beam", size: 24, range: 36, damage: [10, 28], requireTech: "pp7nv", summary: "Top-tier particle projector." },
			antimatterBeam: {
				id: "antimatterBeam", name: "Anti-matter Beam", kind: "beam", size: 22, range: 28, damage: [9, 22],
				shieldDamageMult: 0.5, attackSkill: -10, requireTech: "pp8amb",
				summary: "Antimatter annihilation. Half damage to shields. Low accuracy."
			},
			gravitonLance: {
				id: "gravitonLance", name: "Graviton Lance", kind: "beam", size: 26, range: 34, damage: [8, 20],
				ignoreShields: true, requireTech: "pp8gl",
				summary: "Heavy graviton lance. Ignores shields. Medium accuracy."
			},
			mesonGun: {
				id: "mesonGun", name: "Meson Gun", kind: "beam", size: 20, range: 24, damage: [5, 14],
				ignoreArmor: true, attackSkill: -25, requireTech: "pp8mg",
				summary: "Meson decay. Bypasses armor. Low accuracy."
			},
			deflector: { id: "deflector", name: "Shield I", kind: "shield", size: 8, shieldPerFacing: 1, requireTech: "wp1sh", summary: "Light deflectors." },
			hardShield: { id: "hardShield", name: "Shield III", kind: "shield", size: 16, shieldPerFacing: 3, requireTech: "wp4sh", summary: "Hard shield lattice." },
			shieldV: { id: "shieldV", name: "Shield V", kind: "shield", size: 24, shieldPerFacing: 5, requireTech: "wp6sh", summary: "Capital-grade shield envelope." },
			shieldX: { id: "shieldX", name: "Shield X", kind: "shield", size: 40, shieldPerFacing: 10, requireTech: "wp8sh", summary: "Maximal warp-lattice shields." },
			chemicalLauncher: {
				id: "chemicalLauncher", name: "Chemical launcher", kind: "missileLauncher", ammoId: "ammoChemical",
				size: 6, range: 48, summary: "Chemical warhead tube. Needs chemical magazines. Missile speed is 2× ship combat speed."
			},
			ammoChemical: {
				id: "ammoChemical", name: "Chemical magazine", kind: "missileAmmo", size: 6, rounds: 3, damage: 12,
				launcherId: "chemicalLauncher", summary: "Chemical warhead magazines. 3 shots each."
			},
			fusionLauncher: {
				id: "fusionLauncher", name: "Fusion launcher", kind: "missileLauncher", ammoId: "ammoFusion",
				size: 6, range: 48, requireTech: "rx1wh",
				summary: "Fusion warhead tube. Needs fusion magazines."
			},
			ammoFusion: {
				id: "ammoFusion", name: "Fusion magazine", kind: "missileAmmo", size: 6, rounds: 4, damage: 20,
				launcherId: "fusionLauncher", requireTech: "rx1wh", summary: "Fusion warhead magazines. 4 shots each."
			},
			graviticLauncher: {
				id: "graviticLauncher", name: "Gravitic launcher", kind: "missileLauncher", ammoId: "ammoGravitic",
				size: 6, range: 48, requireTech: "rx3wh",
				summary: "Gravitic warhead tube. Needs gravitic magazines."
			},
			ammoGravitic: {
				id: "ammoGravitic", name: "Gravitic magazine", kind: "missileAmmo", size: 6, rounds: 2, damage: 55,
				launcherId: "graviticLauncher", requireTech: "rx3wh", summary: "Gravitic warhead magazines. 2 shots each."
			},
			antimatterLauncher: {
				id: "antimatterLauncher", name: "Antimatter launcher", kind: "missileLauncher", ammoId: "ammoAntimatter",
				size: 6, range: 48, requireTech: "rx5wh",
				summary: "Antimatter warhead tube. Needs antimatter magazines."
			},
			ammoAntimatter: {
				id: "ammoAntimatter", name: "Antimatter magazine", kind: "missileAmmo", size: 6, rounds: 3, damage: 35,
				launcherId: "antimatterLauncher", requireTech: "rx5wh", summary: "Antimatter warhead magazines. 3 shots each."
			},
			conversionLauncher: {
				id: "conversionLauncher", name: "Conversion launcher", kind: "missileLauncher", ammoId: "ammoConversion",
				size: 6, range: 48, requireTech: "rx6wh",
				summary: "Conversion warhead tube. Needs conversion magazines."
			},
			ammoConversion: {
				id: "ammoConversion", name: "Conversion magazine", kind: "missileAmmo", size: 6, rounds: 2, damage: 70,
				launcherId: "conversionLauncher", requireTech: "rx6wh", summary: "Conversion warhead magazines. 2 shots each."
			},
			muonTorpedo: {
				id: "muonTorpedo", name: "Muon torpedo", kind: "missileLauncher", size: 6, range: 48,
				builtInDamage: 12, unlimitedAmmo: true, requireTech: "rx4mt",
				summary: "Slow guided muon torpedo launcher. Unlimited shots."
			},
			fighterBay: { id: "fighterBay", name: "Fighter bay", kind: "fighter", size: 20, fighterBeam: [1, 3], fighterRange: 12, fighterStructure: 20, requireTech: "ro4", summary: "Fighters move at 1.5× parent ship combat speed." },
			interceptorBay: { id: "interceptorBay", name: "Interceptor bay", kind: "fighter", size: 16, fighterBeam: [1, 4], fighterRange: 14, fighterStructure: 16, fighterSpeedMult: 1.6, requireTech: "wp2fi", summary: "Fast escort fighters." },
			strikeBay: { id: "strikeBay", name: "Strike bay", kind: "fighter", size: 20, fighterBeam: [2, 6], fighterRange: 16, fighterStructure: 22, requireTech: "wp4fi", summary: "Strike craft with harder guns." },
			assaultBay: { id: "assaultBay", name: "Assault bay", kind: "fighter", size: 24, fighterBeam: [3, 8], fighterRange: 18, fighterStructure: 28, fighterSpeedMult: 1.4, requireTech: "wp6fi", summary: "Heavy assault fighters." },
			autoRepair: { id: "autoRepair", name: "Auto repair", kind: "device", size: 8, stub: true, requireTech: "ro1ar" },
			radioScanner: { id: "radioScanner", name: "Radio scanner", kind: "device", size: 6, stub: true, attackSkill: 5, requireTech: "pp1" }
		},
		loyalty: {
			base: 80,
			cultureBonus: 20,
			foodPenalty: 10,
			starveMemoryPenalty: 10,
			policePenalty: 10,
			popsPerPolice: 5,
			conquestPenalty: -40,
			revoltConquestPenalty: -20,
			conquestHealEvery: 1,
			policeProductionPenalty: 0.1
		},
		revolt: {
			rebelTroopDefId: "militia",
			inciteCostPerPop: 5,
			politicalUnrestChance: 100
		},
		planetColors: {
			natives: { label: "Natives", popCount: 3 },
			rareMine: { label: "Rare resource mine", moneyPerTurn: 10 },
			wildlife: { label: "Dangerous wildlife", attackChance: 0.1, predatorDefId: "predator" },
			ruins: { label: "Ancient ruins", researchPerScientist: 1 },
			spaceMonster: { label: "Space monster lair", placeholder: true }
		},
		messages: {
			noWarpDrive: "You have not researched {warpDrive}, you are stuck in your system!",
			diplomacyWelcome: {
				hostile: [
					"{name} grudgingly opens a channel. Speak carefully — they are in no mood for pleasantries.",
					"The {culture} court of {name} demands formal recognition before any deal is discussed.",
					"{name} acknowledges your ships in range. Negotiations are permitted, not welcomed.",
					"A cold transmission from {name}: they will hear you out, but trust is not on offer."
				],
				cool: [
					"{name} agrees to limited dialogue. Expect little warmth from the {culture} delegation.",
					"A terse message from {name}: proposals may be submitted, but patience is thin.",
					"{name} opens negotiations with guarded courtesy.",
					"The {culture} envoys from {name} will talk — on their terms."
				],
				neutral: [
					"{name} welcomes you to the diplomatic table with measured courtesy.",
					"The {culture} envoy from {name} opens negotiations on neutral terms.",
					"{name} signals readiness to discuss trade, treaties, and borders.",
					"A formal greeting from {name}: let us see whether our interests align."
				],
				warm: [
					"{name} greets you warmly and hopes for fruitful talks.",
					"The {culture} delegation from {name} speaks of shared prosperity.",
					"{name} is pleased to open channels and eager to explore cooperation.",
					"Good news from {name}: their court views this meeting as a promising start."
				],
				friendly: [
					"{name} enthusiastically welcomes an alliance of minds with your empire.",
					"The {culture} people of {name} celebrate this day of friendship and open trade.",
					"{name} hails you as a valued partner and invites bold proposals.",
					"A joyous message from {name}: may our negotiations strengthen both our peoples."
				]
			},
			diplomacyReturn: {
				hostile: [
					"{name} reluctantly restores communications.",
					"Channels with {name} are open again — do not mistake that for trust.",
					"{name} is back in range. The {culture} court watches every word."
				],
				cool: [
					"{name} is in contact again, still wary.",
					"Negotiations with {name} resume under a cool silence.",
					"The {culture} envoys from {name} acknowledge your signal."
				],
				neutral: [
					"{name} is in contact again and ready to talk.",
					"Communications with {name} have been re-established.",
					"{name} welcomes renewed dialogue."
				],
				warm: [
					"{name} is glad to be in touch again.",
					"The {culture} court of {name} greets your return to the channel.",
					"{name} looks forward to picking up where you left off."
				],
				friendly: [
					"{name} celebrates your return to the negotiating table.",
					"Old friends at {name} are delighted to speak with you again.",
					"{name} sends warm regards and an open hand."
				]
			}
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
			const nehudiFarm = {
				type: "jobYield", jobs: ["agriculture", "greenhouse"], n: 1,
				biomes: ["desert", "tundra", "swamp", "ocean", "arid"]
			};
			function c(id, name, art, effects, blurb) {
				return { id: id, name: name, art: "assets/species/" + art, effects: effects || [], blurb: blurb || "" };
			}
			return [
				c("cat", "Cat", "Cat (Jaguar).svg", [
					{ type: "loyalty", n: -10 },
					{ type: "troopTsPct", pct: 20 },
					{ type: "shipBonus", stub: true }
				], "Proud felinoid clans who prize independence and keen senses. Territory and reputation matter more than grand alliances."),
				c("centurion", "Centurion", "Centurion.svg", [
					{ type: "jobYield", job: "industry", n: 1 },
					{ type: "troopTsPct", pct: 10 }
				], "Disciplined soldiers forged in long campaigns. They respect strength, order, and clear chains of command."),
				c("crabbit", "Crabbit", "Crabbit.svg", [
					wetFarm,
					{ type: "troopTsPct", pct: 10 }
				], "Armored crab-folk who burrow into damp soils. Wet worlds feed their colonies unusually well."),
				c("gaunt", "Gaunt", "Gaunt.svg", [
					{ type: "troopTsPct", pct: 30 },
					{ type: "negotiation", pct: -10 },
					{ type: "spySkill", n: -10 },
					{ type: "loyalty", n: -30 },
					{ type: "starvationMult", mult: 0.5 }
				], "Gaunt warriors built for hardship and combat. Their troops hit harder than most empires expect, but their people chafe under rule and endure famine longer than most."),
				c("greenBug", "Keverling", "Green Bug D.svg", [
					{ type: "growthBase", n: 10 },
					{ type: "loyalty", n: 10 },
					{ type: "spySkill", n: -10 }
				], "Hive-minded insects with fierce colony loyalty. Populations swell quickly when food is steady."),
				c("human", "Human", "Human A27.svg", [{ type: "negotiation", pct: 25 }], "Adaptable diplomats who trade, talk, and compromise before they fight. Their envoys build goodwill that lasts."),
				c("hmmm", "Hmmm", "hmmm A.svg", [
					{ type: "jobYield", job: "research", n: 1 },
					{ type: "loyalty", n: 10 },
					{ type: "spySkill", n: -10 }
				], "Quiet thinkers who ask uncomfortable questions. Research comes naturally; their calm crews rarely cause trouble."),
				c("karkadann", "Karkadann", "Karkadann D.svg", [
					{ type: "jobYield", job: "industry", n: 2 },
					{ type: "negotiation", pct: -10 }
				], "Heavy industrialists with a knack for manufactories. One more ingot per worker is never enough."),
				c("keleni", "Keleni", "Keleni C.svg", [
					wetFarm,
					{ type: "loyalty", n: 10 },
					{ type: "negotiation", pct: 25 },
					{ type: "troopTsPct", pct: -20 },
					{ type: "spySkill", n: -10 }
				], "Amphibious negotiators at ease on wet worlds and at treaty tables alike. Natural pacifists with loyal communities and skilled envoys."),
				c("krouta", "Krouta", "Krouta C.svg", [{ type: "troopTsPct", pct: 30 }], "Hyena clans with a martial culture. Peace is temporary; strength is remembered."),
				c("loroko", "Loroko", "Loroko A.svg", [
					{ type: "troopTsPct", pct: 20 },
					{ type: "troopArmorPct", pct: 15 },
					{ type: "loyalty", n: 5 }
				], "A deeply militarized people forged for campaigns. Pain barely slows them; discipline and force are their native language."),
				c("mogwai", "Mogwai", "Mogwai B.svg", [
					{ type: "jobYield", job: "research", n: 1 },
					{ type: "firstBuildDiscount", stub: true }
				], "Curious scholars with soft fur and sharp minds. Laboratories flourish wherever they settle."),
				c("nehudi", "Nehudi", "Nehudi D.svg", [
					{ type: "troopTsPct", pct: 20 },
					nehudiFarm,
					{ type: "jobYield", job: "research", n: -1 }
				], "Stoic desert dwellers at home with harsh nature. They coax extra harvests from arid, desert, and wetland soils, but their scientists lag behind."),
				c("ranathim", "Ranathim", "Ranathim B.svg", [
					{ type: "troopTsPct", pct: 20 },
					{ type: "loyalty", n: -10 },
					{ type: "spySkill", n: 5 },
					{ type: "negotiation", pct: 10 }
				], "Horned people driven by passion. Strong in battle, quick to chafe under foreign rule, but easy to win over at the negotiating table."),
				c("snake", "Snake", "Snake (Black).svg", [
					{ type: "spySkill", n: 10 },
					{ type: "jobYield", job: "research", n: 1 },
					{ type: "loyalty", n: -10 },
					{ type: "negotiation", pct: -25 }
				], "Coiled and patient predators who watch more than they speak. They strike when the moment is right."),
				c("squidling", "Squidling", "Squidling.svg", [
					wetFarm,
					{ type: "researchPerTaggedTech", tag: "ship", n: 1 },
					{ type: "squidlingBonus", stub: true }
				], "Aquatic cephalopods who farm the deeps. Ocean and swamp colonies are their breadbasket. +1 research while researching ship tech."),
				c("temkor", "Temkor", "Temkor (Red).svg", [
					wetFarm,
					{ type: "loyalty", n: -10 },
					{ type: "moneyMult", mult: 1.25 },
					{ type: "spySkill", n: 10 }
				], "Fiery temperaments and long memories of slight. Dissent spreads easily, but their rivers run with coin."),
				c("trader", "Trader", "Trader B.svg", [
					{ type: "moneyMult", mult: 1.5 },
					{ type: "spySkill", n: 5 },
					{ type: "loyalty", n: 5 }
				], "Merchants without a fixed homeworld tradition — profit is culture. Every working hand earns more coin.")
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
				forbidKinds: ["asteroidBelt", "gasGiant"],
				effects: [{ type: "jobSlots", job: "greenhouse", n: 1 }, { type: "capDelta", cap: "agri", n: -1 }],
				summary: "Sealed farm. Converts one agriculture slot into a Greenhouse job that makes 3 food, including on barren and toxic worlds."
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
				cost: { industry: 100 }, upkeep: 2, requireTech: "ex0sc", unique: true,
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
				cost: { industry: 50 }, upkeep: 1, requireTech: "ex3cs", unique: true,
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
			police: { id: "police", name: "Police", kind: "troop", cost: { industry: 10 }, upkeep: 1, ts: 15, tags: ["Infantry", "Police"], glyph: { asset: "assets/troops/police.svg" }, summary: "Local security. Stations at this world. 1 freighter to move. Combat later." },
			militia: { id: "militia", name: "Militia", kind: "troop", cost: { industry: 10 }, upkeep: 0.2, ts: 20, tags: ["Infantry", "Defensive"], glyph: { asset: "assets/troops/militia.svg" }, summary: "Cheap garrison. Stations at this world. Cannot invade. 1 freighter to move." },
			predator: { id: "predator", name: "Predators", kind: "troop", npc: true, cost: { industry: 0 }, upkeep: 0, ts: 15, tags: ["Infantry", "Wildlife"], glyph: { asset: "assets/troops/predator.svg" }, summary: "Dangerous wildlife. Not buildable." },
			infantry: { id: "infantry", name: "Infantry", kind: "troop", cost: { industry: 20 }, upkeep: 1, ts: 50, tags: ["Infantry"], glyph: { asset: "assets/troops/infantry.svg" }, summary: "Line infantry. Stations at this world. 1 freighter to move. Combat later." },
			elites: { id: "elites", name: "Elites", kind: "troop", cost: { industry: 40 }, upkeep: 2, ts: 120, tags: ["Infantry"], glyph: { asset: "assets/troops/elites.svg" }, summary: "Heavy infantry. Stations at this world. 1 freighter to move. Combat later." },
			armor: { id: "armor", name: "Armor", kind: "troop", cost: { industry: 20 }, upkeep: 1, ts: 50, tags: ["Armor"], glyph: { asset: "assets/troops/armor.svg" }, summary: "Ground armor. Stations at this world. 1 freighter to move. Combat later." },
			mechs: { id: "mechs", name: "Mechs", kind: "troop", cost: { industry: 40 }, upkeep: 2, ts: 120, tags: ["Armor"], requireTech: "rx2mh", glyph: { asset: "assets/troops/mechs.svg" }, summary: "Heavy walkers. Stations at this world. 1 freighter to move. Troop strength 120, Armor." },
			air: { id: "air", name: "Air", kind: "troop", cost: { industry: 100 }, upkeep: 4, ts: 100, tags: ["Air"], glyph: { asset: "assets/troops/air.svg" }, summary: "Air wing. Stations at this world. 1 freighter to move. Combat later." },
			spaceFreighter: {
				id: "spaceFreighter", name: "Space freighters (×5)", kind: "abstract",
				cost: { industry: 25 }, requireTech: "rx0ip",
				effects: [{ type: "grantFreighters", n: 5 }],
				summary: "Adds five hulls to the empire freighter pool. Each hull hauls 1 food. Five hulls move one person. One hull moves one ground unit. 1 money if any hulls haul food, people, or troops this turn."
			},
			scout: {
				id: "scout", name: "Scout", kind: "unit",
				cost: { industry: 25 }, upkeep: 1, requireTech: "rx0ip", requireStructure: "spaceDock",
				summary: "Cheap hull. Any ship reveals a system on arrival; this is the early survey option. Needs a Space Dock. Needs Warp Drive to leave this star. Unarmed."
			},
			colonyShip: {
				id: "colonyShip", name: "Colony ship", kind: "unit",
				cost: { industry: 100 }, upkeep: 4, requireTech: "bi0ce", requireStructure: "spaceDock",
				effects: [{ type: "foundSettlement" }],
				summary: "Founds a new settlement on a legal empty world. Needs Contained Ecology, a Space Dock, and Warp Drive to leave this star. Unarmed."
			},
			cruiser: {
				id: "cruiser", name: "Cruiser", kind: "unit",
				cost: { industry: 200 }, upkeep: 4, requireStructure: "spaceDock",
				combat: { base: 2 },
				summary: "Combat hull. Load 100. Needs a Space Dock. Outfit it on the Designs screen."
			},
			battleship: {
				id: "battleship", name: "Battleship", kind: "unit",
				cost: { industry: 400 }, upkeep: 8, requireStructure: "spaceDock",
				combat: { base: 4 },
				summary: "Heavy combat hull. Load 200. Needs a Space Dock. Outfit it on the Designs screen."
			},
			defenseStation: {
				id: "defenseStation", name: "Defense station", kind: "unit",
				cost: { industry: 100 }, upkeep: 2, requireStructure: "spaceDock",
				combat: { base: 3 }, station: true, immobile: true,
				summary: "Orbital defense platform. Load 150. Cheap for its firepower, but bound to the world that built it. Immobile in combat."
			},
			shipRefit: {
				id: "shipRefit", name: "Retrofit", kind: "refit",
				cost: { industry: 0 }, requireStructure: "spaceDock",
				summary: "Dock a ship here to apply a design (¼ new-build cost) or scrap it for its built value. Scouts and colony ships can be scrapped."
			}
		},
		governmentTypes: [
			"Republic", "Union", "Hegemony", "Empire", "Kingdom", "Nation",
			"Dominion", "Holdings", "Realm", "Supremacy", "Alliance", "Confederacy",
			"Federation", "Commonwealth", "Protectorate", "Consortium", "Coalition",
			"Collective", "Imperium", "Syndicate"
		],
		homeworldStars: {
			human: ["Terra", "Alexia", "Maradon"],
			mogwai: ["Momoa", "Altair", "Stanis", "Grist"],
			ranathim: ["Styx", "Sarai", "Rath"],
			keleni: ["Anmarwi", "Temjara", "Samsara"],
			nehudi: ["Nehud", "Sylvana"],
			temkor: ["Wyrmwood", "Mirehold"],
			trader: ["Nexus", "Jubilee"],
			loroko: ["Tyria", "Kantha"],
			cat: ["Felidae", "Mau"],
			centurion: ["Principia", "Castellum"],
			crabbit: ["Warren", "Burrow"],
			gaunt: ["Ashfall", "Hollow"],
			greenBug: ["Verdant", "Chitin"],
			hmmm: ["Enigma", "Quorum"],
			karkadann: ["Rhinara", "Hornwall"],
			krouta: ["Breaker", "Rook"],
			snake: ["Naga", "Ophidian"],
			squidling: ["Abyssos", "Pelagia"]
		},
		categories: [
			{ id: "warpPhysics", name: "Warp Physics", tags: ["ship"] },
			{ id: "reactors", name: "Reactors", tags: ["ship", "industry"] },
			{ id: "sociology", name: "Sociology", tags: ["research", "groundCombat"] },
			{ id: "biology", name: "Biology", tags: ["research", "groundCombat"] },
			{ id: "exoticMaterials", name: "Exotic Materials", tags: ["ship", "industry"] },
			{ id: "robotics", name: "Machines", tags: ["industry", "ship"] },
			{ id: "particlePhysics", name: "Particle Physics", tags: ["ship", "groundCombat"] }
		],
		techs: [
			tech("wp0", "Warp Drive", "warpPhysics", 0, [{ type: "warpDrive" }], "Ships may leave their star and travel the galaxy."),
			tech("wp1", "Vector Thrust", "warpPhysics", 1, [{ type: "speed", n: 1 }], "Sharper drive geometry. All ships move 1 hex farther each turn."),
			tech("wp1ad", "Afterdrive", "warpPhysics", 1, [{ type: "combatSpeed", n: 2 }], "Combat speed +2 squares. Does not change map speed."),
			tech("wp1sh", "Shield I", "warpPhysics", 1, [{ type: "unlockLoad", id: "deflector" }], "Unlocks Shield I deflectors for ship designs."),
			tech("wp2", "Tightbeam", "warpPhysics", 2, [{ type: "commsRange", n: 3 }], "Focused comms. Contact range is ship range plus 3."),
			tech("wp2ag", "Artificial Gravity", "warpPhysics", 2, [{ type: "unlockSettle", kind: "asteroidBelt" }], "Spin habitats. Colony ships can found settlements on asteroid belts."),
			tech("wp2fi", "Interceptors", "warpPhysics", 2, [
				{ type: "unlockLoad", id: "interceptorBay" },
				{ type: "fighterRange", n: 2 }
			], "Unlocks interceptor bays. All fighters gain +2 range."),
			tech("wp3", "Star Drive", "warpPhysics", 3, [{ type: "speed", n: 1 }], "Another speed step. Ships close distance faster."),
			tech("wp3sd", "Survey Dish", "warpPhysics", 3, [{ type: "unlockBuild", id: "surveyDish" }], "Unlocks Survey Dish: unique 400-industry building, upkeep 2. Reveals every planet and ship. Extra dishes on other worlds are backups."),
			tech("wp4", "Ansible", "warpPhysics", 4, [{ type: "commsRange", n: 5 }], "Instant signaling. Contact range is ship range plus 5."),
			tech("wp4sh", "Shield III", "warpPhysics", 4, [{ type: "unlockLoad", id: "hardShield" }], "Unlocks Shield III hard shields."),
			tech("wp4fi", "Strike Craft", "warpPhysics", 4, [
				{ type: "unlockLoad", id: "strikeBay" },
				{ type: "fighterDamage", n: 1 }
			], "Unlocks strike bays. All fighters gain +1 weapon damage."),
			tech("wp5", "High Warp", "warpPhysics", 5, [{ type: "speed", n: 1 }], "Cruise speed up again."),
			tech("wp6", "Warp Spine", "warpPhysics", 6, [{ type: "speed", n: 2 }], "Late-game engines. +2 speed."),
			tech("wp6sh", "Shield V", "warpPhysics", 6, [{ type: "unlockLoad", id: "shieldV" }], "Unlocks Shield V shield envelopes."),
			tech("wp6fi", "Assault Wings", "warpPhysics", 6, [
				{ type: "unlockLoad", id: "assaultBay" },
				{ type: "fighterStructure", n: 8 }
			], "Unlocks assault bays. All fighters gain +8 structure."),
			tech("wp7", "Warp Conduit", "warpPhysics", 7, [{ type: "stub", n: 1 }], "Placeholder tier-7 warp tech."),
			tech("wp8sh", "Shield X", "warpPhysics", 8, [{ type: "unlockLoad", id: "shieldX" }], "Unlocks Shield X maximal warp-lattice shields."),
			tech("rx0ip", "Interplanetary Movement", "reactors", 0, [{ type: "unlockBuild", id: "spaceFreighter" }, { type: "unlockBuild", id: "scout" }], "In-system hulls. Unlocks freighter fleets and the Scout hull. Colony ships come from Contained Ecology. A Space Dock is still required to build ships."),
			tech("rx1", "Extended Coils", "reactors", 1, [{ type: "range", n: 2 }], "Ships may operate 2 hexes farther from a friendly colony."),
			tech("rx1cr", "Community Reactors", "reactors", 1, [{ type: "unlockBuild", id: "communityReactor" }], "Shared power. Unlocks Community Reactors: each building gives +1 industry to 5 Industry workers."),
			tech("rx1wh", "Fusion Warheads", "reactors", 1, [
				{ type: "unlockLoad", id: "fusionLauncher" },
				{ type: "unlockLoad", id: "ammoFusion" }
			], "Unlocks fusion launchers and magazines. Chemical launchers are free without this tech."),
			tech("rx2mh", "Mechs", "reactors", 2, [{ type: "unlockBuild", id: "mechs" }], "Unlocks Mechs: ground unit, 40 industry, upkeep 2, troop strength 120, Armor."),
			tech("rx2nt", "Nuclear Transmutation", "reactors", 2, [{ type: "unlockBuild", id: "transmuter" }], "Unlocks the Transmuter: unique 500-industry building, upkeep 2. Industry workers produce +2 industry on very rich worlds, +1 on rich worlds."),
			tech("rx2pb", "Plasma Bolts", "reactors", 2, [{ type: "unlockLoad", id: "plasmaBolts" }], "Unlocks plasma bolt ship weapons."),
			tech("rx3", "Deep Envelope", "reactors", 3, [{ type: "range", n: 3 }], "Operational range +3 from friendly stars."),
			tech("rx3wh", "Gravitic Warheads", "reactors", 3, [
				{ type: "unlockLoad", id: "graviticLauncher" },
				{ type: "unlockLoad", id: "ammoGravitic" }
			], "Unlocks gravitic launchers and magazines."),
			tech("rx4mt", "Muon Torpedoes", "reactors", 4, [{ type: "unlockLoad", id: "muonTorpedo" }], "Unlocks muon torpedo launchers with unlimited shots."),
			tech("rx3pb", "Plasma Beam", "reactors", 3, [{ type: "unlockLoad", id: "plasmaBeam" }], "Unlocks the plasma beam ship weapon."),
			tech("rx4", "Heavy Frame", "reactors", 4, [{ type: "structure", n: 1 }], "Ship structure +1 quality step. Does not raise hull quality N or scale shields/armor."),
			tech("rx4mr", "Miniaturized Reactors", "reactors", 4, [
				{ type: "speed", n: 1 },
				{ type: "structure", n: 4 },
				{ type: "fighterDamage", n: 1 }
			], "+1 map speed, +4 structure quality steps, and +1 fighter weapon damage."),
			tech("rx5", "Core Tap", "reactors", 5, [{ type: "industryPerPop", n: 1 }], "Industry workers produce +1 more."),
			tech("rx5wh", "Antimatter Warheads", "reactors", 5, [
				{ type: "unlockLoad", id: "antimatterLauncher" },
				{ type: "unlockLoad", id: "ammoAntimatter" }
			], "Unlocks antimatter launchers and magazines."),
			tech("rx6", "Far Reach", "reactors", 6, [{ type: "range", n: 5 }], "Long legs. Range +5."),
			tech("rx6fb", "Fusion Beam", "reactors", 6, [{ type: "unlockLoad", id: "fusionBeam" }], "Unlocks the fusion beam ship weapon."),
			tech("rx6wh", "Conversion Warheads", "reactors", 6, [
				{ type: "unlockLoad", id: "conversionLauncher" },
				{ type: "unlockLoad", id: "ammoConversion" }
			], "Unlocks conversion launchers and magazines."),
			tech("rx7", "Stellar Tap", "reactors", 7, [{ type: "stub", n: 1 }], "Placeholder tier-7 reactor tech."),
			tech("rx8", "Zero-Point Core", "reactors", 8, [{ type: "stub", n: 1 }], "Placeholder tier-8 reactor tech."),
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
			tech("so7", "Grand Consensus", "sociology", 7, [{ type: "stub", n: 1 }], "Placeholder tier-7 sociology tech."),
			tech("so8", "Pan-Culture", "sociology", 8, [{ type: "stub", n: 1 }], "Placeholder tier-8 sociology tech."),
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
			tech("bi7", "Xeno-Adaptation", "biology", 7, [{ type: "stub", n: 1 }], "Placeholder tier-7 biology tech."),
			tech("bi8", "Terraform Mastery", "biology", 8, [{ type: "stub", n: 1 }], "Placeholder tier-8 biology tech."),
			tech("ex0sc", "Space Construction", "exoticMaterials", 0, [{ type: "unlockBuild", id: "spaceDock" }], "Unlocks the Space Dock. No ships can be built at a settlement until one stands there."),
			tech("ex1ba", "Body Armor", "exoticMaterials", 1, [{ type: "troopArmorPct", pct: 20 }], "+20% troop strength. Instant; no building."),
			tech("ex1ap", "Armor Lattice", "exoticMaterials", 1, [{ type: "armor", n: 1 }], "Ship armor +1 quality step."),
			tech("ex1rg", "Rail Gun", "exoticMaterials", 1, [{ type: "unlockLoad", id: "particleBeam" }], "Unlocks the rail gun for ship designs."),
			tech("ex2hl", "Heavy Laboratory", "exoticMaterials", 2, [{ type: "unlockBuild", id: "heavyLaboratory" }], "Unlocks Heavy Laboratory: each building gives +2 research to two scientists."),
			tech("ex2st", "Hull Framing", "exoticMaterials", 2, [{ type: "structure", n: 1 }], "Ship structure +1 quality step."),
			tech("ex2md", "Mass Driver", "exoticMaterials", 2, [{ type: "unlockLoad", id: "massDriver" }], "Unlocks the mass driver ship weapon."),
			tech("ex3", "Armor Plate", "exoticMaterials", 3, [{ type: "armor", n: 1 }], "Ship armor +1 quality step (armor HP)."),
			tech("ex3cs", "Mass Carbon Synthesis", "exoticMaterials", 3, [{ type: "unlockBuild", id: "carbonSynth" }], "Unlocks the Carbon synthesizer. Poor or very poor agri worlds: unique building, −1 agri slot, +1 industry per Industry worker."),
			tech("ex3se", "Space Elevator", "exoticMaterials", 3, [{ type: "unlockBuild", id: "spaceElevator" }], "Unlocks the Space Elevator. Unique. Ships built on that world cost 25% less."),
			tech("ex4sc", "Superconductors", "exoticMaterials", 4, [{ type: "range", n: 1 }], "Low-loss power. Ships operate 1 hex farther from friendly colonies."),
			tech("ex4gc", "Gauss Cannon", "exoticMaterials", 4, [{ type: "unlockLoad", id: "gaussCannon" }], "Unlocks the gauss cannon ship weapon."),
			tech("ex4st", "Reinforced Keels", "exoticMaterials", 4, [{ type: "structure", n: 1 }], "Ship structure +1 quality step."),
			tech("ex5sa", "Superalloys", "exoticMaterials", 5, [{ type: "industryPerPop", n: 1 }], "Industry workers produce +1 industry."),
			tech("ex5", "Lab Lattice", "exoticMaterials", 5, [{ type: "researchPerPop", n: 1 }], "Scientists produce +1 research."),
			tech("ex5ap", "Composite Armor", "exoticMaterials", 5, [{ type: "armor", n: 1 }], "Ship armor +1 quality step."),
			tech("ex6", "Unobtainium", "exoticMaterials", 6, [{ type: "industryPerPop", n: 1 }], "+1 industry per industry worker. Does not raise hull quality N."),
			tech("ex6st", "Monostructure", "exoticMaterials", 6, [{ type: "structure", n: 1 }], "Ship structure +1 quality step."),
			tech("ex7", "Exotic Lattice", "exoticMaterials", 7, [{ type: "stub", n: 1 }], "Placeholder tier-7 exotic materials tech."),
			tech("ex8", "Hyperdense Matter", "exoticMaterials", 8, [{ type: "stub", n: 1 }], "Placeholder tier-8 exotic materials tech."),
			tech("ro0rf", "Robo Factories", "robotics", 0, [{ type: "unlockBuild", id: "roboticFactory" }], "Automated shops. Unlocks the Robotic factory: each building gives +2 industry to one Industry worker."),
			tech("ro1at", "Auto-transport", "robotics", 1, [{ type: "unlockBuild", id: "autoTransport" }], "Unlocks Auto-transport network: unique 100-industry building, upkeep 2. Each Industry worker on that world produces +1 industry."),
			tech("ro1ar", "Auto Repair", "robotics", 1, [{ type: "unlockLoad", id: "autoRepair" }], "Unlocks Auto Repair as a ship device. Effect still a stub."),
			tech("ro2", "Servo Drill", "robotics", 2, [{ type: "unitBonus", n: 1 }], "Unit bonus. Not wired yet."),
			tech("ro3", "Auto-lathe", "robotics", 3, [{ type: "industryPerPop", n: 1 }], "Industry workers produce +1 industry."),
			tech("ro4", "Chassis", "robotics", 4, [{ type: "unlockLoad", id: "fighterBay" }], "Unlocks fighter bays. Fighters launch as tokens in space combat."),
			tech("ro5", "Auto-lathe II", "robotics", 5, [{ type: "industryPerPop", n: 1 }], "Industry workers produce +1 industry."),
			tech("ro6", "Von Neumann", "robotics", 6, [{ type: "industryPerPop", n: 2 }], "Industry workers produce +2 industry."),
			tech("ro7", "Autonomous Foundry", "robotics", 7, [{ type: "stub", n: 1 }], "Placeholder tier-7 robotics tech."),
			tech("ro8", "Self-Replicating Drones", "robotics", 8, [{ type: "stub", n: 1 }], "Placeholder tier-8 robotics tech."),
			tech("pp0", "Laser Optics", "particlePhysics", 0, [{ type: "unlockLoad", id: "lightCannon" }], "Unlocks the laser beam for ship designs."),
			tech("pp1", "Radio Scanner", "particlePhysics", 1, [{ type: "unlockLoad", id: "radioScanner" }], "Unlocks a targeting scanner device (attack skill stub until fitted)."),
			tech("pp1ms", "Maser Beam", "particlePhysics", 1, [{ type: "unlockLoad", id: "maserBeam" }], "Unlocks the maser beam ship weapon."),
			tech("pp1lr", "Laser Rifle", "particlePhysics", 1, [{ type: "troopWeapon", tags: ["Infantry"], n: 5 }, { type: "troopWeapon", tags: ["Air"], n: 20 }], "+5 troop strength for infantry, +20 for air. Weapons do not stack; use the best."),
			tech("pp2pa", "Pulse Array", "particlePhysics", 2, [{ type: "unlockLoad", id: "pulseArray" }], "Unlocks the pulse array ship weapon."),
			tech("pp2ib", "Ion Bolt", "particlePhysics", 2, [{ type: "unlockLoad", id: "ionBolt" }], "Unlocks the ion bolt ship weapon."),
			tech("pp3fl", "Focused Lance", "particlePhysics", 3, [{ type: "unlockLoad", id: "focusedBeam" }], "Unlocks the focused lance."),
			tech("pp3ph", "Phasers", "particlePhysics", 3, [{ type: "unlockLoad", id: "phasers" }], "Unlocks phaser banks."),
			tech("pp3bl", "Blasters", "particlePhysics", 3, [{ type: "unlockLoad", id: "blasters" }], "Unlocks blaster turrets."),
			tech("pp4ds", "Destructors", "particlePhysics", 4, [{ type: "unlockLoad", id: "destructors" }], "Unlocks destructor beams."),
			tech("pp4pb", "Proton Beam", "particlePhysics", 4, [{ type: "unlockLoad", id: "protonBeam" }], "Unlocks the proton beam."),
			tech("pp4pc", "Phase Cutter", "particlePhysics", 4, [{ type: "unlockLoad", id: "phaseCutter" }], "Unlocks the phase cutter ship weapon."),
			tech("pp5gr", "Graser Beam", "particlePhysics", 5, [{ type: "unlockLoad", id: "graserBeam" }], "Unlocks the graser beam."),
			tech("pp5nb", "Neutron Beam", "particlePhysics", 5, [{ type: "unlockLoad", id: "neutronBeam" }], "Unlocks the neutron beam."),
			tech("pp5di", "Disintegrators", "particlePhysics", 5, [{ type: "unlockLoad", id: "disintegrators" }], "Unlocks disintegrator beams."),
			tech("pp6fb", "Force Bolt", "particlePhysics", 6, [{ type: "unlockLoad", id: "forceBolt" }], "Unlocks the force bolt ship weapon."),
			tech("pp6gg", "Gravity Gun", "particlePhysics", 6, [{ type: "unlockLoad", id: "gravityGun" }], "Unlocks the gravity gun ship weapon."),
			tech("pp7gb", "Graviton Beam", "particlePhysics", 7, [{ type: "unlockLoad", id: "gravitonBeam" }], "Unlocks the graviton beam ship weapon."),
			tech("pp7nv", "Nova Projector", "particlePhysics", 7, [{ type: "unlockLoad", id: "novaProjector" }], "Unlocks the nova projector ship weapon."),
			tech("pp8amb", "Anti-matter Beam", "particlePhysics", 8, [{ type: "unlockLoad", id: "antimatterBeam" }], "Unlocks the anti-matter beam ship weapon."),
			tech("pp8gl", "Graviton Lance", "particlePhysics", 8, [{ type: "unlockLoad", id: "gravitonLance" }], "Unlocks the graviton lance ship weapon."),
			tech("pp8mg", "Meson Gun", "particlePhysics", 8, [{ type: "unlockLoad", id: "mesonGun" }], "Unlocks the meson gun ship weapon.")
		]
	};
}());
