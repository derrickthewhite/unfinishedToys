var DE = DE || {};

DE.SYMBOLS = [
	"assets/symbols/symbol-01.svg",
	"assets/symbols/symbol-02.svg",
	"assets/symbols/symbol-03.svg",
	"assets/symbols/symbol-04.svg",
	"assets/symbols/symbol-05.svg",
	"assets/symbols/symbol-06.svg",
	"assets/symbols/symbol-07.svg",
	"assets/symbols/symbol-08.svg",
	"assets/symbols/symbol-09.svg",
	"assets/symbols/symbol-10.svg",
	"assets/symbols/symbol-11.svg",
	"assets/symbols/symbol-12.svg"
];

DE.hslColor = function (h, s, l) {
	return "hsl(" + Math.round(h) + ", " + Math.round(s) + "%, " + Math.round(l) + "%)";
};

DE.randomColorPair = function (state) {
	var h = DE.rngRange(state, 0, 360);
	var h2 = (h + DE.rngRange(state, 40, 180)) % 360;
	var useWhite = DE.rngNext(state) < 0.25;
	var primary = DE.hslColor(h, DE.rngRange(state, 35, 70), DE.rngRange(state, 28, 48));
	var secondary = useWhite ? "#e8e4dc" : DE.hslColor(h2, DE.rngRange(state, 20, 55), DE.rngRange(state, 55, 78));
	return [primary, secondary];
};

DE.factionById = function (state, id) {
	if (!state || !state.factions) return null;
	for (var i = 0; i < state.factions.length; i++) {
		if (state.factions[i].id === id) return state.factions[i];
	}
	return null;
};

DE.civilizedFactions = function (state) {
	var out = [];
	for (var i = 0; i < state.factions.length; i++) {
		if (state.factions[i].kind === "civilized") out.push(state.factions[i]);
	}
	return out;
};

DE.newCampaign = function (seedText) {
	var state = {
		rng: DE.seedFromString(seedText || String(Date.now())),
		seedText: seedText || String(Date.now()),
		nextId: 1,
		missionCount: 0,
		totalEncounters: 0,
		incomeEncountersPaid: 0,
		won: false,
		factions: [],
		villages: [],
		logs: {},
		chronicle: [],
		player: null,
		hostileFactionId: null,
		encounterWeights: null,
		mission: null,
		usedUnitNames: {},
		villageTickPaid: 0,
		ui: DE.emptyUi()
	};
	DE.generateWorld(state);
	return state;
};

DE.emptyUi = function () {
	return {
		screen: "base",
		logQuery: "",
		logFilter: "all",
		selectedUnitIds: [],
		sendCounts: {},
		foodBuy: 100,
		goldTake: 100,
		weaponSetBuys: {},
		weaponTakeCounts: {},
		missionDistance: 5,
		villageMissionId: null,
		chooser: null,
		pendingAction: null,
		pendingExtra: {},
		lastResult: null,
		message: "",
		tradeNote: "",
		flash: "",
		menuOpen: false,
		politicsOpen: false,
		infoOpen: false,
		equipFor: null,
		debugMode: false,
		menuNote: "",
		importText: "",
		saveName: "",
		villageAtlas: false
	};
};

DE.generateWorld = function (state) {
	var usedNames = {};
	var counts = [2, 2, 1, 1];
	var speciesOrder = DE.rngShuffle(state, DE.SPECIES.slice());
	var symbols = DE.rngShuffle(state, DE.SYMBOLS.slice());
	var playerSymbol = symbols.pop();
	var civSymbols = symbols.slice(0, 6);
	var lonerSymbols = symbols.slice(6);

	for (var s = 0; s < speciesOrder.length; s++) {
		var species = speciesOrder[s];
		var n = counts[s];
		for (var i = 0; i < n; i++) {
			state.factions.push(DE.makeCivilizedFaction(state, species, civSymbols[state.factions.length], usedNames));
		}
	}

	var monsters = DE.rngShuffle(state, DE.MONSTER_TYPES.slice());
	var intelligent = monsters.slice(0, 2);
	var animal = monsters.slice(2);
	for (var m = 0; m < intelligent.length; m++) {
		state.factions.push(DE.makeLonerFaction(state, intelligent[m], lonerSymbols[m] || civSymbols[0], usedNames));
	}
	state.animalTypes = animal;

	var civ = DE.civilizedFactions(state);
	var hostile = DE.rngPick(state, civ);
	hostile.hostileTarget = true;
	hostile.knownHumanTypes = DE.fullHumanIntel();
	state.hostileFactionId = hostile.id;

	state.player = {
		id: "player",
		name: "Expedition",
		species: "human",
		kind: "player",
		colors: ["#8a7a62", "#e8e4dc"],
		symbol: playerSymbol,
		gold: 300,
		food: 0,
		magic: 0,
		weapons: [],
		captives: [],
		knownTypes: ["infantry", "machineGunner"],
		knownMonsters: {},
		languages: DE.emptyLanguages(),
		seenTypes: { infantry: true, machineGunner: true, civilian: true },
		facedTypes: {},
		politicsKnown: {},
		politicsView: { trust: {}, known: { player: true } },
		training: [],
		units: []
	};
	for (var inf = 0; inf < 8; inf++) {
		state.player.units.push(DE.makeUnit(state, "infantry", "human", "player"));
	}
	for (var mg = 0; mg < 2; mg++) {
		state.player.units.push(DE.makeUnit(state, "machineGunner", "human", "player"));
	}
	for (var civ = 0; civ < 5; civ++) {
		state.player.units.push(DE.makeUnit(state, "civilian", "human", "player"));
	}

	DE.generateVillages(state);
	DE.seedPolitics(state);
	DE.seedVillageCaptives(state);
	DE.placeMarkHostages(state);
	DE.ensureInfoState(state);
	state.encounterWeights = DE.rollEncounterWeights(state);
	state.monsterCvBump = DE.rngIntRange(state, 1, 4) * 5;
	state.intelligentCvBump = DE.rngIntRange(state, 1, 4) * 5;
	DE.appendChronicle(state, "Campaign begins. Hostile mark: " + hostile.name + ".");
};

