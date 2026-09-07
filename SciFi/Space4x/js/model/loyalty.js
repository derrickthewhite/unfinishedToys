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

Space4x.settlementUnderpoliced = function (state, settlement) {
	const need = Space4x.policeNeed(state, settlement);
	if (need <= 0) return false;
	return Space4x.countPolice(state, settlement) < need;
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
	const support = Space4x.settlementFoodSupport(state, settlement, present);
	return support.foodShort;
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
	n += Space4x.cultureLoyaltyDelta(state, cultureId);
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
	return Space4x.groupLoyaltyModDelta(settlement, job, cultureId);
};

Space4x.groupLoyaltyModDelta = function (settlement, job, cultureId) {
	const mods = settlement && settlement.loyaltyMods;
	if (!mods) return 0;
	const row = mods[Space4x.groupKey(job, cultureId)];
	return row && row.delta ? row.delta : 0;
};

Space4x.addGroupLoyaltyDelta = function (settlement, job, cultureId, n, healEvery, meta) {
	if (!settlement || !n) return;
	if (!settlement.loyaltyMods) settlement.loyaltyMods = {};
	const key = Space4x.groupKey(job, cultureId);
	const row = settlement.loyaltyMods[key] || { delta: 0, heal: 0 };
	row.delta = (row.delta || 0) + n;
	if (healEvery) row.healEvery = healEvery;
	if (meta && meta.source) row.source = meta.source;
	settlement.loyaltyMods[key] = row;
};

Space4x.addGroupSpyDelta = function (settlement, job, cultureId, n) {
	Space4x.addGroupLoyaltyDelta(settlement, job, cultureId, n, 4, { source: "spy" });
};

Space4x.clearConquestLoyaltyPenalty = function (settlement) {
	if (!settlement) return;
	const mods = settlement.loyaltyMods;
	if (mods) {
		const keys = Object.keys(mods);
		for (let i = 0; i < keys.length; i++) {
			const row = mods[keys[i]];
			if (!row) {
				delete mods[keys[i]];
				continue;
			}
			if (row.source === "conquest") {
				delete mods[keys[i]];
				continue;
			}
			// Legacy conquest rows were untagged with healEvery 1.
			if (!row.source && row.delta < 0 && (row.healEvery || 0) === 1) {
				delete mods[keys[i]];
			}
		}
	}
	delete settlement.conqueredFromEmpireId;
};

Space4x.applyConquestLoyaltyPenalty = function (state, settlement, fromEmpireId, amount) {
	const rules = Space4x.loyaltyRules(state);
	if (!rules || !settlement) return;
	const n = amount != null ? amount : (rules.conquestPenalty != null ? rules.conquestPenalty : -40);
	if (!n) return;
	const healEvery = rules.conquestHealEvery != null ? rules.conquestHealEvery : 1;
	if (fromEmpireId) settlement.conqueredFromEmpireId = fromEmpireId;
	const seen = {};
	const pops = settlement.pops || [];
	for (let i = 0; i < pops.length; i++) {
		const pop = pops[i];
		const key = Space4x.groupKey(pop.job || "idle", pop.culture);
		if (seen[key]) continue;
		seen[key] = true;
		Space4x.addGroupLoyaltyDelta(settlement, pop.job || "idle", pop.culture, n, healEvery, { source: "conquest" });
	}
	const label = Space4x.settlementLabel(state, settlement);
	state.turnLog.push("Conquered population at " + label + " resents occupation (" + n + " loyalty).");
};

Space4x.applyOccupationChange = function (state, settlement, newOwner, previousOwner) {
	if (!settlement || !newOwner) return;
	settlement.conqueredTurn = state.turn;
	const liberatedFrom = settlement.conqueredFromEmpireId;
	if (liberatedFrom && newOwner.id === liberatedFrom &&
		!(previousOwner && previousOwner.isRevoltPolity)) {
		Space4x.clearConquestLoyaltyPenalty(settlement);
		state.turnLog.push(Space4x.settlementLabel(state, settlement) +
			" liberated — occupation loyalty penalty ends.");
		return;
	}
	const rules = Space4x.loyaltyRules(state);
	const fromId = previousOwner ? previousOwner.id : settlement.conqueredFromEmpireId;
	let amount = rules && rules.conquestPenalty != null ? rules.conquestPenalty : -40;
	if (previousOwner && previousOwner.isRevoltPolity) {
		amount = rules && rules.revoltConquestPenalty != null ? rules.revoltConquestPenalty : -20;
	}
	Space4x.applyConquestLoyaltyPenalty(state, settlement, fromId, amount);
};

Space4x.empireJobLoyalty = function (state, empire, job) {
	let n = 0;
	Space4x.eachEmpireTechEffect(state, empire, function (tech, fx) {
		if (fx.type !== "jobLoyalty") return;
		if (fx.job && fx.job !== job) return;
		if (fx.jobs && fx.jobs.length) {
			let hit = false;
			for (let i = 0; i < fx.jobs.length; i++) {
				if (fx.jobs[i] === job) hit = true;
			}
			if (!hit) return;
		}
		n += fx.n || 0;
	});
	return n;
};

