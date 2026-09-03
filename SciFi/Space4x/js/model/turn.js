var Space4x = Space4x || {};

Space4x.todoSortPriority = function (todo) {
	if (!todo) return 50;
	if (todo.type === "pickTech") return 10;
	if (todo.type === "revoltSummary" || todo.type === "crushedRevolt" ||
		todo.type === "revoltJoin" || todo.type === "revoltJoined") return 20;
	if (todo.type === "groundCombat" || todo.type === "spaceCombat" || todo.type === "spaceLoss") return 30;
	if (todo.type === "diploOffer" || todo.type === "diploResponse" || todo.type === "firstContact") return 40;
	if (todo.type === "emptyQueue" || todo.type === "assignJobs" ||
		todo.type === "foundColony" || todo.type === "pickSettleBody") return 90;
	return 50;
};

Space4x.todoPausesAutoPlay = function (todo) {
	if (!todo) return false;
	if (todo.type === "revoltJoined") return false;
	return true;
};

Space4x.rebuildTodos = function (state) {
	const player = Space4x.playerEmpire(state);
	const todos = [];
	if (!player) {
		state.todos = todos;
		return;
	}
	const openSpace = Space4x.playerOpenSpaceBattles(state);
	for (let i = 0; i < openSpace.length; i++) {
		const b = openSpace[i];
		const star = Space4x.starById(state, b.starId);
		todos.push({
			id: "space-live-" + b.id,
			type: "spaceCombat",
			battleId: b.id,
			blocking: true,
			text: "Space combat at " + (star ? star.name : "a star")
		});
	}
	if (!state.autoAssignJobs) {
		const list = Space4x.settlementsOf(state, player.id);
		for (let i = 0; i < list.length; i++) {
			if (Space4x.countJob(list[i], "idle") > 0) {
				todos.push({
					id: "jobs-" + list[i].id,
					type: "assignJobs",
					settlementId: list[i].id,
					blocking: false,
					text: "Assign work at " + Space4x.settlementLabel(state, list[i])
				});
			}
		}
	}
	if (!player.research.currentProjectId) {
		let any = false;
		const cats = Space4x.settingOf(state).categories;
		for (let c = 0; c < cats.length; c++) {
			if (Space4x.availableTech(state, player, cats[c].id)) any = true;
		}
		const finished = state.turnEvents && state.turnEvents.finishedTechName;
		if (any || finished) {
			todos.push({
				id: "tech",
				type: "pickTech",
				blocking: false,
				text: finished
					? (finished + " researched" + (any ? ". Pick a new technology" : ""))
					: "Pick a new technology"
			});
		}
	}
	if (state.offers) {
		for (let i = 0; i < state.offers.length; i++) {
			const o = state.offers[i];
			if (o.toId !== player.id || o.pending || o.attentionSeen) continue;
			const from = Space4x.empireById(state, o.fromId);
			todos.push({
				id: "diplo-" + o.id,
				type: o.kind === "revoltJoin" ? "revoltJoin" : "diploOffer",
				offerId: o.id,
				rivalId: o.fromId,
				blocking: false,
				text: o.kind === "revoltJoin"
					? (Space4x.empireById(state, o.fromId) || { name: "A revolt" }).name + " wishes to join you"
					: "Offer from " + (from ? from.name : "a rival")
			});
		}
	}
	const responses = state.turnEvents && state.turnEvents.offerResponses;
	if (responses) {
		for (let i = 0; i < responses.length; i++) {
			const ev = responses[i];
			if (ev.seen) continue;
			todos.push({
				id: "offer-resp-" + ev.rivalId + "-" + i,
				type: "diploResponse",
				rivalId: ev.rivalId,
				responseIndex: i,
				blocking: false,
				text: ev.text
			});
		}
	}
	for (let i = 0; i < state.empires.length; i++) {
		const them = state.empires[i];
		if (them.id === player.id) continue;
		const rel = Space4x.relationOf(player, them.id);
		if (!rel || !rel.welcomePending) continue;
		todos.push({
			id: "contact-" + them.id,
			type: "firstContact",
			rivalId: them.id,
			blocking: false,
			text: rel.welcomeMessage || (them.name + " welcomes you to negotiations")
		});
	}
	const homes = Space4x.settlementsOf(state, player.id);
	for (let i = 0; i < homes.length; i++) {
		if (homes[i].buildQueue.length) continue;
		todos.push({
			id: "queue-" + homes[i].id,
			type: "emptyQueue",
			settlementId: homes[i].id,
			blocking: false,
			text: "Build queue empty at " + Space4x.settlementLabel(state, homes[i])
		});
	}
	const arrivedColonies = state.turnEvents && state.turnEvents.arrivedColonyIds;
	for (let i = 0; i < state.units.length; i++) {
		const unit = state.units[i];
		if (unit.empireId !== player.id || !Space4x.unitCanFound(state, unit)) continue;
		if (unit.location.kind !== "orbit" || unit.targetStarId) continue;
		if (!arrivedColonies || arrivedColonies.indexOf(unit.id) === -1) continue;
		const star = Space4x.starById(state, unit.location.starId);
		if (!star) continue;
		const bodies = Space4x.emptyLegalBodies(state, star, player.id);
		if (!bodies.length) continue;
		todos.push({
			id: "found-" + unit.id,
			type: "foundColony",
			unitId: unit.id,
			starId: star.id,
			blocking: false,
			text: "Colony ship arrived at " + star.name
		});
	}
	const combats = Space4x.playerUnseenGroundCombats(state);
	for (let i = 0; i < combats.length; i++) {
		const c = combats[i];
		let text = c.summary || "Ground combat at " + (c.settlementLabel || "a colony");
		if (c.kind === "wildlife") text = "Wildlife attack at " + (c.settlementLabel || "a colony");
		else if (c.kind === "revolt") text = "Revolt combat at " + (c.settlementLabel || "a colony");
		else if (c.kind === "invasion") text = c.summary || ("Invasion at " + (c.settlementLabel || "a colony"));
		todos.push({
			id: "combat-" + c.id,
			type: "groundCombat",
			combatId: c.id,
			settlementId: c.settlementId,
			blocking: false,
			text: text
		});
	}
	const spaceDone = Space4x.playerUnseenSpaceBattles(state);
	for (let i = 0; i < spaceDone.length; i++) {
		const b = spaceDone[i];
		if (!b.done) continue;
		const star = Space4x.starById(state, b.starId);
		todos.push({
			id: "space-" + b.id,
			type: "spaceCombat",
			battleId: b.id,
			blocking: false,
			text: b.summary || ("Space combat at " + (star ? star.name : "a star"))
		});
	}
	const losses = Space4x.playerUnseenSpaceLosses(state);
	for (let i = 0; i < losses.length; i++) {
		todos.push({
			id: "space-loss-" + losses[i].id,
			type: "spaceLoss",
			lossId: losses[i].id,
			starId: losses[i].starId,
			blocking: false,
			text: losses[i].text
		});
	}
	const crushed = state.turnEvents && state.turnEvents.crushedRevolts;
	const revoltSummaries = player ? Space4x.revoltSummariesOf(state, player.id) : [];
	const revoltSummarySites = {};
	for (let i = 0; i < revoltSummaries.length; i++) {
		const rv = revoltSummaries[i];
		if (rv.seen) continue;
		revoltSummarySites[rv.settlementId] = true;
		let text = "Revolt at " + rv.settlementLabel;
		if (rv.outcome === "crushed" || rv.outcome === "combat_crushed") {
			text = "Revolt crushed at " + rv.settlementLabel;
		} else if (rv.rebelEmpireName) {
			text = "Revolt at " + rv.settlementLabel + " — " + rv.rebelEmpireName;
		}
		todos.push({
			id: "revolt-summary-" + rv.id,
			type: "revoltSummary",
			revoltId: rv.id,
			settlementId: rv.settlementId,
			blocking: false,
			text: text
		});
	}
	const revoltJoins = state.turnEvents && state.turnEvents.revoltJoins;
	if (revoltJoins) {
		for (let i = 0; i < revoltJoins.length; i++) {
			const join = revoltJoins[i];
			if (join.seen) continue;
			todos.push({
				id: "revolt-joined-" + join.id,
				type: "revoltJoined",
				joinId: join.id,
				rivalId: join.targetId,
				blocking: false,
				text: join.summary || ((join.rebelName || "A revolt") + " joins " + (join.targetName || "an empire"))
			});
		}
	}
	const revoltCombatSites = {};
	const allCombats = state.turnEvents && state.turnEvents.groundCombats;
	if (allCombats) {
		for (let i = 0; i < allCombats.length; i++) {
			if (allCombats[i].kind === "revolt") revoltCombatSites[allCombats[i].settlementId] = true;
		}
	}
	if (crushed) {
		for (let i = 0; i < crushed.length; i++) {
			const ev = crushed[i];
			if (revoltSummarySites[ev.settlementId]) continue;
			if (revoltCombatSites[ev.settlementId]) continue;
			const unitsLost = ev.unitsLost != null ? ev.unitsLost : (ev.dead || 0);
			let text = "Revolt crushed at " + ev.name + ".";
			const crushedSt = Space4x.settlementById(state, ev.settlementId);
			if (crushedSt) text = "Revolt crushed at " + Space4x.settlementLabel(state, crushedSt) + ".";
			if (unitsLost > 0) text += " " + unitsLost + " rebel " + (unitsLost === 1 ? "unit" : "units") + " destroyed.";
			todos.push({
				id: "revolt-" + ev.settlementId + "-" + i,
				type: "crushedRevolt",
				settlementId: ev.settlementId,
				blocking: false,
				text: text
			});
		}
	}
	todos.sort(function (a, b) {
		const pa = Space4x.todoSortPriority(a);
		const pb = Space4x.todoSortPriority(b);
		if (pa !== pb) return pa - pb;
		if (a.blocking && !b.blocking) return -1;
		if (!a.blocking && b.blocking) return 1;
		return 0;
	});
	state.todos = todos;
};

