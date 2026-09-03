var Space4x = Space4x || {};

Space4x.bindUi = function (app) {
	const ui = app.ui;
	const cmds = app.cmds;
	ui.generationForm.addEventListener("submit", cmds.startGame);
	ui.genAddOpponent.addEventListener("click", cmds.addOpponent);
	if (ui.genSizePreset) {
		ui.genSizePreset.addEventListener("change", function () {
			cmds.setGalaxyPreset(ui.genSizePreset.value);
		});
	}
	ui.btnEndTurn.addEventListener("click", cmds.endTurn);
	ui.btnAutoPlay.addEventListener("click", cmds.toggleAutoPlay);
	ui.btnTodos.addEventListener("click", function () { cmds.setPanel("todo"); });
	ui.btnNewGame.addEventListener("click", cmds.newGame);
	if (ui.gameModal) {
		ui.gameModal.addEventListener("click", function () {
			if (ui.gameModalPrompt) Space4x.cancelPromptModal(ui);
			else Space4x.hideModal(ui);
		});
	}
	if (ui.gameModalCard) {
		ui.gameModalCard.addEventListener("click", function (ev) {
			ev.stopPropagation();
		});
	}
	if (ui.gameModalForm) {
		ui.gameModalForm.addEventListener("submit", function (ev) {
			ev.preventDefault();
			Space4x.submitPromptModal(ui);
		});
	}
	if (ui.gameModalCancel) {
		ui.gameModalCancel.addEventListener("click", function () {
			Space4x.cancelPromptModal(ui);
		});
	}
	if (ui.chromePlayAs) {
		ui.chromePlayAs.addEventListener("change", function () {
			cmds.becomeEmpire(ui.chromePlayAs.value);
		});
	}
	if (ui.systemRename) {
		ui.systemRename.addEventListener("submit", function (ev) {
			ev.preventDefault();
			const starId = app.state.ui.selectedStarId;
			const name = ui.systemRenameInput ? ui.systemRenameInput.value : "";
			if (starId) cmds.renameStar(starId, name);
		});
	}
	if (ui.btnChromeNewGame) ui.btnChromeNewGame.addEventListener("click", cmds.newGame);
	if (ui.btnContinue) ui.btnContinue.addEventListener("click", function () { cmds.continueAutosave(); });
	if (ui.btnSaveSlot) ui.btnSaveSlot.addEventListener("click", cmds.saveSlot);
	if (ui.btnLoadGame) ui.btnLoadGame.addEventListener("click", cmds.showLoadGame);
	if (ui.btnMenuBack) ui.btnMenuBack.addEventListener("click", cmds.showMenu);
	if (ui.btnMenuContinue) ui.btnMenuContinue.addEventListener("click", function () { cmds.continueAutosave(); });
	if (ui.btnSaveFile) ui.btnSaveFile.addEventListener("click", cmds.exportSave);
	if (ui.btnExportSnapshot) ui.btnExportSnapshot.addEventListener("click", cmds.exportSnapshot);
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
	if (ui.btnBackGalaxyCombat) ui.btnBackGalaxyCombat.addEventListener("click", cmds.showGalaxy);
	if (ui.btnBackGalaxyRevolt) ui.btnBackGalaxyRevolt.addEventListener("click", cmds.showGalaxy);
	if (ui.btnBackGalaxySpace) ui.btnBackGalaxySpace.addEventListener("click", cmds.showGalaxy);
	if (ui.btnSpaceOk) ui.btnSpaceOk.addEventListener("click", cmds.dismissSpaceCombat);
	if (ui.btnBackGalaxyDesign) ui.btnBackGalaxyDesign.addEventListener("click", cmds.showGalaxy);
	if (ui.btnBackGalaxyReport) ui.btnBackGalaxyReport.addEventListener("click", cmds.showGalaxy);
	if (ui.btnSpaceEndShip) ui.btnSpaceEndShip.addEventListener("click", cmds.endSpaceShip);
	if (ui.btnSpaceEndSide) ui.btnSpaceEndSide.addEventListener("click", cmds.endSpaceSide);
	if (ui.btnSpaceAutocombat) ui.btnSpaceAutocombat.addEventListener("click", cmds.toggleSpaceCombatAuto);
	if (ui.btnSpaceRetreat) ui.btnSpaceRetreat.addEventListener("click", cmds.orderSpaceRetreat);
	if (ui.designHullCruiser) ui.designHullCruiser.addEventListener("click", function () { cmds.selectDesignHull("cruiser"); });
	if (ui.designHullBattleship) ui.designHullBattleship.addEventListener("click", function () { cmds.selectDesignHull("battleship"); });
	if (ui.designHullStation) ui.designHullStation.addEventListener("click", function () { cmds.selectDesignHull("defenseStation"); });
	if (ui.btnDesignNew) ui.btnDesignNew.addEventListener("click", cmds.addDesignClass);
	if (ui.btnDesignDefault) ui.btnDesignDefault.addEventListener("click", cmds.setDefaultDesign);
	if (ui.btnDesignAuto) ui.btnDesignAuto.addEventListener("click", cmds.autoUpdateDesign);
	if (ui.btnDesignExport) ui.btnDesignExport.addEventListener("click", cmds.exportObserverDesign);
	if (ui.designNameInput) {
		ui.designNameInput.addEventListener("change", cmds.renameDesign);
		ui.designNameInput.addEventListener("blur", cmds.renameDesign);
	}
	if (ui.btnDesignArtPrev) ui.btnDesignArtPrev.addEventListener("click", function () { cmds.cycleDesignArt(-1); });
	if (ui.btnDesignArtNext) ui.btnDesignArtNext.addEventListener("click", function () { cmds.cycleDesignArt(1); });
	if (ui.designShipArt) ui.designShipArt.addEventListener("click", function () { cmds.cycleDesignArt(1); });
	if (ui.btnRefitClose) ui.btnRefitClose.addEventListener("click", cmds.closeRefitModal);
	if (ui.btnRefitBuild) ui.btnRefitBuild.addEventListener("click", cmds.queueShipRefit);
	if (ui.btnRefitScrap) ui.btnRefitScrap.addEventListener("click", cmds.scrapShip);
	if (ui.refitModal) {
		ui.refitModal.addEventListener("click", function (ev) {
			if (ev.target === ui.refitModal) cmds.closeRefitModal();
		});
	}
	if (ui.refitModalCard) ui.refitModalCard.addEventListener("click", function (ev) { ev.stopPropagation(); });
	Space4x.bindSpaceCombatInput(app);
	if (ui.btnDoneShipSelect) ui.btnDoneShipSelect.addEventListener("click", cmds.clearShipSelection);
	if (ui.btnCancelShipOrder) ui.btnCancelShipOrder.addEventListener("click", cmds.cancelShipOrders);
	if (ui.btnEngageSpace) ui.btnEngageSpace.addEventListener("click", cmds.engageSpaceCombat);
	ui.chromeResearch.addEventListener("click", cmds.showResearch);
	ui.btnResearchSelect.addEventListener("click", function () {
		cmds.setResearch(app.state.ui.previewTechId);
	});
	ui.btnEmpireMove.addEventListener("click", cmds.queuePopMove);
	if (ui.btnSettleTroopMove) ui.btnSettleTroopMove.addEventListener("click", cmds.queueTroopMove);
	if (ui.btnSettleTroopFleet) ui.btnSettleTroopFleet.addEventListener("click", cmds.queueTroopFleet);
	Space4x.bindEmpireTransfers(app);
	Space4x.bindGarrisonTransfers(app);
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
	if (ui.btnRushBuild) ui.btnRushBuild.addEventListener("click", cmds.rushBuild);
	if (ui.btnSpyIncite) {
		ui.btnSpyIncite.addEventListener("click", function () {
			if (ui.spyInciteTarget && ui.spyInciteTarget.value) {
				cmds.inciteRevolt(ui.spyInciteTarget.value);
			}
		});
	}
	if (ui.spyInciteTarget) {
		ui.spyInciteTarget.addEventListener("change", function () {
			app.sync();
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
	if (ui.btnDiploReport) ui.btnDiploReport.addEventListener("click", cmds.showEmpireReport);
	if (ui.btnBackDiplomacyReport) ui.btnBackDiplomacyReport.addEventListener("click", cmds.showDiplomacy);
	if (ui.btnDiploSend) ui.btnDiploSend.addEventListener("click", cmds.diploSend);
	if (ui.btnDiploBalance) ui.btnDiploBalance.addEventListener("click", cmds.diploBalance);
	if (ui.btnDiploAccept) ui.btnDiploAccept.addEventListener("click", cmds.diploAccept);
	if (ui.btnDiploRefuse) ui.btnDiploRefuse.addEventListener("click", cmds.diploRefuse);
	if (ui.diploPactProposals) {
		const pactInputs = ui.diploPactProposals.querySelectorAll("input[data-pact]");
		for (let i = 0; i < pactInputs.length; i++) {
			pactInputs[i].addEventListener("change", function () {
				cmds.diploSetPact(this.getAttribute("data-pact"), this.checked);
			});
		}
	}
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
		if (stage === "design") {
			cmds.showDesign();
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
		if (panel === "combat") {
			cmds.openCombatPanel();
			return;
		}
		if (panel) cmds.setPanel(panel);
	});
	window.addEventListener("resize", function () {
		if (app.state.screen !== "play") return;
		if (app.state.ui.stage === "galaxy") Space4x.drawMap(ui, app.state);
		if (app.state.ui.stage === "report") Space4x.syncReportStage(ui, app.state);
		if (app.state.ui.stage === "combat") Space4x.syncCombatStage(ui, app.state, app.cmds);
		if (app.state.ui.stage === "revolt") Space4x.syncRevoltStage(ui, app.state, app.cmds);
		if (app.state.ui.stage === "spaceCombat") Space4x.syncSpaceCombatStage(ui, app.state, app.cmds);
		if (app.state.ui.stage === "design") Space4x.syncDesignStage(ui, app.state, app.cmds);
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