Space4x.empireConquestHealStep = function (state, empire) {
	let step = 1;
	Space4x.eachEmpireTechEffect(state, empire, function (tech, fx) {
		if (fx.type === "conquestHealMult") {
			const n = Math.round(fx.mult || 1);
			if (n > step) step = n;
		}
	});
	return step;
};

Space4x.healLoyaltyMods = function (state) {
	const list = state.settlements || [];
	for (let s = 0; s < list.length; s++) {
		const mods = list[s].loyaltyMods;
		if (!mods) continue;
		const empire = Space4x.empireById(state, list[s].empireId);
		const conquestStep = Space4x.empireConquestHealStep(state, empire);
		const keys = Object.keys(mods);
		for (let i = 0; i < keys.length; i++) {
			const row = mods[keys[i]];
			if (!row || !row.delta) {
				delete mods[keys[i]];
				continue;
			}
			const every = row.healEvery || 4;
			row.heal = (row.heal || 0) + 1;
			if (row.heal < every) continue;
			row.heal = 0;
			const step = row.source === "conquest" ? conquestStep : 1;
			if (row.delta > 0) row.delta -= Math.min(row.delta, step);
			else if (row.delta < 0) row.delta += Math.min(-row.delta, step);
			if (!row.delta) delete mods[keys[i]];
		}
	}
};

Space4x.groupLoyalty = function (state, settlement, job, cultureId) {
	const empire = settlement ? Space4x.empireById(state, settlement.empireId) : null;
	let n = Space4x.cultureLoyalty(state, settlement, cultureId) + Space4x.groupSpyDelta(settlement, job, cultureId);
	n += Space4x.empireJobLoyalty(state, empire, job);
	if (n < 0) n = 0;
	if (n > 100) n = 100;
	return n;
};

Space4x.healSpyLoyalty = function (state) {
	Space4x.healLoyaltyMods(state);
};

Space4x.loyaltyExplain = function (state, settlement, cultureId, job) {
	const rules = Space4x.loyaltyRules(state);
	if (!rules) return [];
	const empire = settlement ? Space4x.empireById(state, settlement.empireId) : null;
	const lines = ["Base " + (rules.base || 0)];
	if (empire && cultureId && cultureId === empire.cultureId) {
		lines.push("+" + (rules.cultureBonus || 0) + " same species as empire");
	}
	const speciesLoyalty = Space4x.cultureLoyaltyDelta(state, cultureId);
	if (speciesLoyalty) {
		const who = Space4x.cultureName(state, cultureId) || "species";
		lines.push((speciesLoyalty > 0 ? "+" : "") + speciesLoyalty + " " + who);
	}
	const civic = empire && empire.modifiers ? empire.modifiers.loyalty : 0;
	if (civic) lines.push((civic > 0 ? "+" : "") + civic + " tech");
	if (job) {
		const jobLoy = Space4x.empireJobLoyalty(state, empire, job);
		if (jobLoy) {
			lines.push((jobLoy > 0 ? "+" : "") + jobLoy + " " + Space4x.jobLabel(state, job) + " tech");
		}
	}
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
		const mod = Space4x.groupLoyaltyModDelta(settlement, job, cultureId);
		if (mod) {
			const mods = settlement.loyaltyMods || {};
			const row = mods[Space4x.groupKey(job, cultureId)];
			const label = row && row.source === "conquest" ? " occupation penalty" :
				(mod < 0 ? " occupation penalty" : " spies");
			lines.push((mod > 0 ? "+" : "") + mod + label);
		}
	}
	if (Space4x.settlementHungry(state, settlement)) lines.push("−" + (rules.foodPenalty || 0) + " not enough food");
	if (Space4x.settlementStarveMemory(settlement)) {
		lines.push("−" + (rules.starveMemoryPenalty || 0) + " recent starvation");
	}
	const need = Space4x.policeNeed(state, settlement);
	const have = Space4x.countPolice(state, settlement);
	if (have < need) lines.push("−" + (rules.policePenalty || 0) + " police " + have + "/" + need);
	else if (need) lines.push("Police " + have + "/" + need);
	if (Space4x.settlementUnderpoliced(state, settlement)) {
		const cut = rules.policeProductionPenalty != null ? rules.policeProductionPenalty : 0.1;
		lines.push("−" + Math.round(cut * 100) + "% production (underpoliced)");
	}
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
	if (settlement.conqueredTurn === state.turn) return 100;
	let n = Space4x.cultureLoyalty(state, settlement, troop.culture) +
		Space4x.unitLoyaltyDelta(state, settlement, troop);
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
	const rules = Space4x.loyaltyRules(state);
	const need = Space4x.policeNeed(state, settlement);
	const have = Space4x.countPolice(state, settlement);
	let text = "Loyalty " + Space4x.settlementLoyalty(state, settlement) + "% · Police " + have + "/" + need;
	if (Space4x.settlementUnderpoliced(state, settlement)) {
		const cut = rules.policeProductionPenalty != null ? rules.policeProductionPenalty : 0.1;
		text += " · −" + Math.round(cut * 100) + "% production";
	}
	return text;
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

