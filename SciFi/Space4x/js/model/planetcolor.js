var Space4x = Space4x || {};

Space4x.planetColorRules = function (state) {
	return Space4x.settingOf(state).planetColors || {};
};

Space4x.bodyHasColor = function (body, id) {
	if (!body || !body.colors) return false;
	for (let i = 0; i < body.colors.length; i++) {
		if (body.colors[i] === id) return true;
	}
	return false;
};

Space4x.planetColorLabel = function (state, id) {
	const rules = Space4x.planetColorRules(state)[id];
	return rules && rules.label ? rules.label : Space4x.titleCase(id || "");
};

Space4x.bodyColorDetails = function (body) {
	if (!body) return null;
	if (!body.colorDetails) body.colorDetails = {};
	return body.colorDetails;
};

Space4x.bodyColorDetail = function (body, colorId) {
	const details = body && body.colorDetails;
	return details && colorId ? (details[colorId] || null) : null;
};

Space4x.setBodyColorDetail = function (body, colorId, detail) {
	if (!body || !colorId) return;
	const details = Space4x.bodyColorDetails(body);
	details[colorId] = detail || {};
};

Space4x.rollWeightedOption = function (state, options) {
	const list = options || [];
	if (!list.length) return null;
	let total = 0;
	for (let i = 0; i < list.length; i++) total += Math.max(0, list[i].weight != null ? list[i].weight : 1);
	if (!(total > 0)) return list[Space4x.rngInt(state, list.length)];
	let roll = Space4x.rngInt(state, total);
	for (let i = 0; i < list.length; i++) {
		roll -= Math.max(0, list[i].weight != null ? list[i].weight : 1);
		if (roll < 0) return list[i];
	}
	return list[list.length - 1];
};

Space4x.bodyColorDetailSuffix = function (state, body, colorId) {
	const detail = Space4x.bodyColorDetail(body, colorId);
	if (colorId === "natives" && body.nativesCulture) {
		return Space4x.cultureName(state, body.nativesCulture);
	}
	if (colorId === "wildlife") {
		const level = Space4x.bodyWildlifeLevel(body);
		return level || null;
	}
	if (colorId === "spindel") return null;
	if (colorId === "rareMine") {
		const money = Space4x.bodyRareMineMoney(state, body);
		return money > 0 ? ("+" + money + "/turn") : null;
	}
	return null;
};

Space4x.bodyColorLabels = function (state, body) {
	if (!body || !body.colors || !body.colors.length) {
		if (body && body.spaceMonster) return ["Space monster lair (coming soon)"];
		return [];
	}
	const out = [];
	for (let i = 0; i < body.colors.length; i++) {
		const colorId = body.colors[i];
		let label = Space4x.planetColorLabel(state, colorId);
		const suffix = Space4x.bodyColorDetailSuffix(state, body, colorId);
		if (suffix) label += " (" + suffix + ")";
		out.push(label);
	}
	if (body.spaceMonster) out.push("Space monster lair (coming soon)");
	return out;
};

Space4x.PREDATOR_LEVELS = ["I", "II", "III", "IV"];

Space4x.predatorDefIdForLevel = function (level) {
	const map = { I: "predatorI", II: "predatorII", III: "predatorIII", IV: "predatorIV" };
	return map[level] || "predatorI";
};

Space4x.wildlifeLevelOptions = function (state) {
	const rules = Space4x.planetColorRules(state).wildlife || {};
	if (rules.predatorLevels && rules.predatorLevels.length) return rules.predatorLevels;
	const ids = rules.predatorDefIds || ["predatorI", "predatorII", "predatorIII", "predatorIV"];
	const levels = Space4x.PREDATOR_LEVELS;
	const out = [];
	for (let i = 0; i < ids.length; i++) {
		out.push({
			level: levels[i] || String(i + 1),
			predatorDefId: ids[i],
			weight: 1
		});
	}
	return out;
};

Space4x.rareMineMoneyOptions = function (state) {
	const rules = Space4x.planetColorRules(state).rareMine || {};
	if (rules.moneyTiers && rules.moneyTiers.length) return rules.moneyTiers;
	const fallback = rules.moneyPerTurn != null ? rules.moneyPerTurn : 10;
	return [{ moneyPerTurn: fallback, weight: 1 }];
};

