var Space4x = Space4x || {};

Space4x.ADDITIVE_TECH = {
	speed: true, range: true, commsRange: true, shipSize: true, combatSpeed: true,
	industryPerPop: true, researchPerPop: true, foodPerFarmer: true,
	growthRatePercent: true, weapon: true, shield: true, armor: true, structure: true,
	fighterDamage: true, fighterRange: true, fighterStructure: true,
	shipAttack: true, shipDefense: true,
	loyalty: true, spySkill: true, loadPct: true
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

Space4x.rebuildEmpireModifiers = function (state, empire) {
	if (!empire) return;
	empire.modifiers = Space4x.emptyModifiers();
	const ids = empire.research && empire.research.completedTechIds || [];
	for (let i = 0; i < ids.length; i++) {
		const tech = Space4x.techById(state, ids[i]);
		if (tech && tech.effects) Space4x.applyTechEffects(empire, tech);
	}
	Space4x.fitShipModules(state, empire);
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
	Space4x.rebuildEmpireModifiers(state, to);
};

Space4x.setEmpireTechOwned = function (state, empire, techId, owned) {
	if (!empire || !empire.research) return false;
	const tech = Space4x.techById(state, techId);
	if (!tech) return false;
	const ids = empire.research.completedTechIds || [];
	const has = Space4x.empireHasTech(empire, techId);
	if (!!owned === has) return false;
	if (owned) {
		ids.push(techId);
		empire.research.completedTechIds = ids;
		if (empire.research.currentProjectId === techId) {
			empire.research.currentProjectId = null;
			empire.research.progress = 0;
			empire.research.cost = 0;
		}
	} else {
		const next = [];
		for (let i = 0; i < ids.length; i++) {
			if (ids[i] !== techId) next.push(ids[i]);
		}
		empire.research.completedTechIds = next;
	}
	Space4x.rebuildEmpireModifiers(state, empire);
	return true;
};

Space4x.toggleEmpireTech = function (state, empire, techId) {
	return Space4x.setEmpireTechOwned(state, empire, techId, !Space4x.empireHasTech(empire, techId));
};

Space4x.resetEmpireResearch = function (state, empire) {
	if (!empire) return;
	const set = Space4x.settingOf(state);
	const cats = (set && set.categories) || [];
	const startTier = set && set.startTechTier != null ? set.startTechTier : 1;
	const tier = {};
	for (let i = 0; i < cats.length; i++) tier[cats[i].id] = startTier;
	empire.research = {
		model: "category",
		currentProjectId: null,
		progress: 0,
		cost: 0,
		categoryTier: tier,
		completedTechIds: [],
		savedProgress: {}
	};
	Space4x.rebuildEmpireModifiers(state, empire);
};

Space4x.empireHasResearchedTier = function (state, empire, tier) {
	const ids = empire && empire.research ? empire.research.completedTechIds : [];
	for (let i = 0; i < ids.length; i++) {
		const tech = Space4x.techById(state, ids[i]);
		if (tech && tech.tier === tier) return true;
	}
	return false;
};

Space4x.generateAiResearch = function (state, empire, opts) {
	opts = opts || {};
	const maxPoints = opts.points == null || opts.points === "" ? null : Number(opts.points);
	const maxTechs = opts.techCount == null || opts.techCount === "" ? null : Number(opts.techCount);
	const stopTier = opts.stopTier == null || opts.stopTier === "" ? null : Number(opts.stopTier);
	let spent = 0;
	let count = 0;
	const names = [];
	for (let step = 0; step < 400; step++) {
		if (stopTier != null && !isNaN(stopTier) && Space4x.empireHasResearchedTier(state, empire, stopTier)) break;
		if (maxTechs != null && !isNaN(maxTechs) && count >= maxTechs) break;
		const stuck = Space4x.aiResearchStuck
			? Space4x.aiResearchStuck(state, empire)
			: Space4x.rngInt(state, 2) === 0;
		let pick = Space4x.aiPickResearch(state, empire, stuck);
		if (!pick && empire.research.currentProjectId) {
			pick = Space4x.techById(state, empire.research.currentProjectId);
		}
		if (!pick) pick = Space4x.aiPickRandomTech(state, empire);
		if (!pick) break;
		if (maxPoints != null && !isNaN(maxPoints) && spent + pick.cost > maxPoints) {
			const pool = Space4x.aiAvailableTechPool(state, empire);
			let fit = null;
			for (let i = 0; i < pool.length; i++) {
				if (spent + pool[i].cost > maxPoints) continue;
				if (!fit || pool[i].cost > fit.cost) fit = pool[i];
			}
			if (!fit) break;
			pick = fit;
		}
		Space4x.completeTech(state, empire, pick);
		spent += pick.cost;
		count += 1;
		names.push(pick.name);
	}
	return { spent: spent, count: count, names: names };
};

Space4x.phaseResearch = function (state) {
	for (let i = 0; i < state.empires.length; i++) {
		const empire = state.empires[i];
		const add = (empire._pendingResearch || 0) + ((empire.research && empire.research.giftPoints) || 0);
		if (empire.research) empire.research.giftPoints = 0;
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
