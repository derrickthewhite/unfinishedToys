var DE = DE || {};

DE.playerLiving = function (state) {
	return DE.livingUnits(state.player.units);
};

DE.FOOD_GOLD_COST = 0.5;

DE.recruitCost = function (type) {
	return DE.unitStuffPrice(type);
};

DE.marchWeaponSetTypes = function () {
	return ["infantry", "machineGunner"];
};

DE.isAllowedMarchWeaponSet = function (state, type) {
	return DE.marchWeaponSetTypes(state).indexOf(type) >= 0;
};

DE.knownUnitTypes = function (state) {
	var known = { infantry: true, machineGunner: true };
	var list = state.player.knownTypes || [];
	for (var i = 0; i < list.length; i++) known[list[i]] = true;
	return known;
};

DE.canRecruit = function (state, type) {
	if (type === "civilian" || type === "infantry" || type === "machineGunner") return true;
	return false;
};

DE.recruitUnit = function (state, type) {
	if (!DE.canRecruit(state, type)) {
		return { ok: false, reason: "Cannot recruit that — raise civilians and equip foreign kits once trained" };
	}
	var cost = DE.recruitCost(type);
	if (state.player.gold < cost) return { ok: false, reason: "Not enough gold" };
	state.player.gold -= cost;
	state.player.units.push(DE.makeUnit(state, type, "human", "player"));
	return { ok: true };
};

DE.canUseKit = function (state, type) {
	return DE.isWeaponKitType(type) && !!DE.knownUnitTypes(state)[type];
};

DE.equipKitOnCivilian = function (state, unitId, type) {
	var u = null;
	for (var i = 0; i < state.player.units.length; i++) {
		if (state.player.units[i].id === unitId) u = state.player.units[i];
	}
	if (!u || u.dead || u.type !== "civilian") {
		return { ok: false, reason: "Pick a civilian" };
	}
	if (!DE.isWeaponKitType(type)) return { ok: false, reason: "Not a weapon kit" };
	if (!DE.canUseKit(state, type)) {
		var label = (DE.unitDef(type) || {}).name || type;
		return { ok: false, reason: "Need training before you can equip " + label };
	}
	var weps = state.player.weapons || [];
	var ix = weps.indexOf(type);
	if (ix < 0) return { ok: false, reason: "Need a " + ((DE.unitDef(type) || {}).name || type) + " kit in camp" };
	weps.splice(ix, 1);
	u.type = type;
	u.previousType = null;
	u.equippedWeapons = true;
	u.foreignWeapons = type !== "infantry" && type !== "machineGunner";
	return { ok: true };
};

DE.reequipUnit = function (state, unitId) {
	var u = null;
	for (var i = 0; i < state.player.units.length; i++) {
		if (state.player.units[i].id === unitId) u = state.player.units[i];
	}
	if (!u || u.dead || u.type !== "civilian" || !u.previousType) {
		return { ok: false, reason: "Nothing to reequip" };
	}
	return DE.equipKitOnCivilian(state, unitId, u.previousType);
};

DE.buyWeaponSet = function (state, type) {
	if (!type || type === "civilian") return { ok: false, reason: "Cannot buy that set" };
	if (!DE.isWeaponKitType(type)) return { ok: false, reason: "Not a weapon kit" };
	var cost = DE.unitStuffPrice(type);
	if (state.player.gold < cost) return { ok: false, reason: "Not enough gold" };
	state.player.weapons = state.player.weapons || [];
	state.player.gold -= cost;
	state.player.weapons.push(type);
	return { ok: true, cost: cost };
};

DE.startTraining = function (state, unitId) {
	var idx = -1;
	var u = null;
	for (var i = 0; i < state.player.units.length; i++) {
		if (state.player.units[i].id === unitId && !state.player.units[i].dead) {
			idx = i;
			u = state.player.units[i];
			break;
		}
	}
	if (!u) return { ok: false, reason: "Unit not found" };
	if (u.type === "civilian") return { ok: false, reason: "Civilians cannot train a role" };
	if (DE.canRecruit(state, u.type)) return { ok: false, reason: "Already trained for that kit" };
	if (DE.isHireling(u) && !DE.canSpeakWith(state, u)) {
		return { ok: false, reason: "He can't train until you share a language." };
	}
	state.player.training = state.player.training || [];
	state.player.training.push({
		kind: "kit",
		type: u.type,
		species: u.species,
		remaining: 5,
		name: u.name || (DE.unitDef(u.type) || {}).name || u.type,
		unit: DE.deepClone(u)
	});
	state.player.units.splice(idx, 1);
	return { ok: true };
};

DE.startLanguageTraining = function (state, id) {
	if (!id) return { ok: false, reason: "No one selected" };
	state.player.training = state.player.training || [];
	var idx;
	var u = null;
	for (idx = 0; idx < (state.player.units || []).length; idx++) {
		if (state.player.units[idx].id === id && !state.player.units[idx].dead) {
			u = state.player.units[idx];
			break;
		}
	}
	if (u) {
		if (!DE.isCivilizedLanguage(u.species)) {
			return { ok: false, reason: "No language to learn from them." };
		}
		if (DE.hasLanguage(state, u.species)) {
			return { ok: false, reason: "You already know that language." };
		}
		state.player.training.push({
			kind: "language",
			type: u.type,
			species: u.species,
			remaining: 10,
			name: u.name || (DE.unitDef(u.type) || {}).name || u.type,
			unit: DE.deepClone(u)
		});
		state.player.units.splice(idx, 1);
		return { ok: true };
	}
	var caps = state.player.captives || [];
	var cix = -1;
	var cap = null;
	for (var c = 0; c < caps.length; c++) {
		if (caps[c].id === id) {
			cix = c;
			cap = caps[c];
			break;
		}
	}
	if (!cap) return { ok: false, reason: "Not in camp" };
	if (!DE.isCivilizedLanguage(cap.species)) {
		return { ok: false, reason: "No language to learn from them." };
	}
	if (DE.hasLanguage(state, cap.species)) {
		return { ok: false, reason: "You already know that language." };
	}
	state.player.training.push({
		kind: "language",
		type: cap.type,
		species: cap.species,
		remaining: 10,
		name: cap.name || (DE.unitDef(cap.type) || {}).name || cap.type,
		captive: DE.deepClone(cap)
	});
	caps.splice(cix, 1);
	return { ok: true };
};

DE.tickTraining = function (state, n) {
	n = n || 1;
	state.player.training = state.player.training || [];
	var done = [];
	for (var i = 0; i < state.player.training.length; i++) {
		state.player.training[i].remaining -= n;
	}
	var still = [];
	for (var j = 0; j < state.player.training.length; j++) {
		var t = state.player.training[j];
		if (t.remaining > 0) {
			still.push(t);
			continue;
		}
		if (t.kind === "language") {
			DE.knowLanguage(state, t.species);
			if (t.unit) {
				state.player.units = state.player.units || [];
				state.player.units.push(t.unit);
			} else if (t.captive) {
				state.player.captives = state.player.captives || [];
				state.player.captives.push(t.captive);
			}
		} else {
			state.player.knownTypes = state.player.knownTypes || [];
			if (t.type && state.player.knownTypes.indexOf(t.type) < 0) state.player.knownTypes.push(t.type);
			if (t.unit) {
				state.player.units = state.player.units || [];
				state.player.units.push(t.unit);
			}
		}
		done.push(t);
	}
	state.player.training = still;
	return done;
};