DE.rollVillageDepth = function (state) {
	var a = DE.rngIntRange(state, 1, 6);
	var b = DE.rngIntRange(state, 1, 6);
	return Math.max(1, Math.round(Math.sqrt(a * a + b * b)));
};

DE.generateVillages = function (state) {
	var civ = DE.civilizedFactions(state);
	var usedNames = {};
	state.villages = [];
	for (var i = 0; i < civ.length; i++) {
		var n = DE.rngIntRange(state, 1, 3);
		for (var j = 0; j < n; j++) {
			var depth = DE.rollVillageDepth(state);
			state.villages.push({
				id: DE.nextId(state, "V"),
				name: DE.villageName(state, usedNames),
				factionId: civ[i].id,
				distance: depth,
				discovered: false,
				revisitLength: Math.max(1, depth * 2 - 1),
				units: [],
				gold: 100,
				magic: 0,
				food: 0,
				weapons: [],
				captives: []
			});
		}
	}
	DE.populateFactionArmies(state);
};

DE.villagesByFaction = function (state, factionId) {
	var out = [];
	for (var i = 0; i < state.villages.length; i++) {
		if (state.villages[i].factionId === factionId) out.push(state.villages[i]);
	}
	return out;
};

DE.villageByFaction = function (state, factionId) {
	var list = DE.villagesByFaction(state, factionId);
	if (!list.length) return null;
	for (var i = 0; i < list.length; i++) {
		if (!list[i].discovered) return list[i];
	}
	return list[0];
};

DE.closestVillageForFaction = function (state, factionId, depth) {
	var list = DE.villagesByFaction(state, factionId);
	if (!list.length) return null;
	var at = Number(depth);
	if (!(at >= 0)) at = 0;
	var best = list[0];
	var bestScore = Math.abs((best.distance || 0) - at);
	for (var i = 1; i < list.length; i++) {
		var v = list[i];
		var score = Math.abs((v.distance || 0) - at);
		if (score < bestScore || (score === bestScore && (v.distance || 0) < (best.distance || 0))) {
			best = v;
			bestScore = score;
		}
	}
	return best;
};

DE.assignHireVillage = function (state, factionId) {
	if (!state || !factionId) return null;
	var enc = state.mission && state.mission.pendingEncounter;
	if (enc && enc.villageRec && enc.villageRec.factionId === factionId) return enc.villageRec.id;
	if (enc && enc.tradeVillageRec && enc.tradeVillageRec.factionId === factionId) return enc.tradeVillageRec.id;
	var list = DE.villagesByFaction(state, factionId);
	if (!list.length) return null;
	return DE.rngPick(state, list).id;
};

DE.SCOUT_VILLAGE_WEIGHTS = { undiscovered: 2, discovered: 1, other: 3 };

DE.villagesAtDepth = function (state, depth, wantDiscovered) {
	var out = [];
	var list = (state && state.villages) || [];
	for (var i = 0; i < list.length; i++) {
		var v = list[i];
		if (!v || v.distance !== depth) continue;
		if (wantDiscovered === true && !v.discovered) continue;
		if (wantDiscovered === false && v.discovered) continue;
		out.push(v);
	}
	return out;
};

DE.villageAtDepth = function (state, depth) {
	var candidates = DE.villagesAtDepth(state, depth, false);
	if (!candidates.length) return null;
	return DE.rngPick(state, candidates);
};

DE.missionMetVillageSet = function (state) {
	var out = {};
	var ids = state && state.mission && state.mission.metVillageIds;
	if (!ids) return out;
	for (var i = 0; i < ids.length; i++) {
		if (ids[i]) out[ids[i]] = true;
	}
	return out;
};

