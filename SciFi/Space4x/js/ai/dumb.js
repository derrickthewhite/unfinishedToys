var Space4x = Space4x || {};

Space4x.nearestEmptyStar = function (state, empireId, fromStar) {
	let best = null;
	let bestD = Infinity;
	for (let i = 0; i < state.galaxy.stars.length; i++) {
		const st = state.galaxy.stars[i];
		const bodies = Space4x.emptyLegalBodies(state, st, empireId);
		if (!bodies.length) continue;
		if (Space4x.starHasEmpireSettlement(state, st.id, empireId)) continue;
		if (!Space4x.inRangeOfEmpire(state, empireId, st.x, st.y)) continue;
		const d = Space4x.dist(fromStar.x, fromStar.y, st.x, st.y);
		if (d < bestD) {
			bestD = d;
			best = st;
		}
	}
	return best;
};

Space4x.wouldStarveWithoutHulls = function (state, empireId) {
	const extraNeed = Space4x.empireFoodGap(state, empireId);
	const empire = Space4x.empireById(state, empireId);
	return extraNeed > 0 && empire && empire.transport.freighters < extraNeed;
};

Space4x.empireFoodGap = function (state, empireId) {
	const list = Space4x.settlementsOf(state, empireId);
	const empire = Space4x.empireById(state, empireId);
	let food = 0;
	let pops = 0;
	for (let i = 0; i < list.length; i++) {
		pops += list[i].pops.length;
		food += Space4x.produceSettlement(state, list[i], empire).food;
	}
	return Math.max(0, pops - food);
};

Space4x.aiOpenAgri = function (state, settlement) {
	return Math.max(0, Space4x.jobCap(state, settlement, "agriculture") - Space4x.countJob(settlement, "agriculture"));
};

Space4x.aiColonyScore = function (state, empire, st, foodShort) {
	const incoming = Space4x.popsInTransitTo(state, st.id);
	const pop = st.pops.length + incoming;
	const body = Space4x.bodyById(state, st.location.bodyId);
	const rich = Space4x.richnessOf(state, body);
	const agriOpen = Space4x.aiOpenAgri(state, st);
	let score = 0;
	if (foodShort && agriOpen > 0) score += 20 * Math.min(3, agriOpen);
	if ((rich.industryPerPop || 0) > 0 && pop < 8) {
		score += 16 * rich.industryPerPop * (8 - pop) / 8;
	}
	if (pop < 3) score += 10;
	if (pop < 2) score += 6;
	if (Space4x.settlementHungry(state, st) && agriOpen <= 0) score -= 40;
	if ((rich.industryPerPop || 0) < 0 && agriOpen <= 0 && pop >= 3) score -= 8;
	if (pop >= 8 && agriOpen <= 0 && !foodShort) return 0;
	return score;
};

Space4x.aiSparePops = function (state, st) {
	const farmers = Space4x.countJob(st, "agriculture") + Space4x.countJob(st, "greenhouse");
	const outgoing = Space4x.popsInTransitFrom(state, st.id);
	const keep = Math.max(farmers, st.pops.length <= 5 ? st.pops.length : 5);
	return Math.max(0, st.pops.length - keep - outgoing);
};

Space4x.aiSendSettlers = function (state, empireId) {
	const empire = Space4x.empireById(state, empireId);
	const homes = Space4x.settlementsOf(state, empireId);
	if (!empire || homes.length < 2) return;
	const factor = Space4x.settingOf(state).popMoveFreighterFactor || 5;
	const foodKeep = Space4x.empireFoodGap(state, empireId);
	let hulls = Math.max(0, (empire.transport.freighters || 0) - foodKeep);
	if (hulls < factor) return;
	const foodShort = foodKeep > 0;
	let bestTo = null;
	let bestToScore = 0;
	for (let i = 0; i < homes.length; i++) {
		const score = Space4x.aiColonyScore(state, empire, homes[i], foodShort);
		if (score > bestToScore) {
			bestToScore = score;
			bestTo = homes[i];
		}
	}
	if (!bestTo || bestToScore <= 0) return;
	let bestFrom = null;
	let bestSpare = 0;
	for (let i = 0; i < homes.length; i++) {
		const st = homes[i];
		if (st.id === bestTo.id) continue;
		if (!Space4x.canLeaveSystem(state, empire, st.location.starId, bestTo.location.starId)) continue;
		if (Space4x.aiColonyScore(state, empire, st, foodShort) >= bestToScore) continue;
		const spare = Space4x.aiSparePops(state, st);
		if (spare > bestSpare) {
			bestSpare = spare;
			bestFrom = st;
		}
	}
	if (!bestFrom || bestSpare <= 0) return;
	const agriOpen = Space4x.aiOpenAgri(state, bestTo);
	const incoming = Space4x.popsInTransitTo(state, bestTo.id);
	const room = Math.max(1, agriOpen, 6 - (bestTo.pops.length + incoming));
	const n = Math.min(bestSpare, Math.floor(hulls / factor), room);
	if (n > 0) Space4x.queuePopMove(state, bestFrom.id, bestTo.id, n);
};

