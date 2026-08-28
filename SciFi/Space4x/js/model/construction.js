var Space4x = Space4x || {};

Space4x.spawnUnit = function (state, settlement, defId) {
	const empire = Space4x.empireById(state, settlement.empireId);
	const star = Space4x.starById(state, settlement.location.starId);
	const def = Space4x.settingOf(state).builds[defId];
	const unit = {
		id: Space4x.nextId(state, "u"),
		defId: defId,
		empireId: empire.id,
		location: {
			kind: "settlement",
			x: star.x,
			y: star.y,
			starId: star.id,
			settlementId: settlement.id
		},
		targetStarId: null,
		modules: Space4x.empireShipModules(state, empire)
	};
	state.units.push(unit);
	state.turnLog.push(settlement.name + " completed a " + (def ? def.name : defId) + ".");
	return unit;
};

Space4x.completeBuild = function (state, settlement, defId) {
	const empire = Space4x.empireById(state, settlement.empireId);
	const def = Space4x.settingOf(state).builds[defId];
	if (def && def.kind === "unit") {
		if (empire.isPlayer && state.turnEvents) state.turnEvents.playerShipBuilt = true;
		Space4x.spawnUnit(state, settlement, defId);
	} else if (def && def.kind === "troop") {
		Space4x.spawnTroop(state, settlement, defId);
	} else if (def && def.kind === "structure") {
		settlement.structures.push({ defId: defId });
		Space4x.enforceJobCaps(state, settlement);
		state.turnLog.push(settlement.name + " built a " + def.name + ".");
	} else if (def && def.kind === "spy") {
		Space4x.spawnSpy(state, settlement);
	}
	Space4x.runCompleteEffects(state, settlement, def);
};

Space4x.runCompleteEffects = function (state, settlement, def) {
	if (!def || !def.effects) return;
	const empire = Space4x.empireById(state, settlement.empireId);
	for (let i = 0; i < def.effects.length; i++) {
		const fx = def.effects[i];
		if (fx.type === "grantFreighters") {
			empire.transport.freighters += fx.n || 0;
			state.turnLog.push(settlement.name + " launched " + (fx.n || 0) + " freighters.");
		}
	}
};

Space4x.phaseConstruction = function (state) {
	for (let i = 0; i < state.settlements.length; i++) {
		const st = state.settlements[i];
		const keep = [];
		let stop = false;
		for (let q = 0; q < st.buildQueue.length; q++) {
			const item = st.buildQueue[q];
			if (stop) {
				keep.push(item);
				continue;
			}
			const def = Space4x.settingOf(state).builds[item.defId];
			if (!def) continue;
			if (!Space4x.canFinishBuild(state, st, def)) {
				keep.push(item);
				continue;
			}
			const cost = Space4x.buildCost(state, st, def);
			const need = cost - (item.progress || 0);
			if (need <= 0) {
				Space4x.completeBuild(state, st, def.id);
				continue;
			}
			if (st.industryPool <= 0) {
				keep.push(item);
				stop = true;
				continue;
			}
			const spend = Math.min(need, st.industryPool);
			st.industryPool -= spend;
			item.progress = (item.progress || 0) + spend;
			if (item.progress >= cost) Space4x.completeBuild(state, st, def.id);
			else {
				keep.push(item);
				stop = true;
			}
		}
		st.buildQueue = keep;
	}
};

Space4x.buildCap = function (state, settlement, def) {
	if (!def) return 0;
	if (def.unique) return 1;
	if (def.maxFrom === "agriPotential") {
		const body = Space4x.bodyById(state, settlement.location.bodyId);
		return Space4x.agriPotential(state, body);
	}
	return Infinity;
};

Space4x.buildCountWithExtra = function (settlement, defId, extra) {
	return Space4x.countStructure(settlement, defId) + ((extra && extra[defId]) || 0);
};

