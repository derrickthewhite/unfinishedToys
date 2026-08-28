var Space4x = Space4x || {};

Space4x.bindUi = function (app) {
	const ui = app.ui;
	const cmds = app.cmds;
	ui.generationForm.addEventListener("submit", cmds.startGame);
	ui.genAddOpponent.addEventListener("click", cmds.addOpponent);
	ui.btnEndTurn.addEventListener("click", cmds.endTurn);
	ui.btnAutoPlay.addEventListener("click", cmds.toggleAutoPlay);
	ui.btnTodos.addEventListener("click", function () { cmds.setPanel("todo"); });
	ui.btnNewGame.addEventListener("click", cmds.newGame);
	if (ui.btnChromeNewGame) ui.btnChromeNewGame.addEventListener("click", cmds.newGame);
	if (ui.chromePlayAs) {
		ui.chromePlayAs.addEventListener("change", function () {
			cmds.becomeEmpire(ui.chromePlayAs.value);
		});
	}
	if (ui.btnContinue) ui.btnContinue.addEventListener("click", cmds.continueAutosave);
	if (ui.btnSaveSlot) ui.btnSaveSlot.addEventListener("click", cmds.saveSlot);
	if (ui.btnSaveFile) ui.btnSaveFile.addEventListener("click", cmds.exportSave);
	if (ui.btnLoadFile) ui.btnLoadFile.addEventListener("click", cmds.pickSaveFile);
	if (ui.saveFileInput) {
		ui.saveFileInput.addEventListener("change", function () {
			const file = ui.saveFileInput.files && ui.saveFileInput.files[0];
			ui.saveFileInput.value = "";
			if (!file) return;
			const reader = new FileReader();
			reader.onload = function () {
				cmds.importSave(String(reader.result || ""));
			};
			reader.onerror = function () {
				app.persistMessage = "Could not read that file.";
				app.sync();
			};
			reader.readAsText(file);
		});
	}
	ui.btnBackGalaxy.addEventListener("click", cmds.showGalaxy);
	if (ui.btnBackSettlement) ui.btnBackSettlement.addEventListener("click", cmds.showSettlement);
	if (ui.btnSettleOpenBuild) ui.btnSettleOpenBuild.addEventListener("click", cmds.showBuild);
	if (ui.btnSettleGetSettlers) ui.btnSettleGetSettlers.addEventListener("click", cmds.getMoreSettlers);
	ui.btnBackGalaxyResearch.addEventListener("click", cmds.showGalaxy);
	ui.btnBackGalaxyEmpire.addEventListener("click", cmds.showGalaxy);
	if (ui.btnBackGalaxySpies) ui.btnBackGalaxySpies.addEventListener("click", cmds.showGalaxy);
	if (ui.btnBackGalaxyDiplomacy) ui.btnBackGalaxyDiplomacy.addEventListener("click", cmds.showGalaxy);
	if (ui.btnBackGalaxyReport) ui.btnBackGalaxyReport.addEventListener("click", cmds.showGalaxy);
	if (ui.btnDoneShipSelect) ui.btnDoneShipSelect.addEventListener("click", cmds.clearShipSelection);
	if (ui.btnCancelShipOrder) ui.btnCancelShipOrder.addEventListener("click", cmds.cancelShipOrders);
	ui.chromeResearch.addEventListener("click", cmds.showResearch);
	ui.btnResearchSelect.addEventListener("click", function () {
		cmds.setResearch(app.state.ui.previewTechId);
	});
	ui.btnEmpireMove.addEventListener("click", cmds.queuePopMove);
	if (ui.btnSettleTroopMove) ui.btnSettleTroopMove.addEventListener("click", cmds.queueTroopMove);
	if (ui.settleTroopCount) {
		ui.settleTroopCount.addEventListener("input", function () {
			const st = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
			Space4x.syncTroopMoveCost(ui, app.state, st);
		});
	}
	if (ui.settleTroopDef) {
		ui.settleTroopDef.addEventListener("change", function () {
			const st = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
			Space4x.syncTroopMoveCost(ui, app.state, st);
		});
	}
	if (ui.btnSettleInspectQueue) {
		ui.btnSettleInspectQueue.addEventListener("click", function () {
			const inspect = app.state.ui.inspect;
			if (inspect && inspect.defId) cmds.queueBuild(inspect.defId);
		});
	}
	ui.empireMoveCount.addEventListener("input", function () {
		Space4x.syncEmpireMoveCost(ui, app.state);
	});
	ui.empireMoveFrom.addEventListener("change", function () {
		app.state.ui.moveFromId = ui.empireMoveFrom.value;
		Space4x.syncEmpireMoveCost(ui, app.state);
	});
	ui.empireMoveTo.addEventListener("change", function () {
		app.state.ui.moveToId = ui.empireMoveTo.value;
		Space4x.syncEmpireMoveCost(ui, app.state);
	});
	Space4x.bindMapInput(app);
	Space4x.bindJobBoard(app);
	Space4x.bindSettleQueue(app);
	Space4x.bindSpyBoard(app);
	if (ui.btnDiploWar) ui.btnDiploWar.addEventListener("click", cmds.diploDeclareWar);
	if (ui.btnDiploSend) ui.btnDiploSend.addEventListener("click", cmds.diploSend);
	if (ui.btnDiploAccept) ui.btnDiploAccept.addEventListener("click", cmds.diploAccept);
	if (ui.btnDiploRefuse) ui.btnDiploRefuse.addEventListener("click", cmds.diploRefuse);
	if (ui.btnDiploPactPeace) ui.btnDiploPactPeace.addEventListener("click", function () { cmds.diploAddPact("peace"); });
	if (ui.btnDiploPactTrade) ui.btnDiploPactTrade.addEventListener("click", function () { cmds.diploAddPact("trade"); });
	if (ui.btnDiploPactResearch) ui.btnDiploPactResearch.addEventListener("click", function () { cmds.diploAddPact("research"); });
	if (ui.btnDiploPactPassage) ui.btnDiploPactPassage.addEventListener("click", function () { cmds.diploAddPact("passage"); });
	if (ui.btnDiploPactSpies) ui.btnDiploPactSpies.addEventListener("click", function () { cmds.diploAddPact("stopSpies"); });
	if (ui.btnDiploGiveMoney) ui.btnDiploGiveMoney.addEventListener("click", function () { cmds.diploAddMoney("give"); });
	if (ui.btnDiploWantMoney) ui.btnDiploWantMoney.addEventListener("click", function () { cmds.diploAddMoney("want"); });
	if (ui.btnDiploGiveWorld) ui.btnDiploGiveWorld.addEventListener("click", function () { cmds.diploAddWorld("give"); });
	if (ui.btnDiploWantWorld) ui.btnDiploWantWorld.addEventListener("click", function () { cmds.diploAddWorld("want"); });
	if (ui.btnDiploGiveShip) ui.btnDiploGiveShip.addEventListener("click", function () { cmds.diploAddShip("give"); });
	if (ui.btnDiploWantShip) ui.btnDiploWantShip.addEventListener("click", function () { cmds.diploAddShip("want"); });
	if (ui.btnDiploGiveTroop) ui.btnDiploGiveTroop.addEventListener("click", function () { cmds.diploAddTroops("give"); });
	if (ui.btnDiploWantTroop) ui.btnDiploWantTroop.addEventListener("click", function () { cmds.diploAddTroops("want"); });
	ui.sideNav.addEventListener("click", function (ev) {
		const btn = ev.target.closest("button");
		if (!btn) return;
		const stage = btn.getAttribute("data-stage");
		if (stage === "galaxy") {
			cmds.showGalaxy();
			return;
		}
		if (stage === "research") {
			cmds.showResearch();
			return;
		}
		if (stage === "empire") {
			cmds.showEmpire();
			return;
		}
		if (stage === "report") {
			cmds.showReport();
			return;
		}
		if (stage === "spies") {
			cmds.showSpies();
			return;
		}
		if (stage === "diplomacy") {
			cmds.showDiplomacy();
			return;
		}
		const panel = btn.getAttribute("data-panel");
		if (panel) cmds.setPanel(panel);
	});
	window.addEventListener("resize", function () {
		if (app.state.screen !== "play") return;
		if (app.state.ui.stage === "galaxy") Space4x.drawMap(ui, app.state);
		if (app.state.ui.stage === "report") Space4x.syncReportStage(ui, app.state);
	});
	window.addEventListener("pagehide", function () {
		cmds.quietAutosave();
	});
};

Space4x.createApp = function () {
	const app = {};
	app.ui = Space4x.captureUi();
	app.state = Space4x.createInitialState();
	app.persistMessage = "";
	app.cmds = Space4x.createCommands(app);
	app.sync = function () {
		Space4x.syncUiFromState(app);
	};
	Space4x.bindUi(app);
	app.sync();
	return app;
};

window.addEventListener("load", function () {
	Space4x.app = Space4x.createApp();
});
