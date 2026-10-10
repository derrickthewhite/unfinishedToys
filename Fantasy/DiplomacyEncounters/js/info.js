var DE = DE || {};

/* Types factions may learn about when fighting the expedition. */
DE.HUMAN_INTEL_TYPES = ["infantry", "machineGunner", "civilian", "melee", "archer"]
	.concat(DE.MAGE_TYPES || []);

DE.UNIT_BLURBS = {
	infantry: "Human rifle line. Steady ranged fire; the backbone of the expedition.",
	machineGunner: "Heavy human gunner. Anchors a fire lane and punishes clumps.",
	melee: "Close steel. Cheap and common among cavern peoples.",
	archer: "Bows at range. Lighter than rifles, still deadly in numbers.",
	ranger: "Long-range scout. The side with more rangers is harder to run down — and will later spoil extra monster tricks.",
	civilian: "Unarmed camp follower. No fighting value until given a kit.",
	illusionist: "Mage of false images. Muddies who is truly strong.",
	fireMage: "Throws fire. High worth, fragile if pressed.",
	healer: "Keeps the wounded in the fight; adds the best ally's worth again.",
	mindMage: "Twists will. Shifts combat value between sides.",
	earthMage: "Stone and shock. Hard to ignore in a press.",
	necromancer: "Raises and steadies the dead. Without one, undead wither.",
	skeleton: "Bone melee. Weak alone; dangerous under a necromancer.",
	ghost: "Half here, half not. Hard to pin and unsettling in the dark.",
	dragon: "Apex beast. Vast worth; few things stand after it breathes.",
	spider: "Skittering hunter. Strong melee for its size.",
	tunnelWorm: "Burrower. Guns lose bite against it.",
	webWorm: "Mixed terror — webs and muscle both.",
	ooze: "Corroding mass. Blades and boots find little purchase."
};

DE.emptyLanguages = function () {
	var out = {};
	var list = DE.SPECIES || [];
	for (var i = 0; i < list.length; i++) out[list[i]] = false;
	return out;
};

DE.emptyHumanIntel = function () {
	var out = {};
	var list = DE.HUMAN_INTEL_TYPES || [];
	for (var i = 0; i < list.length; i++) out[list[i]] = false;
	return out;
};

DE.fullHumanIntel = function () {
	var out = {};
	var list = DE.HUMAN_INTEL_TYPES || [];
	for (var i = 0; i < list.length; i++) out[list[i]] = true;
	return out;
};

DE.ensureInfoState = function (state) {
	if (!state || !state.player) return;
	state.player.languages = state.player.languages || DE.emptyLanguages();
	state.player.seenTypes = state.player.seenTypes || {};
	state.player.facedTypes = state.player.facedTypes || {};
	state.player.knownTypes = state.player.knownTypes || ["infantry", "machineGunner"];
	state.player.knownMonsters = state.player.knownMonsters || {};
	/* Native expedition kits count as seen from the start. */
	var native = ["infantry", "machineGunner", "civilian"];
	for (var n = 0; n < native.length; n++) state.player.seenTypes[native[n]] = true;
	var factions = state.factions || [];
	for (var i = 0; i < factions.length; i++) {
		var f = factions[i];
		if (f.kind === "animal") continue;
		if (!f.knownHumanTypes) {
			f.knownHumanTypes = f.hostileTarget ? DE.fullHumanIntel() : DE.emptyHumanIntel();
		} else if (f.hostileTarget) {
			f.knownHumanTypes = DE.fullHumanIntel();
		}
	}
};

DE.knowLanguage = function (state, species) {
	if (!state || !state.player || !species) return;
	if ((DE.SPECIES || []).indexOf(species) < 0) return;
	state.player.languages = state.player.languages || DE.emptyLanguages();
	state.player.languages[species] = true;
};

DE.hasLanguage = function (state, species) {
	if (!state || !state.player) return false;
	state.player.languages = state.player.languages || DE.emptyLanguages();
	return !!state.player.languages[species];
};

DE.markSeenType = function (state, type) {
	if (!state || !state.player || !type) return;
	state.player.seenTypes = state.player.seenTypes || {};
	state.player.seenTypes[type] = true;
};

DE.hasSeenType = function (state, type) {
	if (!state || !state.player || !type) return false;
	return !!(state.player.seenTypes && state.player.seenTypes[type]);
};

DE.markSeenTypesFromUnits = function (state, units) {
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].type) DE.markSeenType(state, list[i].type);
	}
};

DE.markFacedType = function (state, type) {
	if (!state || !state.player || !type) return;
	DE.markSeenType(state, type);
	state.player.facedTypes = state.player.facedTypes || {};
	state.player.facedTypes[type] = true;
};

DE.hasFacedType = function (state, type) {
	if (!state || !state.player || !type) return false;
	return !!(state.player.facedTypes && state.player.facedTypes[type]);
};

DE.markFacedTypesFromUnits = function (state, units) {
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].type) DE.markFacedType(state, list[i].type);
	}
};

DE.unitBlurb = function (type) {
	return DE.UNIT_BLURBS[type] || ((DE.unitDef(type) || {}).name || type);
};

DE.factionKnowsHumanType = function (faction, type) {
	if (!faction || !type) return false;
	if (faction.hostileTarget) return true;
	return !!(faction.knownHumanTypes && faction.knownHumanTypes[type]);
};

DE.markFactionHumanIntelFromUnits = function (state, factionId, units) {
	var faction = DE.factionById(state, factionId);
	if (!faction || faction.kind === "animal") return;
	if (faction.hostileTarget) {
		faction.knownHumanTypes = DE.fullHumanIntel();
		return;
	}
	faction.knownHumanTypes = faction.knownHumanTypes || DE.emptyHumanIntel();
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		var type = list[i] && list[i].type;
		if (!type) continue;
		if ((DE.HUMAN_INTEL_TYPES || []).indexOf(type) >= 0) {
			faction.knownHumanTypes[type] = true;
		}
	}
};

DE.onInfoContact = function (state, factionId) {
	/* Language is learned through camp training, not hire or capture. */
	if (!state || !factionId) return;
	DE.ensureInfoState(state);
};

DE.infoWeaponTypes = function () {
	var out = [];
	var keys = Object.keys(DE.UNIT_TYPES || {});
	for (var i = 0; i < keys.length; i++) {
		if (DE.isWeaponKitType(keys[i]) || keys[i] === "infantry" || keys[i] === "machineGunner") {
			out.push(keys[i]);
		}
	}
	return out;
};

DE.infoUnitCatalog = function () {
	return Object.keys(DE.UNIT_TYPES || {});
};

DE.applyBattleInfo = function (state, enc, result) {
	if (!result || !result.battle || result.displayBattle) return;
	DE.ensureInfoState(state);
	DE.markFacedTypesFromUnits(state, enc && enc.aiUnits);
	if (enc && enc.factionId) {
		DE.markFactionHumanIntelFromUnits(state, enc.factionId, enc.playerUnits);
	}
};