/* Each village at this depth keeps its own weight (new 2, known 1) plus other 3. */
DE.scoutVillageRollTable = function (state, depth) {
	var cfg = DE.SCOUT_VILLAGE_WEIGHTS || { undiscovered: 2, discovered: 1, other: 3 };
	var list = DE.villagesAtDepth(state, depth);
	var skip = DE.missionMetVillageSet(state);
	var weights = {};
	var byKey = {};
	var villageWeight = 0;
	for (var i = 0; i < list.length; i++) {
		var v = list[i];
		if (!v || skip[v.id]) continue;
		var w = v.discovered ? cfg.discovered : cfg.undiscovered;
		if (!(w > 0) || !v.id) continue;
		var key = "V:" + v.id;
		weights[key] = w;
		byKey[key] = v;
		villageWeight += w;
	}
	if (cfg.other > 0) weights.other = cfg.other;
	return {
		weights: weights,
		byKey: byKey,
		villageWeight: villageWeight,
		other: cfg.other > 0 ? cfg.other : 0,
		total: villageWeight + (cfg.other > 0 ? cfg.other : 0)
	};
};

DE.pickScoutVillage = function (state, depth) {
	var table = DE.scoutVillageRollTable(state, depth);
	if (!table.villageWeight) return null;
	var roll = DE.pickWeighted(state, table.weights);
	if (!roll || roll === "other") return null;
	return table.byKey[roll] || null;
};

DE.discoveredVillages = function (state) {
	var out = [];
	for (var i = 0; i < state.villages.length; i++) {
		if (state.villages[i].discovered) out.push(state.villages[i]);
	}
	return out;
};

DE.appendChronicle = function (state, text) {
	if (!state) return;
	state.chronicle = state.chronicle || [];
	state.chronicle.unshift({
		id: DE.nextId(state, "C"),
		text: text,
		mission: state.mission ? state.mission.id : null,
		beat: state.mission ? state.mission.beat : 0,
		encounters: state.totalEncounters || 0
	});
};

DE.factionGoldMult = function (faction) {
	if (!faction || !faction.roster) return 1;
	return faction.roster.indexOf("necromancer") >= 0 ? 1.2 : 1;
};

DE.makeCivilizedFaction = function (state, species, symbol, usedNames) {
	var mageCount = 3 + DE.rngInt(state, 3);
	var mages = DE.rngShuffle(state, DE.MAGE_TYPES.slice()).slice(0, mageCount);
	var roster = ["melee", "archer", "ranger", "civilian"].concat(mages);
	if (mages.indexOf("necromancer") >= 0) {
		roster.push("skeleton");
		roster.push("ghost");
	}
	var colors = DE.randomColorPair(state);
	return {
		id: DE.nextId(state, "F"),
		kind: "civilized",
		species: species,
		name: DE.factionName(state, species, usedNames),
		colors: colors,
		symbol: symbol,
		mages: mages,
		roster: roster,
		poolUnits: [],
		gold: 1000,
		hostileTarget: false,
		knownHumanTypes: DE.emptyHumanIntel()
	};
};

DE.makeLonerFaction = function (state, monsterType, symbol, usedNames) {
	var unitType = DE.MONSTER_UNIT[monsterType];
	var speciesName = DE.SPECIES_LABELS[monsterType] || monsterType;
	var faction = {
		id: DE.nextId(state, "F"),
		kind: "loner",
		species: monsterType,
		monsterType: monsterType,
		name: speciesName,
		colors: DE.randomColorPair(state),
		symbol: symbol,
		mages: [],
		roster: [unitType],
		poolUnits: [],
		gold: 1000,
		hostileTarget: false,
		alive: true,
		knownHumanTypes: DE.emptyHumanIntel()
	};
	faction.poolUnits = DE.composeLonerPool(state, faction);
	return faction;
};

DE.composeLonerPool = function (state, faction) {
	var type = (faction.roster && faction.roster[0]) || DE.MONSTER_UNIT[faction.monsterType] || "skeleton";
	var units = [];
	var cv = 0;
	var guard = 0;
	while (cv < 250 && guard < 200) {
		guard++;
		units.push(DE.makeFactionUnit(state, faction, type, false));
		cv += DE.unitCombatValue(type);
	}
	return units;
};

DE.makeFactionUnit = function (state, faction, type, village) {
	var u = DE.makeUnit(state, type, DE.unitSpeciesFor(faction, type), faction.id);
	u.hirable = DE.rngNext(state) < (village ? 0.25 : 0.10);
	return u;
};

DE.factionArmyUnits = function (state, faction) {
	var out = [];
	if (!faction) return out;
	var pool = faction.poolUnits || [];
	for (var i = 0; i < pool.length; i++) out.push(pool[i]);
	if (!state || !state.villages) return out;
	for (var v = 0; v < state.villages.length; v++) {
		var village = state.villages[v];
		if (!village || village.factionId !== faction.id) continue;
		var list = village.units || [];
		for (var u = 0; u < list.length; u++) out.push(list[u]);
	}
	return out;
};

DE.livingLeaders = function (state, faction) {
	if (arguments.length === 1) {
		faction = state;
		state = null;
	}
	if (!faction) return [];
	var units = DE.factionArmyUnits(state, faction);
	var out = [];
	for (var i = 0; i < units.length; i++) {
		if (units[i] && units[i].leader && !units[i].dead) out.push(units[i]);
	}
	return out;
};

