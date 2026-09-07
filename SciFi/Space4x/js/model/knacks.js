var Space4x = Space4x || {};

Space4x.ensureKnackState = function (empire) {
	if (!empire) return;
	if (!empire.knackFirstStructure) empire.knackFirstStructure = {};
};

Space4x.backfillKnackFirstStructures = function (state, empire) {
	if (!empire) return;
	Space4x.ensureKnackState(empire);
	const homes = Space4x.settlementsOf(state, empire.id);
	for (let i = 0; i < homes.length; i++) {
		const structs = homes[i].structures || [];
		for (let s = 0; s < structs.length; s++) {
			if (structs[s].defId) empire.knackFirstStructure[structs[s].defId] = true;
		}
	}
};

Space4x.markKnackFirstStructure = function (empire, defId) {
	if (!empire || !defId) return;
	Space4x.ensureKnackState(empire);
	empire.knackFirstStructure[defId] = true;
};

Space4x.empireHasBuiltStructureKind = function (state, empireId, defId) {
	const empire = Space4x.empireById(state, empireId);
	Space4x.ensureKnackState(empire);
	if (empire && empire.knackFirstStructure && empire.knackFirstStructure[defId]) return true;
	const homes = Space4x.settlementsOf(state, empireId);
	for (let i = 0; i < homes.length; i++) {
		if (Space4x.countStructure(homes[i], defId) > 0) return true;
	}
	return false;
};

Space4x.settlementQueueBuildDef = function (state, settlement) {
	if (!settlement || !settlement.buildQueue || !settlement.buildQueue.length) return null;
	return Space4x.settingOf(state).builds[settlement.buildQueue[0].defId] || null;
};

Space4x.settlementPreviewBuildDef = function (state, settlement) {
	const queued = Space4x.settlementQueueBuildDef(state, settlement);
	if (queued) return queued;
	const inspect = state && state.ui && state.ui.inspect;
	if (!inspect || inspect.kind !== "catalog" || !inspect.defId) return null;
	if (!settlement || state.ui.selectedSettlementId !== settlement.id) return null;
	return Space4x.settingOf(state).builds[inspect.defId] || null;
};

Space4x.knackBuildConditionMet = function (state, settlement, fx, def) {
	if (!fx || !def) return false;
	if (fx.when === "ship") return def.kind === "unit";
	if (fx.when === "firstStructureEmpire") {
		if (def.kind !== "structure") return false;
		const empireId = settlement && settlement.empireId;
		return !Space4x.empireHasBuiltStructureKind(state, empireId, def.id);
	}
	if (fx.when === "repeatStructureSettlement") {
		if (def.kind !== "structure") return false;
		return Space4x.countStructure(settlement, def.id) > 0;
	}
	return false;
};

Space4x.knackBuildConditionLabel = function (fx) {
	if (!fx) return "";
	if (fx.when === "ship") return "building ships";
	if (fx.when === "firstStructureEmpire") return "building the first of that structure in the empire";
	if (fx.when === "repeatStructureSettlement") return "building a structure already on that settlement";
	return fx.when || "working";
};

Space4x.knackResearchMatches = function (state, empire, fx) {
	if (!fx || !empire || !empire.research || !empire.research.currentProjectId) return false;
	const tech = Space4x.techById(state, empire.research.currentProjectId);
	if (!tech) return false;
	const cats = fx.categories || (fx.categoryId ? [fx.categoryId] : []);
	for (let i = 0; i < cats.length; i++) {
		if (tech.categoryId === cats[i]) return true;
	}
	return false;
};

Space4x.knackResearchCategoryNames = function (state, fx) {
	const cats = (fx && fx.categories) || [];
	const names = [];
	for (let i = 0; i < cats.length; i++) {
		const cat = Space4x.categoryById(state, cats[i]);
		names.push(cat ? cat.name : cats[i]);
	}
	return names;
};

Space4x.popKnackBuildBonus = function (state, settlement, pop, def) {
	if (!pop || !pop.culture || !def) return null;
	const product = Space4x.settingOf(state).jobs[pop.job] && Space4x.settingOf(state).jobs[pop.job].product;
	if (product !== "industry") return null;
	let best = null;
	Space4x.eachCultureEffect(state, pop.culture, function (c, fx) {
		if (fx.type !== "knackBuild") return;
		if (!Space4x.knackBuildConditionMet(state, settlement, fx, def)) return;
		const pct = fx.pct || 0;
		if (!best || pct > best.pct) {
			best = { culture: c, fx: fx, pct: pct };
		}
	});
	return best;
};

