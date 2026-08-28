var Space4x = Space4x || {};

Space4x.loyaltyRules = function (state) {
	return Space4x.settingOf(state).loyalty || null;
};

Space4x.revoltRules = function (state) {
	return Space4x.settingOf(state).revolt || null;
};

Space4x.troopCountsAsPolice = function (state, empire, def, altEffects) {
	if (!def) return false;
	if (Space4x.defMatchesTags(def, ["Police"])) return true;
	const list = altEffects || [];
	for (let i = 0; i < list.length; i++) {
		const fx = list[i];
		if (fx.defId && def.id === fx.defId) return true;
		if (fx.tags && Space4x.defMatchesTags(def, fx.tags)) return true;
	}
	return false;
};

Space4x.policeAltEffects = function (state, empire) {
	const out = [];
	Space4x.eachEmpireTechEffect(state, empire, function (tech, fx) {
		if (fx.type === "militiaAsPolice") out.push(fx);
	});
	return out;
};

Space4x.countPolice = function (state, settlement) {
	if (!settlement || !settlement.troops) return 0;
	const empire = Space4x.empireById(state, settlement.empireId);
	const altEffects = Space4x.policeAltEffects(state, empire);
	let n = 0;
	const builds = Space4x.settingOf(state).builds;
	for (let i = 0; i < settlement.troops.length; i++) {
		const def = builds[settlement.troops[i].defId];
		if (Space4x.troopCountsAsPolice(state, empire, def, altEffects)) n += 1;
	}
	return n;
};

Space4x.policeNeed = function (state, settlement) {
	const rules = Space4x.loyaltyRules(state);
	const per = rules && rules.popsPerPolice ? rules.popsPerPolice : 5;
	const pops = settlement && settlement.pops ? settlement.pops.length : 0;
	return Math.floor(pops / per);
};

Space4x.settlementHungry = function (state, settlement) {
	if (!settlement) return false;
	if (settlement.foodShort) return true;
	const pops = settlement.pops.length;
	if (!pops) return false;
	let present = settlement.lastFoodPresent || 0;
	if (state.turn <= 1 && present === 0) {
		const sit = Space4x.foodSituation(state, settlement);
		present = sit.present;
	}
	return present < pops;
};

Space4x.settlementStarveMemory = function (settlement) {
	if (!settlement || settlement.lastStarveTurn == null) return false;
	if (settlement.lastGrowthTurn == null) return true;
	return settlement.lastStarveTurn > settlement.lastGrowthTurn;
};

Space4x.cultureLoyalty = function (state, settlement, cultureId) {
	const rules = Space4x.loyaltyRules(state);
	if (!rules) return 100;
	const empire = settlement ? Space4x.empireById(state, settlement.empireId) : null;
	let n = rules.base || 0;
	if (empire && cultureId && cultureId === empire.cultureId) n += rules.cultureBonus || 0;
	if (empire && empire.modifiers) n += empire.modifiers.loyalty || 0;
	n += Space4x.structureSettlementLoyalty(state, settlement);
	if (Space4x.settlementHungry(state, settlement)) n -= rules.foodPenalty || 0;
	if (Space4x.settlementStarveMemory(settlement)) n -= rules.starveMemoryPenalty || 0;
	const need = Space4x.policeNeed(state, settlement);
	if (Space4x.countPolice(state, settlement) < need) n -= rules.policePenalty || 0;
	if (n < 0) n = 0;
	if (n > 100) n = 100;
	return n;
};

Space4x.groupKey = function (job, cultureId) {
	return (job || "idle") + "::" + (cultureId || "");
};

Space4x.groupSpyDelta = function (settlement, job, cultureId) {
	const mods = settlement && settlement.loyaltyMods;
	if (!mods) return 0;
	const row = mods[Space4x.groupKey(job, cultureId)];
	return row && row.delta ? row.delta : 0;
};

Space4x.addGroupSpyDelta = function (settlement, job, cultureId, n) {
	if (!settlement || !n) return;
	if (!settlement.loyaltyMods) settlement.loyaltyMods = {};
	const key = Space4x.groupKey(job, cultureId);
	const row = settlement.loyaltyMods[key] || { delta: 0, heal: 0 };
	row.delta = (row.delta || 0) + n;
	settlement.loyaltyMods[key] = row;
};

Space4x.groupLoyalty = function (state, settlement, job, cultureId) {
	let n = Space4x.cultureLoyalty(state, settlement, cultureId) + Space4x.groupSpyDelta(settlement, job, cultureId);
	if (n < 0) n = 0;
	if (n > 100) n = 100;
	return n;
};

