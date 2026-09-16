var DE = DE || {};

DE.ACTIONS = ["attack", "intimidate", "gift", "greet", "seize", "capture", "retreat", "run", "trade"];

DE.ACTION_LABELS = {
	attack: "Attack",
	intimidate: "Intimidate",
	gift: "Gift",
	greet: "Greet",
	seize: "Seize",
	capture: "Capture",
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
	fireMage: "assets/weapons/fireball.svg"
};

DE.unitDef = function (type) {
	return DE.UNIT_TYPES[type];
};

DE.speciesArt = function (species) {
	if (species === "ghost") return DE.SPECIES_ASSET.ghost;
	return DE.SPECIES_ASSET[species] || DE.SPECIES_ASSET.human;
};

DE.weaponArt = function (type) {
	var def = DE.unitDef(type);
	if (!def || def.monster || def.undead || def.role === "civilian") return null;
	if (DE.WEAPON_ASSET[type]) return DE.WEAPON_ASSET[type];
	if (def.mage) return "assets/weapons/magic.svg";
	return null;
};

DE.unitDropsWeapon = function (unit) {
	var def = DE.unitDef(unit && unit.type);
	if (!def || def.monster || def.undead || def.role === "civilian") return false;
	return !!(def.kind === "standard" || def.mage);
};

DE.groupUnits = function (units) {
	var map = {};
	var order = [];
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		var u = list[i];
		if (u.dead) continue;
		var key = (u.species || "") + "|" + u.type + "|" + (u.wounded ? "w" : "h");
		if (!map[key]) {
			map[key] = {
				species: u.species,
				type: u.type,
				wounded: !!u.wounded,
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
	var label = n + " " + species + " " + typeName;
	if (group.wounded) label += " (wounded)";
	return label;
};

DE.isMageType = function (type) {
	var def = DE.unitDef(type);
	return !!(def && def.mage);
};

DE.isRangedRole = function (role) {
	return role === "ranged" || role === "mixed";
};

DE.unitStuffPrice = function (type) {
	if (type === "civilian") return 10;
	var def = DE.unitDef(type);
	if (!def) return 25;
	if (def.kind === "standard") return 25;
	return 100;
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
	return n;
};

DE.actionClass = function (action) {
	if (action === "attack" || action === "seize" || action === "capture") return "assault";
	if (action === "gift" || action === "greet" || action === "trade") return "open";
	if (action === "intimidate") return "intimidate";
	if (action === "retreat") return "retreat";
	if (action === "run") return "run";
	return "other";
};

DE.actionPolarity = function (action) {
	if (action === "gift" || action === "greet" || action === "trade") return 1;
	if (action === "attack" || action === "seize" || action === "capture") return -1;
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

DE.fightingUnits = function (units) {
	var out = [];
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		if (!list[i].dead && !list[i].wounded) out.push(list[i]);
	}
	return out;
};

DE.emptyStuff = function () {
	return { gold: 0, food: 0, weapons: [], captives: [] };
};

DE.makeUnit = function (state, type, species, factionId, opts) {
	opts = opts || {};
	return {
		id: DE.nextId(state, "u"),
		type: type,
		species: species,
		factionId: factionId,
		wounded: !!opts.wounded,
		dead: false,
		equippedWeapons: opts.equippedWeapons !== false,
		foreignWeapons: !!opts.foreignWeapons,
		previousType: opts.previousType || null
	};
};