Space4x.buildSiteOk = function (state, settlement, def) {
	if (!def || !settlement) return false;
	const body = Space4x.bodyById(state, settlement.location.bodyId);
	if (def.requireAgri && Space4x.agriSlots(state, body) <= 0) return false;
	if (def.requireRichness && def.requireRichness.length) {
		let ok = false;
		const richness = body && body.richness;
		for (let i = 0; i < def.requireRichness.length; i++) {
			if (richness === def.requireRichness[i]) ok = true;
		}
		if (!ok) return false;
	}
	if (def.forbidKinds && body) {
		for (let i = 0; i < def.forbidKinds.length; i++) {
			if (body.kind === def.forbidKinds[i]) return false;
		}
	}
	if (def.forbidBiomes && body) {
		for (let i = 0; i < def.forbidBiomes.length; i++) {
			if (body.biome === def.forbidBiomes[i]) return false;
		}
	}
	if (def.onlyKinds && def.onlyKinds.length && body) {
		let ok = false;
		for (let i = 0; i < def.onlyKinds.length; i++) {
			if (body.kind === def.onlyKinds[i]) ok = true;
		}
		if (!ok) return false;
	}
	return true;
};

Space4x.canFinishBuild = function (state, settlement, def, extra) {
	if (!def || !settlement) return false;
	const empire = Space4x.empireById(state, settlement.empireId);
	if (def.requireTech && !Space4x.empireHasTech(empire, def.requireTech)) return false;
	if (def.requireStructure && Space4x.buildCountWithExtra(settlement, def.requireStructure, extra) <= 0) return false;
	if (!Space4x.buildSiteOk(state, settlement, def)) return false;
	const cap = Space4x.buildCap(state, settlement, def);
	if (cap !== Infinity && Space4x.buildCountWithExtra(settlement, def.id, extra) >= cap) return false;
	return true;
};

Space4x.queueBlockReason = function (state, settlement, def, extra) {
	if (!def) return "Unknown project";
	const empire = Space4x.empireById(state, settlement.empireId);
	if (def.requireTech && !Space4x.empireHasTech(empire, def.requireTech)) {
		return "Needs the required technology";
	}
	if (def.requireStructure && Space4x.buildCountWithExtra(settlement, def.requireStructure, extra) <= 0) {
		return "Needs " + Space4x.structureName(state, def.requireStructure) + " on this world";
	}
	if (!Space4x.buildSiteOk(state, settlement, def)) return "This world cannot build that";
	const cap = Space4x.buildCap(state, settlement, def);
	if (cap !== Infinity && Space4x.buildCountWithExtra(settlement, def.id, extra) >= cap) return "Limit reached here";
	return "";
};

Space4x.queueItemStates = function (state, settlement) {
	const out = [];
	const extra = {};
	const queue = settlement && settlement.buildQueue ? settlement.buildQueue : [];
	for (let i = 0; i < queue.length; i++) {
		const def = Space4x.settingOf(state).builds[queue[i].defId];
		const blocked = !Space4x.canFinishBuild(state, settlement, def, extra);
		out.push({
			blocked: blocked,
			reason: blocked ? Space4x.queueBlockReason(state, settlement, def, extra) : ""
		});
		if (!blocked && def && def.kind === "structure") {
			extra[def.id] = (extra[def.id] || 0) + 1;
		}
	}
	return out;
};

Space4x.countQueuedBuild = function (settlement, defId) {
	let n = 0;
	const q = settlement && settlement.buildQueue ? settlement.buildQueue : [];
	for (let i = 0; i < q.length; i++) {
		if (q[i].defId === defId) n += 1;
	}
	return n;
};

Space4x.canQueueBuild = function (state, settlement, defId) {
	const def = Space4x.settingOf(state).builds[defId];
	if (!def || !settlement) return false;
	const empire = Space4x.empireById(state, settlement.empireId);
	if (def.requireTech && !Space4x.empireHasTech(empire, def.requireTech)) return false;
	if (!Space4x.buildSiteOk(state, settlement, def)) return false;
	const cap = Space4x.buildCap(state, settlement, def);
	if (cap === Infinity) return true;
	let n = Space4x.countStructure(settlement, defId);
	for (let i = 0; i < settlement.buildQueue.length; i++) {
		if (settlement.buildQueue[i].defId === defId) n += 1;
	}
	return n < cap;
};