DE.findFactionUnit = function (state, factionId, unitId) {
	if (!unitId) return null;
	var faction = DE.factionById(state, factionId);
	var units = DE.factionArmyUnits(state, faction);
	for (var i = 0; i < units.length; i++) {
		if (units[i] && units[i].id === unitId) return units[i];
	}
	return null;
};

DE.combatRosterTypes = function (faction) {
	var out = [];
	var roster = (faction && faction.roster) || [];
	for (var i = 0; i < roster.length; i++) {
		if (roster[i] !== "civilian") out.push(roster[i]);
	}
	return out;
};

DE.pickForceType = function (state, faction, units) {
	var combatTypes = DE.combatRosterTypes(faction);
	if (!combatTypes.length) return null;
	var special = DE.rngNext(state) < 1 / 6;
	var type = null;
	if (special) {
		var specials = [];
		var weights = {};
		for (var s = 0; s < combatTypes.length; s++) {
			var d = DE.unitDef(combatTypes[s]);
			if (d && d.kind !== "standard") {
				specials.push(combatTypes[s]);
				weights[combatTypes[s]] = combatTypes[s] === "necromancer" ? 2 : 1;
			}
		}
		type = specials.length ? DE.pickWeighted(state, weights) : DE.rngPick(state, combatTypes);
	} else {
		var basics = [];
		for (var b = 0; b < combatTypes.length; b++) {
			var db = DE.unitDef(combatTypes[b]);
			if (db && db.kind === "standard") basics.push(combatTypes[b]);
		}
		type = basics.length ? DE.rngPick(state, basics) : DE.rngPick(state, combatTypes);
	}
	if (!type) return null;
	var def = DE.unitDef(type);
	if (def && def.undead && !DE.hasFlag(units, "necromancer")) return null;
	return type;
};

DE.cheapestFittingType = function (state, faction, units, remaining) {
	var combatTypes = DE.combatRosterTypes(faction);
	var best = null;
	var bestPrice = Infinity;
	for (var i = 0; i < combatTypes.length; i++) {
		var type = combatTypes[i];
		var def = DE.unitDef(type);
		if (def && def.undead && !DE.hasFlag(units, "necromancer")) continue;
		var price = DE.unitStuffPrice(type);
		if (price <= remaining && price < bestPrice) {
			best = type;
			bestPrice = price;
		}
	}
	return best;
};

DE.composeForceByGold = function (state, faction, goldBudget, village) {
	var units = [];
	var spent = 0;
	var guard = 0;
	while (spent < goldBudget && guard < 400) {
		guard++;
		var type = DE.pickForceType(state, faction, units);
		if (!type) {
			type = DE.cheapestFittingType(state, faction, units, goldBudget - spent);
			if (!type) break;
		}
		var price = DE.unitStuffPrice(type);
		if (spent + price > goldBudget) {
			type = DE.cheapestFittingType(state, faction, units, goldBudget - spent);
			if (!type) break;
			price = DE.unitStuffPrice(type);
		}
		units.push(DE.makeFactionUnit(state, faction, type, village));
		spent += price;
	}
	if (village) {
		var civN = Math.max(1, Math.round(units.length * 3));
		for (var c = 0; c < civN; c++) {
			units.push(DE.makeFactionUnit(state, faction, "civilian", true));
		}
	}
	return { units: units, spent: spent };
};

DE.fillVillageArmy = function (state, village, faction) {
	if (!village || !faction) return;
	var goldMult = DE.factionGoldMult(faction);
	var budget = Math.round(DE.rngIntRange(state, 750, 1650) * goldMult);
	var built = DE.composeForceByGold(state, faction, budget, true);
	village.units = built.units;
	village.raisedGold = built.spent;
	village.gold = 100;
	village.magic = 0;
	village.weapons = [];
	village.captives = village.captives || [];
	var living = DE.livingUnits(village.units);
	village.food = living.length * DE.rngIntRange(state, 3, 6);
};

DE.fillFactionPool = function (state, faction) {
	var goldMult = DE.factionGoldMult(faction);
	var budget = Math.round(2500 * goldMult);
	var built = DE.composeForceByGold(state, faction, budget, false);
	faction.poolUnits = built.units;
	faction.poolRaisedGold = built.spent;
};

DE.leaderPickWeight = function (unit) {
	if (!unit) return 1;
	var w = DE.unitStuffPrice(unit.type) + DE.unitCombatValue(unit.type);
	if (unit.type === "necromancer") w *= 2;
	return Math.max(1, w);
};

DE.removeUnitFromList = function (list, id) {
	if (!list) return null;
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].id === id) {
			var u = list[i];
			list.splice(i, 1);
			return u;
		}
	}
	return null;
};

