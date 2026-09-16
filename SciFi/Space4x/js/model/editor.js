var Space4x = Space4x || {};

Space4x.ensureEditorNextPlanetRange = function (state) {
	if (!state || !state.editor) return 0;
	const n = Number(state.editorNextPlanetRange);
	if (n > 0 && !isNaN(n)) {
		state.editorNextPlanetRange = Math.floor(n);
		return state.editorNextPlanetRange;
	}
	state.editorNextPlanetRange = Space4x.roll2d4(state);
	return state.editorNextPlanetRange;
};

Space4x.setEditorNextPlanetRange = function (state, value) {
	if (!state || !state.editor) return 0;
	const n = Math.floor(Number(value));
	state.editorNextPlanetRange = n > 0 && !isNaN(n) ? n : Space4x.roll2d4(state);
	return state.editorNextPlanetRange;
};

Space4x.randomizeEditorNextPlanetRange = function (state) {
	if (!state || !state.editor) return 0;
	state.editorNextPlanetRange = Space4x.roll2d4(state);
	return state.editorNextPlanetRange;
};

/** Editor stand-in for map range: stuck until warp and ship range reach the next planet. */
Space4x.aiEditorNeedsReach = function (state, empire) {
	if (!state || !state.editor || !empire) return false;
	const need = Space4x.ensureEditorNextPlanetRange(state);
	if (!Space4x.empireHasWarp(state, empire)) return true;
	const range = Space4x.shipStats(state, empire).range;
	return range + 1e-9 < need;
};

Space4x.ensureEditorFleets = function (state) {
	if (!state) return { attacker: [], defender: [] };
	if (!state.editorFleets || !state.editorFleets.attacker || !state.editorFleets.defender) {
		state.editorFleets = { attacker: [], defender: [] };
	}
	return state.editorFleets;
};

Space4x.editorFleetSide = function (state, side) {
	const fleets = Space4x.ensureEditorFleets(state);
	if (side === "defender") return fleets.defender;
	return fleets.attacker;
};

Space4x.editorFleetShipCount = function (state, side) {
	const rows = Space4x.editorFleetSide(state, side);
	let n = 0;
	for (let i = 0; i < rows.length; i++) n += Math.max(0, rows[i].count || 0);
	return n;
};

Space4x.addEditorFleetShip = function (state, side, hullDefId, designId, count) {
	const rows = Space4x.editorFleetSide(state, side);
	const n = Math.max(1, Math.floor(Number(count) || 1));
	for (let i = 0; i < rows.length; i++) {
		if (rows[i].hullDefId === hullDefId && rows[i].designId === designId) {
			rows[i].count = (rows[i].count || 0) + n;
			return rows[i];
		}
	}
	const row = { hullDefId: hullDefId, designId: designId, count: n };
	rows.push(row);
	return row;
};

Space4x.removeEditorFleetShip = function (state, side, index) {
	const rows = Space4x.editorFleetSide(state, side);
	if (index < 0 || index >= rows.length) return;
	rows.splice(index, 1);
};

Space4x.setEditorFleetCount = function (state, side, index, count) {
	const rows = Space4x.editorFleetSide(state, side);
	const row = rows[index];
	if (!row) return;
	const n = Math.floor(Number(count));
	if (!(n > 0)) {
		rows.splice(index, 1);
		return;
	}
	row.count = n;
};

Space4x.clearEditorFleets = function (state) {
	state.editorFleets = { attacker: [], defender: [] };
};

Space4x.ensureEditorOpponent = function (state) {
	if (!state) return null;
	let opp = state.editorOpponentId ? Space4x.empireById(state, state.editorOpponentId) : null;
	if (!opp) {
		for (let i = 0; i < (state.empires || []).length; i++) {
			if (!state.empires[i].isPlayer) {
				opp = state.empires[i];
				break;
			}
		}
	}
	if (!opp) {
		opp = Space4x.createEmpire(state, {
			id: Space4x.nextId(state, "e"),
			name: "Opponent",
			isPlayer: false,
			aiId: "dumb",
			cultureId: Space4x.defaultCultureId(state),
			colorId: 1
		});
		state.empires.push(opp);
	}
	state.editorOpponentId = opp.id;
	if (Space4x.ensureEmpireColors) Space4x.ensureEmpireColors(state);
	return opp;
};

Space4x.syncEditorOpponentFromSandbox = function (state) {
	const sandbox = Space4x.playerEmpire(state);
	const opp = Space4x.ensureEditorOpponent(state);
	if (!sandbox || !opp) return opp;
	if (Space4x.copyEmpireResearch) Space4x.copyEmpireResearch(state, sandbox, opp);
	opp.shipDesigns = JSON.parse(JSON.stringify(sandbox.shipDesigns || {}));
	return opp;
};

Space4x.makeEditorFleetUnit = function (state, empire, hullDefId, design) {
	return {
		id: Space4x.nextId(state, "u"),
		defId: hullDefId,
		empireId: empire.id,
		combatFit: Space4x.snapshotCombatFit(state, empire, hullDefId, design)
	};
};