Space4x.blockingTodos = function (state) {
	for (let i = 0; i < state.todos.length; i++) {
		if (state.todos[i].blocking) return true;
	}
	return false;
};

Space4x.checkVictory = function (state) {
	const alive = [];
	for (let i = 0; i < state.empires.length; i++) {
		const e = state.empires[i];
		const homes = Space4x.settlementsOf(state, e.id);
		let ships = 0;
		for (let u = 0; u < state.units.length; u++) {
			if (state.units[u].empireId === e.id) ships += 1;
		}
		if (homes.length > 0 || ships > 0) alive.push(e);
	}
	if (alive.length === 1) state.winnerEmpireId = alive[0].id;
	if (alive.length === 0) state.winnerEmpireId = "none";
};

Space4x.finishTurnAfterSpace = function (state) {
	state.turnHold = null;
	Space4x.phaseProduction(state);
	Space4x.phaseDiplomacyYields(state);
	Space4x.phaseResearch(state);
	Space4x.phaseConstruction(state);
	Space4x.phaseSpies(state);
	Space4x.phaseTransport(state);
	Space4x.phaseUpkeep(state);
	Space4x.phasePopulation(state);
	Space4x.phaseRebellion(state);
	Space4x.phaseEndEmptyRevolts(state);
	Space4x.phaseFirstContact(state);
	state.turn += 1;
	Space4x.phaseRevoltJoins(state);
	Space4x.phaseResolvePendingOffers(state);
	Space4x.checkVictory(state);
	Space4x.recordScoreSnapshot(state);
	Space4x.rebuildTodos(state);
};