DE.moveUnitToList = function (state, faction, unit, dest) {
	if (!unit || !dest) return;
	DE.removeUnitFromList(faction.poolUnits, unit.id);
	var villages = DE.villagesByFaction(state, faction.id);
	for (var i = 0; i < villages.length; i++) {
		DE.removeUnitFromList(villages[i].units, unit.id);
	}
	dest.push(unit);
};

DE.promoteFactionLeaders = function (state, faction) {
	var candidates = [];
	var army = DE.factionArmyUnits(state, faction);
	for (var i = 0; i < army.length; i++) {
		var u = army[i];
		if (!u || u.dead || u.type === "civilian") continue;
		candidates.push(u);
	}
	candidates.sort(function (a, b) {
		var pa = DE.unitStuffPrice(a.type) - DE.unitStuffPrice(b.type);
		if (pa) return pa > 0 ? -1 : 1;
		var wa = DE.unitCombatValue(a.type) - DE.unitCombatValue(b.type);
		if (wa) return wa > 0 ? -1 : 1;
		return 0;
	});
	var picked = [];
	var pool = candidates.slice();
	while (picked.length < 5 && pool.length) {
		var weights = {};
		for (var p = 0; p < pool.length; p++) weights[String(p)] = DE.leaderPickWeight(pool[p]);
		var idx = Number(DE.pickWeighted(state, weights));
		if (!(idx >= 0) || idx >= pool.length) idx = 0;
		picked.push(pool[idx]);
		pool.splice(idx, 1);
	}
	for (var L = 0; L < picked.length; L++) {
		var deltas = {
			deltaFear: DE.rngRange(state, -0.2, 0.2),
			deltaTrust: DE.rngRange(state, -0.2, 0.2)
		};
		picked[L].leader = deltas;
		picked[L].deltaFear = deltas.deltaFear;
		picked[L].deltaTrust = deltas.deltaTrust;
	}
	var villages = DE.villagesByFaction(state, faction.id);
	for (var v = 0; v < villages.length; v++) {
		if (v < picked.length) DE.moveUnitToList(state, faction, picked[v], villages[v].units);
	}
	for (var r = villages.length; r < picked.length; r++) {
		DE.moveUnitToList(state, faction, picked[r], faction.poolUnits);
	}
};

DE.populateFactionArmies = function (state) {
	var civ = DE.civilizedFactions(state);
	for (var i = 0; i < civ.length; i++) {
		var faction = civ[i];
		var villages = DE.villagesByFaction(state, faction.id);
		for (var v = 0; v < villages.length; v++) DE.fillVillageArmy(state, villages[v], faction);
		DE.fillFactionPool(state, faction);
		DE.promoteFactionLeaders(state, faction);
	}
};

DE.specialTypeWeight = function (type) {
	return type === "necromancer" ? 2 : 1;
};

DE.rollEncounterWeights = function (state) {
	var w = {
		small: DE.rngIntRange(state, 1, 10),
		medium: DE.rngIntRange(state, 1, 10),
		large: DE.rngIntRange(state, 1, 10),
		huge: DE.rngIntRange(state, 1, 5),
		monster: DE.rngIntRange(state, 1, 8)
	};
	var contrib = w.small * 10 + w.medium * 27.5 + w.large * 47.5 + w.huge * 80 + w.monster * 28;
	var sum = w.small + w.medium + w.large + w.huge + w.monster;
	w.empty = Math.max(0.5, contrib / 30 - sum);
	return w;
};

DE.pickWeighted = function (state, weights) {
	var keys = Object.keys(weights);
	var total = 0;
	for (var i = 0; i < keys.length; i++) total += weights[keys[i]];
	var r = DE.rngNext(state) * total;
	for (var j = 0; j < keys.length; j++) {
		r -= weights[keys[j]];
		if (r <= 0) return keys[j];
	}
	return keys[keys.length - 1];
};

DE.sizeRange = function (size) {
	if (size === "small") return [5, 15];
	if (size === "medium") return [20, 35];
	if (size === "large") return [40, 55];
	return [60, 100];
};

DE.composeForce = function (state, faction, size, village) {
	var range = DE.sizeRange(size);
	var target = DE.rngIntRange(state, range[0], range[1]);
	var units = [];
	var cv = 0;
	var guard = 0;
	while (cv < target && guard < 80) {
		guard++;
		var type = DE.pickForceType(state, faction, units);
		if (!type) continue;
		units.push(DE.makeFactionUnit(state, faction, type, village));
		cv += DE.unitCombatValue(type);
	}
	if (village) {
		var civN = Math.max(1, Math.round(units.length * 3));
		for (var c = 0; c < civN; c++) {
			units.push(DE.makeFactionUnit(state, faction, "civilian", true));
		}
	}
	return units;
};

DE.availableUnits = function (list) {
	var out = [];
	var units = list || [];
	for (var i = 0; i < units.length; i++) {
		if (units[i] && !units[i].dead && !units[i].away && !units[i].wounded) out.push(units[i]);
	}
	return out;
};