DE.trainingNotice = function (job) {
	if (!job) return "";
	if (job.kind === "language") {
		var label = DE.SPECIES_LABELS[job.species] || job.species || "that tongue";
		return job.name + " finished language training — you learned " + label + ".";
	}
	return job.name + " finished training and returned — you can equip that kit.";
};

DE.findPlayerUnit = function (state, unitId) {
	var list = (state.player && state.player.units) || [];
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].id === unitId) return list[i];
	}
	return null;
};

DE.findCaptive = function (state, captiveId) {
	var list = (state.player && state.player.captives) || [];
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].id === captiveId) return list[i];
	}
	return null;
};

DE.interrogateCaptive = function (state, captiveId) {
	var cap = DE.findCaptive(state, captiveId);
	if (!cap) return { ok: false, reason: "No such captive" };
	if (cap.interrogated) return { ok: false, reason: "Already interrogated" };
	if (!DE.canSpeakWith(state, cap)) {
		return { ok: false, reason: "You do not share a language." };
	}
	var homeId = DE.captiveHomeId(cap);
	var fac = DE.factionById(state, homeId);
	if (!fac || fac.kind === "loner" || fac.monsterType) {
		cap.interrogated = true;
		return { ok: true, found: false, reason: "They have no village to name." };
	}
	cap.interrogated = true;
	var chance = DE.interrogateChance(cap.type);
	if (DE.rngNext(state) >= chance) {
		return { ok: true, found: false, reason: "They give nothing useful." };
	}
	var hidden = DE.villagesByFaction(state, homeId).filter(function (v) { return v && !v.discovered; });
	if (!hidden.length) {
		return { ok: true, found: false, reason: "They have no hidden village left to name." };
	}
	var village = DE.rngPick(state, hidden);
	village.discovered = true;
	DE.appendChronicle(state, "A captive named " + village.name + " at depth " + village.distance + ".");
	return {
		ok: true,
		found: true,
		village: village,
		reason: village.name + " lies " + village.distance + " encounters from your base."
	};
};

DE.askHirelingVillage = function (state, unitId) {
	var u = DE.findPlayerUnit(state, unitId);
	if (!u || !DE.isHireling(u)) return { ok: false, reason: "Not a hireling" };
	if (!DE.canSpeakWith(state, u)) {
		return { ok: false, reason: "You do not share a language." };
	}
	if (!u.homeVillageId) u.homeVillageId = DE.assignHireVillage(state, u.homeFactionId);
	var village = DE.villageById(state, u.homeVillageId);
	if (!village) return { ok: false, reason: "They have no village to name." };
	if (village.discovered) {
		return { ok: true, reason: "You already know " + village.name + "." };
	}
	village.discovered = true;
	DE.appendChronicle(state, "A hireling named " + village.name + " at depth " + village.distance + ".");
	return {
		ok: true,
		village: village,
		reason: village.name + " lies " + village.distance + " encounters from your base."
	};
};

DE.giftHireling = function (state, unitId, gift) {
	var u = DE.findPlayerUnit(state, unitId);
	if (!u || !DE.isHireling(u)) return { ok: false, reason: "Not a hireling" };
	gift = gift || {};
	var gold = Math.max(0, Math.floor(Number(gift.gold) || 0));
	var food = Math.max(0, Math.floor(Number(gift.food) || 0));
	if (!gold && !food) return { ok: false, reason: "Offer gold or food." };
	if ((state.player.gold || 0) < gold) return { ok: false, reason: "Need " + gold + " gold" };
	if ((state.player.food || 0) < food) return { ok: false, reason: "Need " + food + " food" };
	state.player.gold -= gold;
	state.player.food = (state.player.food || 0) - food;
	var packed = { gold: gold, food: food, weapons: [], captives: [] };
	var value = DE.giftGoldEquivalent(packed);
	DE.appendLog(state, {
		id: DE.nextId(state, "E"),
		factionId: u.homeFactionId,
		rounds: [{ player: "gift", ai: "greet", giftValue: value }],
		gifted: true,
		giftValue: value,
		outcome: "camp gift to a hireling"
	});
	DE.appendChronicle(state, "Gifted a hireling of " +
		((DE.factionById(state, u.homeFactionId) || {}).name || "their people") + ".");
	return { ok: true, value: value, reason: "They will remember a gift worth " + value + "g." };
};

DE.tickHireContracts = function (state, blocks) {
	blocks = Number(blocks) || 0;
	if (blocks <= 0) return;
	function tick(u) {
		if (!u || !DE.isHireling(u) || u.hireRemitsLeft == null) return;
		u.hireRemitsLeft -= blocks;
		if (u.hireRemitsLeft <= 0) {
			u.hireRemitsLeft = 0;
			u.hireExpired = true;
		}
	}
	var units = (state.player && state.player.units) || [];
	for (var i = 0; i < units.length; i++) tick(units[i]);
	var jobs = (state.player && state.player.training) || [];
	for (var t = 0; t < jobs.length; t++) {
		if (jobs[t].unit) tick(jobs[t].unit);
	}
};

DE.rehireUnit = function (state, unitId) {
	var u = DE.findPlayerUnit(state, unitId);
	if (!u || !DE.isHireling(u)) return { ok: false, reason: "Not a hireling" };
	if (!u.hireExpired) return { ok: false, reason: "Their contract is still good." };
	var price = u.hirePrice != null ? u.hirePrice : DE.unitStuffPrice(u.type);
	if ((state.player.gold || 0) < price) return { ok: false, reason: "Need " + price + " gold" };
	state.player.gold -= price;
	var village = DE.villageById(state, u.homeVillageId);
	if (!village) {
		u.homeVillageId = DE.assignHireVillage(state, u.homeFactionId);
		village = DE.villageById(state, u.homeVillageId);
	}
	if (village) village.gold = (village.gold || 0) + price;
	u.hireRemitsLeft = 3;
	u.hireExpired = false;
	return { ok: true, price: price, reason: "Hired on for three more remittances · " + price + "g." };
};

DE.releaseHireling = function (state, unitId) {
	var u = DE.removeUnitFromList((state.player && state.player.units) || [], unitId);
	if (!u || !DE.isHireling(u)) {
		if (u) (state.player.units || []).push(u);
		return { ok: false, reason: "Not a hireling" };
	}
	var fac = DE.factionById(state, u.homeFactionId);
	u.factionId = u.homeFactionId;
	u.hireExpired = false;
	u.hireRemitsLeft = null;
	u.away = false;
	u.dead = false;
	if (fac) {
		fac.poolUnits = fac.poolUnits || [];
		fac.poolUnits.push(u);
	}
	DE.syncPoliticsContacts(state);
	return { ok: true, reason: (u.name || "They") + " returned to their people." };
};

