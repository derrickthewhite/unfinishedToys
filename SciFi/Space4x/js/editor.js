var Space4x = Space4x || {};

Space4x.editorFleetDesigns = function (state, hullDefId) {
	const host = Space4x.playerEmpire(state);
	const pack = host && host.shipDesigns && host.shipDesigns[hullDefId];
	return (pack && pack.list) || [];
};

Space4x.syncEditorFleetList = function (ul, emptyEl, state, side, cmds) {
	const rows = Space4x.editorFleetSide(state, side);
	if (emptyEl) emptyEl.hidden = rows.length > 0;
	if (!ul) return;
	Space4x.syncKeyedList(ul, rows.map(function (row, i) {
		return { id: side + "-" + i + "-" + row.designId, row: row, index: i };
	}), function (item) { return item.id; },
		function () {
			const li = document.createElement("li");
			const name = document.createElement("span");
			name.className = "editor-fleet-name";
			const count = document.createElement("input");
			count.type = "number";
			count.min = "1";
			count.max = "20";
			count.className = "editor-fleet-count";
			const del = document.createElement("button");
			del.type = "button";
			del.textContent = "Remove";
			li.appendChild(name);
			li.appendChild(count);
			li.appendChild(del);
			count.addEventListener("change", function () {
				cmds.setEditorFleetCount(side, Number(li.getAttribute("data-index")), count.value);
			});
			del.addEventListener("click", function () {
				cmds.removeEditorFleetShip(side, Number(li.getAttribute("data-index")));
			});
			return li;
		},
		function (li, item) {
			li.setAttribute("data-index", String(item.index));
			const host = Space4x.playerEmpire(state);
			const design = host ? Space4x.designById(host, item.row.hullDefId, item.row.designId) : null;
			const hull = Space4x.settingOf(state).builds[item.row.hullDefId];
			li.querySelector(".editor-fleet-name").textContent =
				(design ? design.name : item.row.designId) +
				(hull ? " · " + hull.name : "");
			const count = li.querySelector(".editor-fleet-count");
			if (document.activeElement !== count) count.value = String(item.row.count || 1);
		});
};

Space4x.syncEditorFleetStage = function (state, cmds) {
	if (!state || state.ui.stage !== "editorCombat") return;
	if (Space4x.ensureEmpireDesigns) {
		const host = Space4x.playerEmpire(state);
		if (host) Space4x.ensureEmpireDesigns(state, host);
	}
	const hullEl = document.getElementById("editor-fleet-hull");
	const classEl = document.getElementById("editor-fleet-class");
	let hull = (state.ui && state.ui.editorFleetHullId) || "cruiser";
	if (hullEl && document.activeElement !== hullEl) hullEl.value = hull;
	if (hullEl) hull = hullEl.value || hull;
	state.ui.editorFleetHullId = hull;
	const designs = Space4x.editorFleetDesigns(state, hull);
	if (classEl) {
		const prev = state.ui.editorFleetDesignId;
		let keep = false;
		classEl.innerHTML = "";
		for (let i = 0; i < designs.length; i++) {
			const opt = document.createElement("option");
			opt.value = designs[i].id;
			opt.textContent = designs[i].name;
			classEl.appendChild(opt);
			if (designs[i].id === prev) keep = true;
		}
		if (designs.length) {
			classEl.value = keep ? prev : designs[0].id;
			state.ui.editorFleetDesignId = classEl.value;
		} else {
			state.ui.editorFleetDesignId = null;
		}
	}
	Space4x.syncEditorFleetList(document.getElementById("editor-fleet-you"),
		document.getElementById("editor-fleet-you-empty"), state, "attacker", cmds);
	Space4x.syncEditorFleetList(document.getElementById("editor-fleet-opp"),
		document.getElementById("editor-fleet-opp-empty"), state, "defender", cmds);
	const note = document.getElementById("editor-fleet-note");
	if (note) {
		note.textContent = state.editorNote ||
			("You " + Space4x.editorFleetShipCount(state, "attacker") +
				" · Opponent " + Space4x.editorFleetShipCount(state, "defender"));
	}
};