DE.drawUnitsFromList = function (list, targetCv, opts) {
	opts = opts || {};
	var picked = [];
	var cv = 0;
	var available = DE.availableUnits(list);
	if (opts.preferLeader) {
		for (var i = 0; i < available.length; i++) {
			if (available[i].leader) {
				picked.push(available[i]);
				available[i].away = true;
				cv += DE.unitCombatValue(available[i].type);
				available.splice(i, 1);
				break;
			}
		}
	}
	var rest = [];
	for (var r = 0; r < available.length; r++) {
		if (opts.combatOnly && available[r].type === "civilian") continue;
		rest.push(available[r]);
	}
	if (opts.shuffle && opts.state) rest = DE.rngShuffle(opts.state, rest);
	for (var n = 0; n < rest.length; n++) {
		if (cv >= targetCv && picked.length) break;
		rest[n].away = true;
		picked.push(rest[n]);
		cv += DE.unitCombatValue(rest[n].type);
	}
	if (opts.includeCivilians) {
		for (var c = 0; c < available.length; c++) {
			if (available[c].type !== "civilian" || available[c].away) continue;
			available[c].away = true;
			picked.push(available[c]);
		}
	}
	return picked;
};

DE.releaseAwayUnits = function (list) {
	var units = list || [];
	for (var i = 0; i < units.length; i++) {
		if (units[i]) units[i].away = false;
	}
};

DE.rosterMagicKitTypes = function (faction) {
	var out = [];
	var roster = (faction && faction.roster) || [];
	for (var i = 0; i < roster.length; i++) {
		var type = roster[i];
		var def = DE.unitDef(type);
		if ((def && def.mage) || type === "ghost") out.push(type);
	}
	return out;
};

DE.rosterNativeKitTypes = function (faction) {
	var out = [];
	var roster = (faction && faction.roster) || [];
	for (var i = 0; i < roster.length; i++) {
		if (roster[i] === "melee" || roster[i] === "archer" || roster[i] === "skeleton") out.push(roster[i]);
	}
	return out;
};

DE.equipVillageCivilian = function (village, kit) {
	var list = village.units || [];
	for (var i = 0; i < list.length; i++) {
		var u = list[i];
		if (!u || u.dead || u.type !== "civilian") continue;
		u.previousType = u.previousType || u.type;
		u.type = kit;
		return true;
	}
	return false;
};

DE.tryEquipVillageKits = function (state, village, types, chance) {
	if (!village.weapons || !types || !types.length) return;
	var allowed = {};
	for (var t = 0; t < types.length; t++) allowed[types[t]] = true;
	var kept = [];
	for (var i = 0; i < village.weapons.length; i++) {
		var kit = village.weapons[i];
		if (allowed[kit] && DE.rngNext(state) < chance && DE.equipVillageCivilian(village, kit)) continue;
		kept.push(kit);
	}
	village.weapons = kept;
};

DE.villagePopulation = function (village) {
	return DE.livingUnits((village && village.units) || []).length;
};

DE.pickVillageByPopulation = function (state, villages, skipVillage) {
	var list = villages || [];
	var weights = {};
	var byId = {};
	for (var i = 0; i < list.length; i++) {
		var v = list[i];
		if (!v || (skipVillage && v.id === skipVillage.id)) continue;
		byId[v.id] = v;
		weights[v.id] = Math.max(1, DE.villagePopulation(v));
	}
	var keys = Object.keys(weights);
	if (!keys.length) return null;
	return byId[DE.pickWeighted(state, weights)] || null;
};

DE.restHealAiUnits = function (units) {
	var n = 0;
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		var u = list[i];
		if (!u || u.dead || !u.wounded) continue;
		if (DE.isPlayerControlledUnit(u)) continue;
		u.wounded = false;
		n++;
	}
	return n;
};

DE.healAiListsIfHealer = function (state) {
	var facs = (state && state.factions) || [];
	for (var i = 0; i < facs.length; i++) {
		DE.healSide(facs[i].poolUnits || [], { skipPlayer: true });
	}
	var villages = (state && state.villages) || [];
	for (var v = 0; v < villages.length; v++) {
		DE.healSide((villages[v] && villages[v].units) || [], { skipPlayer: true });
	}
};

DE.evacWoundedAi = function (state, skipVillage) {
	var facs = DE.civilizedFactions(state);
	var moved = 0;
	for (var i = 0; i < facs.length; i++) {
		var faction = facs[i];
		var pool = faction.poolUnits || [];
		var wounded = [];
		for (var p = 0; p < pool.length; p++) {
			var u = pool[p];
			if (u && u.wounded && !u.dead && !u.away && !DE.isPlayerControlledUnit(u)) wounded.push(u);
		}
		for (var w = 0; w < wounded.length; w++) {
			var dest = DE.pickVillageByPopulation(state, state.villages, skipVillage);
			if (!dest) break;
			DE.moveUnitToList(state, faction, wounded[w], dest.units);
			moved++;
			DE.healSide(dest.units, { skipPlayer: true });
		}
	}
	return moved;
};

