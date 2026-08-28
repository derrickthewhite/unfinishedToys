var Space4x = Space4x || {};

Space4x.emptyUiInteraction = function () {
	return {
		jobSel: { ids: [], fromJob: null },
		jobDrag: null,
		pendingLaneJob: null,
		spySel: { ids: [], fromLane: null },
		spyDrag: null,
		pendingSpyLane: null,
		queueDrag: null
	};
};

Space4x.ensureUiInteraction = function (state) {
	const d = Space4x.emptyUiInteraction();
	if (!state.ui) state.ui = {};
	const keys = Object.keys(d);
	for (let i = 0; i < keys.length; i++) {
		if (state.ui[keys[i]] === undefined) state.ui[keys[i]] = d[keys[i]];
	}
};

Space4x.clearUiInteraction = function (state) {
	if (!state.ui) return;
	const d = Space4x.emptyUiInteraction();
	const keys = Object.keys(d);
	for (let i = 0; i < keys.length; i++) state.ui[keys[i]] = d[keys[i]];
};

Space4x.emptyModifiers = function () {
	return {
		speed: 0,
		range: 0,
		commsRange: 0,
		shipSize: 0,
		industryPerPop: 0,
		researchPerPop: 0,
		foodPerFarmer: 0,
		growthRatePercent: 0,
		weapon: 0,
		shield: 0,
		armor: 0,
		loyalty: 0,
		spySkill: 0
	};
};

Space4x.createEmpire = function (state, opts) {
	const cats = Space4x.SETTINGS[opts.settingId || state.settingId || "scratch-empire"].categories;
	const set = Space4x.SETTINGS[opts.settingId || state.settingId || "scratch-empire"];
	const startTier = set.startTechTier != null ? set.startTechTier : 1;
	const tier = {};
	for (let i = 0; i < cats.length; i++) tier[cats[i].id] = startTier;
	return {
		id: opts.id,
		name: opts.name,
		isPlayer: !!opts.isPlayer,
		aiId: opts.aiId || null,
		cultureId: opts.cultureId || Space4x.defaultCultureId(state),
		stockpiles: { money: 0 },
		transport: { freighters: 0 },
		modifiers: Space4x.emptyModifiers(),
		exploredStarIds: [],
		spies: [],
		relations: {},
		research: {
			model: "category",
			currentProjectId: null,
			progress: 0,
			cost: 0,
			categoryTier: tier,
			completedTechIds: [],
			savedProgress: {}
		}
	};
};

Space4x.createPop = function (state, empire) {
	return {
		id: Space4x.nextId(state, "p"),
		job: "idle",
		culture: empire && empire.cultureId ? empire.cultureId : Space4x.defaultCultureId(state)
	};
};

Space4x.createSettlement = function (state, empireId, starId, bodyId, name, popCount) {
	const empire = Space4x.empireById(state, empireId);
	const pops = [];
	for (let i = 0; i < popCount; i++) pops.push(Space4x.createPop(state, empire));
	return {
		id: Space4x.nextId(state, "s"),
		name: name,
		empireId: empireId,
		location: { starId: starId, bodyId: bodyId },
		pops: pops,
		structures: [],
		troops: [],
		stationedUnitIds: [],
		buildQueue: [],
		industryPool: 0,
		starveAcc: 0,
		growthAcc: 0,
		lastFoodPresent: 0,
		lastFoodProduced: 0,
		lastStarveTurn: null,
		lastGrowthTurn: null,
		foodShort: false,
		starvedThisTurn: 0,
		loyaltyMods: {}
	};
};

Space4x.createInitialState = function () {
	const boot = { settingId: "scratch-empire", gen: { settingId: "scratch-empire" } };
	const playerCultureId = Space4x.pickRandomCultureId(boot, {}) || Space4x.RANDOM_CULTURE;
	return {
		screen: "generation",
		settingId: "scratch-empire",
		turn: 0,
		nextId: 0,
		rng: 1,
		gen: {
			settingId: "scratch-empire",
			seed: "",
			width: 30,
			height: 30,
			starCount: 25,
			autoAssignJobs: false,
			hideUnvisitedSystems: true,
			playerCultureId: playerCultureId,
			opponents: [{ id: "slot-1", aiId: "dumb", enabled: true, cultureId: Space4x.RANDOM_CULTURE }]
		},
		ui: {
			panel: "todo",
			selectedStarId: null,
			selectedSettlementId: null,
			selectedUnitId: null,
			selectedUnitIds: [],
			stage: "galaxy",
			autoPlaying: false,
			mapView: { zoom: 1, panX: null, panY: null },
			selectedCategoryId: null,
			previewTechId: null,
			moveFromId: null,
			moveToId: null,
			inspect: null,
			genFocus: null,
			diploRivalId: null,
			diploDraft: null,
			jobSel: { ids: [], fromJob: null },
			jobDrag: null,
			pendingLaneJob: null,
			spySel: { ids: [], fromLane: null },
			spyDrag: null,
			pendingSpyLane: null,
			queueDrag: null
		},
		galaxy: { width: 30, height: 30, stars: [] },
		empires: [],
		settlements: [],
		units: [],
		popMoves: [],
		todos: [],
		turnLog: [],
		offers: [],
		turnEvents: { playerShipBuilt: false, playerShipArrived: false, firstContactIds: [], arrivedColonyIds: [], finishedTechName: null, crushedRevolts: [] },
		scoreHistory: [],
		winnerEmpireId: null,
		autoAssignJobs: false,
		hideUnvisitedSystems: true
	};
};