Space4x.bodyWildlifeLevel = function (body) {
	if (!body) return null;
	const detail = Space4x.bodyColorDetail(body, "wildlife");
	if (detail && detail.level) return detail.level;
	if (body.wildlifeLevel) return body.wildlifeLevel;
	const defId = (detail && detail.predatorDefId) || body.predatorDefId;
	if (defId === "predatorIV") return "IV";
	if (defId === "predatorIII") return "III";
	if (defId === "predatorII") return "II";
	if (defId === "predatorI" || defId === "predator") return "I";
	return null;
};

Space4x.bodyRareMineMoney = function (state, body) {
	const detail = Space4x.bodyColorDetail(body, "rareMine");
	if (detail && detail.moneyPerTurn != null) return detail.moneyPerTurn;
	if (body && body.rareMineMoney != null) return body.rareMineMoney;
	const rules = Space4x.planetColorRules(state).rareMine || {};
	return rules.moneyPerTurn != null ? rules.moneyPerTurn : 10;
};

Space4x.applyWildlifeColor = function (state, body) {
	if (!body) return;
	const pick = Space4x.rollWeightedOption(state, Space4x.wildlifeLevelOptions(state)) || {
		level: "I",
		predatorDefId: "predatorI"
	};
	const level = pick.level || "I";
	const predatorDefId = pick.predatorDefId || Space4x.predatorDefIdForLevel(level);
	Space4x.setBodyColorDetail(body, "wildlife", {
		level: level,
		predatorDefId: predatorDefId
	});
	body.wildlifeLevel = level;
	body.predatorDefId = predatorDefId;
	delete body.wildlifeThreat;
};

Space4x.applyRareMineColor = function (state, body) {
	if (!body) return;
	const pick = Space4x.rollWeightedOption(state, Space4x.rareMineMoneyOptions(state)) || {
		moneyPerTurn: 10
	};
	const money = pick.moneyPerTurn != null ? pick.moneyPerTurn : 10;
	Space4x.setBodyColorDetail(body, "rareMine", { moneyPerTurn: money });
	body.rareMineMoney = money;
};

Space4x.applyPlanetColor = function (state, body, colorId) {
	if (!body || !colorId) return;
	if (colorId === "wildlife") Space4x.applyWildlifeColor(state, body);
	else if (colorId === "rareMine") Space4x.applyRareMineColor(state, body);
	else if (colorId === "spindel") Space4x.applySpindelColor(state, body);
};

Space4x.ensureBodyColorDetails = function (state, body) {
	if (!body || !body.colors) return;
	for (let i = 0; i < body.colors.length; i++) {
		const colorId = body.colors[i];
		if (colorId === "wildlife" && !Space4x.bodyWildlifeLevel(body)) {
			Space4x.applyWildlifeColor(state, body);
		}
		if (colorId === "rareMine") {
			const detail = Space4x.bodyColorDetail(body, "rareMine");
			if (!detail || detail.moneyPerTurn == null) Space4x.applyRareMineColor(state, body);
		}
		if (colorId === "spindel" && !Space4x.bodyColorDetail(body, "spindel")) {
			Space4x.setBodyColorDetail(body, "spindel", { web: true });
		}
	}
	if (body.wildlifeThreat != null) delete body.wildlifeThreat;
};

Space4x.planetColorPool = function (state, body) {
	const noNatives = body.kind === "asteroidBelt" || body.biome === "toxic";
	const pool = noNatives
		? ["rareMine", "wildlife", "ruins"]
		: ["natives", "rareMine", "wildlife", "ruins"];
	if (Space4x.gameHasNehudiEmpire(state) && Space4x.bodyIsSpindelEligible(body)) {
		pool.push("spindel");
	}
	return pool;
};

Space4x.rollPlanetColors = function (state, body) {
	if (!body || body.kind === "gasGiant") return;
	const rules = Space4x.planetColorRules(state);
	if (!rules || !Object.keys(rules).length) return;

	if (rules.spaceMonster && Space4x.rngInt(state, 40) === 0) {
		Space4x.applySpaceMonsterSite(state, body);
		return;
	}
	if (Space4x.rngInt(state, 2) !== 0) return;

	const pool = Space4x.planetColorPool(state, body);
	if (!pool.length) return;
	const pick = pool[Space4x.rngInt(state, pool.length)];
	body.colors = [pick];
	Space4x.applyPlanetColor(state, body, pick);
	if (Space4x.rngInt(state, 4) === 0) {
		let second = pool[Space4x.rngInt(state, pool.length)];
		while (second === pick && pool.length > 1) second = pool[Space4x.rngInt(state, pool.length)];
		if (second !== pick) {
			body.colors.push(second);
			Space4x.applyPlanetColor(state, body, second);
		}
	}
};

