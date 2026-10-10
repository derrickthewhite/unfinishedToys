var DE = DE || {};

DE.ACTIONS = ["attack", "intimidate", "defend", "gift", "greet", "seize", "capture", "occupy", "retreat", "run", "trade"];

DE.ACTION_LABELS = {
	attack: "Attack",
	intimidate: "Intimidate",
	defend: "Defend",
	gift: "Gift",
	greet: "Greet",
	seize: "Seize",
	capture: "Capture",
	occupy: "Occupy",
	retreat: "Retreat",
	run: "Run",
	trade: "Trade"
};

DE.SPECIES = ["goblin", "squidling", "skitter", "elf"];
DE.SPECIES_LABELS = {
	goblin: "Goblins",
	squidling: "Squidlings",
	skitter: "Skitters",
	elf: "Elves",
	human: "Humans",
	undead: "Undead",
	ghost: "Ghost",
	dragon: "Dragon",
	webWorm: "Web Worm",
	tunnelWorm: "Tunnel Worm",
	spider: "Spider",
	ooze: "Ooze"
};

DE.MONSTER_TYPES = ["undead", "dragon", "webWorm", "tunnelWorm", "spider", "ooze"];
DE.MAGE_TYPES = ["illusionist", "fireMage", "healer", "mindMage", "earthMage", "necromancer"];

DE.UNIT_TYPES = {
	infantry: {
		id: "infantry", name: "Infantry", role: "ranged", kind: "standard",
		worth: 10, casualty: 10, humanOnly: true, asset: "assets/units/infantry.svg"
	},
	machineGunner: {
		id: "machineGunner", name: "Machine Gunner", role: "ranged", kind: "standard",
		worth: 10, casualty: 10, humanOnly: true, flags: { machineGun: true },
		asset: "assets/be/machineGun.svg"
	},
	melee: {
		id: "melee", name: "Melee", role: "melee", kind: "standard",
		worth: 5, casualty: 5, civilized: true, asset: "assets/be/sword.svg"
	},
	archer: {
		id: "archer", name: "Archer", role: "ranged", kind: "standard",
		worth: 5, casualty: 5, civilized: true, asset: "assets/be/bow.svg"
	},
	ranger: {
		id: "ranger", name: "Ranger", role: "ranged", kind: "standard",
		worth: 10, casualty: 10, civilized: true, flags: { ranger: true },
		asset: "assets/units/ranger.svg"
	},
	civilian: {
		id: "civilian", name: "Civilian", role: "civilian", kind: "standard",
		worth: 0, casualty: 5, civilized: true, asset: "assets/units/civilian.svg"
	},
	illusionist: {
		id: "illusionist", name: "Illusionist", role: "mage", kind: "special",
		worth: 0, casualty: 20, mage: true, flags: { illusionist: true },
		asset: "assets/units/illusionist.svg"
	},
	fireMage: {
		id: "fireMage", name: "Fire Mage", role: "mage", kind: "special",
		worth: 20, casualty: 20, mage: true, asset: "assets/units/fireMage.svg"
	},
	healer: {
		id: "healer", name: "Healer", role: "mage", kind: "special",
		worth: 0, casualty: 10, mage: true, flags: { healer: true },
		asset: "assets/units/healer.svg"
	},
	mindMage: {
		id: "mindMage", name: "Mind Mage", role: "mage", kind: "special",
		worth: 0, casualty: 10, mage: true, flags: { mindMage: true },
		asset: "assets/units/mindMage.svg"
	},
	earthMage: {
		id: "earthMage", name: "Earth Mage", role: "mage", kind: "special",
		worth: 0, casualty: 20, mage: true, flags: { earthMage: true },
		asset: "assets/units/earthMage.svg"
	},
	necromancer: {
		id: "necromancer", name: "Necromancer", role: "mage", kind: "special",
		worth: 10, casualty: 10, mage: true, flags: { necromancer: true },
		asset: "assets/units/necromancer.svg"
	},
	skeleton: {
		id: "skeleton", name: "Skeleton", role: "melee", kind: "special",
		worth: 2, casualty: 2, undead: true, flags: { skeleton: true },
		asset: "assets/units/skeleton.svg"
	},
	ghost: {
		id: "ghost", name: "Ghost", role: "mixed", kind: "special",
		worth: 5, casualty: 5, undead: true, mage: false, flags: { ghost: true },
		asset: "assets/units/ghost.svg"
	},
	dragon: {
		id: "dragon", name: "Dragon", role: "mixed", kind: "monster",
		worth: 50, casualty: 50, monster: true, flags: { mixed: true },
		asset: "assets/units/dragon.svg"
	},
	spider: {
		id: "spider", name: "Spider", role: "melee", kind: "monster",
		worth: 20, casualty: 20, monster: true, flags: { spider: true },
		asset: "assets/units/spider.svg"
	},
	tunnelWorm: {
		id: "tunnelWorm", name: "Tunnel Worm", role: "melee", kind: "monster",
		worth: 30, casualty: 30, monster: true, flags: { tunnelWorm: true },
		asset: "assets/be/worm.svg"
	},
	webWorm: {
		id: "webWorm", name: "Web Worm", role: "mixed", kind: "monster",
		worth: 25, casualty: 25, monster: true, flags: { mixed: true },
		asset: "assets/units/webWorm.svg"
	},
	ooze: {
		id: "ooze", name: "Ooze", role: "melee", kind: "monster",
		worth: 20, casualty: 20, monster: true, flags: { ooze: true },
		asset: "assets/be/ooze.svg"
	}
};

