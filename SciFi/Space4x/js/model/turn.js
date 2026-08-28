var Space4x = Space4x || {};

Space4x.rebuildTodos = function (state) {
	const player = Space4x.playerEmpire(state);
	const todos = [];
	if (!player) {
		state.todos = todos;
		return;
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
					text: "Assign work at " + list[i].name
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
			if (o.toId !== player.id) continue;
			const from = Space4x.empireById(state, o.fromId);
			todos.push({
				id: "diplo-" + o.id,
				type: "diploOffer",
				rivalId: o.fromId,
				blocking: false,
				text: "Offer from " + (from ? from.name : "a rival")
			});
		}
	}
	const welcomes = state.turnEvents && state.turnEvents.firstContactIds;
	if (welcomes) {
		for (let i = 0; i < welcomes.length; i++) {
			const them = Space4x.empireById(state, welcomes[i]);
			todos.push({
				id: "contact-" + welcomes[i],
				type: "firstContact",
				rivalId: welcomes[i],
				blocking: false,
				text: (them ? them.name : "A rival") + " welcomes you"
			});
		}
	}
	const homes = Space4x.settlementsOf(state, player.id);
	for (let i = 0; i < homes.length; i++) {
		if (homes[i].buildQueue.length) continue;
		todos.push({
			id: "queue-" + homes[i].id,
			type: "emptyQueue",
			settlementId: homes[i].id,
			blocking: false,
			text: "Build queue empty at " + homes[i].name
		});
	}
	const arrivedColonies = state.turnEvents && state.turnEvents.arrivedColonyIds;
	for (let i = 0; i < state.units.length; i++) {
		const unit = state.units[i];
		if (unit.empireId !== player.id || unit.defId !== "colonyShip") continue;
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
	const crushed = state.turnEvents && state.turnEvents.crushedRevolts;
	if (crushed) {
		for (let i = 0; i < crushed.length; i++) {
			const ev = crushed[i];
			const dead = ev.dead || 0;
			todos.push({
				id: "revolt-" + ev.settlementId + "-" + i,
				type: "crushedRevolt",
				settlementId: ev.settlementId,
				blocking: false,
				text: "Revolt crushed at " + ev.name + ". " + dead + " " + Space4x.peopleWord(dead) + " died."
			});
		}
	}
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

Space4x.runTurn = function (state) {
	state.turnLog = [];
	state.turnEvents = { playerShipBuilt: false, playerShipArrived: false, firstContactIds: [], arrivedColonyIds: [], finishedTechName: null, crushedRevolts: [] };
	for (let i = 0; i < state.empires.length; i++) {
		if (!state.empires[i].isPlayer) Space4x.dumbChoose(state, state.empires[i].id);
	}
	Space4x.phaseMovement(state);
	Space4x.phaseProduction(state);
	Space4x.phaseDiplomacyYields(state);
	Space4x.phaseResearch(state);
	Space4x.phaseConstruction(state);
	Space4x.phaseSpies(state);
	Space4x.phaseTransport(state);
	Space4x.phaseUpkeep(state);
	Space4x.phasePopulation(state);
	Space4x.phaseRebellion(state);
	Space4x.phaseFirstContact(state);
	state.turn += 1;
	Space4x.checkVictory(state);
	Space4x.recordScoreSnapshot(state);
	Space4x.rebuildTodos(state);
};

Space4x.endTurn = function (state) {
	if (state.winnerEmpireId) return;
	if (Space4x.blockingTodos(state)) {
		state.turnLog.push("Resolve Attention items first.");
		return;
	}
	Space4x.runTurn(state);
};

Space4x.shouldPauseAutoPlay = function (state) {
	if (state.winnerEmpireId) return true;
	if (state.todos.length) return true;
	if (!state.turnEvents) return false;
	return !!(state.turnEvents.playerShipArrived || state.turnEvents.playerShipBuilt);
};
