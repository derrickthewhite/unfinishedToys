var Space4x = Space4x || {};

Space4x.SCORE_CHARTS = [
	{ key: "pop", title: "Population" },
	{ key: "structures", title: "Structures" },
	{ key: "research", title: "Research" },
	{ key: "ships", title: "Ships" },
	{ key: "troops", title: "Ground TS" }
];

Space4x.empireScore = function (state, empire) {
	const builds = Space4x.settingOf(state).builds;
	let pop = 0;
	let structures = 0;
	let ships = 0;
	const ground = [];
	const homes = Space4x.settlementsOf(state, empire.id);
	for (let i = 0; i < homes.length; i++) {
		const st = homes[i];
		pop += (st.pops || []).length;
		const built = st.structures || [];
		for (let s = 0; s < built.length; s++) {
			structures += Space4x.baseDefCost(builds[built[s].defId]);
		}
		const troops = st.troops || [];
		for (let t = 0; t < troops.length; t++) ground.push(troops[t]);
	}
	for (let i = 0; i < state.units.length; i++) {
		const unit = state.units[i];
		if (unit.empireId !== empire.id) continue;
		pop += (unit.cargoPops || []).length;
		const cargo = unit.cargoTroops || [];
		for (let t = 0; t < cargo.length; t++) ground.push(cargo[t]);
		if (Space4x.isHauler(state, unit)) continue;
		const def = builds[unit.defId];
		if (def && def.kind === "unit") ships += Space4x.baseDefCost(def);
	}
	let research = 0;
	const ids = (empire.research && empire.research.completedTechIds) || [];
	for (let i = 0; i < ids.length; i++) {
		const tech = Space4x.techById(state, ids[i]);
		if (tech && tech.cost) research += tech.cost;
	}
	return {
		pop: pop,
		structures: structures,
		research: research,
		ships: ships,
		troops: Space4x.troopListTs(state, empire, ground)
	};
};

Space4x.recordScoreSnapshot = function (state) {
	if (!state.scoreHistory) state.scoreHistory = [];
	if (!state.scoreEmpireMeta) state.scoreEmpireMeta = {};
	const scores = {};
	for (let i = 0; i < state.empires.length; i++) {
		const empire = state.empires[i];
		scores[empire.id] = Space4x.empireScore(state, empire);
		state.scoreEmpireMeta[empire.id] = {
			name: empire.name,
			colorId: empire.colorId,
			isPlayer: !!empire.isPlayer
		};
	}
	const last = state.scoreHistory[state.scoreHistory.length - 1];
	if (last && last.turn === state.turn) last.scores = scores;
	else state.scoreHistory.push({ turn: state.turn, scores: scores });
};