Space4x.empireNameTaken = function (state, name) {
	const list = state.empires || [];
	for (let i = 0; i < list.length; i++) {
		if (list[i].name === name) return true;
	}
	return false;
};

Space4x.isDormantEmpire = function (empire) {
	return !!(empire && empire.dormant);
};

Space4x.isActiveEmpire = function (empire) {
	return !!(empire && !empire.dormant);
};

Space4x.revoltNameSuffixes = function (state) {
	const rules = Space4x.revoltRules(state);
	const list = rules && rules.nameSuffixes;
	if (list && list.length) return list.slice();
	return [
		"Rebellion", "Movement", "Revolt", "Independence", "Militia",
		"New Way", "Grand Path", "Association", "Resistance", "$newParent"
	];
};

Space4x.buildRevoltEmpireName = function (state, cultureId, parent, suffix) {
	const species = Space4x.cultureName(state, cultureId) || "Rebel";
	if (suffix === "$newParent") {
		const parentName = parent && parent.name ? parent.name : "Empire";
		return "New " + parentName;
	}
	return species + " " + suffix;
};

Space4x.revoltEmpireName = function (state, settlement, cultureId, parent) {
	const suffixes = Space4x.revoltNameSuffixes(state);
	for (let i = 0; i < suffixes.length; i++) {
		const name = Space4x.buildRevoltEmpireName(state, cultureId, parent, suffixes[i]);
		if (!Space4x.empireNameTaken(state, name)) return name;
	}
	const species = Space4x.cultureName(state, cultureId) || "Rebel";
	const base = species + " Rebellion";
	if (!Space4x.empireNameTaken(state, base)) return base;
	let n = 2;
	while (Space4x.empireNameTaken(state, base + " " + n)) n += 1;
	return base + " " + n;
};

Space4x.findDormantRevoltEmpire = function (state, cultureId) {
	const list = state.empires || [];
	for (let i = 0; i < list.length; i++) {
		const e = list[i];
		if (!e.dormant || !e.isRevoltPolity) continue;
		if (cultureId && e.cultureId !== cultureId) continue;
		return e;
	}
	return null;
};

// Same-species revolts share one polity. Only mint another when revolting
// against an already-active revolt of that species (rebellion-from-rebellion).
Space4x.findReusableRevoltEmpire = function (state, cultureId, parent) {
	const parentId = parent && parent.id;
	const list = state.empires || [];
	for (let i = 0; i < list.length; i++) {
		const e = list[i];
		if (e.dormant || !e.isRevoltPolity) continue;
		if (cultureId && e.cultureId !== cultureId) continue;
		if (e.id === parentId) continue;
		return e;
	}
	return Space4x.findDormantRevoltEmpire(state, cultureId);
};

Space4x.mergeScoreHistoryEmpire = function (state, fromId, intoId) {
	if (!fromId || !intoId || fromId === intoId) return;
	const history = state.scoreHistory || [];
	for (let t = 0; t < history.length; t++) {
		const scores = history[t].scores;
		if (!scores || !scores[fromId]) continue;
		const src = scores[fromId];
		const dst = scores[intoId] || (scores[intoId] = {});
		const keys = Object.keys(src);
		for (let k = 0; k < keys.length; k++) {
			const key = keys[k];
			dst[key] = (dst[key] || 0) + (src[key] || 0);
		}
		delete scores[fromId];
	}
	if (state.scoreEmpireMeta) delete state.scoreEmpireMeta[fromId];
};

Space4x.mergeRevoltPolityInto = function (state, from, into) {
	if (!from || !into || from.id === into.id) return;
	const homes = Space4x.settlementsOf(state, from.id).slice();
	for (let i = 0; i < homes.length; i++) {
		Space4x.transferSettlement(state, homes[i], into);
	}
	const ships = [];
	for (let i = 0; i < (state.units || []).length; i++) {
		if (state.units[i].empireId === from.id) ships.push(state.units[i]);
	}
	for (let i = 0; i < ships.length; i++) {
		if (Space4x.transferShip) Space4x.transferShip(state, ships[i], into);
		else ships[i].empireId = into.id;
	}
	const money = Space4x.moneyRound((from.stockpiles && from.stockpiles.money) || 0);
	if (money) {
		from.stockpiles.money = 0;
		into.stockpiles = into.stockpiles || { money: 0 };
		into.stockpiles.money = Space4x.moneyRound((into.stockpiles.money || 0) + money);
	}
	Space4x.mergeScoreHistoryEmpire(state, from.id, into.id);
	if (Space4x.forgetEmpireDiplomacy) Space4x.forgetEmpireDiplomacy(state, from.id);
	state.empires = state.empires.filter(function (e) { return e.id !== from.id; });
};