DE.MONSTER_UNIT = {
	undead: "skeleton",
	dragon: "dragon",
	webWorm: "webWorm",
	tunnelWorm: "tunnelWorm",
	spider: "spider",
	ooze: "ooze"
};

DE.SPECIES_ASSET = {
	goblin: "assets/Species/Goblin.svg",
	squidling: "assets/Species/squidling.svg",
	skitter: "assets/Species/Skittering.svg",
	elf: "assets/Species/Elf.svg",
	human: "assets/Species/modern.svg",
	undead: "assets/Species/undead.svg",
	dragon: "assets/Species/Dragon.svg",
	webWorm: "assets/Species/Web Worm.svg",
	tunnelWorm: "assets/Species/Tunnel Worm.svg",
	spider: "assets/Species/Spider.svg",
	ooze: "assets/Species/ooze.svg",
	ghost: "assets/Species/Ghost.svg"
};

DE.WEAPON_ASSET = {
	infantry: "assets/weapons/riffle.svg",
	machineGunner: "assets/weapons/machineGun.svg",
	melee: "assets/weapons/sword.svg",
	archer: "assets/weapons/bow.svg",
	ranger: "assets/weapons/bow.svg",
	fireMage: "assets/weapons/fireMage.svg",
	illusionist: "assets/weapons/Illusionist.svg",
	healer: "assets/weapons/Healer.svg",
	mindMage: "assets/weapons/MindMage.svg",
	earthMage: "assets/weapons/EarthMage.svg",
	necromancer: "assets/weapons/Necromancer.svg"
};

DE.RESOURCE_ASSET = {
	gold: "assets/be/gold.svg",
	food: "assets/be/food.svg",
	magic: "assets/be/magic.svg"
};

DE.unitDef = function (type) {
	return DE.UNIT_TYPES[type];
};

DE.speciesArt = function (species) {
	if (species === "ghost") return DE.SPECIES_ASSET.ghost;
	return DE.SPECIES_ASSET[species] || DE.SPECIES_ASSET.human;
};

DE.portraitSpecies = function (species, type) {
	if (type === "ghost") return "ghost";
	if (type === "skeleton") return "undead";
	return species;
};

DE.weaponArt = function (type) {
	var def = DE.unitDef(type);
	if (!def || def.monster || def.undead || def.role === "civilian") return null;
	if (DE.WEAPON_ASSET[type]) return DE.WEAPON_ASSET[type];
	if (def.mage) return "assets/weapons/magic.svg";
	return null;
};

DE.resourceArt = function (kind) {
	return DE.RESOURCE_ASSET[kind] || null;
};