Space4x.syncEditorFromState = function (app) {
	const ui = app.ui;
	const state = app.state;
	const stage = state.ui.stage;
	if (ui.stageDesign) ui.stageDesign.hidden = stage !== "design";
	if (ui.stageResearch) ui.stageResearch.hidden = stage !== "research";
	if (ui.stageEditorCombat) ui.stageEditorCombat.hidden = stage !== "editorCombat";
	if (ui.stageSpaceCombat) ui.stageSpaceCombat.hidden = stage !== "spaceCombat";
	const nav = document.getElementById("editor-nav");
	if (nav) {
		const navStage = stage === "spaceCombat" ? "editorCombat" : stage;
		const btns = nav.querySelectorAll("[data-stage]");
		for (let i = 0; i < btns.length; i++) {
			btns[i].classList.toggle("is-selected", btns[i].getAttribute("data-stage") === navStage);
		}
	}
	Space4x.syncResearchStage(ui, state, app.cmds);
	Space4x.syncDesignStage(ui, state, app.cmds);
	Space4x.syncEditorFleetStage(state, app.cmds);
	if (stage === "spaceCombat" && Space4x.syncSpaceCombatStage) {
		Space4x.syncSpaceCombatStage(ui, state, app.cmds);
		if (ui.btnSpaceCancel) {
			const battle = Space4x.spaceBattleById(state, state.ui.selectedSpaceBattleId);
			ui.btnSpaceCancel.hidden = !battle || !!battle.done;
		}
	}
	const player = Space4x.playerEmpire(state);
	const n = player && player.research ? (player.research.completedTechIds || []).length : 0;
	const status = document.getElementById("editor-status");
	if (status) {
		const extra = app.persistMessage || state.editorNote || "";
		status.textContent = n + " techs" + (extra ? " · " + extra : "");
	}
	const rangeEl = document.getElementById("editor-next-planet-range");
	const need = Space4x.ensureEditorNextPlanetRange(state);
	if (rangeEl && document.activeElement !== rangeEl) rangeEl.value = String(need);
	const reachEl = document.getElementById("editor-reach-status");
	if (reachEl && player) {
		const shipRange = Space4x.shipStats(state, player).range;
		const hasWarp = Space4x.empireHasWarp(state, player);
		const stuck = Space4x.aiEditorNeedsReach(state, player);
		if (!hasWarp) {
			reachEl.textContent = "Ship range " + shipRange + " · need warp to leave (stuck)";
		} else if (stuck) {
			reachEl.textContent = "Ship range " + shipRange + " < " + need + " (stuck)";
		} else {
			reachEl.textContent = "Ship range " + shipRange + " ≥ " + need + " (in range)";
		}
	}
	const log = document.getElementById("editor-research-log");
	if (log) Space4x.setText(log, state.editorNote || "");
};

Space4x.bindEditorUi = function (app) {
	const ui = app.ui;
	const cmds = app.cmds;
	const nav = document.getElementById("editor-nav");
	if (nav) {
		nav.addEventListener("click", function (ev) {
			const btn = ev.target.closest("[data-stage]");
			if (!btn) return;
			const stage = btn.getAttribute("data-stage");
			if (stage === "research") cmds.showResearch();
			else if (stage === "design") cmds.showDesign();
			else if (stage === "editorCombat") cmds.showEditorCombat();
		});
	}
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
	if (ui.btnResearchSelect) {
		ui.btnResearchSelect.addEventListener("click", function () {
			cmds.setResearch(app.state.ui.previewTechId);
		});
	}
	const btnReset = document.getElementById("btn-editor-reset");
	if (btnReset) btnReset.addEventListener("click", cmds.resetEditor);
	const btnRollRange = document.getElementById("btn-editor-roll-range");
	if (btnRollRange) btnRollRange.addEventListener("click", cmds.rollEditorNextPlanetRange);
	const rangeInput = document.getElementById("editor-next-planet-range");
	if (rangeInput) {
		rangeInput.addEventListener("change", cmds.setEditorNextPlanetRange);
		rangeInput.addEventListener("blur", cmds.setEditorNextPlanetRange);
	}
	const btnSpend = document.getElementById("btn-editor-spend-rp");
	if (btnSpend) btnSpend.addEventListener("click", function () { cmds.generateEditorResearch("points"); });
	const btnTechs = document.getElementById("btn-editor-n-techs");
	if (btnTechs) btnTechs.addEventListener("click", function () { cmds.generateEditorResearch("techs"); });
	const btnTier = document.getElementById("btn-editor-until-tier");
	if (btnTier) btnTier.addEventListener("click", function () { cmds.generateEditorResearch("tier"); });
	const btnResetTech = document.getElementById("btn-editor-reset-tech");
	if (btnResetTech) btnResetTech.addEventListener("click", cmds.resetEditorResearch);
	const hullEl = document.getElementById("editor-fleet-hull");
	if (hullEl) hullEl.addEventListener("change", cmds.changeEditorFleetHull);
	const classEl = document.getElementById("editor-fleet-class");
	if (classEl) classEl.addEventListener("change", cmds.changeEditorFleetClass);
	const addYou = document.getElementById("btn-editor-fleet-add-you");
	if (addYou) addYou.addEventListener("click", function () { cmds.addEditorFleetShip("attacker"); });
	const addOpp = document.getElementById("btn-editor-fleet-add-opp");
	if (addOpp) addOpp.addEventListener("click", function () { cmds.addEditorFleetShip("defender"); });
	const fight = document.getElementById("btn-editor-fleet-fight");
	if (fight) fight.addEventListener("click", cmds.startEditorFight);
	const clear = document.getElementById("btn-editor-fleet-clear");
	if (clear) clear.addEventListener("click", cmds.clearEditorFleets);
	if (ui.btnSpaceEndShip) ui.btnSpaceEndShip.addEventListener("click", cmds.endSpaceShip);
	if (ui.btnSpaceEndSide) ui.btnSpaceEndSide.addEventListener("click", cmds.endSpaceSide);
	if (ui.btnSpaceAutocombat) ui.btnSpaceAutocombat.addEventListener("click", cmds.toggleSpaceCombatAuto);
	if (ui.btnSpaceRetreat) ui.btnSpaceRetreat.addEventListener("click", cmds.orderSpaceRetreat);
	if (ui.btnBackGalaxySpace) ui.btnBackGalaxySpace.addEventListener("click", cmds.showGalaxy);
	if (ui.btnSpaceOk) ui.btnSpaceOk.addEventListener("click", cmds.dismissSpaceCombat);
	if (ui.btnSpaceCancel) ui.btnSpaceCancel.addEventListener("click", cmds.cancelEditorFight);
	if (Space4x.bindSpaceCombatInput) Space4x.bindSpaceCombatInput(app);
	window.addEventListener("pagehide", function () {
		Space4x.saveEditorState(app.state);
	});
};