Space4x.applySpaceMonsterSite = function (state, body) {
	body.spaceMonster = true;
	if (body.kind === "rocky") {
		if (body.biome === "barren" || body.biome === "toxic") body.biome = "garden";
		if (!body.richness || body.richness === "poor" || body.richness === "veryPoor") {
			body.richness = "rich";
		}
	}
	body.colors = ["rareMine", "ruins"];
	Space4x.applyPlanetColor(state, body, "rareMine");
};

Space4x.empireCultureIds = function (state) {
	const used = {};
	for (let i = 0; i < state.empires.length; i++) {
		if (state.empires[i].cultureId) used[state.empires[i].cultureId] = true;
	}
	return used;
};

Space4x.pickNativeCultureId = function (state, used) {
	const list = Space4x.culturesOf(state);
	const opts = [];
	for (let i = 0; i < list.length; i++) {
		if (!used[list[i].id]) opts.push(list[i].id);
	}
	if (!opts.length) {
		for (let j = 0; j < list.length; j++) opts.push(list[j].id);
	}
	if (!opts.length) return null;
	return opts[Space4x.rngInt(state, opts.length)];
};

Space4x.resolvePlanetColors = function (state) {
	const used = Space4x.empireCultureIds(state);
	const stars = state.galaxy.stars || [];
	for (let s = 0; s < stars.length; s++) {
		const bodies = stars[s].bodies || [];
		for (let b = 0; b < bodies.length; b++) {
			const body = bodies[b];
			Space4x.ensureBodyColorDetails(state, body);
			if (!Space4x.bodyHasColor(body, "natives")) continue;
			if (body.kind === "asteroidBelt" || body.biome === "toxic") {
				body.colors = body.colors.filter(function (id) { return id !== "natives"; });
				if (!body.colors.length) delete body.colors;
				body.nativesCulture = null;
				continue;
			}
			let cultureId = Space4x.pickNativeCultureId(state, used);
			if (cultureId) {
				body.nativesCulture = cultureId;
				used[cultureId] = true;
			}
		}
	}
};

Space4x.createNativePop = function (state, cultureId) {
	const pop = Space4x.createPop(state, { cultureId: cultureId });
	pop.noResearch = true;
	return pop;
};

Space4x.absorbBodyNatives = function (state, settlement, body) {
	if (!settlement || !body || !body.nativesCulture) return 0;
	const rules = Space4x.planetColorRules(state).natives || {};
	const n = rules.popCount != null ? rules.popCount : 3;
	let added = 0;
	for (let i = 0; i < n; i++) {
		const pop = Space4x.createNativePop(state, body.nativesCulture);
		delete pop.noResearch;
		settlement.pops.push(pop);
		added += 1;
	}
	body.nativesCulture = null;
	if (body.colors) {
		body.colors = body.colors.filter(function (id) { return id !== "natives"; });
		if (!body.colors.length) delete body.colors;
	}
	return added;
};

Space4x.popCanResearch = function (pop) {
	return !(pop && pop.noResearch);
};

Space4x.settlementColorMoney = function (state, settlement) {
	const body = settlement ? Space4x.bodyById(state, settlement.location.bodyId) : null;
	if (!body || !Space4x.bodyHasColor(body, "rareMine")) return 0;
	return Space4x.bodyRareMineMoney(state, body);
};

Space4x.settlementColorResearch = function (state, settlement) {
	const body = settlement ? Space4x.bodyById(state, settlement.location.bodyId) : null;
	if (!body || !Space4x.bodyHasColor(body, "ruins")) return 0;
	const rules = Space4x.planetColorRules(state).ruins || {};
	const per = rules.researchPerScientist != null
		? rules.researchPerScientist
		: (rules.researchBonus != null ? rules.researchBonus : 1);
	if (!(per > 0)) return 0;
	const scientists = Space4x.countJob(settlement, "research");
	return scientists * per;
};