Space4x.consolidateRevoltPolities = function (state) {
	if (!state || !state.empires) return;
	const byCulture = {};
	for (let i = 0; i < state.empires.length; i++) {
		const e = state.empires[i];
		if (!e.isRevoltPolity) continue;
		const key = e.cultureId || e.id;
		if (!byCulture[key]) byCulture[key] = [];
		byCulture[key].push(e);
	}
	const cultures = Object.keys(byCulture);
	for (let c = 0; c < cultures.length; c++) {
		const list = byCulture[cultures[c]];
		if (list.length < 2) continue;
		list.sort(function (a, b) {
			if (!!a.dormant !== !!b.dormant) return a.dormant ? 1 : -1;
			return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
		});
		const keeper = list[0];
		let oldest = list[0];
		for (let i = 1; i < list.length; i++) {
			if (String(list[i].id).localeCompare(String(oldest.id), undefined, { numeric: true }) < 0) {
				oldest = list[i];
			}
		}
		if (oldest && oldest.name) keeper.name = oldest.name;
		for (let i = 1; i < list.length; i++) {
			Space4x.mergeRevoltPolityInto(state, list[i], keeper);
		}
	}
};

Space4x.mothballRevoltEmpire = function (state, empire) {
	if (!empire || empire.isPlayer) return false;
	empire.dormant = true;
	empire.isRevoltPolity = true;
	empire.revoltJoinOffered = false;
	empire.revoltJoinDueTurn = null;
	empire.spies = [];
	empire.stockpiles = { money: 0 };
	empire.transport = { freighters: 0, spindelNavigators: 0 };
	empire.relations = {};
	empire.knackFirstStructure = {};
	if (Space4x.forgetEmpireDiplomacy) Space4x.forgetEmpireDiplomacy(state, empire.id);
	return true;
};

Space4x.reviveRevoltEmpire = function (state, rebel, parent, settlement) {
	if (!rebel || !parent || !settlement) return null;
	rebel.dormant = false;
	rebel.isRevoltPolity = true;
	rebel.revoltFromEmpireId = parent.id;
	rebel.revoltJoinDueTurn = null;
	rebel.revoltJoinOffered = false;
	rebel.isPlayer = false;
	rebel.aiId = "dumb";
	rebel.spies = [];
	rebel.stockpiles = { money: 0 };
	rebel.transport = { freighters: 0, spindelNavigators: 0 };
	rebel.relations = {};
	rebel.knackFirstStructure = {};
	Space4x.copyEmpireResearch(state, parent, rebel);
	rebel.exploredStarIds = (parent.exploredStarIds || []).slice();
	Space4x.markStarExplored(state, rebel.id, settlement.location.starId);
	return rebel;
};

Space4x.attachToRevoltEmpire = function (state, rebel, parent, settlement) {
	if (!rebel || !parent || !settlement) return null;
	if (rebel.dormant) return Space4x.reviveRevoltEmpire(state, rebel, parent, settlement);
	rebel.isRevoltPolity = true;
	rebel.revoltFromEmpireId = parent.id;
	Space4x.markStarExplored(state, rebel.id, settlement.location.starId);
	return rebel;
};

Space4x.createRevoltEmpire = function (state, parent, settlement, cultureId) {
	const cid = cultureId || (parent && parent.cultureId);
	const existing = Space4x.findReusableRevoltEmpire(state, cid, parent);
	if (existing) {
		Space4x.attachToRevoltEmpire(state, existing, parent, settlement);
		return existing;
	}
	const rebel = Space4x.createEmpire(state, {
		id: Space4x.nextId(state, "e"),
		name: Space4x.revoltEmpireName(state, settlement, cid, parent),
		isPlayer: false,
		aiId: "dumb",
		cultureId: cid
	});
	rebel.isRevoltPolity = true;
	rebel.revoltFromEmpireId = parent ? parent.id : null;
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
	if (empire.isRevoltPolity || empire.dormant) {
		Space4x.mothballRevoltEmpire(state, empire);
		return;
	}
	state.empires = state.empires.filter(function (e) { return e.id !== empireId; });
	if (Space4x.forgetEmpireDiplomacy) Space4x.forgetEmpireDiplomacy(state, empireId);
};

Space4x.empirePopCount = function (state, empireId) {
	let n = 0;
	const homes = Space4x.settlementsOf(state, empireId);
	for (let i = 0; i < homes.length; i++) n += (homes[i].pops || []).length;
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.empireId !== empireId) continue;
		n += (u.cargoPops || []).length;
	}
	return n;
};