Space4x.queueBuild = function (state, settlementId, defId) {
	const st = Space4x.settlementById(state, settlementId);
	if (!st) return;
	const def = Space4x.settingOf(state).builds[defId];
	if (!def) return;
	if (!Space4x.canQueueBuild(state, st, defId)) return;
	st.buildQueue.push({ id: Space4x.nextId(state, "q"), defId: defId, progress: 0 });
};

Space4x.cancelBuild = function (state, settlementId, queueId) {
	const st = Space4x.settlementById(state, settlementId);
	if (!st) return;
	for (let i = 0; i < st.buildQueue.length; i++) {
		if (st.buildQueue[i].id === queueId) {
			st.industryPool += st.buildQueue[i].progress || 0;
			st.buildQueue.splice(i, 1);
			return;
		}
	}
};

Space4x.moveQueueItem = function (state, settlementId, queueId, dir) {
	const st = Space4x.settlementById(state, settlementId);
	if (!st || !dir) return;
	let i = -1;
	for (let q = 0; q < st.buildQueue.length; q++) {
		if (st.buildQueue[q].id === queueId) i = q;
	}
	if (i < 0) return;
	const j = i + dir;
	if (j < 0 || j >= st.buildQueue.length) return;
	const tmp = st.buildQueue[i];
	st.buildQueue[i] = st.buildQueue[j];
	st.buildQueue[j] = tmp;
};

Space4x.reorderQueue = function (state, settlementId, ids) {
	const st = Space4x.settlementById(state, settlementId);
	if (!st || !ids || ids.length !== st.buildQueue.length) return false;
	const byId = {};
	for (let i = 0; i < st.buildQueue.length; i++) byId[st.buildQueue[i].id] = st.buildQueue[i];
	const next = [];
	for (let i = 0; i < ids.length; i++) {
		const item = byId[ids[i]];
		if (!item) return false;
		next.push(item);
	}
	st.buildQueue = next;
	return true;
};

Space4x.queueBuildEtas = function (state, settlement) {
	const queue = settlement && settlement.buildQueue ? settlement.buildQueue : [];
	const etas = [];
	const empire = settlement ? Space4x.empireById(state, settlement.empireId) : null;
	const perTurn = empire ? Space4x.produceSettlement(state, settlement, empire).industry : 0;
	let pool = settlement ? (settlement.industryPool || 0) : 0;
	let t = 0;
	let stalled = false;
	const blocked = Space4x.queueItemStates(state, settlement);
	for (let i = 0; i < queue.length; i++) {
		if (blocked[i] && blocked[i].blocked) {
			etas.push({ turns: null, own: null, stalled: false, blocked: true });
			continue;
		}
		if (stalled) {
			etas.push({ turns: null, own: null, stalled: true });
			continue;
		}
		const def = Space4x.settingOf(state).builds[queue[i].defId];
		let remaining = Space4x.buildCost(state, settlement, def) - (queue[i].progress || 0);
		if (remaining <= 0) {
			etas.push({ turns: 0, own: 0, stalled: false });
			continue;
		}
		const startT = t;
		while (remaining > pool) {
			if (perTurn <= 0) {
				stalled = true;
				break;
			}
			t += 1;
			pool += perTurn;
		}
		if (stalled) {
			etas.push({ turns: null, own: null, stalled: true });
			continue;
		}
		pool -= remaining;
		let own = t - startT;
		let total = t;
		if (total === 0) total = 1;
		if (own === 0 && startT === 0) own = 1;
		etas.push({ turns: total, own: own, stalled: false });
	}
	return etas;
};

Space4x.queueTurnsWord = function (n) {
	if (n === 1) return "1 turn";
	return n + " turns";
};