Space4x.maybeResumeTurnAfterSpace = function (state) {
	if (state.turnHold !== "afterSpace") return;
	if (Space4x.playerOpenSpaceBattles(state).length) return;
	Space4x.finishTurnAfterSpace(state);
};

Space4x.runTurn = function (state) {
	state.turnLog = [];
	state.turnEvents = {
		playerShipBuilt: false,
		playerShipArrived: false,
		firstContactIds: [],
		arrivedColonyIds: [],
		finishedTechName: null,
		crushedRevolts: [],
		revoltSummaries: [],
		revoltJoins: [],
		offerResponses: [],
		groundCombats: [],
		spaceBattles: [],
		spaceLosses: []
	};
	state.turnHold = null;
	for (let i = 0; i < state.empires.length; i++) {
		if (!state.empires[i].isPlayer) Space4x.dumbChoose(state, state.empires[i].id);
	}
	Space4x.phasePendingInvasions(state);
	Space4x.phaseEndEmptyRevolts(state);
	Space4x.phaseGroundCombat(state);
	Space4x.phaseMovement(state);
	Space4x.phaseSpaceCombat(state);
	if (Space4x.playerOpenSpaceBattles(state).length) {
		state.turnHold = "afterSpace";
		Space4x.rebuildTodos(state);
		return;
	}
	Space4x.finishTurnAfterSpace(state);
};

Space4x.endTurn = function (state) {
	if (state.winnerEmpireId) return;
	if (state.turnHold === "afterSpace") {
		if (Space4x.playerOpenSpaceBattles(state).length) {
			state.turnLog.push("Finish space combat first.");
			return;
		}
		Space4x.finishTurnAfterSpace(state);
		return;
	}
	if (Space4x.blockingTodos(state)) {
		state.turnLog.push("Resolve Attention items first.");
		return;
	}
	Space4x.runTurn(state);
};

Space4x.shouldPauseAutoPlay = function (state) {
	if (state.winnerEmpireId) return true;
	if (state.turnHold === "afterSpace") return true;
	for (let i = 0; i < state.todos.length; i++) {
		if (Space4x.todoPausesAutoPlay(state.todos[i])) return true;
	}
	if (!state.turnEvents) return false;
	if (Space4x.playerUnseenGroundCombats(state).length) return true;
	if (Space4x.playerUnseenSpaceBattles(state).length) return true;
	if (Space4x.playerUnseenSpaceLosses(state).length) return true;
	return !!(state.turnEvents.playerShipArrived || state.turnEvents.playerShipBuilt);
};