DE.captureHireling = function (state, unitId) {
	var u = DE.removeUnitFromList((state.player && state.player.units) || [], unitId);
	if (!u || !DE.isHireling(u)) {
		if (u) (state.player.units || []).push(u);
		return { ok: false, reason: "Not a hireling" };
	}
	var rec = DE.makeCaptiveRecord(u);
	rec.interrogated = false;
	state.player.captives = state.player.captives || [];
	state.player.captives.push(rec);
	DE.appendLog(state, {
		id: DE.nextId(state, "E"),
		factionId: u.homeFactionId,
		rounds: [{ player: "capture", ai: "retreat" }],
		outcome: "captured a hireling"
	});
	DE.onPoliticsCapture(state, u.homeFactionId);
	DE.appendChronicle(state, "Took " + (u.name || "a hireling") + " captive.");
	return { ok: true, reason: (u.name || "They") + " is now a captive. Their people will not forget." };
};

DE.sellMissionWeapon = function (state, unitId) {
	var m = state.mission;
	if (!m) return { ok: false, reason: "Not on a mission" };
	var u = null;
	for (var i = 0; i < m.party.length; i++) {
		if (m.party[i].id === unitId) u = m.party[i];
	}
	if (!u || u.dead) return { ok: false, reason: "Unit not found" };
	if (u.type === "civilian" || !DE.unitDropsWeapon(u)) {
		return { ok: false, reason: "No weapons to sell" };
	}
	var price = DE.unitStuffPrice(u.type);
	var fac = state.mission && state.mission.pendingEncounter
		? DE.factionById(state, state.mission.pendingEncounter.factionId)
		: null;
	if (fac) price = DE.weaponKitSellPrice(u.type, fac);
	u.previousType = u.type;
	u.type = "civilian";
	u.equippedWeapons = false;
	m.stuff.gold = (m.stuff.gold || 0) + price;
	return { ok: true, price: price };
};

DE.startMission = function (state, opts) {
	opts = opts || {};
	var selected = opts.unitIds || [];
	var party = [];
	for (var i = 0; i < state.player.units.length; i++) {
		var u = state.player.units[i];
		if (u.dead) continue;
		if (selected.indexOf(u.id) >= 0) {
			var copy = DE.deepClone(u);
			copy.wounded = false;
			party.push(copy);
		}
	}
	if (!party.length) return { ok: false, reason: "No soldiers" };

	var foodBuy = Math.max(0, Math.floor(opts.foodBuy || 0));
	var foodCost = foodBuy * DE.FOOD_GOLD_COST;
	var setBuys = opts.weaponSetBuys || [];
	var setCost = 0;
	for (var s = 0; s < setBuys.length; s++) {
		if (!DE.isAllowedMarchWeaponSet(state, setBuys[s])) {
			return { ok: false, reason: "Cannot buy that weapon set for the march" };
		}
		setCost += DE.unitStuffPrice(setBuys[s]);
	}
	var reserved = foodCost + setCost;
	if (state.player.gold + 1e-9 < reserved) {
		return { ok: false, reason: "Need " + reserved + " gold for food and weapon sets" };
	}
	var maxTake = Math.floor(state.player.gold - reserved);
	var goldTake = Math.max(0, Math.floor(opts.goldTake != null ? opts.goldTake : maxTake));
	if (goldTake > maxTake) {
		return { ok: false, reason: "Cannot take that much gold" };
	}

	state.player.gold -= foodCost;
	state.player.gold -= setCost;
	state.player.gold -= goldTake;

	var campWeapons = DE.filterWeaponKits(state.player.weapons || []);
	var takeQuota = {};
	var takeOpts = opts.weaponTakeCounts || {};
	var campCounts = DE.countWeaponKits(campWeapons);
	Object.keys(campCounts).forEach(function (type) {
		takeQuota[type] = Math.max(0, Math.min(campCounts[type], Math.floor(Number(takeOpts[type]) || 0)));
	});
	var takenWeapons = [];
	var leftWeapons = [];
	for (var w = 0; w < campWeapons.length; w++) {
		var kit = campWeapons[w];
		if ((takeQuota[kit] || 0) > 0) {
			takenWeapons.push(kit);
			takeQuota[kit] -= 1;
		} else {
			leftWeapons.push(kit);
		}
	}
	for (var b = 0; b < setBuys.length; b++) {
		takenWeapons.push(setBuys[b]);
	}
	state.player.weapons = leftWeapons;

	var carriedFood = Math.max(0, Math.floor(state.player.food || 0));
	state.player.food = 0;
	var foodTaken = foodBuy + carriedFood;

	var village = null;
	if (opts.villageId) {
		for (var v = 0; v < state.villages.length; v++) {
			if (state.villages[v].id === opts.villageId) village = state.villages[v];
		}
	}
	var distance = village ? DE.villageMarchLength(village) : Math.max(1, Math.floor(opts.distance || 5));
	if (village) DE.syncVillageMarch(village);
	state.missionCount += 1;
	state.mission = {
		id: "M" + state.missionCount,
		distance: distance,
		remaining: distance,
		progressed: 0,
		attempted: 0,
		returning: false,
		cancelled: false,
		villageId: village ? village.id : null,
		villageAt: village ? village.distance : -1,
		metVillageIds: [],
		party: party,
		stuff: {
			gold: goldTake,
			food: foodTaken,
			magic: Math.max(0, Math.floor(state.player.magic || 0)),
			weapons: takenWeapons,
			captives: DE.deepClone(state.player.captives || [])
		},
		beat: 0,
		encountersAtStart: state.totalEncounters || 0,
		hungryBeats: 0,
		starved: false,
		startSnapshot: {
			party: party.length,
			gold: goldTake,
			food: foodTaken,
			weapons: takenWeapons.length,
			captives: (state.player.captives || []).length
		}
	};
	state.ui.screen = "mission";
	state.ui.weaponTakeCounts = {};
	state.ui.weaponSetBuys = {};
	state.player.magic = 0;
	var startBits = [
		"Mission " + state.mission.id + " began",
		party.length + " soldier" + (party.length === 1 ? "" : "s"),
		goldTake + "g",
		foodTaken + " food",
		(state.mission.stuff.magic || 0) + " magic",
		takenWeapons.length + " kit" + (takenWeapons.length === 1 ? "" : "s")
	];
	if (village) startBits.push("for " + village.name);
	DE.appendChronicle(state, startBits.join(" · "));
	DE.nextBeat(state);
	return { ok: true };
};

DE.cancelMission = function (state) {
	var m = state.mission;
	if (!m || m.returning) return { ok: false };
	if (m.progressed >= m.distance / 2) return { ok: false, reason: "Past halfway" };
	if (typeof DE.returnEncounterTreasury === "function") DE.returnEncounterTreasury(state, m.pendingEncounter);
	m.returning = true;
	m.cancelled = true;
	m.remaining = Math.max(1, m.progressed);
	m.villageAt = -1;
	return { ok: true };
};

DE.eatFood = function (state) {
	var m = state.mission;
	var n = DE.livingUnits(m.party).length;
	if (m.stuff.food >= n) {
		m.stuff.food -= n;
		return { hungry: false, starved: 0, penalty: DE.hungerPenalty(state) };
	}
	m.stuff.food = 0;
	m.hungryBeats = (m.hungryBeats || 0) + 1;
	var penalty = DE.hungerPenalty(state);
	return { hungry: true, starved: 0, penalty: penalty };
};

