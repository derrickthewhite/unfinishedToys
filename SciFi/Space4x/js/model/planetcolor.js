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

Space4x.bodyColorLabels = function (state, body) {
	if (!body || !body.colors || !body.colors.length) {
		if (body && body.spaceMonster) return ["Space monster lair (coming soon)"];
		return [];
	}
	const out = [];
	for (let i = 0; i < body.colors.length; i++) {
		let label = Space4x.planetColorLabel(state, body.colors[i]);
		if (body.colors[i] === "natives" && body.nativesCulture) {
			label += " (" + Space4x.cultureName(state, body.nativesCulture) + ")";
		}
		out.push(label);
	}
	if (body.spaceMonster) out.push("Space monster lair (coming soon)");
	return out;
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

	const noNatives = body.kind === "asteroidBelt" || body.biome === "toxic";
	const pool = noNatives
		? ["rareMine", "wildlife", "ruins"]
		: ["natives", "rareMine", "wildlife", "ruins"];
	const pick = pool[Space4x.rngInt(state, pool.length)];
	body.colors = [pick];
	if (Space4x.rngInt(state, 4) === 0) {
		let second = pool[Space4x.rngInt(state, pool.length)];
		while (second === pick) second = pool[Space4x.rngInt(state, pool.length)];
		body.colors.push(second);
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
	const rules = Space4x.planetColorRules(state).rareMine || {};
	return rules.moneyPerTurn != null ? rules.moneyPerTurn : 10;
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
