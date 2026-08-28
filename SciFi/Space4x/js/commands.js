var Space4x = Space4x || {};

Space4x.movePopToJob = function (state, settlement, job, delta) {
	if (delta > 0) {
		const cap = Space4x.jobCap(state, settlement, job);
		const have = Space4x.countJob(settlement, job);
		let n = Math.min(delta, cap === Infinity ? delta : cap - have);
		for (let i = 0; i < settlement.pops.length && n > 0; i++) {
			if (settlement.pops[i].job === "idle") {
				settlement.pops[i].job = job;
				n -= 1;
			}
		}
		return;
	}
	let n = -delta;
	for (let i = 0; i < settlement.pops.length && n > 0; i++) {
		if (settlement.pops[i].job === job) {
			settlement.pops[i].job = "idle";
			n -= 1;
		}
	}
};

Space4x.createCommands = function (app) {
	const cmds = {};

	function after() {
		if (app.state.screen === "play") Space4x.rebuildTodos(app.state);
		app.sync();
		if (app.state.screen === "play" && app.state.ui.stage === "galaxy") {
			requestAnimationFrame(function () { Space4x.drawMap(app.ui, app.state); });
		}
		if (app.state.screen === "play" && app.state.ui.stage === "report") {
			requestAnimationFrame(function () { Space4x.syncReportStage(app.ui, app.state); });
		}
	}

	function setPersistMessage(text) {
		app.persistMessage = text || "";
	}

	function loadEnvelope(envelope) {
		cmds.stopAutoPlay();
		const applied = Space4x.applySave(app.state, envelope);
		if (!applied.ok) {
			setPersistMessage(applied.reason);
			after();
			return false;
		}
		setPersistMessage("");
		if (!app.state.scoreHistory || !app.state.scoreHistory.length) {
			Space4x.recordScoreSnapshot(app.state);
		}
		after();
		return true;
	}

	cmds.readGenerationForm = function () {
		const ui = app.ui;
		const gen = app.state.gen;
		if (document.activeElement !== ui.genSeed) gen.seed = ui.genSeed.value;
		if (document.activeElement !== ui.genWidth) gen.width = parseInt(ui.genWidth.value, 10) || 30;
		if (document.activeElement !== ui.genHeight) gen.height = parseInt(ui.genHeight.value, 10) || 30;
		if (document.activeElement !== ui.genStars) gen.starCount = parseInt(ui.genStars.value, 10) || 25;
		gen.settingId = ui.genSetting.value;
		gen.autoAssignJobs = ui.genAutoJobs.checked;
		if (ui.genHideUnvisited) gen.hideUnvisitedSystems = ui.genHideUnvisited.checked;
	};

	cmds.startGame = function (ev) {
		if (ev) ev.preventDefault();
		cmds.stopAutoPlay();
		cmds.readGenerationForm();
		Space4x.startNewGame(app.state);
		after();
	};

	cmds.addOpponent = function () {
		const gen = app.state.gen;
		gen.opponents.push({
			id: "slot-" + (gen.opponents.length + 1) + "-" + Date.now(),
			aiId: "dumb",
			enabled: true,
			cultureId: Space4x.RANDOM_CULTURE
		});
		after();
	};

	cmds.setPlayerCulture = function (cultureId) {
		app.state.gen.playerCultureId = cultureId;
		after();
	};

	cmds.setOpponentCulture = function (slotId, cultureId) {
		const list = app.state.gen.opponents;
		for (let i = 0; i < list.length; i++) {
			if (list[i].id === slotId) list[i].cultureId = cultureId;
		}
		after();
	};

	cmds.chooseOpponentSpecies = function (slotId) {
		const gen = app.state.gen;
		const pick = Space4x.pickRandomCultureId(app.state, Space4x.usedGenCultureIds(gen));
		cmds.setOpponentCulture(slotId, pick || Space4x.RANDOM_CULTURE);
	};

	cmds.removeOpponent = function (slotId) {
		app.state.gen.opponents = app.state.gen.opponents.filter(function (s) {
			return s.id !== slotId;
		});
		after();
	};

	cmds.stopAutoPlay = function () {
		app.state.ui.autoPlaying = false;
		if (app._autoTimer) {
			clearTimeout(app._autoTimer);
			app._autoTimer = null;
		}
	};

	cmds.endTurn = function () {
		cmds.stopAutoPlay();
		Space4x.endTurn(app.state);
		Space4x.maybeAutosaveAfterTurn(app.state);
		if (app.state.todos.length) app.state.ui.panel = "todo";
		after();
	};

	cmds.toggleAutoPlay = function () {
		if (app.state.ui.autoPlaying) {
			cmds.stopAutoPlay();
			after();
			return;
		}
		if (app.state.winnerEmpireId || Space4x.blockingTodos(app.state)) return;
		if (app.state.todos.length) {
			app.state.ui.panel = "todo";
			after();
			return;
		}
		app.state.ui.autoPlaying = true;
		after();
		function tick() {
			app._autoTimer = null;
			if (!app.state.ui.autoPlaying || app.state.screen !== "play") return;
			Space4x.endTurn(app.state);
			Space4x.maybeAutosaveAfterTurn(app.state);
			const pause = Space4x.shouldPauseAutoPlay(app.state);
			if (pause) cmds.stopAutoPlay();
			if (app.state.todos.length) app.state.ui.panel = "todo";
			after();
			if (!pause && app.state.ui.autoPlaying) app._autoTimer = setTimeout(tick, 1000);
		}
		tick();
	};

	cmds.setPanel = function (name) {
		app.state.ui.panel = name;
		after();
	};

	cmds.showGalaxy = function () {
		app.state.ui.stage = "galaxy";
		if (app.state.ui.selectedStarId) app.state.ui.panel = "system";
		after();
	};

	cmds.becomeEmpire = function (empireId) {
		if (app.state.screen !== "play") return;
		cmds.stopAutoPlay();
		if (!Space4x.becomeEmpire(app.state, empireId)) return;
		after();
	};

	cmds.showSettlement = function () {
		const st = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
		if (!st) {
			cmds.showGalaxy();
			return;
		}
		app.state.ui.stage = "settlement";
		after();
	};

	cmds.showBuild = function () {
		const st = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
		if (!st) return;
		app.state.ui.stage = "build";
		after();
	};

	cmds.showSpies = function () {
		app.state.ui.stage = "spies";
		after();
	};

	cmds.showDiplomacy = function () {
		app.state.ui.stage = "diplomacy";
		after();
	};

	cmds.selectDiploRival = function (id) {
		if (app.state.ui.diploRivalId !== id) Space4x.resetDiploDraft(app.state);
		app.state.ui.diploRivalId = id;
		after();
	};

	cmds.diploDeclareWar = function () {
		const player = Space4x.playerEmpire(app.state);
		if (!player || !app.state.ui.diploRivalId) return;
		Space4x.declareWar(app.state, player.id, app.state.ui.diploRivalId);
		Space4x.resetDiploDraft(app.state);
		after();
	};

	cmds.diploAddPact = function (id) {
		const draft = Space4x.diploDraftOf(app.state);
		if (draft.pacts.indexOf(id) >= 0) return;
		draft.pacts.push(id);
		after();
	};

	cmds.diploRemovePact = function (index) {
		const draft = Space4x.diploDraftOf(app.state);
		if (index < 0 || index >= draft.pacts.length) return;
		draft.pacts.splice(index, 1);
		after();
	};

	cmds.diploAddClause = function (side, clause) {
		const draft = Space4x.diploDraftOf(app.state);
		if (side !== "give" && side !== "want") return;
		draft[side].push(clause);
		after();
	};

	cmds.diploRemoveClause = function (side, index) {
		const draft = Space4x.diploDraftOf(app.state);
		if (side !== "give" && side !== "want") return;
		if (index < 0 || index >= draft[side].length) return;
		draft[side].splice(index, 1);
		after();
	};

	cmds.diploAddMoney = function (side) {
		const n = Space4x.moneyRound(parseFloat(app.ui.diploMoneyN && app.ui.diploMoneyN.value) || 0);
		if (!(n > 0)) return;
		cmds.diploAddClause(side, { type: "money", n: n });
	};

	cmds.diploAddWorld = function (side) {
		const sel = side === "give" ? app.ui.diploGiveWorld : app.ui.diploWantWorld;
		if (!sel || !sel.value) return;
		cmds.diploAddClause(side, { type: "settlement", settlementId: sel.value });
	};

	cmds.diploAddShip = function (side) {
		const sel = side === "give" ? app.ui.diploGiveShip : app.ui.diploWantShip;
		if (!sel || !sel.value) return;
		cmds.diploAddClause(side, { type: "ship", unitId: sel.value });
	};

	cmds.diploAddTroops = function (side) {
		const sel = side === "give" ? app.ui.diploGiveTroop : app.ui.diploWantTroop;
		const nEl = side === "give" ? app.ui.diploGiveTroopN : app.ui.diploWantTroopN;
		if (!sel || !sel.value) return;
		const raw = String(sel.value);
		const cut = raw.indexOf("::");
		if (cut < 0) return;
		const settlementId = raw.slice(0, cut);
		const parsed = Space4x.parseTroopStackId(raw.slice(cut + 2));
		let n = parseInt(nEl && nEl.value, 10) || 1;
		const st = Space4x.settlementById(app.state, settlementId);
		const have = Space4x.countTroops(st, parsed.defId, parsed.culture);
		if (n > have) n = have;
		if (!(n > 0)) return;
		cmds.diploAddClause(side, {
			type: "troops",
			settlementId: settlementId,
			defId: parsed.defId,
			culture: parsed.culture,
			n: n
		});
	};

	cmds.diploSend = function () {
		const player = Space4x.playerEmpire(app.state);
		const toId = app.state.ui.diploRivalId;
		if (!player || !toId) return;
		const result = Space4x.submitOffer(app.state, player.id, toId, Space4x.diploDraftOf(app.state));
		if (result && result.ok) Space4x.resetDiploDraft(app.state);
		after();
	};

	cmds.diploAccept = function () {
		const player = Space4x.playerEmpire(app.state);
		if (!player) return;
		const offer = Space4x.offerTo(app.state, player.id, app.state.ui.diploRivalId);
		if (!offer) return;
		Space4x.acceptOffer(app.state, offer.id, player.id);
		after();
	};

	cmds.diploRefuse = function () {
		const player = Space4x.playerEmpire(app.state);
		if (!player) return;
		const offer = Space4x.offerTo(app.state, player.id, app.state.ui.diploRivalId);
		if (!offer) return;
		Space4x.refuseOffer(app.state, offer.id, player.id);
		after();
	};

	cmds.setSpyPosts = function (spyIds, laneId) {
		const player = Space4x.playerEmpire(app.state);
		if (!player) return;
		Space4x.setSpyPosts(app.state, player.id, spyIds, laneId);
		after();
	};

	cmds.showResearch = function () {
		app.state.ui.stage = "research";
		if (!app.state.ui.selectedCategoryId) {
			const player = Space4x.playerEmpire(app.state);
			if (player && player.research.currentProjectId) {
				const tech = Space4x.techById(app.state, player.research.currentProjectId);
				if (tech) app.state.ui.selectedCategoryId = tech.categoryId;
			}
			if (!app.state.ui.selectedCategoryId) {
				const cats = Space4x.settingOf(app.state).categories;
				if (cats[0]) app.state.ui.selectedCategoryId = cats[0].id;
			}
		}
		if (!app.state.ui.previewTechId && app.state.ui.selectedCategoryId) {
			cmds.selectCategory(app.state.ui.selectedCategoryId);
			return;
		}
		after();
	};

	cmds.showEmpire = function () {
		app.state.ui.stage = "empire";
		after();
	};

	cmds.showReport = function () {
		app.state.ui.stage = "report";
		after();
	};

	cmds.getMoreSettlers = function () {
		const player = Space4x.playerEmpire(app.state);
		const here = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
		if (!player || !here || here.empireId !== player.id) return;
		const list = Space4x.settlementsOf(app.state, player.id);
		app.state.ui.moveToId = here.id;
		let fromId = "";
		for (let i = 0; i < list.length; i++) {
			if (list[i].id !== here.id) {
				fromId = list[i].id;
				break;
			}
		}
		app.state.ui.moveFromId = fromId;
		cmds.showEmpire();
	};

	cmds.selectCategory = function (categoryId) {
		app.state.ui.selectedCategoryId = categoryId;
		const player = Space4x.playerEmpire(app.state);
		const avail = player ? Space4x.availableTech(app.state, player, categoryId) : null;
		const cur = player && player.research.currentProjectId ? Space4x.techById(app.state, player.research.currentProjectId) : null;
		if (cur && cur.categoryId === categoryId) app.state.ui.previewTechId = cur.id;
		else if (avail) app.state.ui.previewTechId = avail.id;
		else {
			const list = Space4x.techsInCategory(app.state, categoryId);
			app.state.ui.previewTechId = list.length ? list[list.length - 1].id : null;
		}
		after();
	};

	cmds.previewTech = function (techId) {
		const tech = Space4x.techById(app.state, techId);
		if (!tech) return;
		app.state.ui.previewTechId = techId;
		app.state.ui.selectedCategoryId = tech.categoryId;
		after();
	};

	cmds.selectStar = function (starId) {
		app.state.ui.selectedStarId = starId;
		app.state.ui.stage = "galaxy";
		app.state.ui.panel = "system";
		after();
	};

	cmds.selectSettlement = function (id, stage) {
		const st = Space4x.settlementById(app.state, id);
		if (!st) return;
		if (app.state.ui.selectedSettlementId !== id) {
			if (Space4x.clearJobSel) Space4x.clearJobSel();
			app.state.ui.inspect = null;
		}
		app.state.ui.selectedSettlementId = id;
		app.state.ui.selectedStarId = st.location.starId;
		app.state.ui.stage = stage || "settlement";
		after();
	};

	cmds.selectUnit = function (id) {
		const unit = Space4x.unitById(app.state, id);
		if (!unit) return;
		if (Space4x.unitIsSelected(app.state, id)) {
			Space4x.removeSelectedUnit(app.state, id);
			after();
			return;
		}
		const player = Space4x.playerEmpire(app.state);
		if (player && unit.empireId === player.id) {
			Space4x.addSelectedUnit(app.state, id);
		} else {
			app.state.ui.selectedUnitId = id;
		}
		after();
	};

	cmds.selectUnits = function (ids) {
		if (!ids || !ids.length) return;
		let allSelected = true;
		for (let i = 0; i < ids.length; i++) {
			if (!Space4x.unitIsSelected(app.state, ids[i])) allSelected = false;
		}
		if (allSelected) {
			for (let i = 0; i < ids.length; i++) Space4x.removeSelectedUnit(app.state, ids[i]);
			after();
			return;
		}
		const player = Space4x.playerEmpire(app.state);
		let added = false;
		for (let i = 0; i < ids.length; i++) {
			const unit = Space4x.unitById(app.state, ids[i]);
			if (!unit) continue;
			if (player && unit.empireId === player.id) {
				Space4x.addSelectedUnit(app.state, unit.id);
				added = true;
			} else if (!added) {
				app.state.ui.selectedUnitId = unit.id;
			}
		}
		after();
	};

	cmds.assignJob = function (settlementId, job, delta) {
		const st = Space4x.settlementById(app.state, settlementId);
		if (!st) return;
		const player = Space4x.playerEmpire(app.state);
		if (!player || st.empireId !== player.id) return;
		Space4x.movePopToJob(app.state, st, job, delta);
		after();
	};

	cmds.setPopJob = function (popId, job) {
		const st = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
		const player = Space4x.playerEmpire(app.state);
		if (!st || !player || st.empireId !== player.id) return;
		Space4x.setPopJob(app.state, st, popId, job);
		after();
	};

	cmds.setPopJobs = function (popIds, job) {
		const st = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
		const player = Space4x.playerEmpire(app.state);
		if (!st || !player || st.empireId !== player.id) return;
		Space4x.setPopJobs(app.state, st, popIds, job);
		after();
	};

	cmds.queuePopMove = function () {
		const player = Space4x.playerEmpire(app.state);
		if (!player) return;
		const fromId = app.ui.empireMoveFrom.value;
		const toId = app.ui.empireMoveTo.value;
		const count = parseInt(app.ui.empireMoveCount.value, 10) || 0;
		const from = Space4x.settlementById(app.state, fromId);
		const to = Space4x.settlementById(app.state, toId);
		if (!from || !to || from.empireId !== player.id || to.empireId !== player.id) return;
		Space4x.queuePopMove(app.state, fromId, toId, count);
		after();
	};

	cmds.queueTroopMove = function () {
		const player = Space4x.playerEmpire(app.state);
		const from = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
		if (!player || !from || from.empireId !== player.id) return;
		const parsed = Space4x.parseTroopStackId(app.ui.settleTroopDef.value);
		const toId = app.ui.settleTroopTo.value;
		const count = parseInt(app.ui.settleTroopCount.value, 10) || 0;
		Space4x.queueTroopMove(app.state, from.id, toId, parsed.defId, count, parsed.culture);
		after();
	};

	cmds.cancelPopMove = function (moveId) {
		Space4x.cancelHauler(app.state, moveId);
		after();
	};

	cmds.queueBuild = function (defId) {
		const id = app.state.ui.selectedSettlementId;
		const st = Space4x.settlementById(app.state, id);
		const player = Space4x.playerEmpire(app.state);
		if (!st || !player || st.empireId !== player.id) return;
		Space4x.queueBuild(app.state, id, defId);
		app.state.ui.inspect = { kind: "catalog", defId: defId, queueId: null };
		app.state.ui.stage = "build";
		after();
	};

	cmds.inspectBuild = function (kind, defId, queueId, culture) {
		app.state.ui.inspect = { kind: kind, defId: defId, queueId: queueId || null, culture: culture || null };
		if (kind === "catalog" || kind === "queue" || kind === "structure") {
			if (Space4x.settlementById(app.state, app.state.ui.selectedSettlementId)) app.state.ui.stage = "build";
		}
		after();
	};

	cmds.cancelBuild = function (queueId) {
		const id = app.state.ui.selectedSettlementId;
		const st = Space4x.settlementById(app.state, id);
		const player = Space4x.playerEmpire(app.state);
		if (!st || !player || st.empireId !== player.id) return;
		if (app.state.ui.inspect && app.state.ui.inspect.queueId === queueId) app.state.ui.inspect = null;
		Space4x.cancelBuild(app.state, id, queueId);
		after();
	};

	cmds.moveQueue = function (queueId, dir) {
		const id = app.state.ui.selectedSettlementId;
		const st = Space4x.settlementById(app.state, id);
		const player = Space4x.playerEmpire(app.state);
		if (!st || !player || st.empireId !== player.id) return;
		Space4x.moveQueueItem(app.state, id, queueId, dir);
		after();
	};

	cmds.reorderQueue = function (ids) {
		const id = app.state.ui.selectedSettlementId;
		const st = Space4x.settlementById(app.state, id);
		const player = Space4x.playerEmpire(app.state);
		if (!st || !player || st.empireId !== player.id) return;
		Space4x.reorderQueue(app.state, id, ids);
		after();
	};

	cmds.setResearch = function (techId) {
		const player = Space4x.playerEmpire(app.state);
		if (!player) return;
		const id = techId || app.state.ui.previewTechId;
		const tech = Space4x.techById(app.state, id);
		if (!tech) return;
		if (Space4x.techStatus(player, tech) !== "available" && player.research.currentProjectId !== tech.id) return;
		app.state.ui.previewTechId = tech.id;
		app.state.ui.selectedCategoryId = tech.categoryId;
		Space4x.setResearchProject(app.state, player.id, tech.id);
		after();
	};

	cmds.clearShipSelection = function () {
		Space4x.clearSelectedUnits(app.state);
		after();
	};

	cmds.sendShipTo = function (unitId, starId) {
		const unit = Space4x.unitById(app.state, unitId);
		if (unit && Space4x.shipCanTakeOrders(unit)) Space4x.addSelectedUnit(app.state, unit.id);
		cmds.sendSelectedToStar(starId);
	};

	cmds.sendSelectedToStar = function (starId) {
		const dest = Space4x.starById(app.state, starId);
		const player = Space4x.playerEmpire(app.state);
		if (!dest || !player) return;
		app.state.ui.selectedStarId = starId;
		app.state.ui.panel = "system";
		if (!Space4x.inRangeOfEmpire(app.state, player.id, dest.x, dest.y)) {
			after();
			return;
		}
		const ids = Space4x.orderableSelectedIds(app.state);
		if (!ids.length) {
			after();
			return;
		}
		for (let i = 0; i < ids.length; i++) {
			Space4x.setShipTarget(app.state, ids[i], starId);
		}
		after();
	};

	cmds.cancelShipOrders = function () {
		const ids = Space4x.orderableSelectedIds(app.state);
		for (let i = 0; i < ids.length; i++) {
			Space4x.clearShipTarget(app.state, ids[i]);
		}
		after();
	};

	cmds.pickSettle = function (unitId, bodyId) {
		const ok = Space4x.foundSettlement(app.state, unitId, bodyId);
		if (ok) {
			const home = Space4x.settlementOnBody(app.state, bodyId);
			if (home) {
				app.state.ui.selectedSettlementId = home.id;
				app.state.ui.selectedStarId = home.location.starId;
				app.state.ui.stage = "settlement";
			}
		}
		after();
	};

	cmds.followTodo = function (todoId) {
		const todos = app.state.todos;
		let todo = null;
		for (let i = 0; i < todos.length; i++) if (todos[i].id === todoId) todo = todos[i];
		if (!todo) return;
		if (todo.type === "assignJobs") cmds.selectSettlement(todo.settlementId);
		else if (todo.type === "emptyQueue") cmds.selectSettlement(todo.settlementId, "build");
		else if (todo.type === "pickTech") cmds.showResearch();
		else if (todo.type === "diploOffer" || todo.type === "firstContact") {
			if (app.state.ui.diploRivalId !== todo.rivalId) Space4x.resetDiploDraft(app.state);
			app.state.ui.diploRivalId = todo.rivalId;
			cmds.showDiplomacy();
		}
		else if (todo.type === "crushedRevolt") cmds.selectSettlement(todo.settlementId);
		else if (todo.type === "foundColony" || todo.type === "pickSettleBody") {
			app.state.ui.selectedUnitId = todo.unitId;
			app.state.ui.selectedUnitIds = todo.unitId ? [todo.unitId] : [];
			app.state.ui.selectedStarId = todo.starId;
			app.state.ui.stage = "galaxy";
			app.state.ui.panel = "system";
			after();
		} else cmds.setPanel("todo");
	};

	cmds.newGame = function () {
		cmds.stopAutoPlay();
		const gen = app.state.gen;
		app.state = Space4x.createInitialState();
		app.state.gen = gen;
		setPersistMessage("");
		after();
	};

	cmds.continueAutosave = function () {
		const envelope = Space4x.readAutosave();
		if (!envelope) {
			setPersistMessage("No autosave to continue.");
			after();
			return;
		}
		loadEnvelope(envelope);
	};

	cmds.saveSlot = function () {
		if (app.state.screen !== "play") return;
		const label = window.prompt("Save name", Space4x.defaultSaveLabel(app.state));
		if (label == null) return;
		const result = Space4x.writeSaveSlot(app.state, { label: label });
		setPersistMessage(result.ok ? "Saved." : result.reason);
		after();
	};

	cmds.loadSlot = function (id) {
		const envelope = Space4x.readSaveSlot(id);
		if (!envelope) {
			setPersistMessage("Save not found.");
			after();
			return;
		}
		loadEnvelope(envelope);
	};

	cmds.deleteSlot = function (id) {
		const result = Space4x.deleteSaveSlot(id);
		setPersistMessage(result.ok ? "Deleted." : (result.reason || "Could not delete save."));
		after();
	};

	cmds.exportSave = function () {
		if (app.state.screen !== "play") return;
		const envelope = Space4x.makeSaveEnvelope(app.state);
		const check = Space4x.validateSaveEnvelope(envelope);
		if (!check.ok) {
			setPersistMessage(check.reason);
			after();
			return;
		}
		const url = URL.createObjectURL(Space4x.toSaveFileBlob(envelope));
		const a = document.createElement("a");
		a.href = url;
		a.download = Space4x.saveFileName(envelope);
		a.click();
		URL.revokeObjectURL(url);
		setPersistMessage("File downloaded.");
		after();
	};

	cmds.importSave = function (text) {
		const parsed = Space4x.fromSaveFileText(text);
		if (!parsed.ok) {
			setPersistMessage(parsed.reason);
			after();
			return;
		}
		loadEnvelope(parsed.envelope);
	};

	cmds.pickSaveFile = function () {
		if (app.ui.saveFileInput) app.ui.saveFileInput.click();
	};

	cmds.quietAutosave = function () {
		if (app.state.screen !== "play") return;
		Space4x.writeAutosave(app.state);
	};

	return cmds;
};