DE.hungerPenalty = function (state) {
	var m = state && state.mission;
	if (!m) return 0;
	return Math.min(0.4, (m.hungryBeats || 0) * 0.05);
};

DE.hungerLabel = function (state) {
	var beats = (state.mission && state.mission.hungryBeats) || 0;
	if (!beats) return "";
	var pct = Math.round(DE.hungerPenalty(state) * 100);
	return "Hungry −" + pct + "%";
};

DE.starveExpedition = function (state) {
	var m = state.mission;
	if (!m) return;
	for (var i = 0; i < m.party.length; i++) {
		m.party[i].dead = true;
		m.party[i].wounded = false;
	}
	m.stuff.gold = 0;
	m.stuff.food = 0;
	m.stuff.weapons = [];
	DE.releaseCaptivesToPools(state, m.stuff.captives || []);
	m.stuff.captives = [];
	m.starved = true;
	m.cancelled = true;
	DE.appendChronicle(state, "Mission " + m.id + " starved · Hungry −40% · none returned");
	state.ui.flash = "The expedition starved. No one came back.";
	state.ui.message = "Hunger took them all.";
	DE.returnToBase(state);
};

DE.expectedFoodBuy = function (state) {
	var party = 0;
	var counts = (state.ui && state.ui.sendCounts) || {};
	var groups = DE.groupUnits(DE.playerLiving(state));
	for (var i = 0; i < groups.length; i++) {
		var g = groups[i];
		var key = DE.groupSendKey(g);
		var send = counts[key];
		if (send == null) send = 0;
		party += Math.max(0, Math.min(g.count, Math.floor(Number(send) || 0)));
	}
	if (!party && state.ui && state.ui.selectedUnitIds && state.ui.selectedUnitIds.length) {
		party = state.ui.selectedUnitIds.length;
	}
	var distance = Math.max(1, Math.floor((state.ui && state.ui.missionDistance) || 5));
	var need = party * distance;
	var camp = Math.max(0, Math.floor((state.player && state.player.food) || 0));
	return Math.max(0, need - camp);
};

DE.expectedFoodPartySize = function (state) {
	var counts = (state.ui && state.ui.sendCounts) || {};
	var groups = DE.groupUnits(DE.playerLiving(state));
	var party = 0;
	for (var i = 0; i < groups.length; i++) {
		var g = groups[i];
		var key = DE.groupSendKey(g);
		var send = counts[key];
		if (send == null) send = 0;
		party += Math.max(0, Math.min(g.count, Math.floor(Number(send) || 0)));
	}
	return party;
};

DE.missionDepth = function (m) {
	if (!m) return 0;
	var D = Math.max(1, m.distance || 1);
	var p = Math.max(0, m.progressed || 0);
	if (p <= 0) return 0;
	if (p > D) return 0;
	var apex = Math.ceil(D / 2);
	if (p <= apex) return p;
	/* Mirror the outbound climb so odd lengths don't skip (1,2,3,2,1 not 1,2,3,1). */
	return Math.max(0, apex - (p - apex));
};

/* Depth of the beat about to resolve (village depth must match this). */
DE.encounterDepth = function (m) {
	if (!m) return 0;
	return DE.missionDepth({
		distance: m.distance,
		progressed: Math.max(0, m.progressed || 0) + 1
	});
};

DE.CAMP_RAID_CHANCE = 0.1;

DE.hostileRaiderFactions = function (state) {
	var out = [];
	var civ = DE.civilizedFactions(state);
	for (var i = 0; i < civ.length; i++) {
		var f = civ[i];
		if (!DE.availableUnits(f.poolUnits).length) continue;
		if (f.hostileTarget) {
			out.push(f);
			continue;
		}
		var t = typeof DE.politicsTrust === "function" ? DE.politicsTrust(state, f.id, "player") : null;
		if (typeof DE.politicsBand === "function" && DE.politicsBand(t) === "hostile") out.push(f);
	}
	return out;
};

DE.maybeQueueCampRaid = function (state) {
	if (!state || !state.mission || state.queuedCampRaid) return null;
	if (!DE.campLeftoverUnits(state).length) return null;
	var eligible = DE.hostileRaiderFactions(state);
	var hits = [];
	for (var i = 0; i < eligible.length; i++) {
		if (DE.rngNext(state) < DE.CAMP_RAID_CHANCE) hits.push(eligible[i]);
	}
	if (!hits.length) return null;
	state.queuedCampRaid = { factionId: DE.rngPick(state, hits).id };
	return state.queuedCampRaid;
};

DE.campLeftoverUnits = function (state) {
	var ids = {};
	var party = (state.mission && state.mission.party) || [];
	for (var i = 0; i < party.length; i++) {
		if (party[i] && party[i].id) ids[party[i].id] = true;
	}
	var out = [];
	var list = (state.player && state.player.units) || [];
	for (var j = 0; j < list.length; j++) {
		if (!list[j] || list[j].dead) continue;
		if (ids[list[j].id]) continue;
		out.push(list[j]);
	}
	return out;
};

DE.campGarrisonStuff = function (state) {
	return {
		gold: (state.player && state.player.gold) || 0,
		food: (state.player && state.player.food) || 0,
		magic: (state.player && state.player.magic) || 0,
		weapons: (state.player && state.player.weapons) || [],
		captives: []
	};
};

DE.syncCampGarrisonStuff = function (state, stuff) {
	if (!state || !state.player || !stuff) return;
	state.player.gold = stuff.gold || 0;
	state.player.food = stuff.food || 0;
	state.player.magic = stuff.magic || 0;
	state.player.weapons = stuff.weapons || [];
};

DE.buildCampRaidEncounter = function (state, factionId) {
	var faction = DE.factionById(state, factionId);
	if (!faction) return null;
	var units = DE.drawUnitsFromList(faction.poolUnits, DE.encounterSizeTarget(state, "medium"), {
		state: state,
		shuffle: true,
		preferLeader: true,
		combatOnly: true
	});
	if (!units.length) {
		units = DE.availableUnits(faction.poolUnits);
		for (var a = 0; a < units.length; a++) units[a].away = true;
	}
	if (!units.length) return null;
	var leader = null;
	for (var i = 0; i < units.length; i++) {
		if (units[i].leader) { leader = units[i]; break; }
	}
	var enc = {
		id: DE.nextId(state, "E"),
		factionId: faction.id,
		kind: "campRaid",
		size: "medium",
		village: false,
		villageName: null,
		villageRec: null,
		campRaid: true,
		leader: leader,
		playerUnits: DE.campLeftoverUnits(state),
		aiUnits: units,
		playerStuff: DE.campGarrisonStuff(state),
		aiStuff: null,
		roundIndex: 0,
		lastPair: null,
		intimidateMayTrade: false,
		hireUnlocked: false,
		resolved: false,
		rounds: []
	};
	DE.bindEncounterTreasury(state, enc, units, faction);
	return enc;
};

