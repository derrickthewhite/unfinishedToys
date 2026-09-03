var Space4x = Space4x || {};

Space4x.ADDITIVE_TECH = {
	speed: true, range: true, commsRange: true, shipSize: true, combatSpeed: true,
	industryPerPop: true, researchPerPop: true, foodPerFarmer: true,
	growthRatePercent: true, weapon: true, shield: true, armor: true, structure: true,
	fighterDamage: true, fighterRange: true, fighterStructure: true,
	loyalty: true, spySkill: true
};

Space4x.applyTechEffects = function (empire, tech) {
	for (let i = 0; i < tech.effects.length; i++) {
		const fx = tech.effects[i];
		if (!Space4x.ADDITIVE_TECH[fx.type]) continue;
		empire.modifiers[fx.type] = (empire.modifiers[fx.type] || 0) + (fx.n || 0);
	}
};

Space4x.empireShipModules = function (state, empire) {
	const out = [];
	const seen = {};
	const ids = empire && empire.research ? empire.research.completedTechIds : [];
	for (let i = 0; i < ids.length; i++) {
		const tech = Space4x.techById(state, ids[i]);
		if (!tech || !tech.effects) continue;
		for (let e = 0; e < tech.effects.length; e++) {
			const fx = tech.effects[e];
			if (fx.type !== "shipModule" || !fx.id || seen[fx.id]) continue;
			seen[fx.id] = true;
			out.push({ id: fx.id, name: tech.name });
		}
	}
	return out;
};

Space4x.fitShipModules = function (state, empire) {
	const mods = Space4x.empireShipModules(state, empire);
	if (!empire) return;
	for (let i = 0; i < state.units.length; i++) {
		const unit = state.units[i];
		if (unit.empireId !== empire.id || Space4x.isHauler(state, unit)) continue;
		unit.modules = mods.slice();
	}
};

Space4x.completeTech = function (state, empire, tech) {
	if (empire.research.completedTechIds.indexOf(tech.id) === -1) {
		empire.research.completedTechIds.push(tech.id);
	}
	Space4x.applyTechEffects(empire, tech);
	empire.research.categoryTier[tech.categoryId] = tech.tier + 1;
	empire.research.currentProjectId = null;
	empire.research.progress = 0;
	empire.research.cost = 0;
	Space4x.fitShipModules(state, empire);
	if (empire.isPlayer && state.turnEvents) state.turnEvents.finishedTechName = tech.name;
	state.turnLog.push(empire.name + " finished " + tech.name + ".");
};

Space4x.copyEmpireResearch = function (state, from, to) {
	if (!from || !to || !from.research || !to.research) return;
	const ids = (from.research.completedTechIds || []).slice();
	to.research.completedTechIds = ids;
	const src = from.research.categoryTier || {};
	const tier = {};
	const keys = Object.keys(src);
	for (let i = 0; i < keys.length; i++) tier[keys[i]] = src[keys[i]];
	to.research.categoryTier = tier;
	to.research.currentProjectId = null;
	to.research.progress = 0;
	to.research.cost = 0;
	to.research.savedProgress = {};
	to.modifiers = Space4x.emptyModifiers();
	for (let i = 0; i < ids.length; i++) {
		const tech = Space4x.techById(state, ids[i]);
		if (tech && tech.effects) Space4x.applyTechEffects(to, tech);
	}
};

Space4x.phaseResearch = function (state) {
	for (let i = 0; i < state.empires.length; i++) {
		const empire = state.empires[i];
		const add = empire._pendingResearch || 0;
		if (!empire.research.currentProjectId) continue;
		const tech = Space4x.techById(state, empire.research.currentProjectId);
		if (!tech) continue;
		empire.research.progress += add;
		empire.research.cost = tech.cost;
		if (empire.research.progress >= tech.cost) {
			Space4x.completeTech(state, empire, tech);
			continue;
		}
		const pct = empire.research.progress / tech.cost;
		if (pct >= 0.5) {
			const chance = (pct * 100 - 50) * 0.02;
			if (Space4x.rngNext(state) < chance) Space4x.completeTech(state, empire, tech);
		}
	}
};

Space4x.setResearchProject = function (state, empireId, techId) {
	const empire = Space4x.empireById(state, empireId);
	if (empire.research.currentProjectId && empire.research.currentProjectId !== techId) {
		empire.research.savedProgress[empire.research.currentProjectId] = empire.research.progress;
	}
	const tech = Space4x.techById(state, techId);
	if (!tech) return;
	const next = Space4x.categoryTierOf(empire, tech.categoryId);
	if (tech.tier !== next) return;
	if (Space4x.empireHasTech(empire, tech.id)) return;
	empire.research.currentProjectId = techId;
	empire.research.cost = tech.cost;
	empire.research.progress = empire.research.savedProgress[techId] || 0;
};