Space4x.healSpyLoyalty = function (state) {
	const list = state.settlements || [];
	for (let s = 0; s < list.length; s++) {
		const mods = list[s].loyaltyMods;
		if (!mods) continue;
		const keys = Object.keys(mods);
		for (let i = 0; i < keys.length; i++) {
			const row = mods[keys[i]];
			if (!row || !row.delta) {
				delete mods[keys[i]];
				continue;
			}
			row.heal = (row.heal || 0) + 1;
			if (row.heal < 4) continue;
			row.heal = 0;
			if (row.delta > 0) row.delta -= 1;
			else if (row.delta < 0) row.delta += 1;
			if (!row.delta) delete mods[keys[i]];
		}
	}
};

Space4x.loyaltyExplain = function (state, settlement, cultureId, job) {
	const rules = Space4x.loyaltyRules(state);
	if (!rules) return [];
	const empire = settlement ? Space4x.empireById(state, settlement.empireId) : null;
	const lines = ["Base " + (rules.base || 0)];
	if (empire && cultureId && cultureId === empire.cultureId) {
		lines.push("+" + (rules.cultureBonus || 0) + " same species as empire");
	}
	const civic = empire && empire.modifiers ? empire.modifiers.loyalty : 0;
	if (civic) lines.push((civic > 0 ? "+" : "") + civic + " tech");
	Space4x.eachStructureEffect(state, settlement, function (def, fx) {
		if (fx.type !== "settlementLoyalty" || !fx.n) return;
		lines.push((fx.n > 0 ? "+" : "") + fx.n + " " + def.name);
	});
	const altEffects = Space4x.policeAltEffects(state, empire);
	if (altEffects.length) {
		const names = [];
		for (let i = 0; i < altEffects.length; i++) {
			const fx = altEffects[i];
			if (fx.defId) names.push(Space4x.structureName(state, fx.defId));
			else if (fx.tags && fx.tags.length) names.push(fx.tags.join("/"));
		}
		if (names.length) lines.push(names.join(", ") + " count as police");
	}
	if (job) {
		const spy = Space4x.groupSpyDelta(settlement, job, cultureId);
		if (spy) lines.push((spy > 0 ? "+" : "") + spy + " spies");
	}
	if (Space4x.settlementHungry(state, settlement)) lines.push("−" + (rules.foodPenalty || 0) + " not enough food");
	if (Space4x.settlementStarveMemory(settlement)) {
		lines.push("−" + (rules.starveMemoryPenalty || 0) + " recent starvation");
	}
	const need = Space4x.policeNeed(state, settlement);
	const have = Space4x.countPolice(state, settlement);
	if (have < need) lines.push("−" + (rules.policePenalty || 0) + " police " + have + "/" + need);
	else if (need) lines.push("Police " + have + "/" + need);
	lines.push("Total " + (job
		? Space4x.groupLoyalty(state, settlement, job, cultureId)
		: Space4x.cultureLoyalty(state, settlement, cultureId)) + "%");
	return lines;
};

Space4x.loyaltyGroups = function (state, settlement) {
	const out = [];
	if (!settlement) return out;
	const map = {};
	const pops = settlement.pops || [];
	for (let i = 0; i < pops.length; i++) {
		const pop = pops[i];
		const key = (pop.job || "idle") + "::" + (pop.culture || "");
		if (!map[key]) {
			map[key] = {
				id: key,
				job: pop.job || "idle",
				culture: pop.culture || null,
				pops: [],
				n: 0,
				loyalty: Space4x.groupLoyalty(state, settlement, pop.job || "idle", pop.culture)
			};
			out.push(map[key]);
		}
		map[key].pops.push(pop);
		map[key].n += 1;
	}
	return out;
};

Space4x.settlementLoyalty = function (state, settlement) {
	const groups = Space4x.loyaltyGroups(state, settlement);
	let n = 0;
	let w = 0;
	for (let i = 0; i < groups.length; i++) {
		n += groups[i].loyalty * groups[i].n;
		w += groups[i].n;
	}
	if (!w) return Space4x.cultureLoyalty(state, settlement, settlement && Space4x.empireById(state, settlement.empireId) && Space4x.empireById(state, settlement.empireId).cultureId);
	return Math.round(n / w);
};