DE.unitDropsWeapon = function (unit) {
	return DE.isWeaponKitType(unit && unit.type);
};

DE.isWeaponKitType = function (type) {
	var def = DE.unitDef(type);
	if (!def || def.monster || def.undead || def.role === "civilian") return false;
	if (def.flags && def.flags.ranger) return false;
	return !!(def.kind === "standard" || def.mage);
};

DE.filterWeaponKits = function (weapons) {
	var out = [];
	var list = weapons || [];
	for (var i = 0; i < list.length; i++) {
		if (DE.isWeaponKitType(list[i])) out.push(list[i]);
	}
	return out;
};

DE.countWeaponKits = function (weapons) {
	var counts = {};
	var list = DE.filterWeaponKits(weapons);
	for (var i = 0; i < list.length; i++) {
		counts[list[i]] = (counts[list[i]] || 0) + 1;
	}
	return counts;
};

DE.groupUnits = function (units) {
	var map = {};
	var order = [];
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		var u = list[i];
		if (u.dead) continue;
		var home = u.homeFactionId || "";
		var key = (u.species || "") + "|" + u.type + "|" + (u.wounded ? "w" : "h") + "|" + home;
		if (!map[key]) {
			map[key] = {
				species: u.species,
				type: u.type,
				wounded: !!u.wounded,
				homeFactionId: u.homeFactionId || null,
				count: 0,
				ids: [],
				units: []
			};
			order.push(key);
		}
		map[key].count += 1;
		map[key].ids.push(u.id);
		map[key].units.push(u);
	}
	return order.map(function (k) { return map[k]; });
};

DE.groupLabel = function (group) {
	var def = DE.unitDef(group.type);
	var species = DE.SPECIES_LABELS[group.species] || group.species || "";
	var typeName = def ? def.name : group.type;
	var n = group.count;
	var same = !species ||
		species.toLowerCase() === String(typeName).toLowerCase() ||
		group.species === group.type;
	var label = n + " " + (same ? typeName : (species + " " + typeName));
	if (group.wounded) label += " (wounded)";
	return label;
};

DE.groupSendKey = function (group) {
	return (group.species || "") + "|" + group.type + (group.wounded ? "|w" : "") + "|" + (group.homeFactionId || "");
};

DE.isHireling = function (unit) {
	return !!(unit && unit.homeFactionId && unit.homeFactionId !== "player");
};

DE.isCivilizedLanguage = function (species) {
	return !!(species && (DE.SPECIES || []).indexOf(species) >= 0);
};

DE.canSpeakWith = function (state, unit) {
	if (!unit) return false;
	return DE.isCivilizedLanguage(unit.species) && DE.hasLanguage(state, unit.species);
};

DE.captiveHomeId = function (cap) {
	if (!cap) return null;
	return cap.homeFactionId || cap.factionId || null;
};

DE.makeCaptiveRecord = function (u) {
	if (!u) return null;
	return {
		id: u.id,
		name: u.name || "",
		type: u.type,
		species: u.species,
		factionId: u.factionId || u.homeFactionId || null,
		homeFactionId: u.homeFactionId || u.factionId || null,
		homeVillageId: u.homeVillageId || null,
		interrogated: !!u.interrogated,
		markHostage: !!u.markHostage
	};
};

DE.unitFromCaptiveRecord = function (state, cap) {
	if (!cap) return null;
	var homeId = DE.captiveHomeId(cap);
	var fac = homeId ? DE.factionById(state, homeId) : null;
	var species = cap.species || (fac && fac.species) || "human";
	var factionId = homeId || cap.factionId || "wild";
	return {
		id: cap.id || DE.nextId(state, "u"),
		name: cap.name || "",
		type: cap.type,
		species: species,
		factionId: factionId,
		homeFactionId: homeId || null,
		homeVillageId: cap.homeVillageId || null,
		wounded: false,
		dead: false,
		away: false,
		equippedWeapons: true,
		foreignWeapons: false,
		previousType: null,
		leader: null,
		markHostage: !!cap.markHostage,
		interrogated: !!cap.interrogated
	};
};