Space4x.popKnackResearchBonus = function (state, empire, pop) {
	if (!pop || !pop.culture || !empire) return null;
	const product = Space4x.settingOf(state).jobs[pop.job] && Space4x.settingOf(state).jobs[pop.job].product;
	if (product !== "research") return null;
	let best = null;
	Space4x.eachCultureEffect(state, pop.culture, function (c, fx) {
		if (fx.type !== "knackResearch") return;
		if (!Space4x.knackResearchMatches(state, empire, fx)) return;
		const n = fx.n || 0;
		if (!best || n > best.n) best = { culture: c, fx: fx, n: n };
	});
	return best;
};

Space4x.applyKnackYield = function (state, settlement, pop, out, opts) {
	opts = opts || {};
	if (!pop || !out) return;
	const empire = settlement ? Space4x.empireById(state, settlement.empireId) : null;
	const buildDef = opts.buildDef !== undefined
		? opts.buildDef
		: Space4x.settlementQueueBuildDef(state, settlement);
	if (buildDef && out.industry > 0) {
		const buildKnack = Space4x.popKnackBuildBonus(state, settlement, pop, buildDef);
		if (buildKnack && buildKnack.pct) {
			const bonus = Math.floor(out.industry * buildKnack.pct / 100);
			if (bonus) out.industry += bonus;
		}
	}
	if (empire && out.research != null) {
		const researchKnack = Space4x.popKnackResearchBonus(state, empire, pop);
		if (researchKnack && researchKnack.n) out.research += researchKnack.n;
	}
};

Space4x.settlementHasCulture = function (settlement, cultureId) {
	if (!settlement || !cultureId) return false;
	const pops = settlement.pops || [];
	for (let i = 0; i < pops.length; i++) {
		if (pops[i].culture === cultureId) return true;
	}
	return false;
};

Space4x.settlementKnackFootnotes = function (state, settlement, def) {
	const out = [];
	if (!settlement || !def) return out;
	const seen = {};
	const cultures = Space4x.culturesOf(state);
	for (let c = 0; c < cultures.length; c++) {
		const culture = cultures[c];
		if (!Space4x.settlementHasCulture(settlement, culture.id)) continue;
		const fxList = culture.effects || [];
		for (let i = 0; i < fxList.length; i++) {
			const fx = fxList[i];
			if (fx.type !== "knackBuild") continue;
			if (!Space4x.knackBuildConditionMet(state, settlement, fx, def)) continue;
			const key = culture.id + ":" + (fx.when || "");
			if (seen[key]) continue;
			seen[key] = true;
			const pct = fx.pct || 0;
			out.push({
				cultureId: culture.id,
				cultureName: culture.name,
				text: "*you have " + culture.name + " who get +" + pct +
					"% industry when " + Space4x.knackBuildConditionLabel(fx)
			});
		}
	}
	return out;
};

Space4x.catalogHasKnackMark = function (state, settlement, def) {
	return Space4x.settlementKnackFootnotes(state, settlement, def).length > 0;
};

Space4x.industryKnackExplainBits = function (state, settlement, previewDef) {
	const bits = [];
	const def = previewDef || Space4x.settlementQueueBuildDef(state, settlement);
	if (!def || !settlement) return bits;
	const seen = {};
	for (let i = 0; i < settlement.pops.length; i++) {
		const pop = settlement.pops[i];
		if (pop.job !== "industry") continue;
		const knack = Space4x.popKnackBuildBonus(state, settlement, pop, def);
		if (!knack) continue;
		const key = knack.culture.id;
		if (seen[key]) continue;
		seen[key] = true;
		bits.push("+" + knack.pct + "% " + knack.culture.name + " knack");
	}
	return bits;
};

Space4x.researchKnackExplainBits = function (state, settlement) {
	const bits = [];
	const empire = settlement ? Space4x.empireById(state, settlement.empireId) : null;
	if (!empire || !settlement) return bits;
	const seen = {};
	for (let i = 0; i < settlement.pops.length; i++) {
		const pop = settlement.pops[i];
		if (pop.job !== "research") continue;
		const knack = Space4x.popKnackResearchBonus(state, empire, pop);
		if (!knack) continue;
		const key = knack.culture.id;
		if (seen[key]) continue;
		seen[key] = true;
		bits.push("+" + knack.n + " " + knack.culture.name + " knack");
	}
	return bits;
};