Space4x.troopsInCoverOrder = function (state, settlement) {
	const troops = settlement && settlement.troops ? settlement.troops : [];
	const defs = Space4x.troopDefs(state);
	const defOrder = {};
	for (let i = 0; i < defs.length; i++) defOrder[defs[i].id] = i;
	const cultures = Space4x.culturesOf(state);
	const cultureOrder = {};
	for (let i = 0; i < cultures.length; i++) cultureOrder[cultures[i].id] = i;
	const rows = [];
	for (let i = 0; i < troops.length; i++) rows.push({ t: troops[i], i: i });
	rows.sort(function (a, b) {
		const da = defOrder[a.t.defId] != null ? defOrder[a.t.defId] : 99;
		const db = defOrder[b.t.defId] != null ? defOrder[b.t.defId] : 99;
		if (da !== db) return da - db;
		const ca = cultureOrder[a.t.culture] != null ? cultureOrder[a.t.culture] : 99;
		const cb = cultureOrder[b.t.culture] != null ? cultureOrder[b.t.culture] : 99;
		if (ca !== cb) return ca - cb;
		return a.i - b.i;
	});
	const out = [];
	for (let i = 0; i < rows.length; i++) out.push(rows[i].t);
	return out;
};

Space4x.unitCoverBonusById = function (state, settlement) {
	const bonus = {};
	if (!settlement) return bonus;
	const remaining = Space4x.troopsInCoverOrder(state, settlement).slice();
	Space4x.eachStructureEffect(state, settlement, function (def, fx) {
		if (fx.type !== "unitLoyaltyCover") return;
		let left = fx.cover || 0;
		const add = fx.n || 0;
		while (left > 0 && remaining.length) {
			const t = remaining.shift();
			bonus[t.id] = (bonus[t.id] || 0) + add;
			left -= 1;
		}
	});
	return bonus;
};

Space4x.unitCoverFromDef = function (state, settlement, defId) {
	const copies = settlement ? Space4x.countStructure(settlement, defId) : 0;
	const garrison = settlement && settlement.troops ? settlement.troops.length : 0;
	let covered = 0;
	if (!settlement) return { copies: copies, covered: 0, garrison: garrison };
	const remaining = Space4x.troopsInCoverOrder(state, settlement).slice();
	Space4x.eachStructureEffect(state, settlement, function (def, fx) {
		if (fx.type !== "unitLoyaltyCover") return;
		let left = fx.cover || 0;
		while (left > 0 && remaining.length) {
			remaining.shift();
			left -= 1;
			if (def.id === defId) covered += 1;
		}
	});
	return { copies: copies, covered: covered, garrison: garrison };
};

Space4x.unitLoyaltyDelta = function (state, settlement, troop) {
	let n = 0;
	if (!troop) return n;
	Space4x.eachStructureEffect(state, settlement, function (def, fx) {
		if (fx.type !== "unitLoyalty") return;
		if (fx.defId && fx.defId !== troop.defId) return;
		n += fx.n || 0;
	});
	const empire = settlement ? Space4x.empireById(state, settlement.empireId) : null;
	Space4x.eachEmpireTechEffect(state, empire, function (tech, fx) {
		if (fx.type !== "unitLoyalty") return;
		if (fx.defId && fx.defId !== troop.defId) return;
		n += fx.n || 0;
	});
	const cover = Space4x.unitCoverBonusById(state, settlement);
	n += cover[troop.id] || 0;
	return n;
};

Space4x.unitLoyalty = function (state, settlement, troop) {
	if (!Space4x.loyaltyRules(state) || !settlement || !troop) return 100;
	let n = Space4x.settlementLoyalty(state, settlement) + Space4x.unitLoyaltyDelta(state, settlement, troop);
	if (n < 0) n = 0;
	if (n > 100) n = 100;
	return n;
};

Space4x.stackUnitLoyalty = function (state, settlement, defId, culture) {
	const out = { n: 0, min: 100, max: 0 };
	if (!settlement || !settlement.troops) return out;
	for (let i = 0; i < settlement.troops.length; i++) {
		const t = settlement.troops[i];
		if (defId && t.defId !== defId) continue;
		if (culture !== undefined && culture !== null && t.culture !== culture) continue;
		const L = Space4x.unitLoyalty(state, settlement, t);
		if (!out.n || L < out.min) out.min = L;
		if (!out.n || L > out.max) out.max = L;
		out.n += 1;
	}
	return out;
};