/* Free held captives back into their home faction pool (revive if still recorded dead). */
DE.releaseCaptivesToPools = function (state, captives) {
	if (!captives || !captives.length) return 0;
	var released = 0;
	var list = captives.slice();
	for (var i = 0; i < list.length; i++) {
		var cap = list[i];
		if (!cap) continue;
		var homeId = DE.captiveHomeId(cap);
		if (homeId === "player") {
			var revived = DE.revivePlayerCaptive(state, cap);
			if (revived) released += 1;
			continue;
		}
		var fac = homeId ? DE.factionById(state, homeId) : null;
		if (!fac) continue;
		fac.poolUnits = fac.poolUnits || [];
		var existing = DE.findFactionUnit(state, homeId, cap.id);
		if (existing) {
			existing.dead = false;
			existing.wounded = false;
			existing.away = false;
			released += 1;
			continue;
		}
		fac.poolUnits.push(DE.unitFromCaptiveRecord(state, cap));
		released += 1;
	}
	captives.length = 0;
	return released;
};

DE.revivePlayerCaptive = function (state, cap) {
	if (!state || !cap) return false;
	function reviveIn(list) {
		var arr = list || [];
		for (var i = 0; i < arr.length; i++) {
			if (arr[i] && arr[i].id === cap.id) {
				arr[i].dead = false;
				arr[i].wounded = false;
				arr[i].away = false;
				return true;
			}
		}
		return false;
	}
	if (state.mission && reviveIn(state.mission.party)) return true;
	if (state.mission && state.mission.pendingEncounter && reviveIn(state.mission.pendingEncounter.playerUnits)) {
		return true;
	}
	if (reviveIn(state.player && state.player.units)) return true;
	var u = DE.unitFromCaptiveRecord(state, cap);
	u.factionId = "player";
	u.homeFactionId = u.homeFactionId || "player";
	state.player = state.player || {};
	state.player.units = state.player.units || [];
	state.player.units.push(u);
	return true;
};

DE.releasePartyCaptivesIfWiped = function (state, units, stuff) {
	if (!stuff || !(stuff.captives || []).length) return 0;
	if (DE.livingUnits(units || []).length) return 0;
	return DE.releaseCaptivesToPools(state, stuff.captives);
};

DE.interrogateChance = function (type) {
	return DE.unitStuffPrice(type) >= 100 ? 0.5 : 0.3;
};

DE.isMageType = function (type) {
	var def = DE.unitDef(type);
	return !!(def && def.mage);
};

DE.isRangedRole = function (role) {
	return role === "ranged" || role === "mixed";
};

DE.unitStuffPrice = function (type) {
	if (type === "civilian" || type === "skeleton") return 10;
	if (type === "machineGunner" || type === "ranger") return 100;
	var def = DE.unitDef(type);
	if (!def) return 25;
	if (def.kind === "standard") return 25;
	return 100;
};

DE.unitCombatValue = function (type) {
	var def = DE.unitDef(type);
	if (!def) return 1;
	var add = Math.max(1, def.worth || def.casualty || 5);
	if (def.flags && (def.flags.illusionist || def.flags.earthMage || def.flags.mindMage || def.flags.healer)) add = 15;
	if (def.flags && def.flags.necromancer) add = 15;
	return add;
};

DE.forceGoldCost = function (units) {
	var n = 0;
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].type !== "civilian") n += DE.unitStuffPrice(list[i].type);
	}
	return n;
};

DE.forceCombatValue = function (units) {
	var n = 0;
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		if (list[i] && !list[i].dead) n += DE.unitCombatValue(list[i].type);
	}
	return n;
};

DE.unitSpeciesFor = function (faction, type) {
	if (type === "ghost") return "ghost";
	var def = DE.unitDef(type);
	if (def && def.undead) return "undead";
	if (def && def.monster) return type;
	return (faction && faction.species) || "human";
};