Space4x.queueEtaText = function (eta) {
	if (eta && eta.blocked) return "blocked";
	if (!eta || eta.stalled) return "stalled";
	if (!eta.turns) return "ready";
	const own = eta.own == null ? eta.turns : eta.own;
	return own + " / " + Space4x.queueTurnsWord(eta.turns);
};

Space4x.queueEtaTitle = function (eta) {
	if (eta && eta.blocked) return "";
	if (!eta || eta.stalled) return "No industry income on this world.";
	if (!eta.turns) return "Finishes this turn from stored industry.";
	const own = eta.own == null ? eta.turns : eta.own;
	return Space4x.queueTurnsWord(own) + " of work once items ahead are done. Completes in " +
		Space4x.queueTurnsWord(eta.turns) + ".";
};

Space4x.queueFrontSummary = function (state, settlement) {
	const queue = settlement && settlement.buildQueue ? settlement.buildQueue : [];
	if (!queue.length) return { text: "Nothing in the queue.", title: "" };
	const etas = Space4x.queueBuildEtas(state, settlement);
	const blocked = Space4x.queueItemStates(state, settlement);
	let idx = 0;
	for (let i = 0; i < queue.length; i++) {
		if (!blocked[i] || !blocked[i].blocked) {
			idx = i;
			break;
		}
	}
	const item = queue[idx];
	const def = Space4x.settingOf(state).builds[item.defId];
	const name = def ? def.name : item.defId;
	let text = name + " · " + Space4x.queueEtaText(etas[idx]);
	if (queue.length > 1) text += " · +" + (queue.length - 1) + " more";
	const block = blocked[idx];
	const title = (block && block.blocked) ? (block.reason || "Cannot be built yet.") : Space4x.queueEtaTitle(etas[idx]);
	return { text: text, title: title };
};

Space4x.foundSettlement = function (state, unitId, bodyId) {
	const unit = Space4x.unitById(state, unitId);
	if (!unit || !Space4x.unitCanFound(state, unit)) return false;
	const star = Space4x.starById(state, unit.location.starId) || Space4x.starAt(state, unit.location.x, unit.location.y);
	if (!star || unit.location.kind === "space") return false;
	const bodies = Space4x.emptyLegalBodies(state, star, unit.empireId);
	let body = null;
	for (let i = 0; i < bodies.length; i++) {
		if (bodies[i].id === bodyId) body = bodies[i];
	}
	if (!body) return false;
	if (!Space4x.inRangeOfEmpire(state, unit.empireId, star.x, star.y)) return false;
	const name = star.name + " " + body.name;
	const home = Space4x.createSettlement(state, unit.empireId, star.id, body.id, name, 1);
	Space4x.assignNewPop(state, home, home.pops[0]);
	state.settlements.push(home);
	state.units = state.units.filter(function (u) { return u.id !== unitId; });
	state.turnLog.push(Space4x.empireById(state, unit.empireId).name + " founded " + name + ".");
	return true;
};

Space4x.buildKindLabel = function (def) {
	if (!def) return "Project";
	if (def.kind === "structure") return "Structure";
	if (def.kind === "unit") return "Ship";
	if (def.kind === "troop") return "Ground unit";
	if (def.kind === "abstract") return "Empire project";
	if (def.kind === "spy") return "Agent";
	return Space4x.titleCase(def.kind);
};