Space4x.endRevoltIfNoPopulace = function (state, empire) {
	if (!empire || !empire.isRevoltPolity || empire.isPlayer || empire.dormant) return false;
	if (Space4x.empirePopCount(state, empire.id) > 0) return false;
	const name = empire.name;
	const homes = Space4x.settlementsOf(state, empire.id).slice();
	const parent = Space4x.empireById(state, empire.revoltFromEmpireId);
	for (let i = 0; i < homes.length; i++) {
		const st = homes[i];
		if (parent) {
			Space4x.transferSettlement(state, st, parent);
			Space4x.clearConquestLoyaltyPenalty(st);
		} else {
			state.settlements = state.settlements.filter(function (s) { return s.id !== st.id; });
		}
	}
	state.units = (state.units || []).filter(function (u) { return u.empireId !== empire.id; });
	Space4x.mothballRevoltEmpire(state, empire);
	state.turnLog.push(name + " ends — no populace remains" +
		(parent ? "; worlds revert to " + parent.name : "") + ".");
	return true;
};

Space4x.phaseEndEmptyRevolts = function (state) {
	const revolts = Space4x.revoltPolities(state).slice();
	for (let i = 0; i < revolts.length; i++) {
		Space4x.endRevoltIfNoPopulace(state, revolts[i]);
	}
};

Space4x.markRevoltVictory = function (state, rebel, parent) {
	if (!rebel || !parent) return;
	rebel.isRevoltPolity = true;
	rebel.revoltFromEmpireId = parent.id;
	rebel.revoltJoinDueTurn = state.turn + 1;
	rebel.revoltJoinOffered = false;
};

Space4x.revoltPolities = function (state) {
	const out = [];
	const list = state.empires || [];
	for (let i = 0; i < list.length; i++) {
		if (list[i].isRevoltPolity && !list[i].dormant) out.push(list[i]);
	}
	return out;
};

Space4x.strongestEmpire = function (state, empires) {
	let best = null;
	let bestPower = -1;
	for (let i = 0; i < empires.length; i++) {
		const p = Space4x.empirePower(state, empires[i]);
		if (p > bestPower) {
			bestPower = p;
			best = empires[i];
		}
	}
	return best;
};

Space4x.findRevoltJoinTarget = function (state, rebel) {
	if (!rebel || !rebel.isRevoltPolity || rebel.dormant) return null;
	const parentId = rebel.revoltFromEmpireId;
	const cultureId = rebel.cultureId;
	if (!cultureId) return null;
	const revolts = [];
	const list = Space4x.revoltPolities(state);
	for (let i = 0; i < list.length; i++) {
		const e = list[i];
		if (e.id === rebel.id) continue;
		if (e.cultureId !== cultureId) continue;
		revolts.push(e);
	}
	if (revolts.length) return Space4x.strongestEmpire(state, revolts);
	const homelands = [];
	const empires = state.empires || [];
	for (let i = 0; i < empires.length; i++) {
		const e = empires[i];
		if (e.id === rebel.id) continue;
		if (e.id === parentId) continue;
		if (e.cultureId !== cultureId) continue;
		if (e.isRevoltPolity) continue;
		homelands.push(e);
	}
	return Space4x.strongestEmpire(state, homelands);
};

Space4x.setRevoltWar = function (state, rebel, parent) {
	if (!rebel || !parent || rebel.id === parent.id) return;
	rebel.isRevoltPolity = true;
	rebel.revoltFromEmpireId = parent.id;
	if (Space4x.atWar(rebel, parent)) return;
	Space4x.setPairFlag(rebel, parent, "war", true);
	if (Space4x.clearTreaties) Space4x.clearTreaties(rebel, parent);
	if (Space4x.dropOffersBetween) Space4x.dropOffersBetween(state, rebel.id, parent.id);
	state.turnLog.push(rebel.name + " is at war with " + parent.name + ".");
};

Space4x.summarizePopList = function (state, pops) {
	const groups = {};
	const order = [];
	const list = pops || [];
	for (let i = 0; i < list.length; i++) {
		const pop = list[i];
		const culture = pop.culture || "";
		const job = pop.job || "idle";
		const key = job + "::" + culture;
		if (!groups[key]) {
			groups[key] = { job: job, culture: culture, count: 0 };
			order.push(key);
		}
		groups[key].count += 1;
	}
	const lines = [];
	for (let i = 0; i < order.length; i++) {
		const row = groups[order[i]];
		const who = Space4x.cultureName(state, row.culture) || "Colonists";
		const jobLabel = row.job === "idle" ? "idle" : row.job;
		lines.push(row.count + " " + who + " (" + jobLabel + ")");
	}
	return { count: list.length, lines: lines };
};

Space4x.registerRevoltSummary = function (state, report) {
	if (!state.turnEvents) state.turnEvents = {};
	if (!state.turnEvents.revoltSummaries) state.turnEvents.revoltSummaries = [];
	state.turnEvents.revoltSummaries.push(report);
	return report;
};

Space4x.revoltSummariesOf = function (state, empireId) {
	const list = state.turnEvents && state.turnEvents.revoltSummaries;
	if (!list) return [];
	if (!empireId) return list.slice();
	const out = [];
	for (let i = 0; i < list.length; i++) {
		if (list[i].empireId === empireId) out.push(list[i]);
	}
	return out;
};