Space4x.loyaltyText = function (state, settlement) {
	if (!Space4x.loyaltyRules(state) || !settlement) return "";
	const need = Space4x.policeNeed(state, settlement);
	const have = Space4x.countPolice(state, settlement);
	return "Loyalty " + Space4x.settlementLoyalty(state, settlement) + "% · Police " + have + "/" + need;
};

Space4x.loyaltyRoll = function (state, loyalty) {
	return (1 + Space4x.rngInt(state, 100)) > loyalty;
};

Space4x.majorityCultureOfPops = function (state, pops, fallback) {
	const counts = {};
	let bestN = 0;
	const list = pops || [];
	for (let i = 0; i < list.length; i++) {
		const id = list[i].culture;
		if (!id) continue;
		counts[id] = (counts[id] || 0) + 1;
		if (counts[id] > bestN) bestN = counts[id];
	}
	if (!bestN) return fallback;
	const tied = [];
	const ids = Object.keys(counts);
	for (let i = 0; i < ids.length; i++) {
		if (counts[ids[i]] === bestN) tied.push(ids[i]);
	}
	if (tied.length === 1) return tied[0];
	if (fallback) {
		for (let i = 0; i < tied.length; i++) {
			if (tied[i] === fallback) return fallback;
		}
	}
	const cultures = Space4x.culturesOf(state);
	for (let i = 0; i < cultures.length; i++) {
		for (let t = 0; t < tied.length; t++) {
			if (cultures[i].id === tied[t]) return tied[t];
		}
	}
	return tied[0];
};

Space4x.revoltEmpireName = function (state, settlement) {
	const base = settlement.name + " revolt";
	function taken(name) {
		for (let i = 0; i < state.empires.length; i++) {
			if (state.empires[i].name === name) return true;
		}
		return false;
	}
	if (!taken(base)) return base;
	let n = 2;
	while (taken(base + " " + n)) n += 1;
	return base + " " + n;
};

Space4x.createRevoltEmpire = function (state, parent, settlement, cultureId) {
	const rebel = Space4x.createEmpire(state, {
		id: Space4x.nextId(state, "e"),
		name: Space4x.revoltEmpireName(state, settlement),
		isPlayer: false,
		aiId: "dumb",
		cultureId: cultureId || parent.cultureId
	});
	Space4x.copyEmpireResearch(state, parent, rebel);
	rebel.exploredStarIds = (parent.exploredStarIds || []).slice();
	Space4x.markStarExplored(state, rebel.id, settlement.location.starId);
	state.empires.push(rebel);
	return rebel;
};

Space4x.removeEmpireIfEmpty = function (state, empireId) {
	const empire = Space4x.empireById(state, empireId);
	if (!empire || empire.isPlayer) return;
	if (Space4x.settlementsOf(state, empireId).length) return;
	for (let i = 0; i < state.units.length; i++) {
		if (state.units[i].empireId === empireId) return;
	}
	state.empires = state.empires.filter(function (e) { return e.id !== empireId; });
	if (Space4x.forgetEmpireDiplomacy) Space4x.forgetEmpireDiplomacy(state, empireId);
};