Space4x.aiQueuePolice = function (state, settlement) {
	if (!settlement || settlement.buildQueue.length) return false;
	const incoming = Space4x.popsInTransitTo(state, settlement.id);
	const need = Math.floor((settlement.pops.length + incoming) / ((Space4x.loyaltyRules(state) && Space4x.loyaltyRules(state).popsPerPolice) || 5));
	const have = Space4x.countPolice(state, settlement) + Space4x.countQueuedBuild(settlement, "police");
	if (have >= need) return false;
	if (!Space4x.canQueueBuild(state, settlement, "police")) return false;
	Space4x.queueBuild(state, settlement.id, "police");
	return true;
};

Space4x.ensureAiResearch = function (state, empireId) {
	const list = Space4x.settlementsOf(state, empireId);
	for (let i = 0; i < list.length; i++) {
		const st = list[i];
		const n = st.pops.length;
		if (n < 5) continue;
		const want = Math.max(1, Math.floor(n / 6));
		let have = Space4x.countJob(st, "research");
		while (have < want) {
			let pop = null;
			for (let p = 0; p < st.pops.length; p++) {
				if (st.pops[p].job === "industry") {
					pop = st.pops[p];
					break;
				}
			}
			if (!pop) break;
			pop.job = "research";
			have += 1;
		}
	}
};

Space4x.aiHasColonizeTarget = function (state, empire) {
	const homes = Space4x.settlementsOf(state, empire.id);
	const seen = {};
	for (let i = 0; i < homes.length; i++) {
		const sid = homes[i].location.starId;
		if (seen[sid]) continue;
		seen[sid] = true;
		const star = Space4x.starById(state, sid);
		if (star && Space4x.emptyLegalBodies(state, star, empire.id).length) return true;
	}
	if (!homes.length || !Space4x.empireHasWarp(state, empire)) return false;
	const from = Space4x.starById(state, homes[0].location.starId);
	return !!(from && Space4x.nearestEmptyStar(state, empire.id, from));
};

Space4x.techHelpsReach = function (tech) {
	if (!tech || !tech.effects) return false;
	for (let i = 0; i < tech.effects.length; i++) {
		const t = tech.effects[i].type;
		if (t === "warpDrive" || t === "range" || t === "unlockSettle") return true;
	}
	return false;
};

Space4x.aiReachScore = function (state, tech) {
	if (!tech) return 0;
	let score = 0;
	const fx = tech.effects || [];
	for (let i = 0; i < fx.length; i++) {
		if (fx[i].type === "warpDrive") score += 100;
		if (fx[i].type === "range") score += 50 + (fx[i].n || 0);
		if (fx[i].type === "unlockSettle") score += 40;
	}
	if (score) return score;
	const techs = Space4x.settingOf(state).techs;
	let soonest = null;
	for (let i = 0; i < techs.length; i++) {
		const t = techs[i];
		if (t.categoryId !== tech.categoryId || t.tier <= tech.tier) continue;
		if (!Space4x.techHelpsReach(t)) continue;
		if (soonest == null || t.tier < soonest) soonest = t.tier;
	}
	if (soonest == null) return 0;
	return 12 - (soonest - tech.tier);
};

Space4x.aiPickReachTech = function (state, empire) {
	const cats = Space4x.settingOf(state).categories;
	let best = null;
	let bestScore = 0;
	for (let c = 0; c < cats.length; c++) {
		const opts = Space4x.availableTechs(state, empire, cats[c].id);
		for (let i = 0; i < opts.length; i++) {
			const score = Space4x.aiReachScore(state, opts[i]);
			if (score > bestScore) {
				bestScore = score;
				best = opts[i];
			}
		}
	}
	return best;
};