DE.tickVillage = function (state, village, skipVillage) {
	if (!village || (skipVillage && skipVillage.id === village.id)) return;
	var faction = DE.factionById(state, village.factionId);
	if (!faction || faction.kind !== "civilized") return;
	DE.healSide(village.units || [], { skipPlayer: true });
	DE.restHealAiUnits(village.units || []);
	var goldMult = DE.factionGoldMult(faction);
	village.gold = (village.gold || 0) + Math.round(DE.rngIntRange(state, 50, 150) * goldMult);
	village.magic = (village.magic || 0) + DE.rngIntRange(state, 50, 150);
	village.weapons = village.weapons || [];
	village.units = village.units || [];
	faction.poolUnits = faction.poolUnits || [];

	var magicKits = DE.rosterMagicKitTypes(faction);
	while (village.magic >= 100 && magicKits.length) {
		village.magic -= 100;
		village.weapons.push(DE.rngPick(state, magicKits));
	}

	var nativeKits = DE.rosterNativeKitTypes(faction);
	while (village.gold - 100 >= 25 && nativeKits.length) {
		village.gold -= 25;
		if (DE.rngNext(state) < 0.5) village.weapons.push(DE.rngPick(state, nativeKits));
	}

	DE.tryEquipVillageKits(state, village, nativeKits, 0.25);
	DE.tryEquipVillageKits(state, village, ["infantry", "machineGunner"], 0.5);

	var others = DE.villagesByFaction(state, faction.id).filter(function (v) {
		return v && v.id !== village.id;
	});
	if (others.length) {
		var sendCiv = DE.rngIntRange(state, 0, 10);
		for (var c = 0; c < sendCiv; c++) {
			var civ = null;
			for (var u = 0; u < village.units.length; u++) {
				var cu = village.units[u];
				if (cu && !cu.dead && !cu.away && cu.type === "civilian" && !cu.leader) {
					civ = cu;
					break;
				}
			}
			if (!civ) break;
			DE.moveUnitToList(state, faction, civ, DE.rngPick(state, others).units);
		}
	}

	var sendGold = DE.rngIntRange(state, 0, 500);
	var sent = 0;
	for (var s = 0; s < village.units.length && sent < sendGold; ) {
		var su = village.units[s];
		if (!su || su.dead || su.away || su.wounded || su.leader || su.type === "civilian") {
			s++;
			continue;
		}
		var price = DE.unitStuffPrice(su.type);
		if (sent + price > sendGold) {
			s++;
			continue;
		}
		sent += price;
		DE.moveUnitToList(state, faction, su, faction.poolUnits);
	}

	var takeGold = DE.rngIntRange(state, 0, 100);
	var taken = 0;
	for (var p = 0; p < faction.poolUnits.length && taken < takeGold; ) {
		var pu = faction.poolUnits[p];
		if (!pu || pu.dead || pu.away || pu.wounded || pu.leader || pu.type === "civilian") {
			p++;
			continue;
		}
		var takePrice = DE.unitStuffPrice(pu.type);
		if (taken + takePrice > takeGold) {
			p++;
			continue;
		}
		taken += takePrice;
		DE.moveUnitToList(state, faction, pu, village.units);
	}

	var living = DE.livingUnits(village.units);
	village.food = living.length * DE.rngIntRange(state, 3, 6);
};

DE.maybeTickVillages = function (state, skipVillage) {
	if (!state) return;
	state.totalEncounters = state.totalEncounters || 0;
	state.villageTickPaid = state.villageTickPaid || 0;
	var due = Math.floor(state.totalEncounters / 5) - Math.floor(state.villageTickPaid / 5);
	if (due <= 0) return;
	var skip = skipVillage || (state.mission && state.mission.pendingEncounter && state.mission.pendingEncounter.villageRec
		? state.mission.pendingEncounter.villageRec
		: null);
	for (var n = 0; n < due; n++) {
		DE.healAiListsIfHealer(state);
		DE.evacWoundedAi(state, skip);
		var villages = state.villages || [];
		for (var i = 0; i < villages.length; i++) DE.tickVillage(state, villages[i], skip);
		if (typeof DE.maybeQueueCampRaid === "function") DE.maybeQueueCampRaid(state);
	}
	state.villageTickPaid = Math.floor(state.totalEncounters / 5) * 5;
};

DE.cheapCaptiveTypes = function (faction) {
	var out = [];
	var roster = (faction && faction.roster) || [];
	for (var i = 0; i < roster.length; i++) {
		var type = roster[i];
		if (type === "civilian" || type === "ranger") continue;
		var def = DE.unitDef(type);
		if (def && def.kind === "standard" && (type === "melee" || type === "archer" || type === "skeleton" || type === "infantry")) {
			out.push(type);
		}
	}
	if (!out.length) {
		for (var j = 0; j < roster.length; j++) {
			if (roster[j] !== "civilian" && DE.unitStuffPrice(roster[j]) <= 25) out.push(roster[j]);
		}
	}
	return out;
};

DE.specialCaptiveTypes = function (faction) {
	var out = [];
	var roster = (faction && faction.roster) || [];
	for (var i = 0; i < roster.length; i++) {
		var type = roster[i];
		if (type === "civilian") continue;
		var def = DE.unitDef(type);
		if (def && (def.kind === "special" || def.mage)) out.push(type);
	}
	return out;
};