Space4x.resolveRevolt = function (state, settlement) {
	const parent = Space4x.empireById(state, settlement.empireId);
	if (!parent || !settlement.pops.length) return;
	const groups = Space4x.loyaltyGroups(state, settlement);
	const failing = [];
	for (let i = 0; i < groups.length; i++) {
		const g = groups[i];
		const fail = Space4x.loyaltyRoll(state, g.loyalty);
		if (fail) failing.push(g);
	}
	if (!failing.length) return;

	const rebelPops = [];
	for (let i = 0; i < failing.length; i++) {
		for (let p = 0; p < failing[i].pops.length; p++) rebelPops.push(failing[i].pops[p]);
	}
	const cultureId = Space4x.majorityCultureOfPops(state, rebelPops, parent.cultureId);
	const rebel = Space4x.createRevoltEmpire(state, parent, settlement, cultureId);
	const avg = Space4x.settlementLoyalty(state, settlement);

	state.turnLog.push(settlement.name + " revolts (" + rebelPops.length + " " +
		Space4x.peopleWord(rebelPops.length) + ", loyalty " + avg + "%).");

	const rebelTroops = [];
	const revoltRules = Space4x.revoltRules(state);
	const rebelTroopDefId = revoltRules && revoltRules.rebelTroopDefId;
	let rebelTroopSpawned = 0;
	if (rebelTroopDefId) {
		const rebelTroopDef = Space4x.settingOf(state).builds[rebelTroopDefId];
		for (let i = 0; i < rebelPops.length; i++) {
			if (!Space4x.loyaltyRoll(state, Space4x.groupLoyalty(state, settlement, rebelPops[i].job || "idle", rebelPops[i].culture))) continue;
			rebelTroops.push({
				id: Space4x.nextId(state, "t"),
				defId: rebelTroopDefId,
				culture: rebelPops[i].culture
			});
			rebelTroopSpawned += 1;
		}
		if (rebelTroopSpawned) {
			const troopName = rebelTroopDef ? rebelTroopDef.name : rebelTroopDefId;
			state.turnLog.push(rebelTroopSpawned + " " + troopName + " form at " + settlement.name + ".");
		}
	}

	const loyalTroops = [];
	const garrison = settlement.troops ? settlement.troops.slice() : [];
	for (let i = 0; i < garrison.length; i++) {
		const t = garrison[i];
		if (Space4x.loyaltyRoll(state, Space4x.unitLoyalty(state, settlement, t))) {
			rebelTroops.push(t);
			const def = Space4x.settingOf(state).builds[t.defId];
			state.turnLog.push((def ? def.name : t.defId) + " defects at " + settlement.name + ".");
		} else {
			loyalTroops.push(t);
		}
	}
	settlement.troops = [];

	function giveTo(empire, troops) {
		settlement.empireId = empire.id;
		settlement.troops = troops || [];
		Space4x.markStarExplored(state, empire.id, settlement.location.starId);
	}

	function crush(loyalLeft, rebelUnitsLost) {
		giveTo(parent, loyalLeft);
		let line = "The revolt at " + settlement.name + " is crushed.";
		if (rebelUnitsLost > 0) {
			line += " " + rebelUnitsLost + " rebel " + Space4x.unitsWord(rebelUnitsLost) + " destroyed.";
		}
		state.turnLog.push(line);
		if (parent.isPlayer) {
			if (!state.turnEvents) state.turnEvents = {};
			if (!state.turnEvents.crushedRevolts) state.turnEvents.crushedRevolts = [];
			state.turnEvents.crushedRevolts.push({
				settlementId: settlement.id,
				name: settlement.name,
				unitsLost: rebelUnitsLost || 0
			});
		}
		Space4x.removeEmpireIfEmpty(state, rebel.id);
	}

	if (!rebelTroops.length && !loyalTroops.length) {
		giveTo(rebel, []);
		state.turnLog.push(settlement.name + " falls to " + rebel.name + " (no garrison).");
		return;
	}
	if (!rebelTroops.length) {
		crush(loyalTroops, 0);
		return;
	}
	if (!loyalTroops.length) {
		giveTo(rebel, rebelTroops);
		state.turnLog.push(settlement.name + " falls to " + rebel.name + ".");
		return;
	}

	if (Space4x.combatModel(state) !== "quick") {
		giveTo(rebel, rebelTroops.concat(loyalTroops));
		state.turnLog.push(settlement.name + " falls to " + rebel.name + ".");
		return;
	}

	const fight = Space4x.quickCombat(state, {
		empire: rebel,
		troops: rebelTroops
	}, {
		empire: parent,
		troops: loyalTroops
	});
	const rebelTs = Space4x.troopListTs(state, rebel, rebelTroops);
	const loyalTs = Space4x.troopListTs(state, parent, loyalTroops);
	state.turnLog.push("Quick combat at " + settlement.name + ": " + rebel.name + " " + rebelTs +
		" TS vs " + parent.name + " " + loyalTs + " TS.");
	for (let r = 0; r < fight.rounds.length; r++) {
		const round = fight.rounds[r];
		state.turnLog.push("Round " + round.n + ": " + rebel.name + " deals " + round.atkDealt +
			", " + parent.name + " deals " + round.defDealt + " → " + round.atkPool + " vs " + round.defPool + " TS.");
	}
	if (fight.winner === "attacker") {
		giveTo(rebel, fight.atkTroops);
		state.turnLog.push(settlement.name + " falls to " + rebel.name + ".");
	} else {
		const rebelUnitsLost = rebelTroops.length - fight.atkTroops.length;
		crush(fight.defTroops, rebelUnitsLost);
	}
};

Space4x.phaseRebellion = function (state) {
	if (!Space4x.loyaltyRules(state)) return;
	const list = state.settlements.slice();
	for (let i = 0; i < list.length; i++) {
		const st = list[i];
		if (st.starvedThisTurn > 0 && st.pops.length) Space4x.resolveRevolt(state, st);
	}
};
