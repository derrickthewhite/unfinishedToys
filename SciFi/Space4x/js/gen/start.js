var Space4x = Space4x || {};

Space4x.placeEmpires = function (state) {
	const w = state.galaxy.width;
	const h = state.galaxy.height;
	const cx = (w - 1) / 2;
	const cy = (h - 1) / 2;
	const idealR = Math.min(cx, cy) * 0.75;
	const stars = state.galaxy.stars;
	const used = {};
	const usedStarNames = {};
	const placed = [];

	function pickStar() {
		let best = null;
		let bestScore = -Infinity;
		for (let i = 0; i < stars.length; i++) {
			const st = stars[i];
			if (used[st.id]) continue;
			const r = Space4x.dist(st.x, st.y, cx, cy);
			let score = -Math.abs(r - idealR) * 1.2;
			if (placed.length) {
				let minD = Infinity;
				for (let p = 0; p < placed.length; p++) {
					const d = Space4x.dist(st.x, st.y, placed[p].x, placed[p].y);
					if (d < minD) minD = d;
				}
				score += minD * 3;
			}
			score += Space4x.rngNext(state) * Math.min(w, h) * 0.35;
			if (score > bestScore) {
				bestScore = score;
				best = st;
			}
		}
		return best;
	}

	for (let e = 0; e < state.empires.length; e++) {
		const empire = state.empires[e];
		const star = pickStar();
		if (!star) break;
		used[star.id] = true;
		placed.push(star);
		const hwName = Space4x.pickHomeworldStarName(state, empire.cultureId, usedStarNames);
		if (hwName) star.name = hwName;
		const body = Space4x.ensureMediumGarden(state, star);
		const home = Space4x.createSettlement(state, empire.id, star.id, body.id, star.name + " Home", 8);
		Space4x.absorbBodyNatives(state, home, body);
		Space4x.seedHomeJobs(state, home);
		Space4x.spawnTroop(state, home, "police", true);
		Space4x.spawnTroop(state, home, "police", true);
		Space4x.markStarExplored(state, empire.id, star.id);
		state.settlements.push(home);
	}
};

Space4x.startNewGame = function (state) {
	const gen = state.gen;
	state.settingId = gen.settingId;
	state.autoAssignJobs = !!gen.autoAssignJobs;
	state.hideUnvisitedSystems = gen.hideUnvisitedSystems !== false;
	state.rng = Space4x.seedFromString(gen.seed);
	state.turn = 1;
	state.nextId = 0;
	state.galaxy = { width: gen.width, height: gen.height, starCount: gen.starCount, stars: [], bgSeed: null };
	state.empires = [];
	state.settlements = [];
	state.units = [];
	state.popMoves = [];
	state.pendingInvasions = [];
	state.todos = [];
	state.turnLog = ["New game."];
	state.offers = [];
	state.turnEvents = { playerShipBuilt: false, playerShipArrived: false, firstContactIds: [], arrivedColonyIds: [], finishedTechName: null, crushedRevolts: [], revoltSummaries: [], revoltJoins: [] };
	state.scoreHistory = [];
	state.winnerEmpireId = null;
	state.observerMode = false;
	state.ui.selectedStarId = null;
	state.ui.selectedSettlementId = null;
	state.ui.selectedUnitId = null;
	state.ui.selectedUnitIds = [];
	state.ui.selectedCategoryId = null;
	state.ui.previewTechId = null;
	state.ui.moveFromId = null;
	state.ui.moveToId = null;
	state.ui.inspect = null;
	state.ui.diploRivalId = null;
	state.ui.diploDraft = null;
	state.ui.panel = "todo";
	state.ui.stage = "galaxy";
	state.ui.autoPlaying = false;
	state.ui.mapView = { zoom: 1, panX: null, panY: null };

	Space4x.ensureGenColors(gen);
	const usedCultures = {};
	const usedColors = {};
	state.empires.push(Space4x.createEmpire(state, {
		id: Space4x.nextId(state, "e"),
		name: "Player",
		isPlayer: true,
		aiId: null,
		cultureId: Space4x.resolveGenCultureId(state, gen.playerCultureId, usedCultures),
		colorId: Space4x.resolveGenColorId(state, gen.playerColorId, usedColors)
	}));
	for (let i = 0; i < gen.opponents.length; i++) {
		const slot = gen.opponents[i];
		if (!slot.enabled) continue;
		const cultureId = Space4x.resolveGenCultureId(state, slot.cultureId, usedCultures);
		state.empires.push(Space4x.createEmpire(state, {
			id: Space4x.nextId(state, "e"),
			name: Space4x.polityNameForCulture(state, cultureId),
			isPlayer: false,
			aiId: slot.aiId || "dumb",
			cultureId: cultureId,
			colorId: Space4x.resolveGenColorId(state, slot.colorId, usedColors)
		}));
	}

	Space4x.generateGalaxy(state);
	Space4x.ensureGalaxyBgSeed(state);
	Space4x.resolvePlanetColors(state);
	Space4x.placeEmpires(state);
	Space4x.ensureEmpireColors(state);
	for (let i = 0; i < state.empires.length; i++) Space4x.ensureEmpireDesigns(state, state.empires[i]);
	if (state.autoAssignJobs) {
		for (let i = 0; i < state.empires.length; i++) {
			if (state.empires[i].isPlayer) Space4x.autoAssignJobs(state, state.empires[i].id);
		}
	}
	const player = Space4x.playerEmpire(state);
	const homes = Space4x.settlementsOf(state, player.id);
	if (homes[0]) {
		state.ui.selectedSettlementId = homes[0].id;
		state.ui.selectedStarId = homes[0].location.starId;
	}
	Space4x.phaseFirstContact(state);
	Space4x.rebuildTodos(state);
	Space4x.recordScoreSnapshot(state);
	state.screen = "play";
};

