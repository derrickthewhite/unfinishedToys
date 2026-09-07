var Space4x = Space4x || {};

Space4x.SPINDEL_CULTURE_ID = "nehudi";
Space4x.SPINDEL_HOME_MILITIA = 2;

Space4x.empireHasCultureEffect = function (state, empire, type) {
	if (!empire || !type) return false;
	let found = false;
	Space4x.eachCultureEffect(state, empire.cultureId, function (c, fx) {
		if (fx.type === type) found = true;
	});
	return found;
};

Space4x.empireHasSpindelWeb = function (state, empire) {
	return Space4x.empireHasCultureEffect(state, empire, "spindelWeb");
};

Space4x.gameHasNehudiEmpire = function (state) {
	const list = state.empires || [];
	for (let i = 0; i < list.length; i++) {
		if (list[i].dormant) continue;
		if (list[i].cultureId === Space4x.SPINDEL_CULTURE_ID) return true;
	}
	return false;
};

Space4x.bodyIsSpindelEligible = function (body) {
	if (!body || body.kind !== "rocky") return false;
	if (body.biome === "barren" || body.biome === "toxic") return false;
	return true;
};

Space4x.bodyHasSpindel = function (body) {
	return Space4x.bodyHasColor(body, "spindel");
};

Space4x.settlementIsSpindel = function (state, settlement) {
	if (!settlement) return false;
	const body = Space4x.bodyById(state, settlement.location.bodyId);
	return Space4x.bodyHasSpindel(body);
};

Space4x.starHasSpindel = function (state, starId) {
	const star = Space4x.starById(state, starId);
	if (!star) return false;
	const bodies = star.bodies || [];
	for (let i = 0; i < bodies.length; i++) {
		if (Space4x.bodyHasSpindel(bodies[i])) return true;
	}
	return false;
};

Space4x.applySpindelColor = function (state, body, opts) {
	opts = opts || {};
	if (!body || !Space4x.bodyIsSpindelEligible(body)) return false;
	if (!body.colors) body.colors = [];
	if (body.colors.indexOf("spindel") < 0) body.colors.push("spindel");
	Space4x.setBodyColorDetail(body, "spindel", { web: true });
	if (opts.forceWildlifeLevel) {
		Space4x.setBodyColorDetail(body, "wildlife", {
			level: opts.forceWildlifeLevel,
			predatorDefId: Space4x.predatorDefIdForLevel(opts.forceWildlifeLevel)
		});
		body.wildlifeLevel = opts.forceWildlifeLevel;
		body.predatorDefId = Space4x.predatorDefIdForLevel(opts.forceWildlifeLevel);
		if (body.colors.indexOf("wildlife") < 0) body.colors.push("wildlife");
	} else if (opts.rollWildlife !== false) {
		const chance = (Space4x.planetColorRules(state).spindel || {}).wildlifeChance;
		const roll = chance != null ? chance : 0.75;
		if (Space4x.rngNext(state) < roll) Space4x.applyWildlifeColor(state, body);
	}
	return true;
};

Space4x.ensureSpindelVision = function (state) {
	const stars = state.galaxy && state.galaxy.stars ? state.galaxy.stars : [];
	const spindelStars = [];
	for (let s = 0; s < stars.length; s++) {
		if (Space4x.starHasSpindel(state, stars[s].id)) spindelStars.push(stars[s].id);
	}
	if (!spindelStars.length) return;
	for (let e = 0; e < state.empires.length; e++) {
		const empire = state.empires[e];
		if (!Space4x.empireHasSpindelWeb(state, empire)) continue;
		for (let i = 0; i < spindelStars.length; i++) {
			Space4x.markStarExplored(state, empire.id, spindelStars[i]);
		}
	}
};

Space4x.applyNehudiHomeSpindel = function (state, empire, body, settlement) {
	if (!empire || !Space4x.empireHasSpindelWeb(state, empire)) return;
	Space4x.applySpindelColor(state, body, { forceWildlifeLevel: "I", rollWildlife: false });
	if (settlement) {
		for (let i = 0; i < Space4x.SPINDEL_HOME_MILITIA; i++) {
			Space4x.spawnTroop(state, settlement, "militia", true);
		}
	}
};

Space4x.ensureTransportPools = function (empire) {
	if (!empire) return;
	if (!empire.transport) empire.transport = { freighters: 0, spindelNavigators: 0 };
	if (empire.transport.freighters == null) empire.transport.freighters = 0;
	if (empire.transport.spindelNavigators == null) empire.transport.spindelNavigators = 0;
};

Space4x.isSpindelHauler = function (state, unit) {
	return !!(unit && unit.spindelTransport);
};

Space4x.inTransitSpindelHulls = function (state, empireId) {
	let n = 0;
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (empireId && u.empireId !== empireId) continue;
		if (!Space4x.isSpindelHauler(state, u)) continue;
		n += Space4x.unitFreighterHulls(state, u);
	}
	return n;
};

Space4x.empireSpindelNavigatorUse = function (state, empireId) {
	const empire = Space4x.empireById(state, empireId);
	Space4x.ensureTransportPools(empire);
	const transit = Space4x.inTransitSpindelHulls(state, empireId);
	const idle = empire ? (empire.transport.spindelNavigators || 0) : 0;
	return {
		owned: idle + transit,
		idle: idle,
		transit: transit,
		busy: transit
	};
};

Space4x.canUseSpindelNavigators = function (state, empire, fromSettlement, toSettlement) {
	if (!Space4x.empireHasSpindelWeb(state, empire)) return false;
	return Space4x.settlementIsSpindel(state, fromSettlement) &&
		Space4x.settlementIsSpindel(state, toSettlement);
};

Space4x.isSpindelColony = function (state, unit) {
	return !!(unit && unit.defId === "spindelColony");
};

Space4x.unitFoundRequiresSpindel = function (state, unit) {
	return Space4x.isSpindelColony(state, unit);
};

Space4x.starDisplayName = function (state, empireId, star) {
	if (!star) return "";
	const explored = !empireId || Space4x.starIsExplored(state, empireId, star.id);
	return explored ? star.name : ("(" + star.name + ")");
};