Space4x.expandEditorFleetUnits = function (state, side, empire) {
	const sandbox = Space4x.playerEmpire(state);
	const host = sandbox || empire;
	const rows = Space4x.editorFleetSide(state, side);
	const units = [];
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const design = host ? Space4x.designById(host, row.hullDefId, row.designId) : null;
		if (!design) continue;
		const n = Math.max(0, Math.floor(row.count || 0));
		for (let k = 0; k < n; k++) {
			units.push(Space4x.makeEditorFleetUnit(state, empire, row.hullDefId, design));
		}
	}
	return units;
};

Space4x.editorLiveBattle = function (state) {
	const list = (state.turnEvents && state.turnEvents.spaceBattles) || [];
	for (let i = 0; i < list.length; i++) {
		if (list[i].starId === "editor" && !list[i].done) return list[i];
	}
	return null;
};

Space4x.cancelEditorSpaceBattle = function (state) {
	if (!state) return;
	if (state.turnEvents && state.turnEvents.spaceBattles) {
		const keep = [];
		for (let i = 0; i < state.turnEvents.spaceBattles.length; i++) {
			const battle = state.turnEvents.spaceBattles[i];
			if (battle.starId === "editor") {
				battle.done = true;
				battle._aiAnim = false;
				continue;
			}
			keep.push(battle);
		}
		state.turnEvents.spaceBattles = keep;
	}
	if (state.ui) {
		state.ui.selectedSpaceBattleId = null;
		state.ui.spaceTokenId = null;
		state.ui.spaceEnemyTokenId = null;
		state.ui.spaceWeaponId = null;
		state.ui.spaceCombatAuto = false;
	}
	state.turnHold = null;
};

Space4x.startEditorSpaceBattle = function (state) {
	if (!state || !state.editor) return { ok: false, reason: "Not an editor sandbox." };
	const sandbox = Space4x.playerEmpire(state);
	if (!sandbox) return { ok: false, reason: "No sandbox empire." };
	if (Space4x.ensureEmpireDesigns) Space4x.ensureEmpireDesigns(state, sandbox);
	const atkN = Space4x.editorFleetShipCount(state, "attacker");
	const defN = Space4x.editorFleetShipCount(state, "defender");
	if (!atkN || !defN) return { ok: false, reason: "Both sides need at least one ship." };
	Space4x.cancelEditorSpaceBattle(state);
	const opp = Space4x.syncEditorOpponentFromSandbox(state);
	const atk = Space4x.expandEditorFleetUnits(state, "attacker", sandbox);
	const def = Space4x.expandEditorFleetUnits(state, "defender", opp);
	if (!atk.length || !def.length) return { ok: false, reason: "Could not snapshot those classes. Check Designs." };
	const battle = Space4x.createSpaceBattle(state, "editor", sandbox.id, opp.id, atk, def);
	Space4x.startSpaceBattleTurns(state, battle);
	state.turnHold = null;
	return { ok: true, battle: battle };
};

Space4x.sanitizeEditorCombatState = function (state) {
	if (!state || !state.editor) return;
	Space4x.ensureEditorFleets(state);
	Space4x.cancelEditorSpaceBattle(state);
	if (state.ui && state.ui.stage === "spaceCombat") state.ui.stage = "editorCombat";
};

if (!Space4x.inContactWithEmpire) {
	Space4x.inContactWithEmpire = function (state, fromId, toId) {
		if (!fromId || !toId) return false;
		return fromId === toId;
	};
}

Space4x.createEditorState = function () {
	const state = Space4x.createInitialState();
	state.screen = "editor";
	state.editor = true;
	state.turn = 1;
	state.rng = Space4x.seedFromString("") || 1;
	state.turnLog = [];
	state.empires = [];
	state.settlements = [];
	state.units = [];
	state.galaxy = { width: 10, height: 10, stars: [] };
	state.editorNote = "";
	state.editorNextPlanetRange = Space4x.roll2d4(state);
	state.editorFleets = { attacker: [], defender: [] };
	const empire = Space4x.createEmpire(state, {
		id: Space4x.nextId(state, "e"),
		name: "Sandbox",
		isPlayer: true,
		aiId: null,
		cultureId: Space4x.defaultCultureId(state),
		colorId: 0
	});
	state.empires.push(empire);
	if (Space4x.ensureEmpireColors) Space4x.ensureEmpireColors(state);
	if (Space4x.ensureEmpireDesigns && Space4x.shipArtCount) Space4x.ensureEmpireDesigns(state, empire);
	state.ui.stage = "design";
	state.ui.designHullId = "cruiser";
	state.ui.designId = null;
	state.ui.selectedCategoryId = null;
	state.ui.previewTechId = null;
	state.ui.editorFleetHullId = "cruiser";
	state.ui.editorFleetDesignId = null;
	return state;
};

Space4x.refreshEditorDesigns = function (state) {
	const empire = Space4x.playerEmpire(state);
	if (!empire) return;
	Space4x.ensureEmpireDesigns(state, empire);
	Space4x.autoUpdateDesign(state, empire, "cruiser");
	Space4x.autoUpdateDesign(state, empire, "battleship");
	Space4x.autoUpdateDesign(state, empire, "defenseStation");
};