DE.presentEncounter = function (state, enc) {
	var m = state.mission;
	if (!m || !enc) return false;
	m.pendingEncounter = enc;
	if (enc.factionId && enc.kind !== "animal") {
		DE.onPoliticsEncounter(state, enc.factionId);
		enc.trustAtMeet = DE.trustFromLog(state, enc.factionId).center;
	}
	DE.markSeenTypesFromUnits(state, enc.aiUnits || []);
	state.ui.screen = "encounter";
	state.ui.pendingAction = null;
	state.ui.pendingExtra = {};
	state.ui.chooser = null;
	state.ui.message = "";
	state.ui.tradeNote = "";
	return true;
};

DE.openQueuedCampRaid = function (state) {
	if (!state || !state.queuedCampRaid || !state.mission) return false;
	var enc = DE.buildCampRaidEncounter(state, state.queuedCampRaid.factionId);
	state.queuedCampRaid = null;
	if (!enc) return false;
	return DE.presentEncounter(state, enc);
};

DE.nextBeat = function (state) {
	var m = state.mission;
	if (!m) return;
	if (m.remaining <= 0) {
		DE.returnToBase(state);
		return;
	}
	if (!DE.livingUnits(m.party).length) {
		DE.releaseCaptivesToPools(state, (m.stuff && m.stuff.captives) || []);
		state.ui.message = "The expedition is gone. What remains is dragged home.";
		DE.returnToBase(state);
		return;
	}
	m.beat += 1;
	m.attempted += 1;
	state.totalEncounters = (state.totalEncounters || 0) + 1;
	var ate = DE.eatFood(state);
	if (ate.hungry && ate.penalty >= 0.4) {
		DE.starveExpedition(state);
		return;
	}
	/* Village depth N only when the current encounter depth is N. */
	var depth = DE.encounterDepth(m);
	var revisitVillage = null;
	if (m.villageId && m.villageAt >= 0 && depth === m.villageAt && !m.returning) {
		revisitVillage = DE.villageById(state, m.villageId);
	}
	var discoverVillage = !m.villageId && !m.returning ? DE.pickScoutVillage(state, depth) : null;
	var forcedVillage = revisitVillage || discoverVillage;
	DE.maybeTickVillages(state, forcedVillage);
	if (state.queuedCampRaid && !forcedVillage) {
		DE.openQueuedCampRaid(state);
		return;
	}
	var roll = forcedVillage ? "village" : DE.pickWeighted(state, state.encounterWeights);
	if (roll === "village" && !forcedVillage) {
		roll = DE.pickWeighted(state, {
			small: state.encounterWeights.small,
			medium: state.encounterWeights.medium,
			large: state.encounterWeights.large,
			huge: state.encounterWeights.huge,
			monster: state.encounterWeights.monster,
			empty: state.encounterWeights.empty
		});
	}
	if (roll === "empty") {
		var emptyDepth = DE.encounterDepth(m);
		m.progressed += 1;
		m.remaining -= 1;
		m.stuff.magic = m.stuff.magic || 0;
		var foundMagic = 0;
		if (DE.rngNext(state) < 0.5) {
			foundMagic = DE.rngIntRange(state, 5, 20);
			m.stuff.magic += foundMagic;
		}
		state.ui.screen = "empty";
		state.ui.message = ate.hungry
			? ("Empty dark. " + DE.hungerLabel(state) + " — the march goes without rations.")
			: DE.emptyFlavor(state);
		if (foundMagic) {
			state.ui.message += " You gather " + foundMagic + " magic from the stone.";
		}
		state.mission.pendingEncounter = null;
		DE.appendChronicle(state, "Empty stretch · depth " + emptyDepth + " · " + m.progressed + "/" + m.distance +
			(foundMagic ? (" · +" + foundMagic + " magic") : ""));
		return;
	}
	var enc = forcedVillage
		? DE.buildVillageEncounter(state, forcedVillage)
		: DE.buildEncounter(state, roll, false);
	if (!enc) {
		m.progressed += 1;
		m.remaining -= 1;
		state.ui.screen = "empty";
		state.ui.message = "The tunnel is quiet.";
		return;
	}
	DE.presentEncounter(state, enc);
};

DE.emptyFlavor = function (state) {
	var lines = [
		"Dripstone and old air. Nobody here.",
		"A cold gallery, bones long since picked.",
		"Fungus light, no voices.",
		"The passage pinches, then opens on nothing.",
		"Ash of a fire days gone."
	];
	return DE.rngPick(state, lines);
};

DE.encounterSizeTarget = function (state, size) {
	var range = DE.sizeRange(size === "single" ? "small" : (size || "medium"));
	if (size === "single") return range[0];
	return DE.rngIntRange(state, range[0], range[1]);
};

DE.poolLeader = function (faction) {
	var list = (faction && faction.poolUnits) || [];
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].leader && !list[i].dead && !list[i].away) return list[i];
	}
	return null;
};

DE.stationedLeader = function (village) {
	var list = (village && village.units) || [];
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].leader && !list[i].dead && !list[i].away) return list[i];
	}
	return null;
};

DE.encounterFace = function (enc) {
	if (enc && enc.leader && enc.leader.name) return enc.leader;
	var units = (enc && enc.aiUnits) || [];
	for (var i = 0; i < units.length; i++) {
		if (units[i] && units[i].name && !units[i].dead) return units[i];
	}
	return null;
};

DE.writeBackEncounterUnits = function (state, enc) {
	if (!enc) return;
	var faction = DE.factionById(state, enc.factionId);
	DE.releasePartyCaptivesIfWiped(state, enc.playerUnits, enc.playerStuff);
	DE.releasePartyCaptivesIfWiped(state, enc.aiUnits, enc.aiStuff);
	if (enc.campRaid) {
		DE.syncCampGarrisonStuff(state, enc.playerStuff);
		if (faction) {
			DE.releaseAwayUnits(faction.poolUnits);
			DE.healSide(faction.poolUnits, { skipPlayer: true });
		}
		return;
	}
	if (enc.village && enc.villageRec) {
		DE.releaseAwayUnits(enc.villageRec.units);
		DE.syncVillageStuff(enc.villageRec, enc.aiStuff);
		DE.healSide(enc.villageRec.units || [], { skipPlayer: true });
	} else if (faction) {
		DE.releaseAwayUnits(faction.poolUnits);
		DE.healSide(faction.poolUnits, { skipPlayer: true });
	}
	if (faction && faction.kind === "loner" && DE.livingUnits(faction.poolUnits).length === 0) {
		faction.alive = false;
	}
};