DE.giftGoldEquivalent = function (gift) {
	if (!gift) return 0;
	var n = 0;
	n += (gift.gold || 0);
	n += (gift.food || 0);
	if (gift.weapons) {
		for (var i = 0; i < gift.weapons.length; i++) {
			n += DE.unitStuffPrice(gift.weapons[i]);
		}
	}
	if (gift.captives) {
		for (var j = 0; j < gift.captives.length; j++) {
			n += DE.unitStuffPrice(gift.captives[j].type);
		}
	}
	if (gift.units) {
		for (var k = 0; k < gift.units.length; k++) {
			n += DE.unitStuffPrice(gift.units[k].type);
		}
	}
	if (gift.advice) n += 50;
	return n;
};

DE.actionClass = function (action) {
	if (action === "attack" || action === "seize" || action === "capture" || action === "occupy") return "assault";
	if (action === "gift" || action === "greet" || action === "trade") return "open";
	if (action === "intimidate" || action === "defend") return "intimidate";
	if (action === "retreat") return "retreat";
	if (action === "run") return "run";
	return "other";
};

DE.sideHasSite = function (enc, who) {
	if (!enc) return false;
	if (who === "ai") return !!enc.village;
	if (who === "player") return !!enc.campRaid;
	return false;
};

DE.actionAvailable = function (enc, action, who) {
	if (action === "defend") return DE.sideHasSite(enc, who);
	if (action === "occupy") return DE.sideHasSite(enc, who === "player" ? "ai" : "player");
	return true;
};

DE.runEscapeChance = function (encounter, runnerIsPlayer) {
	var base = encounter && encounter.village ? 0.75 : 0.5;
	return DE.clamp(base + DE.rangerEscapeDelta(encounter, runnerIsPlayer), 0, 1);
};

DE.rangerCount = function (units) {
	var n = 0;
	var list = DE.fightingUnits(units);
	for (var i = 0; i < list.length; i++) {
		if (list[i].type === "ranger") n++;
	}
	return n;
};

/* Side with more rangers is favored: runner escape +20%, or −20% if the pursuer has more. */
DE.rangerEscapeDelta = function (encounter, runnerIsPlayer) {
	if (!encounter) return 0;
	var playerN = DE.rangerCount(encounter.playerUnits);
	var aiN = DE.rangerCount(encounter.aiUnits);
	if (playerN === aiN) return 0;
	var runnerN = runnerIsPlayer ? playerN : aiN;
	var otherN = runnerIsPlayer ? aiN : playerN;
	if (runnerN > otherN) return 0.2;
	return -0.2;
};

/* Stub: rangers will later cancel extra monster abilities. */
DE.rangerMonsterCounter = function () {
	return 0;
};

DE.actionPolarity = function (action) {
	if (action === "gift" || action === "greet" || action === "trade") return 1;
	if (action === "attack" || action === "seize" || action === "capture" || action === "occupy") return -1;
	return 0;
};

DE.summarizeUnits = function (units) {
	return DE.groupUnits(units).map(function (g) { return DE.groupLabel(g); }).join(", ") || "none";
};

DE.livingUnits = function (units) {
	var out = [];
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		if (!list[i].dead) out.push(list[i]);
	}
	return out;
};

DE.isPlayerControlledUnit = function (unit) {
	return !!(unit && unit.factionId === "player");
};

DE.fightingUnits = function (units) {
	var out = [];
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		if (!list[i].dead && !list[i].wounded) out.push(list[i]);
	}
	return out;
};

DE.emptyStuff = function () {
	return { gold: 0, food: 0, magic: 0, weapons: [], captives: [] };
};

DE.makeUnit = function (state, type, species, factionId, opts) {
	opts = opts || {};
	if (state) state.usedUnitNames = state.usedUnitNames || {};
	var name = opts.name || (state && typeof DE.unitName === "function"
		? DE.unitName(state, species || "human", state.usedUnitNames)
		: (type || "soldier"));
	return {
		id: DE.nextId(state, "u"),
		name: name,
		type: type,
		species: species,
		factionId: factionId,
		homeFactionId: opts.homeFactionId || null,
		wounded: !!opts.wounded,
		dead: false,
		equippedWeapons: opts.equippedWeapons !== false,
		foreignWeapons: !!opts.foreignWeapons,
		previousType: opts.previousType || null,
		leader: opts.leader || null,
		away: !!opts.away
	};
};