Space4x.aiPickResearch = function (state, empire, stuck) {
	if (Space4x.contactedEmpires(state, empire).length && !Space4x.empireHasDiplomacy(state, empire)) {
		const exo = Space4x.techById(state, "so0ex");
		if (exo) {
			const opts = Space4x.availableTechs(state, empire, exo.categoryId);
			for (let o = 0; o < opts.length; o++) {
				if (opts[o].id === "so0ex") {
					if (empire.research.currentProjectId === "so0ex") return null;
					return opts[o];
				}
			}
		}
	}
	if (stuck) {
		const best = Space4x.aiPickReachTech(state, empire);
		if (best) {
			const cur = empire.research.currentProjectId ? Space4x.techById(state, empire.research.currentProjectId) : null;
			if (!cur || Space4x.aiReachScore(state, cur) < Space4x.aiReachScore(state, best)) return best;
			return null;
		}
	}
	if (empire.research.currentProjectId) return null;
	const prefer = ["ex0sc", "rx0ip", "bi0ce", "wp0", "ro0rf"];
	for (let p = 0; p < prefer.length; p++) {
		const tech = Space4x.techById(state, prefer[p]);
		if (!tech) continue;
		const opts = Space4x.availableTechs(state, empire, tech.categoryId);
		for (let o = 0; o < opts.length; o++) {
			if (opts[o].id === prefer[p]) return opts[o];
		}
	}
	const cats = Space4x.settingOf(state).categories;
	for (let i = 0; i < cats.length; i++) {
		const tech = Space4x.availableTech(state, empire, cats[i].id);
		if (tech) return tech;
	}
	return null;
};

Space4x.dumbChoose = function (state, empireId) {
	const empire = Space4x.empireById(state, empireId);
	Space4x.dumbDiplomacy(state, empire);
	Space4x.autoAssignJobs(state, empireId);
	Space4x.ensureAiResearch(state, empireId);
	const canColonize = Space4x.aiHasColonizeTarget(state, empire);
	const pick = Space4x.aiPickResearch(state, empire, !canColonize);
	if (pick) Space4x.setResearchProject(state, empireId, pick.id);
	const homes = Space4x.settlementsOf(state, empireId);
	for (let i = 0; i < homes.length; i++) {
		const st = homes[i];
		if (Space4x.aiQueuePolice(state, st)) continue;
		if (st.buildQueue.length) continue;
		if (!Space4x.countStructure(st, "spaceDock") && Space4x.canQueueBuild(state, st, "spaceDock")) {
			Space4x.queueBuild(state, st.id, "spaceDock");
			continue;
		}
		const factories = Space4x.countStructure(st, "roboticFactory");
		if (factories < 1 && Space4x.canQueueBuild(state, st, "roboticFactory")) {
			Space4x.queueBuild(state, st.id, "roboticFactory");
			continue;
		}
		if (Space4x.wouldStarveWithoutHulls(state, empireId) && Space4x.canQueueBuild(state, st, "spaceFreighter")) {
			Space4x.queueBuild(state, st.id, "spaceFreighter");
			continue;
		}
		if (canColonize && Space4x.canQueueBuild(state, st, "colonyShip")) {
			Space4x.queueBuild(state, st.id, "colonyShip");
		}
	}
	Space4x.aiSendSettlers(state, empireId);
	for (let u = 0; u < state.units.length; u++) {
		const unit = state.units[u];
		if (unit.empireId !== empireId || unit.defId !== "colonyShip") continue;
		if (unit.targetStarId) continue;
		const here = Space4x.starAt(state, unit.location.x, unit.location.y) ||
			Space4x.nearestFriendlyStar(state, empireId, unit.location.x, unit.location.y);
		if (!here) continue;
		const local = Space4x.emptyLegalBodies(state, here, empireId);
		if (local.length) {
			Space4x.foundSettlement(state, unit.id, local[0].id);
			continue;
		}
		const dest = Space4x.nearestEmptyStar(state, empireId, here);
		if (dest && dest.id !== here.id && Space4x.canLeaveSystem(state, empire, here.id, dest.id)) {
			unit.targetStarId = dest.id;
		}
	}
};