DE.buildEncounter = function (state, kind, forcedVillage) {
	if (kind === "monster" || kind === "undead") {
		return DE.buildMonsterEncounter(state);
	}
	if (kind === "village" || forcedVillage) {
		var village = typeof forcedVillage === "object" && forcedVillage ? forcedVillage : null;
		if (!village && state.mission && state.mission.villageId) {
			village = DE.villageById(state, state.mission.villageId);
		}
		if (village) return DE.buildVillageEncounter(state, village);
		return null;
	}
	var size = kind;
	var civ = DE.civilizedFactions(state);
	if (!civ.length) return null;
	var withPool = civ.filter(function (f) {
		return DE.availableUnits(f.poolUnits).length && DE.livingLeaders(state, f).length;
	});
	var faction = withPool.length ? DE.rngPick(state, withPool) : DE.rngPick(state, civ);
	if (!DE.availableUnits(faction.poolUnits).length) {
		var others = civ.filter(function (f) { return DE.availableUnits(f.poolUnits).length; });
		if (!others.length) return DE.buildMonsterEncounter(state);
		faction = DE.rngPick(state, others);
	}
	var units = DE.drawUnitsFromList(faction.poolUnits, DE.encounterSizeTarget(state, size), {
		state: state,
		shuffle: true,
		preferLeader: true,
		combatOnly: true
	});
	if (!units.length) return DE.buildMonsterEncounter(state);
	var leader = null;
	for (var i = 0; i < units.length; i++) {
		if (units[i].leader) { leader = units[i]; break; }
	}
	var enc = {
		id: DE.nextId(state, "E"),
		factionId: faction.id,
		kind: "field",
		size: size,
		village: false,
		villageName: null,
		villageRec: null,
		leader: leader,
		playerUnits: state.mission.party,
		aiUnits: units,
		playerStuff: state.mission.stuff,
		aiStuff: null,
		roundIndex: 0,
		lastPair: null,
		intimidateMayTrade: false,
		hireUnlocked: false,
		resolved: false,
		rounds: []
	};
	DE.bindEncounterTreasury(state, enc, units, faction);
	return enc;
};

DE.buildVillageEncounter = function (state, village) {
	var faction = DE.factionById(state, village.factionId);
	if (!faction) return null;
	var wasNew = !village.discovered;
	village.discovered = true;
	var units = DE.drawUnitsFromList(village.units, DE.encounterSizeTarget(state, "huge"), {
		state: state,
		shuffle: true,
		preferLeader: true,
		combatOnly: true,
		includeCivilians: true
	});
	if (!units.length) {
		units = DE.availableUnits(village.units);
		for (var a = 0; a < units.length; a++) units[a].away = true;
	}
	var leader = null;
	for (var i = 0; i < units.length; i++) {
		if (units[i].leader) { leader = units[i]; break; }
	}
	if (wasNew) {
		DE.appendChronicle(state, "Found " + village.name + " (" + faction.name + ") at depth " + village.distance + ".");
	}
	var enc = {
		id: DE.nextId(state, "E"),
		factionId: faction.id,
		kind: "village",
		size: "huge",
		village: true,
		villageName: village.name,
		villageRec: village,
		leader: leader,
		playerUnits: state.mission.party,
		aiUnits: units,
		playerStuff: state.mission.stuff,
		aiStuff: null,
		roundIndex: 0,
		lastPair: null,
		intimidateMayTrade: false,
		hireUnlocked: false,
		resolved: false,
		rounds: []
	};
	DE.bindEncounterTreasury(state, enc, units, faction);
	return enc;
};

DE.buildMonsterEncounter = function (state) {
	var types = DE.MONSTER_TYPES.slice();
	var t = DE.rngPick(state, types);
	var loner = null;
	for (var i = 0; i < state.factions.length; i++) {
		if (state.factions[i].monsterType === t) loner = state.factions[i];
	}
	if (loner && loner.kind === "loner" && loner.alive !== false && DE.availableUnits(loner.poolUnits).length) {
		var available = DE.availableUnits(loner.poolUnits);
		var one = available.length ? (DE.rngPick(state, available) || available[0]) : null;
		if (one) {
			one.away = true;
			return {
				id: DE.nextId(state, "E"),
				factionId: loner.id,
				kind: "loner",
				size: "single",
				village: false,
				leader: null,
				playerUnits: state.mission.party,
				aiUnits: [one],
				playerStuff: state.mission.stuff,
				aiStuff: DE.makePartyStuff(state, [one], loner),
				roundIndex: 0,
				lastPair: null,
				intimidateMayTrade: false,
				resolved: false,
				rounds: []
			};
		}
	}
	if (t === "undead" || (loner && loner.alive === false && t === (loner && loner.monsterType))) {
		var pack = DE.composeUndeadForce(state, DE.rngPick(state, ["small", "medium", "large"]));
		var faction = pack.faction;
		if (faction && faction.kind === "loner" && faction.alive !== false && DE.availableUnits(faction.poolUnits).length) {
			t = DE.rngPick(state, state.animalTypes.length ? state.animalTypes : ["ooze"]);
		} else {
			return {
				id: DE.nextId(state, "E"),
				factionId: "wild-undead",
				kind: "animal",
				size: "medium",
				village: false,
				leader: null,
				playerUnits: state.mission.party,
				aiUnits: pack.units,
				playerStuff: state.mission.stuff,
				aiStuff: DE.makePartyStuff(state, pack.units, faction),
				roundIndex: 0,
				lastPair: null,
				animal: true,
				resolved: false,
				rounds: []
			};
		}
	}
	if (!state.animalTypes || !state.animalTypes.length) t = t || "ooze";
	else if (state.animalTypes.indexOf(t) < 0) t = DE.rngPick(state, state.animalTypes);
	var wild = DE.makeUnit(state, DE.MONSTER_UNIT[t] || t, t, "wild-" + t);
	return {
		id: DE.nextId(state, "E"),
		factionId: "wild-" + t,
		kind: "animal",
		size: "single",
		village: false,
		leader: null,
		playerUnits: state.mission.party,
		aiUnits: [wild],
		playerStuff: state.mission.stuff,
		aiStuff: DE.makePartyStuff(state, [wild], null),
		roundIndex: 0,
		lastPair: null,
		animal: true,
		resolved: false,
		rounds: []
	};
};

DE.ensureVillage = function (state, faction) {
	var existing = DE.villageByFaction(state, faction.id);
	if (existing) return existing;
	var v = {
		id: DE.nextId(state, "V"),
		name: DE.villageName(state, {}),
		factionId: faction.id,
		distance: 4,
		discovered: false,
		revisitLength: 4,
		units: [],
		gold: 100,
		magic: 0,
		food: 0,
		weapons: [],
		captives: []
	};
	state.villages.push(v);
	DE.fillVillageArmy(state, v, faction);
	var poolLeaders = (faction.poolUnits || []).filter(function (u) { return u && u.leader && !u.dead; });
	if (poolLeaders.length) DE.moveUnitToList(state, faction, poolLeaders[0], v.units);
	return v;
};

DE.villageById = function (state, id) {
	for (var i = 0; i < state.villages.length; i++) {
		if (state.villages[i].id === id) return state.villages[i];
	}
	return null;
};

DE.updateVillageRevisit = function (state, enc) {
	if (!enc.village || !enc.villageRec) return;
	DE.syncVillageMarch(enc.villageRec);
	/* One shot per march: after meeting the village (hold or flee), resume random encounters. */
	var m = state.mission;
	if (!m) return;
	m.metVillageIds = m.metVillageIds || [];
	if (enc.villageRec.id && m.metVillageIds.indexOf(enc.villageRec.id) < 0) {
		m.metVillageIds.push(enc.villageRec.id);
	}
	if (m.villageId && enc.villageRec.id === m.villageId) {
		m.villageAt = -1;
	}
};