Space4x.revoltSummaryById = function (state, id) {
	const list = state.turnEvents && state.turnEvents.revoltSummaries;
	if (!list || !id) return null;
	for (let i = 0; i < list.length; i++) {
		if (list[i].id === id) return list[i];
	}
	return null;
};

Space4x.markRevoltSummarySeen = function (state, id) {
	const row = Space4x.revoltSummaryById(state, id);
	if (row) row.seen = true;
};

Space4x.revoltSummaryForCombat = function (state, combatId) {
	const list = state.turnEvents && state.turnEvents.revoltSummaries;
	if (!list || !combatId) return null;
	for (let i = 0; i < list.length; i++) {
		if (list[i].combatId === combatId) return list[i];
	}
	return null;
};

Space4x.markRevoltJoinSeen = function (state, id) {
	const list = state.turnEvents && state.turnEvents.revoltJoins;
	if (!list || !id) return;
	for (let i = 0; i < list.length; i++) {
		if (list[i].id === id) list[i].seen = true;
	}
};

Space4x.revoltJoinOfferClauses = function (state, rebel) {
	const give = [];
	const homes = Space4x.settlementsOf(state, rebel.id);
	for (let i = 0; i < homes.length; i++) {
		give.push({ type: "settlement", settlementId: homes[i].id });
	}
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.empireId !== rebel.id || Space4x.isHauler(state, u)) continue;
		give.push({ type: "ship", unitId: u.id });
	}
	return give;
};

Space4x.absorbRevoltPolity = function (state, rebel, target) {
	if (!rebel || !target || rebel.id === target.id || rebel.dormant) return false;
	const rebelName = rebel.name;
	const targetName = target.name;
	const settlements = Space4x.settlementsOf(state, rebel.id).slice();
	for (let i = 0; i < settlements.length; i++) {
		Space4x.transferSettlement(state, settlements[i], target);
	}
	const ships = [];
	for (let i = 0; i < state.units.length; i++) {
		if (state.units[i].empireId === rebel.id) ships.push(state.units[i]);
	}
	for (let i = 0; i < ships.length; i++) Space4x.transferShip(state, ships[i], target);
	const money = Space4x.moneyRound(rebel.stockpiles.money || 0);
	if (money) {
		rebel.stockpiles.money = 0;
		target.stockpiles.money = Space4x.moneyRound((target.stockpiles.money || 0) + money);
	}
	Space4x.mothballRevoltEmpire(state, rebel);
	const summary = rebelName + " joins " + targetName + ".";
	state.turnLog.push(summary);
	if (!target.isPlayer) {
		if (!state.turnEvents) state.turnEvents = {};
		if (!state.turnEvents.revoltJoins) state.turnEvents.revoltJoins = [];
		state.turnEvents.revoltJoins.push({
			id: Space4x.nextId(state, "rj"),
			turn: state.turn,
			rebelName: rebelName,
			targetId: target.id,
			targetName: targetName,
			summary: summary,
			seen: false
		});
	}
	return true;
};

Space4x.submitRevoltJoinOffer = function (state, rebel, target) {
	if (!rebel || !target || rebel.id === target.id) return false;
	const give = Space4x.revoltJoinOfferClauses(state, rebel);
	if (!give.length) return false;
	const offer = {
		id: Space4x.nextId(state, "d"),
		kind: "revoltJoin",
		fromId: rebel.id,
		toId: target.id,
		give: give,
		want: [],
		pacts: [],
		turn: state.turn
	};
	rebel.revoltJoinOffered = true;
	if (!state.offers) state.offers = [];
	if (target.isPlayer) {
		state.offers.push(offer);
		state.turnLog.push(rebel.name + " asks to join " + target.name + ".");
		return true;
	}
	if (rebel.cultureId === target.cultureId) {
		Space4x.absorbRevoltPolity(state, rebel, target);
		return true;
	}
	state.turnLog.push(rebel.name + " sought to join " + target.name + " but was refused.");
	Space4x.removeEmpireIfEmpty(state, rebel.id);
	return false;
};

Space4x.phaseRevoltJoins = function (state) {
	const list = Space4x.revoltPolities(state);
	for (let i = 0; i < list.length; i++) {
		const rebel = list[i];
		if (rebel.revoltJoinOffered) continue;
		if (rebel.revoltJoinDueTurn == null || state.turn < rebel.revoltJoinDueTurn) continue;
		const target = Space4x.findRevoltJoinTarget(state, rebel);
		if (!target) {
			rebel.revoltJoinDueTurn = state.turn + 1;
			continue;
		}
		Space4x.submitRevoltJoinOffer(state, rebel, target);
	}
};

Space4x.hungerUnrestTest = function (state, settlement) {
	if (!Space4x.settlementHungry(state, settlement)) return false;
	const loyalty = Space4x.settlementLoyalty(state, settlement);
	const n = Math.max(1, Math.floor((100 - loyalty) / 2));
	return Space4x.rngInt(state, n) === 0;
};