DE.hostileFactionsToward = function (state, factionId) {
	var out = [];
	var civ = DE.civilizedFactions(state);
	for (var i = 0; i < civ.length; i++) {
		if (civ[i].id === factionId) continue;
		var t = DE.politicsTrust(state, factionId, civ[i].id);
		if (DE.politicsBand(t) === "hostile") out.push(civ[i]);
	}
	return out;
};

DE.seedVillageCaptives = function (state) {
	var villages = (state && state.villages) || [];
	for (var i = 0; i < villages.length; i++) {
		var village = villages[i];
		if (!village) continue;
		village.captives = [];
		var sources = DE.hostileFactionsToward(state, village.factionId);
		if (!sources.length) continue;
		var n = DE.rngIntRange(state, 1, 5);
		for (var c = 0; c < n; c++) {
			var src = DE.rngPick(state, sources);
			var special = DE.rngNext(state) < 0.5;
			var types = special ? DE.specialCaptiveTypes(src) : DE.cheapCaptiveTypes(src);
			if (!types.length) types = special ? DE.cheapCaptiveTypes(src) : DE.specialCaptiveTypes(src);
			if (!types.length) continue;
			var type = DE.rngPick(state, types);
			var u = DE.makeFactionUnit(state, src, type, false);
			village.captives.push(DE.makeCaptiveRecord(u));
		}
	}
};

DE.placeMarkHostages = function (state) {
	state.markHostageIds = [];
	var villages = DE.villagesByFaction(state, state.hostileFactionId);
	if (!villages.length) return;
	for (var i = 0; i < 5; i++) {
		var v = villages[i % villages.length];
		var u = DE.makeUnit(state, "infantry", "human", "player", { homeFactionId: "player" });
		u.markHostage = true;
		var rec = DE.makeCaptiveRecord(u);
		v.captives = v.captives || [];
		v.captives.push(rec);
		state.markHostageIds.push(rec.id);
	}
};

DE.syncVillageStuff = function (village, stuff) {
	if (!village || !stuff) return;
	village.gold = stuff.gold || 0;
	village.magic = stuff.magic || 0;
	village.food = stuff.food || 0;
	village.weapons = stuff.weapons || [];
	village.captives = stuff.captives || [];
};

DE.villageStuffView = function (village) {
	return {
		gold: village.gold || 0,
		magic: village.magic || 0,
		food: village.food || 0,
		weapons: village.weapons || [],
		captives: village.captives || []
	};
};

DE.composeUndeadForce = function (state, size) {
	var range = DE.sizeRange(size || "medium");
	var target = DE.rngIntRange(state, range[0], range[1]);
	var units = [];
	var cv = 0;
	var undeadFaction = null;
	for (var i = 0; i < state.factions.length; i++) {
		if (state.factions[i].monsterType === "undead") undeadFaction = state.factions[i];
	}
	var fid = undeadFaction ? undeadFaction.id : "undead-wild";
	var useGhost = DE.rngNext(state) < 0.25;
	while (cv < target && units.length < 40) {
		var type = useGhost && DE.rngNext(state) < 0.4 ? "ghost" : "skeleton";
		units.push(DE.makeUnit(state, type, "undead", fid));
		cv += DE.unitDef(type).worth;
	}
	return { units: units, faction: undeadFaction };
};

DE.makePartyStuff = function (state, units, faction, village) {
	units = units || [];
	var n = Math.max(1, units.length);
	var weapons = [];
	if (faction && faction.roster) {
		var pool = [];
		for (var i = 0; i < faction.roster.length; i++) {
			if (DE.isWeaponKitType(faction.roster[i])) pool.push(faction.roster[i]);
		}
		if (pool.length) {
			var kits = village
				? (4 + DE.rngInt(state, 5))
				: (1 + DE.rngInt(state, Math.min(3, Math.max(1, pool.length))));
			for (var w = 0; w < kits; w++) {
				weapons.push(DE.rngPick(state, pool));
			}
		}
	} else if (DE.rngNext(state) < 0.35) {
		weapons = [DE.rngPick(state, ["melee", "archer", "fireMage"])];
	}
	var monster = DE.isMonsterParty(units, faction);
	var gold = monster
		? DE.rngIntRange(state, 5, 50)
		: DE.rngIntRange(state, n * 1, n * 10);
	var foodMult = DE.rngIntRange(state, 3, 6);
	var magicMult = DE.rngIntRange(state, 3, 6);
	return {
		gold: gold,
		food: n * foodMult,
		magic: n * magicMult,
		weapons: DE.filterWeaponKits(weapons),
		captives: []
	};
};

DE.isMonsterParty = function (units, faction) {
	if (faction && (faction.kind === "loner" || faction.monsterType)) return true;
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		var def = DE.unitDef(list[i].type);
		if (def && (def.monster || def.undead)) return true;
	}
	return false;
};