DE.villageMarchLength = function (village) {
	if (!village) return 1;
	return Math.max(1, (Number(village.distance) || 1) * 2 - 1);
};

DE.syncVillageMarch = function (village) {
	if (!village) return;
	village.revisitLength = DE.villageMarchLength(village);
};

DE.syncAllVillageMarches = function (state) {
	var list = (state && state.villages) || [];
	for (var i = 0; i < list.length; i++) DE.syncVillageMarch(list[i]);
};

DE.playRound = function (state, playerAction, extra) {
	var enc = state.mission && state.mission.pendingEncounter;
	if (!enc || enc.resolved) return { ok: false };
	extra = extra || {};
	if (playerAction === "trade" && enc.roundIndex === 0) return { ok: false, reason: "Trade is not offered at first meeting." };
	var ai = DE.chooseAiAction(state, enc);
	enc.intimidateMayTrade = !!enc.intimidateMayTrade;
	var extras = {
		playerAction: playerAction,
		aiAction: ai.action,
		playerSeize: extra.seize,
		aiSeize: ai.extra && ai.extra.seize,
		playerCaptureId: extra.captureId,
		aiCaptureId: ai.extra && ai.extra.captureId,
		playerGift: extra.gift,
		aiGift: ai.extra && ai.extra.gift
	};
	var result = DE.resolveRound(state, enc, playerAction, ai.action, extras);
	enc.rounds.push({
		player: playerAction,
		ai: ai.action,
		giftValue: extra.gift ? DE.giftGoldEquivalent(extra.gift) : 0
	});
	enc.lastPair = { player: playerAction, ai: ai.action };
	enc.roundIndex += 1;
	enc.intimidateMayTrade = !!result.intimidateMayTrade;
	result.ai = ai;
	if (result.another) {
		state.ui.lastResult = result;
		state.ui.screen = "encounter";
		state.ui.message = (result.notes || []).join(" ");
		return { ok: true, result: result };
	}
	DE.finishEncounter(state, enc, result);
	return { ok: true, result: result };
};

DE.encounterHeadline = function (state, enc) {
	if (!enc) return "You encounter something";
	if (enc.campRaid) {
		var raider = DE.factionById(state, enc.factionId);
		return "The " + ((raider && raider.name) || "foe") + " are at your camp.";
	}
	if (enc.village) return "You encounter Village " + (enc.villageName || "Unknown");
	var fac = DE.factionById(state, enc.factionId);
	var monsterKey = null;
	if (fac && fac.monsterType) monsterKey = fac.monsterType;
	else if (enc.kind === "animal" || enc.kind === "loner") {
		var u0 = (enc.aiUnits || [])[0];
		monsterKey = u0 ? (DE.monsterKeyForUnit(u0) || u0.species || u0.type) : null;
		if (monsterKey === "undead" && u0 && u0.type === "ghost") monsterKey = "ghost";
		else if (monsterKey === "undead" && u0 && u0.type === "skeleton") monsterKey = "undead";
	}
	if (monsterKey || (fac && fac.kind === "loner") || enc.kind === "animal") {
		var key = monsterKey || (fac && fac.monsterType) || "beast";
		var label = DE.SPECIES_LABELS[key] || key;
		var face = DE.encounterFace(enc);
		if (fac && fac.kind === "loner" && DE.isMonsterKnown(state, key) && face && face.name) {
			return "You encounter " + face.name + " the " + label;
		}
		return "You encounter " + label;
	}
	var species = fac ? (DE.SPECIES_LABELS[fac.species] || fac.species) : "strangers";
	if (enc.leader && enc.leader.name) return "You encounter " + species + " led by " + enc.leader.name;
	return "You encounter " + species;
};

DE.finishEncounter = function (state, enc, result) {
	enc.resolved = true;
	DE.lootBattleWeapons(enc, result);
	var m = state.mission;
	if (result.hold.player && !enc.campRaid) {
		m.progressed += 1;
		m.remaining -= 1;
	}
	DE.updateVillageRevisit(state, enc);
	DE.applyBattleInfo(state, enc, result);
	DE.writeBackEncounterUnits(state, enc);
	var killedMarkLeader = false;
	if (result.battle && !result.displayBattle && result.battle.winner === "player") {
		var killedLeader = DE.maybeKillLeader(state, enc);
		killedMarkLeader = !!(killedLeader && enc.leader && enc.factionId === state.hostileFactionId);
		if (killedLeader && enc.leader && !killedMarkLeader) {
			result.notes.push(enc.leader.name + " will not lead again.");
		}
		DE.markMonstersKnownFromUnits(state, enc.aiUnits);
	}
	if (enc.factionId && enc.kind !== "animal") {
		DE.appendLog(state, {
			id: enc.id,
			factionId: enc.factionId,
			missionId: m.id,
			beat: m.beat,
			leaderName: enc.leader ? enc.leader.name : "",
			kind: enc.kind,
			village: !!enc.village,
			villageName: enc.villageName,
			summary: DE.summarizeUnits(enc.aiUnits),
			playerSummary: DE.summarizeUnits(enc.playerUnits),
			rounds: enc.rounds.slice(),
			gifted: !!(result.gift && result.gift.moved),
			giftValue: result.gift && result.gift.value,
			traded: !!enc.didTrade,
			battle: !!result.battle,
			displayBattle: !!result.displayBattle,
			winner: result.battle ? result.battle.winner : null,
			playerHeld: result.hold.player,
			aiHeld: result.hold.ai,
			outcome: result.notes.join(" ")
		});
		result.attitude = DE.attitudeShiftFromEncounter(state, enc);
	}
	var fac = DE.factionById(state, enc.factionId);
	var who = enc.campRaid
		? ("Raid on camp by " + ((fac && fac.name) || "foes"))
		: enc.village
		? (enc.villageName || "a village")
		: (fac ? fac.name : (enc.kind === "animal" ? "wild beasts" : "strangers"));
	var line = who + ": " + (result.notes && result.notes.length ? result.notes.join(" ") : "encounter ends");
	if (result.battle && result.battle.winner === "player") line += " (you won)";
	else if (result.battle && result.battle.winner === "ai") line += " (they won)";
	DE.appendChronicle(state, line);
	if (killedMarkLeader) {
		var markName = (fac && fac.name) || "the mark";
		DE.appendChronicle(state, enc.leader.name + " of " + markName + " has fallen.");
		result.notes.push(enc.leader.name + " will not lead again.");
	}
	enc.awaitingTrade = !!result.trade;
	if (enc.awaitingTrade && typeof DE.rollTradeGossip === "function") {
		DE.rollTradeGossip(state, enc);
	}
	state.ui.screen = "resolve";
	state.ui.lastResult = result;
	state.ui.message = (result.notes || []).join(" ");
	DE.checkWin(state);
	DE.syncPoliticsContacts(state);
};

