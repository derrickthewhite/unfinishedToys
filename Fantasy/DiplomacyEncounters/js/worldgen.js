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
		goldTake: 200,
		weaponSetBuys: {},
		missionDistance: 5,
		villageMissionId: null,
		chooser: null,
		pendingAction: null,
		pendingExtra: {},
		lastResult: null,
		message: "",
		tradeNote: "",
		flash: ""
	};
};

DE.generateWorld = function (state) {
	var usedNames = {};
	var counts = DE.rngShuffle(state, [4, 3, 2, 1]);
	var speciesOrder = DE.rngShuffle(state, DE.SPECIES.slice());
	var symbols = DE.rngShuffle(state, DE.SYMBOLS.slice());
	var playerSymbol = symbols.pop();
	var civSymbols = symbols.slice(0, 10);
	var lonerSymbols = symbols.slice(10);

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
	state.hostileFactionId = hostile.id;

	state.player = {
		id: "player",
		name: "Expedition",
		species: "human",
		kind: "player",
		colors: ["#8a7a62", "#e8e4dc"],
		symbol: playerSymbol,
		gold: 1000,
		food: 0,
		weapons: [],
		captives: [],
		knownTypes: ["infantry", "machineGunner"],
		knownMonsters: {},
		training: [],
		units: []
	};
	for (var inf = 0; inf < 15; inf++) {
		state.player.units.push(DE.makeUnit(state, "infantry", "human", "player"));
	}
	for (var mg = 0; mg < 5; mg++) {
		state.player.units.push(DE.makeUnit(state, "machineGunner", "human", "player"));
	}

	DE.generateVillages(state);
	state.encounterWeights = DE.rollEncounterWeights(state);
	DE.appendChronicle(state, "Campaign begins. Hostile mark: " + hostile.name + ".");
};

DE.VILLAGE_DISTANCES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

DE.generateVillages = function (state) {
	var civ = DE.civilizedFactions(state);
	var distances = DE.rngShuffle(state, DE.VILLAGE_DISTANCES.slice());
	var usedNames = {};
	state.villages = [];
	for (var i = 0; i < civ.length; i++) {
		state.villages.push({
			id: DE.nextId(state, "V"),
			name: DE.villageName(state, usedNames),
			factionId: civ[i].id,
			distance: distances[i],
			discovered: false,
			revisitLength: distances[i] * 2
		});
	}
};

DE.villageByFaction = function (state, factionId) {
	for (var i = 0; i < state.villages.length; i++) {
		if (state.villages[i].factionId === factionId) return state.villages[i];
	}
	return null;
};

DE.villageAtDepth = function (state, depth) {
	for (var i = 0; i < state.villages.length; i++) {
		var v = state.villages[i];
		if (!v.discovered && v.distance === depth) return v;
	}
	return null;
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

DE.makeCivilizedFaction = function (state, species, symbol, usedNames) {
	var mageCount = 3 + DE.rngInt(state, 3);
	var mages = DE.rngShuffle(state, DE.MAGE_TYPES.slice()).slice(0, mageCount);
	var roster = ["melee", "archer", "civilian"].concat(mages);
	if (mages.indexOf("necromancer") >= 0) {
		roster.push("skeleton");
		roster.push("ghost");
	}
	var leaders = [];
	for (var i = 0; i < 5; i++) {
		leaders.push({
			id: DE.nextId(state, "L"),
			name: DE.leaderName(state, usedNames),
			alive: true,
			deltaFear: DE.rngRange(state, -0.1, 0.1),
			deltaTrust: DE.rngRange(state, -0.1, 0.1)
		});
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
		leaders: leaders,
		gold: 1000,
		hostileTarget: false
	};
};

DE.makeLonerFaction = function (state, monsterType, symbol, usedNames) {
	var unitType = DE.MONSTER_UNIT[monsterType];
	var leaders = [{
		id: DE.nextId(state, "L"),
		name: DE.leaderName(state, usedNames),
		alive: true,
		deltaFear: DE.rngRange(state, -0.1, 0.1),
		deltaTrust: DE.rngRange(state, -0.1, 0.1)
	}];
	return {
		id: DE.nextId(state, "F"),
		kind: "loner",
		species: monsterType,
		monsterType: monsterType,
		name: "The " + DE.SPECIES_LABELS[monsterType],
		colors: DE.randomColorPair(state),
		symbol: symbol,
		mages: [],
		roster: [unitType],
		leaders: leaders,
		gold: 1000,
		hostileTarget: false,
		alive: true
	};
};

DE.livingLeaders = function (faction) {
	var out = [];
	var list = (faction && faction.leaders) || [];
	for (var i = 0; i < list.length; i++) {
		if (list[i].alive) out.push(list[i]);
	}
	return out;
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
	var roster = faction.roster.slice();
	var combatTypes = [];
	for (var i = 0; i < roster.length; i++) {
		if (roster[i] !== "civilian") combatTypes.push(roster[i]);
	}
	var cv = 0;
	var guard = 0;
	while (cv < target && guard < 80) {
		guard++;
		var special = DE.rngNext(state) < 1 / 6;
		var type;
		if (special) {
			var specials = [];
			for (var s = 0; s < combatTypes.length; s++) {
				var d = DE.unitDef(combatTypes[s]);
				if (d && d.kind !== "standard") specials.push(combatTypes[s]);
			}
			type = specials.length ? DE.rngPick(state, specials) : DE.rngPick(state, combatTypes);
		} else {
			var basics = [];
			for (var b = 0; b < combatTypes.length; b++) {
				var db = DE.unitDef(combatTypes[b]);
				if (db && db.kind === "standard") basics.push(combatTypes[b]);
			}
			type = basics.length ? DE.rngPick(state, basics) : DE.rngPick(state, combatTypes);
		}
		if (!type) break;
		var def = DE.unitDef(type);
		var add = Math.max(1, def.worth || def.casualty || 5);
		if (def.flags && (def.flags.illusionist || def.flags.earthMage || def.flags.mindMage || def.flags.healer)) add = 15;
		var u = DE.makeUnit(state, type, faction.species, faction.id);
		u.hirable = DE.rngNext(state) < (village ? 0.25 : 0.10);
		units.push(u);
		cv += add;
	}
	if (village) {
		var civN = Math.max(1, Math.round(units.length * 3));
		for (var c = 0; c < civN; c++) {
			var civ = DE.makeUnit(state, "civilian", faction.species, faction.id);
			civ.hirable = DE.rngNext(state) < 0.25;
			units.push(civ);
		}
	}
	return units;
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

DE.makePartyStuff = function (state, units, faction) {
	var weapons = [];
	if (faction && faction.roster) {
		var pool = [];
		for (var i = 0; i < faction.roster.length; i++) {
			if (faction.roster[i] !== "civilian") pool.push(faction.roster[i]);
		}
		var n = 1 + DE.rngInt(state, Math.min(3, Math.max(1, pool.length)));
		var shuffled = DE.rngShuffle(state, pool);
		for (var w = 0; w < n && w < shuffled.length; w++) weapons.push(shuffled[w]);
	} else if (DE.rngNext(state) < 0.35) {
		weapons = [DE.rngPick(state, ["melee", "archer", "fireMage"])];
	}
	return {
		gold: DE.rngIntRange(state, 40, 220),
		food: Math.max(4, units.length * 2),
		weapons: DE.uniqueTypes ? DE.uniqueTypes(weapons) : weapons,
		captives: []
	};
};