Space4x.buildInspectInfo = function (state, settlement, defId) {
	const def = Space4x.settingOf(state).builds[defId];
	if (!def) {
		return { name: defId, meta: "", summary: "", stats: [], canQueue: false };
	}
	const stats = [];
	const cost = Space4x.buildCost(state, settlement, def);
	const base = def.cost && def.cost.industry != null ? def.cost.industry : "?";
	stats.push("Cost " + cost + " industry" + (cost !== base ? " (base " + base + ")" : ""));
	if (def.upkeep) {
		if (def.kind === "unit") stats.push("Upkeep " + Space4x.fmtMoney(def.upkeep) + " money / turn (×2 in flight)");
		else stats.push("Upkeep " + Space4x.fmtMoney(def.upkeep) + " money / turn");
	} else if (def.kind === "structure") {
		stats.push("No upkeep");
	}
	if (def.kind === "structure") stats.push("Stays on this world");
	if (def.kind === "unit") stats.push("Launches as a map ship");
	if (def.kind === "spy") stats.push("Joins the Spies screen. Assigned anywhere you are in contact.");
	if (def.requireStructure) {
		const yard = Space4x.structureName(state, def.requireStructure);
		stats.push("Needs " + yard + " on this world");
		if (settlement && !Space4x.countStructure(settlement, def.requireStructure)) stats.push("No " + yard + " here");
	}
	if (def.kind === "troop") {
		const empire = settlement ? Space4x.empireById(state, settlement.empireId) : Space4x.playerEmpire(state);
		const cultureId = (state.ui.inspect && state.ui.inspect.kind === "troop" && state.ui.inspect.culture) ||
			Space4x.majorityCulture(state, settlement);
		const ts = Space4x.troopTs(state, empire, def, cultureId);
		stats.push("Troop strength " + ts);
		if (def.ts != null && ts !== def.ts) stats.push("Base " + def.ts + " with tech and species");
		if (cultureId) {
			stats.push("Species: " + Space4x.cultureName(state, cultureId));
			const pct = Space4x.cultureTroopTsPct(state, cultureId);
			if (pct) stats.push("Species +" + pct + "% troop strength");
		}
		if (def.tags && def.tags.length) stats.push("Tags: " + def.tags.join(", "));
		if (settlement && Space4x.loyaltyRules(state)) {
			const inspect = state.ui.inspect;
			const culture = inspect && inspect.kind === "troop" ? inspect.culture : undefined;
			const range = Space4x.stackUnitLoyalty(state, settlement, def.id, culture);
			if (range.n) {
				if (range.min === range.max) stats.push("Unit loyalty " + range.min + "%");
				else stats.push("Unit loyalty " + range.min + "–" + range.max + "%");
			}
		}
		stats.push("Stations at this settlement");
		stats.push("1 freighter to move");
	}
	if (def.kind === "abstract") stats.push("Added to the empire pool");
	if (def.unique) stats.push("One per settlement");
	Space4x.pushStructureInspectStats(state, settlement, def, stats);
	if (def.maxFrom === "agriPotential") stats.push("Capped by this world's agriculture potential");
	if (def.requireAgri) stats.push("Needs a world with agriculture slots");
	if (def.requireRichness && def.requireRichness.length) {
		const names = [];
		for (let i = 0; i < def.requireRichness.length; i++) names.push(Space4x.richnessLabel(state, def.requireRichness[i]));
		stats.push("Only on " + names.join(" or ") + " worlds");
	}
	if (def.forbidKinds && def.forbidKinds.length) stats.push("Not on " + def.forbidKinds.map(Space4x.titleCase).join(", "));
	if (def.forbidBiomes && def.forbidBiomes.length) stats.push("Not on " + def.forbidBiomes.map(Space4x.titleCase).join(", "));
	if (def.onlyKinds && def.onlyKinds.length) stats.push("Only on " + def.onlyKinds.map(Space4x.titleCase).join(", "));
	const built = settlement ? Space4x.countStructure(settlement, defId) : 0;
	if (built && def.kind === "structure") stats.push("Standing here: " + built);
	if (def.kind === "troop" && settlement) {
		const n = Space4x.countTroops(settlement, defId);
		if (n) stats.push("Stationed here: " + n);
	}
	let queued = 0;
	if (settlement) {
		for (let i = 0; i < settlement.buildQueue.length; i++) {
			if (settlement.buildQueue[i].defId === defId) queued += 1;
		}
	}
	if (queued) stats.push("In queue: " + queued);
	const canQueue = !!(settlement && Space4x.canQueueBuild(state, settlement, defId));
	return {
		name: def.name,
		meta: Space4x.buildKindLabel(def) + " · " + cost + " industry",
		summary: def.summary || "",
		stats: stats,
		canQueue: canQueue
	};
};