Space4x.createEditorApp = function () {
	const app = {};
	app.ui = Space4x.captureUi();
	app.persistMessage = "";
	const saved = Space4x.loadEditorState();
	app.state = saved || Space4x.createEditorState();
	Space4x.ensureEditorNextPlanetRange(app.state);
	Space4x.sanitizeEditorCombatState(app.state);
	if (saved) {
		const emp = Space4x.playerEmpire(app.state);
		if (emp && Space4x.ensureEmpireDesigns) Space4x.ensureEmpireDesigns(app.state, emp);
	}
	app.cmds = Space4x.createCommands(app);
	app.sync = function () {
		Space4x.syncEditorFromState(app);
		Space4x.saveEditorState(app.state);
	};

	const showDesign = app.cmds.showDesign;
	app.cmds.showDesign = function () {
		Space4x.cancelEditorSpaceBattle(app.state);
		showDesign();
	};
	const showResearch = app.cmds.showResearch;
	app.cmds.showResearch = function () {
		Space4x.cancelEditorSpaceBattle(app.state);
		showResearch();
	};

	app.cmds.showEditorCombat = function () {
		Space4x.cancelEditorSpaceBattle(app.state);
		app.state.ui.stage = "editorCombat";
		app.sync();
	};

	app.cmds.showGalaxy = function () {
		app.cmds.showEditorCombat();
	};

	app.cmds.showSpaceCombat = function (battleId) {
		if (battleId) {
			app.state.ui.selectedSpaceBattleId = battleId;
			app.state.ui.spaceEnemyTokenId = null;
			if (Space4x.markSpaceBattleSeen) Space4x.markSpaceBattleSeen(app.state, battleId);
		}
		if (Space4x.ensureAllCombatBgSeeds) Space4x.ensureAllCombatBgSeeds(app.state);
		const battle = Space4x.spaceBattleById(app.state, app.state.ui.selectedSpaceBattleId);
		if (battle && !app.state.ui.spaceTokenId) {
			const side = Space4x.playerBattleSide(app.state, battle);
			const ships = Space4x.livingTokens(battle, side).filter(function (t) { return t.kind !== "missile"; });
			if (ships[0]) app.state.ui.spaceTokenId = ships[0].id;
		}
		app.state.ui.stage = "spaceCombat";
		app.sync();
	};

	app.cmds.dismissSpaceCombat = function () {
		const battleId = app.state.ui.selectedSpaceBattleId;
		if (battleId && Space4x.markSpaceBattleSeen) Space4x.markSpaceBattleSeen(app.state, battleId);
		Space4x.cancelEditorSpaceBattle(app.state);
		app.state.ui.stage = "editorCombat";
		app.sync();
	};

	app.cmds.cancelEditorFight = function () {
		Space4x.cancelEditorSpaceBattle(app.state);
		app.state.ui.stage = "editorCombat";
		app.state.editorNote = "Fight cancelled.";
		app.sync();
	};

	app.cmds.changeEditorFleetHull = function () {
		const hullEl = document.getElementById("editor-fleet-hull");
		app.state.ui.editorFleetHullId = hullEl ? hullEl.value : "cruiser";
		app.state.ui.editorFleetDesignId = null;
		app.sync();
	};

	app.cmds.changeEditorFleetClass = function () {
		const classEl = document.getElementById("editor-fleet-class");
		app.state.ui.editorFleetDesignId = classEl ? classEl.value : null;
		app.sync();
	};

	app.cmds.addEditorFleetShip = function (side) {
		const hullEl = document.getElementById("editor-fleet-hull");
		const classEl = document.getElementById("editor-fleet-class");
		const countEl = document.getElementById("editor-fleet-count");
		const hull = hullEl ? hullEl.value : app.state.ui.editorFleetHullId;
		const designId = classEl ? classEl.value : app.state.ui.editorFleetDesignId;
		const count = countEl ? countEl.value : 1;
		if (!hull || !designId) {
			app.state.editorNote = "No class to add. Open Designs first.";
			app.sync();
			return;
		}
		Space4x.addEditorFleetShip(app.state, side, hull, designId, count);
		app.state.editorNote = "";
		app.sync();
	};

	app.cmds.removeEditorFleetShip = function (side, index) {
		Space4x.removeEditorFleetShip(app.state, side, index);
		app.state.editorNote = "";
		app.sync();
	};

	app.cmds.setEditorFleetCount = function (side, index, count) {
		Space4x.setEditorFleetCount(app.state, side, index, count);
		app.state.editorNote = "";
		app.sync();
	};

	app.cmds.clearEditorFleets = function () {
		Space4x.clearEditorFleets(app.state);
		app.state.editorNote = "";
		app.sync();
	};

	app.cmds.startEditorFight = function () {
		const result = Space4x.startEditorSpaceBattle(app.state);
		if (!result.ok) {
			app.state.editorNote = result.reason;
			app.sync();
			return;
		}
		app.state.editorNote = "";
		app.cmds.showSpaceCombat(result.battle.id);
	};

	app.cmds.setResearch = function (techId) {
		const player = Space4x.playerEmpire(app.state);
		const id = techId || app.state.ui.previewTechId;
		const tech = Space4x.techById(app.state, id);
		if (!player || !tech) return;
		app.state.ui.previewTechId = tech.id;
		app.state.ui.selectedCategoryId = tech.categoryId;
		Space4x.toggleEmpireTech(app.state, player, tech.id);
		app.sync();
	};

	app.cmds.resetEditor = function () {
		if (!window.confirm("Reset the editor sandbox? Designs and research will be wiped.")) return;
		Space4x.clearEditorState();
		app.state = Space4x.createEditorState();
		app.persistMessage = "";
		app.sync();
	};

	app.cmds.resetEditorResearch = function () {
		const player = Space4x.playerEmpire(app.state);
		if (!player) return;
		Space4x.resetEmpireResearch(app.state, player);
		Space4x.refreshEditorDesigns(app.state);
		app.state.editorNote = "Research reset.";
		app.sync();
	};

	app.cmds.rollEditorNextPlanetRange = function () {
		const n = Space4x.randomizeEditorNextPlanetRange(app.state);
		app.state.editorNote = "Next planet range " + n + " (2d4).";
		app.sync();
	};

	app.cmds.setEditorNextPlanetRange = function () {
		const el = document.getElementById("editor-next-planet-range");
		if (!el) return;
		Space4x.setEditorNextPlanetRange(app.state, el.value);
		app.sync();
	};

	app.cmds.generateEditorResearch = function (mode) {
		const player = Space4x.playerEmpire(app.state);
		if (!player) return;
		const rpEl = document.getElementById("editor-rp");
		const nEl = document.getElementById("editor-n-techs");
		const tierEl = document.getElementById("editor-stop-tier");
		const stopRaw = tierEl && tierEl.value !== "" ? Number(tierEl.value) : null;
		const opts = {};
		if (stopRaw != null && !isNaN(stopRaw)) opts.stopTier = stopRaw;
		if (mode === "points") {
			const n = rpEl ? Number(rpEl.value) : 0;
			if (!(n > 0)) {
				app.state.editorNote = "Enter research points to spend.";
				app.sync();
				return;
			}
			opts.points = n;
		} else if (mode === "techs") {
			const n = nEl ? Number(nEl.value) : 0;
			if (!(n > 0)) {
				app.state.editorNote = "Enter how many techs to complete.";
				app.sync();
				return;
			}
			opts.techCount = n;
		} else if (mode === "tier") {
			if (opts.stopTier == null) {
				app.state.editorNote = "Enter a tier to stop at.";
				app.sync();
				return;
			}
		}
		const result = Space4x.generateAiResearch(app.state, player, opts);
		Space4x.refreshEditorDesigns(app.state);
		if (!result.count) {
			app.state.editorNote = "No techs completed.";
		} else {
			app.state.editorNote = "Finished " + result.count + " techs (" + result.spent + " RP): " +
				result.names.join(", ");
		}
		app.sync();
	};

	Space4x.bindEditorUi(app);
	app.sync();
	return app;
};

window.addEventListener("load", function () {
	Space4x.app = Space4x.createEditorApp();
});