DE.actionPairLine = function (result) {
	if (!result) return "";
	var you = DE.ACTION_LABELS[result.playerAction] || result.playerAction || "—";
	var they = DE.ACTION_LABELS[result.aiAction] || result.aiAction || "—";
	return "You: " + you + " · They: " + they + ". ";
};

DE.closeTrade = function (state, didTrade) {
	var enc = state.mission && state.mission.pendingEncounter;
	if (enc) {
		enc.didTrade = enc.didTrade || !!didTrade;
		enc.awaitingTrade = false;
		if (typeof DE.finishTradeStall === "function") DE.finishTradeStall(state, enc);
		if (didTrade && state.logs[enc.factionId] && state.logs[enc.factionId][0]) {
			state.logs[enc.factionId][0].traded = true;
		}
		if (state.ui.lastResult) {
			state.ui.lastResult.attitude = DE.attitudeShiftFromEncounter(state, enc);
		}
	}
	state.ui.chooser = null;
	state.ui.tradeNote = "";
	if (state.won) {
		state.ui.screen = "win";
		return;
	}
	if (DE.openQueuedCampRaid(state)) return;
	DE.nextBeat(state);
};

DE.maybeKillLeader = function (state, enc) {
	if (!enc || !enc.leader) return false;
	var unit = DE.findFactionUnit(state, enc.factionId, enc.leader.id) || enc.leader;
	if (!unit || !unit.leader) return false;
	if (!unit.dead) return false;
	return true;
};

DE.playerCustodyIds = function (state) {
	var ids = {};
	function add(list) {
		var arr = list || [];
		for (var i = 0; i < arr.length; i++) {
			if (arr[i] && arr[i].id && !arr[i].dead) ids[arr[i].id] = true;
		}
	}
	if (state.player) {
		add(state.player.units);
		add(state.player.captives);
	}
	if (state.mission) {
		add(state.mission.party);
		add(state.mission.stuff && state.mission.stuff.captives);
		var enc = state.mission.pendingEncounter;
		if (enc) {
			add(enc.playerUnits);
			add(enc.playerStuff && enc.playerStuff.captives);
		}
	}
	return ids;
};

DE.markHostagesStillHeld = function (state) {
	var ids = (state && state.markHostageIds) || [];
	if (!ids.length) return 0;
	var have = DE.playerCustodyIds(state);
	var n = 0;
	for (var i = 0; i < ids.length; i++) {
		if (!have[ids[i]]) n++;
	}
	return n;
};

DE.checkWin = function (state) {
	var ids = (state && state.markHostageIds) || [];
	if (ids.length) {
		if (DE.markHostagesStillHeld(state) === 0) state.won = true;
		return;
	}
	var f = DE.factionById(state, state.hostileFactionId);
	if (f && DE.livingLeaders(state, f).length === 0) {
		state.won = true;
	}
};

DE.continueAfterResolve = function (state) {
	if (state.won) {
		state.ui.screen = "win";
		return;
	}
	var enc = state.mission && state.mission.pendingEncounter;
	if (enc && enc.awaitingTrade) enc.awaitingTrade = false;
	if (typeof DE.returnEncounterTreasury === "function") DE.returnEncounterTreasury(state, enc);
	if (DE.openQueuedCampRaid(state)) return;
	DE.nextBeat(state);
};

DE.grantBaseIncome = function (state) {
	state.totalEncounters = state.totalEncounters || 0;
	state.incomeEncountersPaid = state.incomeEncountersPaid || 0;
	var due = Math.floor(state.totalEncounters / 5) - Math.floor(state.incomeEncountersPaid / 5);
	if (due <= 0) return { gold: 0, blocks: 0 };
	var gold = due * 100;
	state.player.gold += gold;
	state.incomeEncountersPaid = Math.floor(state.totalEncounters / 5) * 5;
	return { gold: gold, blocks: due };
};

DE.returnToBase = function (state) {
	var m = state.mission;
	var notices = [];
	if (m) {
		if (typeof DE.returnEncounterTreasury === "function") DE.returnEncounterTreasury(state, m.pendingEncounter);
		var beats = Math.max(0, (state.totalEncounters || 0) - (m.encountersAtStart || 0));
		var kept = [];
		var ids = {};
		for (var i = 0; i < m.party.length; i++) {
			var u = m.party[i];
			ids[u.id] = true;
			if (u.dead) continue;
			u.wounded = false;
			kept.push(u);
		}
		if (!kept.length) {
			DE.releaseCaptivesToPools(state, (m.stuff && m.stuff.captives) || []);
		}
		var leftovers = [];
		for (var j = 0; j < state.player.units.length; j++) {
			if (!ids[state.player.units[j].id] && !state.player.units[j].dead) leftovers.push(state.player.units[j]);
		}
		state.player.units = leftovers.concat(kept);
		var returnedWeapons = DE.filterWeaponKits(m.stuff.weapons || []);
		state.player.weapons = DE.filterWeaponKits(state.player.weapons || []).concat(returnedWeapons);
		state.player.captives = m.stuff.captives || [];
		state.player.gold += (m.stuff.gold || 0);
		state.player.magic = (state.player.magic || 0) + Math.max(0, Math.floor(m.stuff.magic || 0));
		var rations = Math.max(0, Math.floor(m.stuff.food || 0));
		m.stuff.food = 0;
		m.stuff.magic = 0;
		var foodGold = rations * DE.FOOD_GOLD_COST;
		if (foodGold > 0) {
			state.player.gold += foodGold;
			notices.push("Sold " + rations + " leftover ration" + (rations === 1 ? "" : "s") + " for " + foodGold + "g.");
		}

		var snap = m.startSnapshot || {};
		var endParty = kept.length;
		var endGold = (m.stuff.gold || 0) + foodGold;
		var endKits = returnedWeapons.length;
		var endCaps = (m.stuff.captives || []).length;
		var netBits = [
			"Mission " + m.id + (m.cancelled ? " aborted" : " ended"),
			endParty + "/" + (snap.party || endParty) + " soldiers"
		];
		var goldNet = endGold - (snap.gold || 0);
		var kitNet = endKits - (snap.weapons || 0);
		var capNet = endCaps - (snap.captives || 0);
		netBits.push((goldNet >= 0 ? "+" : "") + goldNet + "g");
		netBits.push((kitNet >= 0 ? "+" : "") + kitNet + " kits");
		if (capNet) netBits.push((capNet >= 0 ? "+" : "") + capNet + " captives");
		if (rations > 0) netBits.push(rations + " food sold");
		DE.appendChronicle(state, netBits.join(" · "));
		var trained = DE.tickTraining(state, beats);
		for (var t = 0; t < trained.length; t++) {
			notices.push(DE.trainingNotice(trained[t]));
		}
	}
	var income = DE.grantBaseIncome(state);
	if (income.gold > 0) {
		notices.unshift("Camp remittance: +" + income.gold + "g from " + (income.blocks * 5) + " encounters.");
	}
	DE.tickHireContracts(state, income.blocks);
	state.mission = null;
	state.ui.screen = state.won ? "win" : "base";
	state.ui.selectedUnitIds = [];
	state.ui.sendCounts = {};
	if (notices.length) state.ui.flash = notices.join(" ");
	DE.syncPoliticsContacts(state);
};
