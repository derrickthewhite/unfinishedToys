var Space4x = Space4x || {};

Space4x.movePopToJob = function (state, settlement, job, delta) {
	if (delta > 0) {
		const cap = Space4x.jobCap(state, settlement, job);
		const have = Space4x.countJob(settlement, job);
		let n = Math.min(delta, cap === Infinity ? delta : cap - have);
		for (let i = 0; i < settlement.pops.length && n > 0; i++) {
			if (settlement.pops[i].job !== "idle") continue;
			if (job === "research" && !Space4x.popCanResearch(settlement.pops[i])) continue;
			settlement.pops[i].job = job;
			n -= 1;
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
		if (app.state.screen === "play" && app.state.ui.stage === "combat") {
			requestAnimationFrame(function () { Space4x.syncCombatStage(app.ui, app.state, app.cmds); });
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
		Space4x.pullGenerationForm(app.ui, app.state.gen, false);
	};

	cmds.startGame = function (ev) {
		if (ev) ev.preventDefault();
		cmds.stopAutoPlay();
		cmds.readGenerationForm();
		Space4x.startNewGame(app.state);
		after();
		const player = Space4x.playerEmpire(app.state);
		const homes = player ? Space4x.settlementsOf(app.state, player.id) : [];
		if (homes.length) {
			const starId = homes[0].location.starId;
			const star = Space4x.starById(app.state, starId);
			Space4x.showPromptModal(app.ui, {
				message: "Name your home star system.",
				value: star ? star.name : "",
				onOk: function (name) {
					Space4x.applyStarName(app.state, starId, name);
					app.sync();
				}
			});
		}
	};

	cmds.addOpponent = function () {
		const gen = app.state.gen;
		gen.opponents.push({
			id: "slot-" + (gen.opponents.length + 1) + "-" + Date.now(),
			aiId: "dumb",
			enabled: true,
			cultureId: Space4x.RANDOM_CULTURE,
			colorId: Space4x.RANDOM_COLOR || "random"
		});
		Space4x.ensureGenColors(gen);
		after();
	};

	cmds.setPlayerCulture = function (cultureId) {
		app.state.gen.playerCultureId = cultureId;
		after();
	};

	cmds.setGalaxyPreset = function (id) {
		if (id === "custom") return;
		Space4x.applyGalaxyPreset(app.state.gen, id);
		after();
	};

	cmds.setPlayerColor = function (colorId) {
		Space4x.setGenColor(app.state.gen, "player", colorId);
		after();
	};

	cmds.setOpponentCulture = function (slotId, cultureId) {
		const list = app.state.gen.opponents;
		for (let i = 0; i < list.length; i++) {
			if (list[i].id === slotId) list[i].cultureId = cultureId;
		}
		after();
	};

	cmds.setOpponentColor = function (slotId, colorId) {
		Space4x.setGenColor(app.state.gen, slotId, colorId);
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

	cmds.showLoadGame = function () {
		cmds.setPanel("load");
	};

	cmds.showMenu = function () {
		cmds.setPanel("menu");
	};

	cmds.showGalaxy = function () {
		app.state.ui.stage = "galaxy";
		if (app.state.ui.selectedStarId) app.state.ui.panel = "system";
		after();
	};

	cmds.becomeEmpire = function (empireId) {
		if (app.state.screen !== "play") return;
		cmds.stopAutoPlay();
		if (empireId === Space4x.OBSERVER_ID) {
			if (Space4x.becomeObserver(app.state)) after();
			return;
		}
		if (!Space4x.becomeEmpire(app.state, empireId)) return;
		after();
	};

	cmds.renameStar = function (starId, newName) {
		const player = Space4x.playerEmpire(app.state);
		if (!player || !Space4x.starCanRename(app.state, player.id, starId)) return;
		if (!Space4x.applyStarName(app.state, starId, newName)) return;
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

	cmds.showEmpireReport = function () {
		if (!app.state.ui.diploRivalId) return;
		app.state.ui.stage = "empireReport";
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

	cmds.diploSetPact = function (id, on) {
		const draft = Space4x.diploDraftOf(app.state);
		const idx = draft.pacts.indexOf(id);
		if (on) {
			if (idx < 0) draft.pacts.push(id);
		} else if (idx >= 0) {
			draft.pacts.splice(idx, 1);
		}
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
		const them = Space4x.empireById(app.state, toId);
		const draft = Space4x.diploDraftOf(app.state);
		draft.pacts = Space4x.filterProposedPacts(app.state, player, them, draft.pacts);
		const result = Space4x.submitOffer(app.state, player.id, toId, draft);
		if (result && result.ok) {
			Space4x.resetDiploDraft(app.state);
			Space4x.showModal(app.ui, "Offer sent to " + (them ? them.name : "them") + ". You will hear back next turn.");
		} else {
			Space4x.showModal(app.ui, "This offer is not valid. Add treaties or assets, or check that you can afford what you offer.");
		}
		after();
	};

	cmds.diploBalance = function () {
		const player = Space4x.playerEmpire(app.state);
		const toId = app.state.ui.diploRivalId;
		if (!player || !toId) return;
		const them = Space4x.empireById(app.state, toId);
		const draft = Space4x.diploDraftOf(app.state);
		const result = Space4x.balanceDiploDraft(app.state, player, them, draft);
		Space4x.showModal(app.ui, result.message);
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
			const player = Space4x.researchViewEmpire(app.state);
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

	cmds.showDesign = function () {
		app.state.ui.stage = "design";
		const host = Space4x.designHost(app.state);
		if (host) Space4x.ensureEmpireDesigns(app.state, host);
		if (!app.state.ui.designHullId) app.state.ui.designHullId = "cruiser";
		after();
	};

	cmds.showReport = function () {
		app.state.ui.stage = "report";
		after();
	};

	cmds.showCombat = function (combatId) {
		if (combatId) {
			app.state.ui.selectedCombatId = combatId;
			Space4x.markGroundCombatSeen(app.state, combatId);
			Space4x.rebuildTodos(app.state);
		}
		app.state.ui.stage = "combat";
		app.state.ui.panel = "combat";
		after();
	};

	cmds.showRevolt = function (revoltId) {
		if (revoltId) {
			app.state.ui.selectedRevoltId = revoltId;
			Space4x.markRevoltSummarySeen(app.state, revoltId);
			Space4x.rebuildTodos(app.state);
		}
		app.state.ui.stage = "revolt";
		after();
	};

	cmds.showSpaceCombat = function (battleId) {
		if (battleId) {
			app.state.ui.selectedSpaceBattleId = battleId;
			app.state.ui.spaceEnemyTokenId = null;
			Space4x.markSpaceBattleSeen(app.state, battleId);
			Space4x.rebuildTodos(app.state);
		}
		Space4x.ensureAllCombatBgSeeds(app.state);
		const battle = Space4x.spaceBattleById(app.state, app.state.ui.selectedSpaceBattleId);
		if (battle && !app.state.ui.spaceTokenId) {
			const side = Space4x.playerBattleSide(app.state, battle);
			const ships = Space4x.livingTokens(battle, side).filter(function (t) { return t.kind !== "missile"; });
			if (ships[0]) app.state.ui.spaceTokenId = ships[0].id;
		}
		app.state.ui.stage = "spaceCombat";
		app.state.ui.panel = "combat";
		after();
	};

	cmds.dismissSpaceCombat = function () {
		const battleId = app.state.ui.selectedSpaceBattleId;
		if (battleId) Space4x.markSpaceBattleSeen(app.state, battleId);
		Space4x.rebuildTodos(app.state);
		if (Space4x.maybeResumeTurnAfterSpace) Space4x.maybeResumeTurnAfterSpace(app.state);
		app.state.ui.stage = "galaxy";
		app.state.ui.panel = "todo";
		after();
	};

	cmds.engageSpaceCombat = function () {
		const starId = app.state.ui.selectedStarId;
		if (!starId) return;
		const player = Space4x.playerEmpire(app.state);
		const sit = player ? Space4x.spaceCombatSituation(app.state, starId, player.id) : null;
		if (sit && sit.hasOpenBattle && sit.openBattleId) {
			cmds.showSpaceCombat(sit.openBattleId);
			return;
		}
		const battle = Space4x.engageSpaceCombatAtStar(app.state, starId);
		Space4x.rebuildTodos(app.state);
		if (battle && !battle.done) cmds.showSpaceCombat(battle.id);
		else if (sit && sit.text) app.state.turnLog.push(sit.text);
		after();
	};

	cmds.selectCombat = function (combatId) {
		app.state.ui.selectedCombatId = combatId;
		Space4x.markGroundCombatSeen(app.state, combatId);
		Space4x.rebuildTodos(app.state);
		if (app.state.ui.stage !== "combat") app.state.ui.stage = "combat";
		after();
	};

	cmds.openCombatPanel = function () {
		app.state.ui.panel = "combat";
		const space = Space4x.playerSpaceBattles(app.state);
		const ground = Space4x.playerGroundCombats(app.state);
		if (space.length && (!app.state.ui.selectedSpaceBattleId || Space4x.playerOpenSpaceBattles(app.state).length)) {
			const open = Space4x.playerOpenSpaceBattles(app.state);
			const pick = open[0] || space[0];
			cmds.showSpaceCombat(pick.id);
			return;
		}
		if (ground.length && !app.state.ui.selectedCombatId) {
			app.state.ui.selectedCombatId = ground[0].id;
		}
		if (ground.length) app.state.ui.stage = "combat";
		after();
	};

	cmds.selectSpaceToken = function (tokenId) {
		app.state.ui.spaceTokenId = tokenId;
		app.state.ui.spaceWeaponId = null;
		after();
	};

	cmds.selectSpaceEnemyToken = function (tokenId) {
		app.state.ui.spaceEnemyTokenId = tokenId;
		after();
	};

	cmds.selectSpaceWeapon = function (weaponId) {
		app.state.ui.spaceWeaponId = weaponId;
		after();
	};

	cmds.spaceGridClick = function (x, y) {
		const battle = Space4x.spaceBattleById(app.state, app.state.ui.selectedSpaceBattleId);
		if (!battle) return;
		Space4x.playerSpaceGridAct(app.state, battle, x, y);
		after();
	};

	cmds.endSpaceShip = function () {
		const battle = Space4x.spaceBattleById(app.state, app.state.ui.selectedSpaceBattleId);
		if (!battle) return;
		Space4x.endSpaceShip(app.state, battle, app.state.ui.spaceTokenId);
		after();
	};

	cmds.endSpaceSide = function () {
		const battle = Space4x.spaceBattleById(app.state, app.state.ui.selectedSpaceBattleId);
		if (!battle || battle._aiAnim) return;
		Space4x.endSpaceSide(app.state, battle);
		Space4x.rebuildTodos(app.state);
		after();
	};

	cmds.toggleSpaceCombatAuto = function () {
		app.state.ui.spaceCombatAuto = !app.state.ui.spaceCombatAuto;
		after();
	};

	cmds.orderSpaceRetreat = function () {
		const battle = Space4x.spaceBattleById(app.state, app.state.ui.selectedSpaceBattleId);
		if (!battle || battle._aiAnim) return;
		if (!Space4x.orderSpaceRetreat(app.state, battle, app.state.ui.spaceTokenId)) return;
		Space4x.checkBattleEnd(app.state, battle);
		after();
	};

	cmds.openRefitModal = function () {
		const id = app.state.ui.selectedSettlementId;
		const st = Space4x.settlementById(app.state, id);
		const player = Space4x.playerEmpire(app.state);
		if (!st || !player || st.empireId !== player.id) return;
		if (Space4x.countStructure(st, "spaceDock") <= 0) {
			Space4x.showModal(app.ui, "Need a Space Dock to retrofit.");
			return;
		}
		app.state.ui.refit = { unitId: null, designId: null };
		Space4x.showRefitModal(app.ui, app.state, cmds);
		after();
	};

	cmds.closeRefitModal = function () {
		Space4x.hideRefitModal(app.ui);
		after();
	};

	cmds.selectRefitShip = function (unitId) {
		if (!app.state.ui.refit) app.state.ui.refit = { unitId: null, designId: null };
		app.state.ui.refit.unitId = unitId;
		app.state.ui.refit.designId = null;
		Space4x.syncRefitModal(app.ui, app.state, cmds);
	};

	cmds.selectRefitDesign = function (designId) {
		if (!app.state.ui.refit) app.state.ui.refit = { unitId: null, designId: null };
		app.state.ui.refit.designId = designId;
		Space4x.syncRefitModal(app.ui, app.state, cmds);
	};

	cmds.queueShipRefit = function () {
		const id = app.state.ui.selectedSettlementId;
		const sel = app.state.ui.refit || {};
		if (!Space4x.queueShipRefit(app.state, id, sel.unitId, sel.designId)) return;
		Space4x.hideRefitModal(app.ui);
		app.state.ui.stage = "build";
		after();
	};

	cmds.scrapShip = function () {
		const id = app.state.ui.selectedSettlementId;
		const sel = app.state.ui.refit || {};
		if (!Space4x.scrapShip(app.state, id, sel.unitId)) return;
		if (app.state.ui.refit) {
			app.state.ui.refit.unitId = null;
			app.state.ui.refit.designId = null;
		}
		Space4x.syncRefitModal(app.ui, app.state, cmds);
		after();
	};

	cmds.selectDesignHull = function (hullId) {
		app.state.ui.designHullId = hullId;
		app.state.ui.designId = null;
		after();
	};

	cmds.selectDesign = function (designId) {
		app.state.ui.designId = designId;
		after();
	};

	cmds.addDesignClass = function () {
		const host = Space4x.designHost(app.state);
		if (!host) return;
		const design = Space4x.addNamedDesign(app.state, host, app.state.ui.designHullId || "cruiser");
		if (design) app.state.ui.designId = design.id;
		after();
	};

	cmds.setDefaultDesign = function () {
		const host = Space4x.designHost(app.state);
		if (!host) return;
		Space4x.setActiveDesign(host, app.state.ui.designHullId || "cruiser", app.state.ui.designId);
		after();
	};

	cmds.autoUpdateDesign = function () {
		const host = Space4x.designHost(app.state);
		if (!host) return;
		Space4x.autoUpdateDesign(app.state, host, app.state.ui.designHullId || "cruiser");
		after();
	};

	cmds.renameDesign = function () {
		const host = Space4x.designHost(app.state);
		if (!host || !app.ui.designNameInput) return;
		Space4x.renameDesign(host, app.state.ui.designHullId || "cruiser", app.state.ui.designId, app.ui.designNameInput.value);
		after();
	};

	cmds.cycleDesignArt = function (delta) {
		const host = Space4x.designHost(app.state);
		if (!host || !app.state.ui.designId) return;
		Space4x.cycleDesignArtIndex(app.state, host, app.state.ui.designHullId || "cruiser", app.state.ui.designId, delta);
		after();
	};

	cmds.addDesignLoad = function (itemId) {
		const host = Space4x.designHost(app.state);
		if (!host) return;
		Space4x.addDesignLoadItem(app.state, host, app.state.ui.designHullId || "cruiser", app.state.ui.designId, itemId);
		after();
	};

	cmds.removeDesignLoad = function (index) {
		const host = Space4x.designHost(app.state);
		if (!host) return;
		Space4x.removeDesignLoadAt(host, app.state.ui.designHullId || "cruiser", app.state.ui.designId, index);
		after();
	};

	cmds.adjustDesignLoadCount = function (index, delta) {
		const host = Space4x.designHost(app.state);
		if (!host) return;
		Space4x.adjustDesignLoadCount(app.state, host, app.state.ui.designHullId || "cruiser", app.state.ui.designId, index, delta);
		after();
	};

	cmds.setDesignLoadCount = function (index, count) {
		const host = Space4x.designHost(app.state);
		if (!host) return;
		const hull = app.state.ui.designHullId || "cruiser";
		const design = Space4x.designById(host, hull, app.state.ui.designId);
		if (!design) return;
		const max = Space4x.designGroupMaxCount(app.state, design, hull, index);
		Space4x.setDesignLoadCount(app.state, host, hull, app.state.ui.designId, index, Math.min(count, max));
		after();
	};

	cmds.exportObserverDesign = function () {
		if (!Space4x.isObserver(app.state)) return;
		const host = Space4x.designHost(app.state);
		if (!host) return;
		const hull = app.state.ui.designHullId || "cruiser";
		const design = Space4x.designById(host, hull, app.state.ui.designId) || Space4x.activeDesign(host, hull);
		if (!design) return;
		const payload = {
			type: "space4x-ship-design",
			version: 1,
			settingId: app.state.settingId,
			hullDefId: hull,
			design: {
				name: design.name,
				hullDefId: design.hullDefId || hull,
				load: (design.load || []).map(function (e) {
					return { itemId: e.itemId, count: e.count != null ? e.count : 1 };
				})
			}
		};
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		const safe = String(design.name || "design").replace(/[^\w\-]+/g, "_").slice(0, 40);
		a.href = url;
		a.download = safe + "-" + hull + ".json";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	cmds.goToCombatLocation = function (combatId) {
		const combat = Space4x.groundCombatById(app.state, combatId);
		if (!combat) return;
		const st = combat.settlementId ? Space4x.settlementById(app.state, combat.settlementId) : null;
		if (st) {
			cmds.selectSettlement(st.id);
			return;
		}
		if (combat.starId) {
			app.state.ui.selectedStarId = combat.starId;
			app.state.ui.selectedSettlementId = null;
			app.state.ui.stage = "galaxy";
			app.state.ui.panel = "system";
			after();
		}
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
		const player = Space4x.researchViewEmpire(app.state);
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

	cmds.selectStar = function (starId, opts) {
		app.state.ui.selectedStarId = starId;
		app.state.ui.stage = "galaxy";
		app.state.ui.panel = "system";
		if (!opts || !opts.keepShips) Space4x.clearSelectedUnits(app.state);
		after();
	};

	cmds.selectSettlement = function (id, stage) {
		const st = Space4x.settlementById(app.state, id);
		if (!st) return;
		if (app.state.ui.selectedSettlementId !== id) {
			if (Space4x.clearJobSel) Space4x.clearJobSel(app.state);
			Space4x.clearEmpireTroopSel(app.state);
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
		Space4x.addSelectedUnit(app.state, id);
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
		for (let i = 0; i < ids.length; i++) {
			const unit = Space4x.unitById(app.state, ids[i]);
			if (unit) Space4x.addSelectedUnit(app.state, unit.id);
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
		const sel = app.state.ui.empireTroopSel;
		const toId = app.ui.settleTroopTo.value;
		if (sel && sel.ids.length && sel.settlementId === from.id) {
			Space4x.queueTroopMoveByIds(app.state, from.id, toId, sel.ids);
			Space4x.clearEmpireTroopSel(app.state);
			after();
			return;
		}
		const parsed = Space4x.parseTroopStackId(app.ui.settleTroopDef.value);
		const count = parseInt(app.ui.settleTroopCount.value, 10) || 0;
		Space4x.queueTroopMove(app.state, from.id, toId, parsed.defId, count, parsed.culture);
		after();
	};

	cmds.queueTroopFleet = function () {
		const player = Space4x.playerEmpire(app.state);
		const from = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
		if (!player || !from || from.empireId !== player.id) return;
		const sel = app.state.ui.empireTroopSel;
		if (sel && sel.ids.length && sel.settlementId === from.id) {
			Space4x.queueTroopFleetByIds(app.state, from.id, sel.ids);
			Space4x.clearEmpireTroopSel(app.state);
			after();
			return;
		}
		const parsed = Space4x.parseTroopStackId(app.ui.settleTroopDef.value);
		const count = parseInt(app.ui.settleTroopCount.value, 10) || 0;
		Space4x.queueTroopFleet(app.state, from.id, parsed.defId, count, parsed.culture);
		after();
	};

	cmds.invadeSettlement = function (bodyId) {
		const player = Space4x.playerEmpire(app.state);
		const st = Space4x.settlementOnBody(app.state, bodyId);
		if (!player || !st) return;
		const fleets = Space4x.invasionFleetsForSettlement(app.state, player.id, st);
		if (!fleets.length) {
			const star = Space4x.starById(app.state, st.location.starId);
			const hint = star ? Space4x.invasionSituation(app.state, star.id, player.id) : null;
			if (hint && hint.text) app.state.turnLog.push(hint.text);
			else if (Space4x.atWar(player, st.empireId)) {
				app.state.turnLog.push("Troop transports with soldiers must be in orbit here to invade.");
			} else {
				app.state.turnLog.push("Declare war before invading " + Space4x.settlementLabel(app.state, st) + ".");
			}
			after();
			return;
		}
		const ids = fleets.map(function (u) { return u.id; });
		if (!Space4x.queueInvasion(app.state, ids, st.id)) {
			if (Space4x.hasPendingInvasion(app.state, st.id)) {
				app.state.turnLog.push("Invasion of " + Space4x.settlementLabel(app.state, st) + " already ordered.");
			}
		}
		after();
	};

	cmds.unloadTroops = function (bodyId) {
		const player = Space4x.playerEmpire(app.state);
		const st = Space4x.settlementOnBody(app.state, bodyId);
		if (!player || !st) return;
		const fleet = Space4x.unloadFleetForSettlement(app.state, player.id, st);
		if (!fleet) return;
		Space4x.unloadTroopFleet(app.state, fleet.id, st.id);
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
		if (defId === "shipRefit") {
			cmds.openRefitModal();
			return;
		}
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

	cmds.rushBuild = function () {
		const id = app.state.ui.selectedSettlementId;
		const st = Space4x.settlementById(app.state, id);
		const player = Space4x.playerEmpire(app.state);
		if (!st || !player || st.empireId !== player.id) return;
		if (!Space4x.rushBuild(app.state, id)) return;
		after();
	};

	cmds.inciteRevolt = function (settlementId) {
		const player = Space4x.playerEmpire(app.state);
		if (!player) return;
		const result = Space4x.inciteRevolt(app.state, player.id, settlementId);
		if (!result.ok) Space4x.showModal(app.ui, result.reason || "Could not incite revolt.");
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
		if (unit && Space4x.playerCanOrderUnit(app.state, unit)) Space4x.addSelectedUnit(app.state, unit.id);
		cmds.sendSelectedToStar(starId);
	};

	cmds.sendSelectedToStar = function (starId) {
		const dest = Space4x.starById(app.state, starId);
		const player = Space4x.playerEmpire(app.state);
		if (!dest || !player) return;
		app.state.ui.selectedStarId = starId;
		app.state.ui.panel = "system";
		const ids = Space4x.orderableSelectedIds(app.state);
		if (!ids.length) {
			after();
			return;
		}
		for (let i = 0; i < ids.length; i++) {
			const unit = Space4x.unitById(app.state, ids[i]);
			const fromStar = unit ? Space4x.unitStarId(app.state, unit) : null;
			if (Space4x.wouldLeaveSystemWithoutWarp(app.state, player, fromStar, starId)) {
				Space4x.showModal(app.ui, Space4x.settingMessage(app.state, "noWarpDrive"));
				after();
				return;
			}
		}
		if (!Space4x.inRangeOfEmpireAtCell(app.state, player.id, dest.x, dest.y)) {
			after();
			return;
		}
		let sent = 0;
		for (let i = 0; i < ids.length; i++) {
			if (Space4x.setShipTarget(app.state, ids[i], starId)) sent += 1;
		}
		if (sent) Space4x.clearSelectedUnits(app.state);
		after();
	};

	cmds.cancelShipOrders = function () {
		const ids = Space4x.orderableSelectedIds(app.state);
		for (let i = 0; i < ids.length; i++) {
			Space4x.clearShipTarget(app.state, ids[i]);
		}
		Space4x.clearSelectedUnits(app.state);
		after();
	};

	cmds.pickSettle = function (unitId, bodyId) {
		const unit = Space4x.unitById(app.state, unitId);
		const starId = unit ? Space4x.unitStarId(app.state, unit) : null;
		const empireId = unit ? unit.empireId : null;
		const wasFirst = !!(starId && empireId && !Space4x.starHasEmpireSettlement(app.state, starId, empireId));
		const foreignHere = !!(starId && empireId && Space4x.starHasForeignSettlement(app.state, starId, empireId));
		const ok = Space4x.foundSettlement(app.state, unitId, bodyId);
		if (ok) {
			const home = Space4x.settlementOnBody(app.state, bodyId);
			if (home) {
				app.state.ui.selectedSettlementId = home.id;
				app.state.ui.selectedStarId = home.location.starId;
				app.state.ui.stage = "settlement";
			}
			const player = Space4x.playerEmpire(app.state);
			if (player && player.id === empireId && wasFirst && starId && !foreignHere) {
				const star = Space4x.starById(app.state, starId);
				Space4x.showPromptModal(app.ui, {
					message: "Name this star system.",
					value: star ? star.name : "",
					onOk: function (name) {
						Space4x.applyStarName(app.state, starId, name);
						app.sync();
					}
				});
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
		else if (todo.type === "emptyQueue") cmds.selectSettlement(todo.settlementId);
		else if (todo.type === "pickTech") cmds.showResearch();
		else if (todo.type === "diploOffer" || todo.type === "revoltJoin" || todo.type === "firstContact" || todo.type === "diploResponse") {
			const player = Space4x.playerEmpire(app.state);
			if (todo.type === "firstContact") Space4x.receiveDiplomacyWelcome(app.state, player, todo.rivalId);
			else if (todo.type === "diploResponse") Space4x.dismissOfferResponse(app.state, todo.responseIndex);
			else if (todo.offerId) Space4x.markOfferSeen(app.state, todo.offerId);
			Space4x.rebuildTodos(app.state);
			if (app.state.ui.diploRivalId !== todo.rivalId) Space4x.resetDiploDraft(app.state);
			app.state.ui.diploRivalId = todo.rivalId;
			cmds.showDiplomacy();
		}
		else if (todo.type === "crushedRevolt") cmds.selectSettlement(todo.settlementId);
		else if (todo.type === "revoltSummary") cmds.showRevolt(todo.revoltId);
		else if (todo.type === "revoltJoined") {
			Space4x.markRevoltJoinSeen(app.state, todo.joinId);
			Space4x.rebuildTodos(app.state);
			if (todo.rivalId) {
				if (app.state.ui.diploRivalId !== todo.rivalId) Space4x.resetDiploDraft(app.state);
				app.state.ui.diploRivalId = todo.rivalId;
				cmds.showDiplomacy();
			} else {
				after();
			}
		}
		else if (todo.type === "groundCombat") cmds.showCombat(todo.combatId);
		else if (todo.type === "spaceCombat") cmds.showSpaceCombat(todo.battleId);
		else if (todo.type === "spaceLoss") {
			Space4x.markSpaceLossSeen(app.state, todo.lossId);
			Space4x.rebuildTodos(app.state);
			if (todo.starId) {
				app.state.ui.selectedStarId = todo.starId;
				app.state.ui.stage = "galaxy";
				app.state.ui.panel = "system";
			}
			after();
		}
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

	cmds.continueAutosave = function (id) {
		const key = id === "autosave-checkpoint"
			? Space4x.SAVE_CHECKPOINT_KEY
			: Space4x.SAVE_AUTOSAVE_KEY;
		const envelope = Space4x.readAutosave(key);
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

	cmds.exportSnapshot = function () {
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
		a.download = Space4x.snapshotFileName(envelope);
		a.click();
		URL.revokeObjectURL(url);
		setPersistMessage("Snapshot downloaded.");
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