Space4x.politicalUnrestTest = function (state, settlement) {
	const rules = Space4x.revoltRules(state);
	const n = rules && rules.politicalUnrestChance != null ? rules.politicalUnrestChance : 100;
	if (n <= 0) return false;
	return Space4x.rngInt(state, n) === 0;
};

Space4x.resolveRevolt = function (state, settlement, opts) {
	opts = opts || {};
	const parent = Space4x.empireById(state, settlement.empireId);
	if (!parent || !settlement.pops.length) return null;
	const groups = Space4x.loyaltyGroups(state, settlement);
	const failing = [];
	for (let i = 0; i < groups.length; i++) {
		const g = groups[i];
		const fail = Space4x.loyaltyRoll(state, g.loyalty);
		if (fail) failing.push(g);
	}
	if (!failing.length) return null;

	const rebelPops = [];
	for (let i = 0; i < failing.length; i++) {
		for (let p = 0; p < failing[i].pops.length; p++) rebelPops.push(failing[i].pops[p]);
	}
	const cultureId = Space4x.majorityCultureOfPops(state, rebelPops, parent.cultureId);
	const rebel = Space4x.createRevoltEmpire(state, parent, settlement, cultureId);
	Space4x.setRevoltWar(state, rebel, parent);
	const avg = Space4x.settlementLoyalty(state, settlement);
	const loyalPops = [];
	const rebelPopIds = {};
	for (let i = 0; i < rebelPops.length; i++) rebelPopIds[rebelPops[i].id] = true;
	for (let i = 0; i < settlement.pops.length; i++) {
		if (!rebelPopIds[settlement.pops[i].id]) loyalPops.push(settlement.pops[i]);
	}
	const rebelPopSummary = Space4x.summarizePopList(state, rebelPops);
	const loyalPopSummary = Space4x.summarizePopList(state, loyalPops);
	const label = Space4x.settlementLabel(state, settlement);
	const revoltRules = Space4x.revoltRules(state);
	const rebelTroopDefId = revoltRules && revoltRules.rebelTroopDefId;
	const rebelTroopDef = rebelTroopDefId ? Space4x.settingOf(state).builds[rebelTroopDefId] : null;

	state.turnLog.push(settlement.name + " revolts (" + rebelPops.length + " " +
		Space4x.peopleWord(rebelPops.length) + ", loyalty " + avg + "%).");

	const rebelTroops = [];
	const spawnedMilitia = [];
	let rebelTroopSpawned = 0;
	if (rebelTroopDefId) {
		for (let i = 0; i < rebelPops.length; i++) {
			if (!Space4x.loyaltyRoll(state, Space4x.groupLoyalty(state, settlement, rebelPops[i].job || "idle", rebelPops[i].culture))) continue;
			const troop = {
				id: Space4x.nextId(state, "t"),
				defId: rebelTroopDefId,
				culture: rebelPops[i].culture
			};
			rebelTroops.push(troop);
			spawnedMilitia.push(troop);
			rebelTroopSpawned += 1;
		}
		if (rebelTroopSpawned) {
			const troopName = rebelTroopDef ? rebelTroopDef.name : rebelTroopDefId;
			state.turnLog.push(rebelTroopSpawned + " " + troopName + " form at " + settlement.name + ".");
		}
	}

	const defectedTroops = [];
	const loyalTroops = [];
	const garrison = settlement.troops ? settlement.troops.slice() : [];
	for (let i = 0; i < garrison.length; i++) {
		const t = garrison[i];
		if (Space4x.loyaltyRoll(state, Space4x.unitLoyalty(state, settlement, t))) {
			rebelTroops.push(t);
			defectedTroops.push(t);
			const def = Space4x.settingOf(state).builds[t.defId];
			state.turnLog.push((def ? def.name : t.defId) + " defects at " + settlement.name + ".");
		} else {
			loyalTroops.push(t);
		}
	}
	settlement.troops = [];

	const defectedSummary = Space4x.summarizeTroopSide(state, rebel, defectedTroops);
	const loyalTroopSummary = Space4x.summarizeTroopSide(state, parent, loyalTroops);
	const militiaSummary = Space4x.summarizeTroopSide(state, rebel, spawnedMilitia);

	function registerRevoltSummary(outcome, summary, extra) {
		const report = {
			id: Space4x.nextId(state, "rv"),
			turn: state.turn + 1,
			settlementId: settlement.id,
			settlementLabel: label,
			starId: settlement.location.starId,
			bodyId: settlement.location.bodyId,
			empireId: parent.id,
			rebelEmpireId: rebel.id,
			rebelEmpireName: rebel.name,
			outcome: outcome,
			rebelPopCount: rebelPopSummary.count,
			rebelPopLines: rebelPopSummary.lines,
			loyalPopCount: loyalPopSummary.count,
			loyalPopLines: loyalPopSummary.lines,
			militiaSpawned: rebelTroopSpawned,
			militiaName: rebelTroopDef ? rebelTroopDef.name : (rebelTroopDefId || "Militia"),
			militiaStacks: militiaSummary.stacks,
			defectedStacks: defectedSummary.stacks,
			loyalTroopStacks: loyalTroopSummary.stacks,
			summary: summary,
			seen: false
		};
		if (extra) {
			const keys = Object.keys(extra);
			for (let i = 0; i < keys.length; i++) report[keys[i]] = extra[keys[i]];
		}
		if (parent.isPlayer) Space4x.registerRevoltSummary(state, report);
	}

	function giveTo(empire, troops) {
		settlement.empireId = empire.id;
		settlement.troops = troops || [];
		Space4x.markStarExplored(state, empire.id, settlement.location.starId);
		Space4x.clearConquestLoyaltyPenalty(settlement);
	}

	function rebelWon(rebelEmpire) {
		Space4x.markRevoltVictory(state, rebelEmpire, parent);
		Space4x.clearConquestLoyaltyPenalty(settlement);
		if (opts.sponsorEmpireId) {
			Space4x.addAttitude(state, rebelEmpire, opts.sponsorEmpireId, 10);
		}
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
		rebelWon(rebel);
		const line = settlement.name + " falls to " + rebel.name + " (no garrison).";
		state.turnLog.push(line);
		registerRevoltSummary("rebel_won", line);
		return rebel;
	}
	if (!rebelTroops.length) {
		crush(loyalTroops, 0);
		registerRevoltSummary("crushed", "The revolt at " + settlement.name + " is crushed.");
		return null;
	}
	if (!loyalTroops.length) {
		giveTo(rebel, rebelTroops);
		rebelWon(rebel);
		const line = settlement.name + " falls to " + rebel.name + ".";
		state.turnLog.push(line);
		registerRevoltSummary("rebel_won", line);
		return rebel;
	}

	if (Space4x.combatModel(state) !== "quick") {
		giveTo(rebel, rebelTroops.concat(loyalTroops));
		rebelWon(rebel);
		const line = settlement.name + " falls to " + rebel.name + ".";
		state.turnLog.push(line);
		registerRevoltSummary("rebel_won", line);
		return rebel;
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
	state.turnLog.push("Quick combat at " + label + ": " + rebel.name + " " + rebelTs +
		" TS vs " + parent.name + " " + loyalTs + " TS.");
	const report = Space4x.buildGroundCombatReport(state, {
		kind: "revolt",
		settlementId: settlement.id,
		settlementLabel: label,
		starId: settlement.location.starId,
		bodyId: settlement.location.bodyId,
		empireId: parent.id,
		attackerLabel: rebel.name,
		defenderLabel: parent.name + " garrison",
		atk: { empire: rebel, troops: rebelTroops },
		def: { empire: parent, troops: loyalTroops },
		atkTroopsBefore: rebelTroops,
		defTroopsBefore: loyalTroops,
		fight: fight,
		popsLost: 0,
		effects: []
	});
	if (fight.winner === "attacker") {
		giveTo(rebel, fight.atkTroops);
		rebelWon(rebel);
		const line = settlement.name + " falls to " + rebel.name + ".";
		state.turnLog.push(line);
		report.summary = line;
		report.effects.push("Settlement changes hands.");
		Space4x.registerGroundCombat(state, report);
		registerRevoltSummary("combat_rebel_won", line, { combatId: report.id });
	} else {
		const rebelUnitsLost = rebelTroops.length - fight.atkTroops.length;
		report.summary = "Revolt crushed at " + label + ".";
		if (rebelUnitsLost > 0) {
			report.effects.push(rebelUnitsLost + " rebel " + Space4x.unitsWord(rebelUnitsLost) + " destroyed.");
		}
		Space4x.registerGroundCombat(state, report);
		crush(fight.defTroops, rebelUnitsLost);
		let summary = "Revolt crushed at " + label + ".";
		if (rebelUnitsLost > 0) {
			summary += " " + rebelUnitsLost + " rebel " + Space4x.unitsWord(rebelUnitsLost) + " destroyed.";
		}
		registerRevoltSummary("combat_crushed", summary, { combatId: report.id });
		return null;
	}
	return rebel;
};

Space4x.phaseRebellion = function (state) {
	if (!Space4x.loyaltyRules(state)) return;
	const list = state.settlements.slice();
	for (let i = 0; i < list.length; i++) {
		const st = list[i];
		if (!st.pops.length) continue;
		if (st.conqueredTurn === state.turn) continue;
		if (st.starvedThisTurn > 0) {
			Space4x.resolveRevolt(state, st);
			continue;
		}
		if (Space4x.hungerUnrestTest(state, st) || Space4x.politicalUnrestTest(state, st)) {
			Space4x.resolveRevolt(state, st);
		}
	}
};
