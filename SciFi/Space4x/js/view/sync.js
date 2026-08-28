var Space4x = Space4x || {};

Space4x.syncCultureBlurb = function (uiBits, state, cultureId) {
	const blurb = Space4x.cultureBlurb(state, cultureId);
	if (uiBits.art) {
		if (blurb.art) Space4x.setCultureImg(uiBits.art, state, blurb.id);
		else {
			uiBits.art.removeAttribute("src");
			uiBits.art.hidden = true;
			uiBits.art.alt = blurb.name;
		}
	}
	Space4x.setText(uiBits.name, blurb.name);
	Space4x.setText(uiBits.text, blurb.text);
};

Space4x.syncCulturePicker = function (root, state, selectedId, onPick) {
	if (!root) return;
	const cultures = Space4x.culturesOf(state);
	const items = [{ id: Space4x.RANDOM_CULTURE, name: "Random", kind: "random" }];
	for (let i = 0; i < cultures.length; i++) {
		items.push({ id: cultures[i].id, name: cultures[i].name, kind: "culture" });
	}
	Space4x.syncKeyedList(root, items, function (c) { return c.id; },
		function (item) {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.type = "button";
			if (item.kind === "random") {
				const mark = document.createElement("span");
				mark.className = "gen-random-mark";
				mark.textContent = "?";
				btn.appendChild(mark);
			} else {
				const img = document.createElement("img");
				img.alt = "";
				btn.appendChild(img);
			}
			const name = document.createElement("span");
			name.className = "gen-culture-name";
			btn.appendChild(name);
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				onPick(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, item) {
			const btn = row.querySelector("button");
			row.querySelector(".gen-culture-name").textContent = item.name;
			if (item.kind !== "random") {
				Space4x.setCultureImg(row.querySelector("img"), state, item.id);
			}
			const c = item.kind === "random" ? null : Space4x.cultureById(state, item.id);
			btn.title = item.kind === "random" ?
				"A species is chosen when the game starts." :
				item.name + " — " + Space4x.cultureSummary(c);
			btn.classList.toggle("is-selected", selectedId === item.id);
		}
	);
};

Space4x.syncGeneration = function (ui, state, cmds) {
	const gen = state.gen;
	const focus = document.activeElement;
	if (focus !== ui.genSeed) ui.genSeed.value = gen.seed;
	if (focus !== ui.genWidth) ui.genWidth.value = String(gen.width);
	if (focus !== ui.genHeight) ui.genHeight.value = String(gen.height);
	if (focus !== ui.genStars) ui.genStars.value = String(gen.starCount);
	if (focus !== ui.genSetting) ui.genSetting.value = gen.settingId;
	if (focus !== ui.genAutoJobs) ui.genAutoJobs.checked = gen.autoAssignJobs;
	if (ui.genHideUnvisited && focus !== ui.genHideUnvisited) {
		ui.genHideUnvisited.checked = gen.hideUnvisitedSystems !== false;
	}

	const cultures = Space4x.culturesOf(state);
	if (ui.genPlayerSpecies) ui.genPlayerSpecies.hidden = !cultures.length;
	if (!gen.playerCultureId) gen.playerCultureId = Space4x.RANDOM_CULTURE;
	Space4x.syncCulturePicker(ui.genPlayerCultures, state, gen.playerCultureId, function (id) {
		cmds.setPlayerCulture(id);
	});
	if (ui.genPlayerBlurb) {
		Space4x.syncCultureBlurb({
			art: ui.genPlayerBlurbArt,
			name: ui.genPlayerBlurbName,
			text: ui.genPlayerBlurbText
		}, state, gen.playerCultureId);
	}

	Space4x.syncKeyedList(ui.genOpponents, gen.opponents, function (s) { return s.id; },
		function () {
			const li = document.createElement("li");
			li.className = "gen-opp";
			const head = document.createElement("div");
			head.className = "gen-opp-head";
			const img = document.createElement("img");
			img.className = "gen-opp-art";
			img.alt = "";
			const label = document.createElement("span");
			label.className = "gen-opp-ai";
			const pick = document.createElement("button");
			pick.type = "button";
			pick.className = "gen-opp-pick";
			pick.textContent = "Choose species";
			const rm = document.createElement("button");
			rm.type = "button";
			rm.textContent = "Remove";
			head.appendChild(img);
			head.appendChild(label);
			head.appendChild(pick);
			head.appendChild(rm);
			const grid = document.createElement("ul");
			grid.className = "gen-culture-grid";
			const blurb = document.createElement("div");
			blurb.className = "gen-culture-blurb";
			const blurbArt = document.createElement("img");
			blurbArt.className = "gen-blurb-art";
			blurbArt.alt = "";
			const blurbCopy = document.createElement("div");
			const blurbName = document.createElement("h3");
			blurbName.className = "gen-blurb-name";
			const blurbText = document.createElement("p");
			blurbText.className = "gen-blurb-text muted";
			blurbCopy.appendChild(blurbName);
			blurbCopy.appendChild(blurbText);
			blurb.appendChild(blurbArt);
			blurb.appendChild(blurbCopy);
			li.appendChild(head);
			li.appendChild(grid);
			li.appendChild(blurb);
			pick.addEventListener("click", function () {
				cmds.chooseOpponentSpecies(li.getAttribute("data-id"));
			});
			rm.addEventListener("click", function () {
				cmds.removeOpponent(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, slot) {
			const random = Space4x.isRandomCulture(slot.cultureId);
			row.querySelector(".gen-opp-ai").textContent = random ? "Dumb AI · Random species" : "Dumb AI";
			row.querySelector(".gen-opp-pick").hidden = !random;
			const art = row.querySelector(".gen-opp-art");
			if (random) {
				art.removeAttribute("src");
				art.hidden = true;
				art.alt = "Random";
			} else {
				Space4x.setCultureImg(art, state, slot.cultureId);
			}
			const grid = row.querySelector(".gen-culture-grid");
			const blurb = row.querySelector(".gen-culture-blurb");
			grid.hidden = random;
			blurb.hidden = random;
			if (!random) {
				Space4x.syncCulturePicker(grid, state, slot.cultureId, function (id) {
					cmds.setOpponentCulture(row.getAttribute("data-id"), id);
				});
				Space4x.syncCultureBlurb({
					art: blurb.querySelector(".gen-blurb-art"),
					name: blurb.querySelector(".gen-blurb-name"),
					text: blurb.querySelector(".gen-blurb-text")
				}, state, slot.cultureId);
			}
		}
	);
};

Space4x.syncSaveUi = function (ui, app) {
	const msg = app.persistMessage || "";
	function status(node) {
		if (!node) return;
		Space4x.setText(node, msg);
		node.hidden = !msg;
	}
	status(ui.genSaveStatus);
	status(ui.chromeSaveStatus);
	const autosave = Space4x.readAutosave();
	if (ui.btnContinue) {
		ui.btnContinue.hidden = !autosave;
		if (autosave) {
			ui.btnContinue.textContent = "Continue · " + (autosave.label || ("Turn " + autosave.turn));
		}
	}
	if (!ui.genSaveList) return;
	const slots = Space4x.listSaveSlots();
	if (ui.genSavesEmpty) ui.genSavesEmpty.hidden = slots.length > 0;
	const cmds = app.cmds;
	Space4x.syncKeyedList(ui.genSaveList, slots, function (s) { return s.id; },
		function () {
			const li = document.createElement("li");
			li.className = "gen-save-row";
			const name = document.createElement("span");
			const load = document.createElement("button");
			load.type = "button";
			load.textContent = "Load";
			const del = document.createElement("button");
			del.type = "button";
			del.textContent = "Delete";
			li.appendChild(name);
			li.appendChild(load);
			li.appendChild(del);
			load.addEventListener("click", function () {
				cmds.loadSlot(li.getAttribute("data-id"));
			});
			del.addEventListener("click", function () {
				cmds.deleteSlot(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, item) {
			row.querySelector("span").textContent = item.label || ("Turn " + item.turn);
		}
	);
};

Space4x.syncChrome = function (ui, state) {
	const player = Space4x.playerEmpire(state);
	Space4x.setText(ui.chromeSetting, Space4x.settingOf(state).name);
	Space4x.setText(ui.chromeTurn, state.turn);
	if (ui.chromePlayAs) {
		const ids = [];
		for (let i = 0; i < state.empires.length; i++) ids.push(state.empires[i].id);
		const key = ids.join(",");
		if (ui.chromePlayAs.getAttribute("data-ids") !== key) {
			while (ui.chromePlayAs.firstChild) ui.chromePlayAs.removeChild(ui.chromePlayAs.firstChild);
			for (let i = 0; i < state.empires.length; i++) {
				const opt = document.createElement("option");
				opt.value = state.empires[i].id;
				opt.textContent = state.empires[i].name;
				ui.chromePlayAs.appendChild(opt);
			}
			ui.chromePlayAs.setAttribute("data-ids", key);
		}
		if (document.activeElement !== ui.chromePlayAs) {
			ui.chromePlayAs.value = player ? player.id : "";
		}
	}
	if (!player) return;
	Space4x.setText(ui.chromeMoney, Space4x.fmtMoney(player.stockpiles.money));
	if (ui.chromeMoneyLine) {
		const f = Space4x.empireMoneyForecast(state, player.id);
		const bits = ["Stockpile " + Space4x.fmtMoney(f.stockpile), "Income +" + Space4x.fmtMoney(f.income)];
		if (f.trade) bits.push("Trade +" + Space4x.fmtMoney(f.trade));
		for (let i = 0; i < f.lines.length; i++) bits.push(f.lines[i]);
		bits.push("Net " + (f.net >= 0 ? "+" : "") + Space4x.fmtMoney(f.net) + " this turn");
		ui.chromeMoneyLine.title = bits.join("\n");
	}
	const homes = Space4x.settlementsOf(state, player.id);
	let food = 0;
	let pops = 0;
	for (let i = 0; i < homes.length; i++) {
		food += Space4x.produceSettlement(state, homes[i], player).food;
		pops += homes[i].pops.length;
	}
	Space4x.setText(ui.chromeFoodProd, food);
	Space4x.setText(ui.chromeFoodNeed, pops);
	const hulls = Space4x.empireFreighterUse(state, player.id);
	Space4x.setText(ui.chromeFreighters, hulls.owned);
	Space4x.setText(ui.chromeFreightersUsed, hulls.busy);
	let researchText = "Research —";
	if (player.research.currentProjectId) {
		const tech = Space4x.techById(state, player.research.currentProjectId);
		const pct = tech && tech.cost ? Math.floor(100 * player.research.progress / tech.cost) : 0;
		researchText = (tech ? tech.name : "?") + " " + pct + "%";
		if (pct >= 50) {
			const chance = Math.round((pct - 50) * 2);
			researchText += " early " + chance + "%";
		}
	}
	Space4x.setText(ui.chromeResearch, researchText);
	Space4x.setText(ui.chromeTodoCount, state.todos.length);
	Space4x.setText(ui.btnAutoPlay, state.ui.autoPlaying ? "Pause" : "Auto Play");
	ui.btnEndTurn.disabled = !!state.winnerEmpireId || Space4x.blockingTodos(state);
	ui.btnAutoPlay.disabled = !!state.winnerEmpireId || Space4x.blockingTodos(state);
};

Space4x.syncPanels = function (ui, state) {
	if (!ui.panels[state.ui.panel]) state.ui.panel = "todo";
	const names = Object.keys(ui.panels);
	for (let i = 0; i < names.length; i++) {
		ui.panels[names[i]].hidden = names[i] !== state.ui.panel;
	}
};

Space4x.syncTodos = function (ui, state, cmds) {
	ui.todoEmpty.hidden = state.todos.length > 0;
	Space4x.syncKeyedList(ui.todoList, state.todos, function (t) { return t.id; },
		function (todo) {
			const li = document.createElement("li");
			const text = document.createElement("span");
			const go = document.createElement("button");
			go.type = "button";
			go.textContent = "Go";
			li.appendChild(text);
			li.appendChild(go);
			go.addEventListener("click", function () {
				cmds.followTodo(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, todo) {
			row.querySelector("span").textContent = (todo.blocking ? "[!] " : "") + todo.text;
		}
	);
};

Space4x.syncStage = function (ui, state) {
	const stage = state.ui.stage;
		ui.canvas.hidden = stage !== "galaxy";
		ui.stageSettlement.hidden = stage !== "settlement";
		if (ui.stageBuild) ui.stageBuild.hidden = stage !== "build";
		ui.stageResearch.hidden = stage !== "research";
	ui.stageEmpire.hidden = stage !== "empire";
	if (ui.stageSpies) ui.stageSpies.hidden = stage !== "spies";
	if (ui.stageDiplomacy) ui.stageDiplomacy.hidden = stage !== "diplomacy";
	if (ui.stageReport) ui.stageReport.hidden = stage !== "report";
};

Space4x.syncSystem = function (ui, state, cmds) {
	Space4x.pruneShipSelection(state);
	const star = Space4x.starById(state, state.ui.selectedStarId);
	const picked = Space4x.selectedUnits(state);
	if (!star && !picked.length) {
		Space4x.setText(ui.systemName, "No system selected");
		Space4x.setText(ui.systemPos, "");
		Space4x.syncKeyedList(ui.systemBodies, [], function () { return ""; }, function () { return document.createElement("li"); }, function () {});
		Space4x.syncFleetList(ui.systemFleets, [], state, cmds);
		Space4x.setText(ui.systemSelected, "No ship selected.");
		if (ui.btnDoneShipSelect) ui.btnDoneShipSelect.hidden = true;
		if (ui.btnCancelShipOrder) ui.btnCancelShipOrder.hidden = true;
		if (ui.systemSurvey) {
			ui.systemSurvey.hidden = true;
			Space4x.setText(ui.systemSurvey, "");
		}
		return;
	}
	const player = Space4x.playerEmpire(state);
	if (star) {
		Space4x.setText(ui.systemName, star.name);
		Space4x.setText(ui.systemPos, "(" + star.x + ", " + star.y + ")");
	} else {
		Space4x.setText(ui.systemName, "In flight");
		Space4x.setText(ui.systemPos, "");
	}
	const explored = !star ? true : (player ? Space4x.starIsExplored(state, player.id, star.id) : true);
	if (ui.systemSurvey) {
		ui.systemSurvey.hidden = explored;
		Space4x.setText(ui.systemSurvey, explored ? "" : "Unexplored. Send a ship here to survey the planets.");
	}
	const founderShips = player && star && explored ? Space4x.foundingShipsAtStar(state, player.id, star.id) : [];
	const bodies = star && explored ? star.bodies : [];
	Space4x.syncKeyedList(ui.systemBodies, bodies, function (b) { return b.id; },
		function () {
			const li = document.createElement("li");
			li.className = "system-body";
			const canvas = document.createElement("canvas");
			canvas.width = 48;
			canvas.height = 48;
			canvas.className = "system-planet";
			const text = document.createElement("span");
			text.className = "system-body-text";
			const open = document.createElement("button");
			open.type = "button";
			open.textContent = "Open";
			open.className = "btn-open";
			const found = document.createElement("button");
			found.type = "button";
			found.textContent = "Found";
			found.className = "btn-found";
			li.appendChild(canvas);
			li.appendChild(text);
			li.appendChild(open);
			li.appendChild(found);
			function goSettle() {
				const home = Space4x.settlementOnBody(state, li.getAttribute("data-id"));
				if (home) cmds.selectSettlement(home.id);
			}
			canvas.addEventListener("click", goSettle);
			text.addEventListener("click", goSettle);
			open.addEventListener("click", goSettle);
			found.addEventListener("click", function () {
				const here = Space4x.starById(state, state.ui.selectedStarId);
				const emp = Space4x.playerEmpire(state);
				if (!here || !emp) return;
				const ships = Space4x.foundingShipsAtStar(state, emp.id, here.id);
				let unit = Space4x.unitById(state, state.ui.selectedUnitId);
				if (!unit || ships.indexOf(unit) < 0) unit = ships[0];
				if (unit) cmds.pickSettle(unit.id, li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, body) {
			const canvas = row.querySelector("canvas");
			Space4x.drawPlanet(canvas, body);
			const home = Space4x.settlementOnBody(state, body.id);
			let extra = "";
			if (home) {
				extra = " — " + home.name + " · " + home.pops.length + " " + Space4x.peopleWord(home.pops.length);
			}
			row.querySelector("span").textContent = body.name + extra + "\n" + Space4x.bodyCaption(body, state);
			row.querySelector(".btn-open").hidden = !home;
			const legal = star ? Space4x.emptyLegalBodies(state, star, player && player.id) : [];
			let can = false;
			for (let i = 0; i < legal.length; i++) if (legal[i].id === body.id) can = true;
			row.querySelector(".btn-found").hidden = !can || !founderShips.length;
			row.querySelector("canvas").style.cursor = home ? "pointer" : "default";
		}
	);
	const ships = star ? Space4x.shipsAtStar(state, star.id).filter(function (u) {
		return !player || Space4x.unitVisibleTo(state, player.id, u);
	}) : [];
	for (let i = 0; i < picked.length; i++) {
		if (ships.indexOf(picked[i]) < 0 && (!player || Space4x.unitVisibleTo(state, player.id, picked[i]))) {
			ships.push(picked[i]);
		}
	}
	Space4x.syncFleetList(ui.systemFleets, ships, state, cmds);
	const selectedIds = state.ui.selectedUnitIds || [];
	const unit = Space4x.unitById(state, state.ui.selectedUnitId);
	let inspectOnly = picked.length > 0;
	for (let i = 0; i < picked.length; i++) {
		if (Space4x.shipCanTakeOrders(picked[i])) inspectOnly = false;
	}
	const inspectNote = inspectOnly ? " Cannot be given orders." : "";
	if (selectedIds.length > 1) {
		const names = [];
		for (let i = 0; i < selectedIds.length; i++) {
			const u = Space4x.unitById(state, selectedIds[i]);
			if (u) names.push(Space4x.unitLabel(state, u));
		}
		Space4x.setText(ui.systemSelected, "Selected: " + selectedIds.length + " ships (" + names.join(", ") + ")." + inspectNote);
	} else if (!unit) {
		Space4x.setText(ui.systemSelected, "No ship selected. Click a fleet on the map or in this list.");
	} else {
		const emp = Space4x.empireById(state, unit.empireId);
		Space4x.setText(ui.systemSelected, "Selected: " + (emp ? emp.name + " " : "") + Space4x.unitLabel(state, unit) + " — " + Space4x.unitPlaceLabel(state, unit) + inspectNote);
	}
	if (ui.btnDoneShipSelect) ui.btnDoneShipSelect.hidden = !unit && !selectedIds.length;
	let cancelable = 0;
	for (let i = 0; i < selectedIds.length; i++) {
		const u = Space4x.unitById(state, selectedIds[i]);
		if (u && u.targetStarId && Space4x.shipCanTakeOrders(u)) cancelable += 1;
	}
	if (ui.btnCancelShipOrder) {
		ui.btnCancelShipOrder.hidden = cancelable === 0;
		ui.btnCancelShipOrder.disabled = cancelable === 0;
		Space4x.setText(ui.btnCancelShipOrder, cancelable > 1 ? "Cancel " + cancelable + " orders" : "Cancel order");
	}
};

Space4x.syncFleetList = function (root, units, state, cmds) {
	Space4x.syncKeyedList(root, units, function (u) { return u.id; },
		function () {
			const li = document.createElement("li");
			li.className = "fleet-row";
			const btn = document.createElement("button");
			btn.type = "button";
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				cmds.selectUnit(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, unit) {
			const emp = Space4x.empireById(state, unit.empireId);
			row.querySelector("button").textContent = (emp ? emp.name + " · " : "") + Space4x.unitLabel(state, unit) + " — " + Space4x.unitPlaceLabel(state, unit);
			row.classList.toggle("is-selected", Space4x.unitIsSelected(state, unit.id));
		}
	);
};

Space4x.syncSettleInspect = function (ui, state, st, mine) {
	if (!ui.settleInspectName) return;
	const inspect = state.ui.inspect;
	const empty = !st || !inspect || !inspect.defId;
	if (ui.settleInspectEmpty) ui.settleInspectEmpty.hidden = !empty;
	if (ui.settleInspectName) ui.settleInspectName.hidden = empty;
	if (ui.settleInspectMeta) ui.settleInspectMeta.hidden = empty;
	if (ui.settleInspectSummary) ui.settleInspectSummary.hidden = empty;
	if (empty) {
		Space4x.setText(ui.settleInspectName, "Project");
		Space4x.setText(ui.settleInspectMeta, "");
		Space4x.setText(ui.settleInspectSummary, "");
		if (ui.settleInspectStatsBox) ui.settleInspectStatsBox.hidden = true;
		if (ui.btnSettleInspectQueue) ui.btnSettleInspectQueue.hidden = true;
		if (ui.settleInspectStats) {
			Space4x.syncKeyedList(ui.settleInspectStats, [], function () { return ""; },
				function () { return document.createElement("li"); }, function () {});
		}
		return;
	}
	const info = Space4x.buildInspectInfo(state, st, inspect.defId);
	let meta = info.meta;
	if (inspect.kind === "structure") meta += " · standing";
	if (inspect.kind === "troop") meta += " · garrison";
	if (inspect.kind === "queue") {
		let item = null;
		for (let i = 0; i < st.buildQueue.length; i++) {
			if (st.buildQueue[i].id === inspect.queueId) item = st.buildQueue[i];
		}
		if (item) {
			const def = Space4x.settingOf(state).builds[item.defId];
			const cost = Space4x.buildCost(state, st, def);
			meta += " · queued " + (item.progress || 0) + "/" + cost;
			const etas = Space4x.queueBuildEtas(state, st);
			for (let i = 0; i < st.buildQueue.length; i++) {
				if (st.buildQueue[i].id === item.id) {
					meta += " · " + Space4x.queueEtaText(etas[i]);
					break;
				}
			}
		}
	}
	if (inspect.kind === "catalog") meta += " · catalog";
	Space4x.setText(ui.settleInspectName, info.name);
	Space4x.setText(ui.settleInspectMeta, meta);
	Space4x.setText(ui.settleInspectSummary, info.summary);
	if (ui.settleInspectStatsBox) ui.settleInspectStatsBox.hidden = false;
	const stats = info.stats.map(function (line, i) { return { id: String(i), text: line }; });
	Space4x.syncKeyedList(ui.settleInspectStats, stats, function (s) { return s.id; },
		function () {
			const li = document.createElement("li");
			li.appendChild(document.createElement("span"));
			return li;
		},
		function (row, item) { row.querySelector("span").textContent = item.text; }
	);
	if (ui.btnSettleInspectQueue) {
		ui.btnSettleInspectQueue.hidden = false;
		ui.btnSettleInspectQueue.disabled = !mine || !info.canQueue;
		Space4x.setText(ui.btnSettleInspectQueue, info.canQueue ? "Add to queue" : "Cannot queue");
	}
};

Space4x.syncSettlement = function (ui, state, cmds) {
	const st = Space4x.settlementById(state, state.ui.selectedSettlementId);
	if (!st) {
		Space4x.setText(ui.settleName, "No settlement selected");
		Space4x.setText(ui.settleMeta, "");
		if (ui.settleCulture) {
			ui.settleCulture.hidden = true;
			ui.settleCulture.removeAttribute("src");
		}
		Space4x.setText(ui.settleIndustry, "0");
		Space4x.setText(ui.settlePopLine, "");
		Space4x.setText(ui.settleGrowth, "");
		if (ui.settleGrowth) ui.settleGrowth.title = "";
		if (ui.settleLoyalty) {
			Space4x.setText(ui.settleLoyalty, "");
			ui.settleLoyalty.title = "";
			ui.settleLoyalty.hidden = true;
		}
		if (ui.settleStructuresEmpty) ui.settleStructuresEmpty.hidden = true;
		if (ui.settleStructures) Space4x.syncKeyedList(ui.settleStructures, [], function () { return ""; }, function () { return document.createElement("li"); }, function () {});
		Space4x.syncGarrison(ui, state, cmds, null, false);
		if (ui.settlePlanet) Space4x.drawPlanet(ui.settlePlanet, null);
		Space4x.syncJobBoard(ui, state, cmds);
		Space4x.syncSettleInspect(ui, state, null, false);
		if (ui.settleBuildStubLine) {
			Space4x.setText(ui.settleBuildStubLine, "Nothing in the queue.");
			ui.settleBuildStubLine.title = "";
		}
		if (ui.buildMeta) Space4x.setText(ui.buildMeta, "");
		if (ui.btnSettleOpenBuild) ui.btnSettleOpenBuild.disabled = true;
		if (ui.btnSettleGetSettlers) ui.btnSettleGetSettlers.hidden = true;
		return;
	}
	const body = Space4x.bodyById(state, st.location.bodyId);
	const empire = Space4x.empireById(state, st.empireId);
	Space4x.setText(ui.settleName, st.name);
	const cultureLabel = Space4x.settlementCultureLabel(state, st);
	let meta = body ? body.name + " · " + Space4x.bodyCaption(body, state) : "";
	if (cultureLabel) meta += (meta ? " · " : "") + cultureLabel;
	if (empire) meta += (meta ? " — " : "") + empire.name;
	Space4x.setText(ui.settleMeta, meta);
	if (ui.settleCulture) {
		const cid = Space4x.majorityCulture(state, st);
		Space4x.setCultureImg(ui.settleCulture, state, cid);
		ui.settleCulture.title = cultureLabel;
	}
	Space4x.drawPlanet(ui.settlePlanet, body);
	Space4x.setText(ui.settleIndustry, st.industryPool);
	Space4x.setText(ui.settlePopLine, st.pops.length + " " + Space4x.peopleWord(st.pops.length));
	const outlook = Space4x.settlementPopOutlook(state, st);
	Space4x.setText(ui.settleGrowth, Space4x.popOutlookText(outlook));
	if (ui.settleGrowth) ui.settleGrowth.title = Space4x.popOutlookTip(outlook);
	if (ui.settleLoyalty) {
		const hasLoyalty = !!Space4x.loyaltyRules(state);
		ui.settleLoyalty.hidden = !hasLoyalty;
		if (hasLoyalty) {
			Space4x.setText(ui.settleLoyalty, Space4x.loyaltyText(state, st));
			ui.settleLoyalty.title = Space4x.loyaltyExplain(state, st, Space4x.majorityCulture(state, st)).join("\n");
		} else {
			Space4x.setText(ui.settleLoyalty, "");
			ui.settleLoyalty.title = "";
		}
	}
	const playerNow = Space4x.playerEmpire(state);
	const mine = playerNow && st.empireId === playerNow.id;
	if (ui.buildMeta) Space4x.setText(ui.buildMeta, st.name);
	if (ui.btnSettleOpenBuild) ui.btnSettleOpenBuild.disabled = false;
	if (ui.btnSettleGetSettlers) ui.btnSettleGetSettlers.hidden = !mine;
	if (ui.settleBuildStubLine) {
		const stub = Space4x.queueFrontSummary(state, st);
		Space4x.setText(ui.settleBuildStubLine, stub.text);
		ui.settleBuildStubLine.title = stub.title;
	}
	const inspect = state.ui.inspect;
	Space4x.syncJobBoard(ui, state, cmds);
	const structCounts = [];
	const seen = {};
	for (let i = 0; i < st.structures.length; i++) {
		const id = st.structures[i].defId;
		if (!seen[id]) {
			seen[id] = { id: id, n: 0 };
			structCounts.push(seen[id]);
		}
		seen[id].n += 1;
	}
	if (ui.settleStructuresEmpty) ui.settleStructuresEmpty.hidden = structCounts.length > 0;
	if (ui.settleStructures) {
		Space4x.syncKeyedList(ui.settleStructures, structCounts, function (s) { return s.id; },
			function () {
				const li = document.createElement("li");
				const btn = document.createElement("button");
				btn.type = "button";
				li.appendChild(btn);
				btn.addEventListener("click", function () {
					cmds.inspectBuild("structure", li.getAttribute("data-id"));
				});
				return li;
			},
			function (row, item) {
				const def = Space4x.settingOf(state).builds[item.id];
				const name = def ? def.name : item.id;
				row.querySelector("button").textContent = item.n > 1 ? name + " (" + item.n + ")" : name;
				row.classList.toggle("is-inspect", !!(inspect && inspect.kind === "structure" && inspect.defId === item.id));
			}
		);
	}
	Space4x.syncGarrison(ui, state, cmds, st, mine);
	if (ui.settleQueueEmpty) ui.settleQueueEmpty.hidden = st.buildQueue.length > 0;
	const queueEtas = Space4x.queueBuildEtas(state, st);
	const queueBlocked = Space4x.queueItemStates(state, st);
	if (!(Space4x._queueDrag && Space4x._queueDrag.moved)) {
	Space4x.syncKeyedList(ui.settleQueue, st.buildQueue, function (q) { return q.id; },
		function () {
			const li = document.createElement("li");
			const name = document.createElement("span");
			name.className = "q-name";
			const prog = document.createElement("span");
			prog.className = "q-prog";
			const eta = document.createElement("span");
			eta.className = "q-eta";
			const rm = document.createElement("button");
			rm.type = "button";
			rm.textContent = "×";
			rm.className = "q-rm";
			rm.title = "Cancel";
			li.appendChild(name);
			li.appendChild(prog);
			li.appendChild(eta);
			li.appendChild(rm);
			rm.addEventListener("click", function () {
				cmds.cancelBuild(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, item) {
			const def = Space4x.settingOf(state).builds[item.defId];
			row.setAttribute("data-def", item.defId);
			row.querySelector(".q-name").textContent = def ? def.name : item.defId;
			row.querySelector(".q-prog").textContent = (item.progress || 0) + "/" + Space4x.buildCost(state, st, def);
			let idx = 0;
			for (let i = 0; i < st.buildQueue.length; i++) {
				if (st.buildQueue[i].id === item.id) idx = i;
			}
			const eta = queueEtas[idx];
			const block = queueBlocked[idx];
			const etaEl = row.querySelector(".q-eta");
			etaEl.textContent = Space4x.queueEtaText(eta);
			if (block && block.blocked) etaEl.title = block.reason || "Cannot be built yet.";
			else etaEl.title = Space4x.queueEtaTitle(eta);
			row.querySelector(".q-name").title = (block && block.reason) || "";
			row.querySelector(".q-rm").disabled = !mine;
			row.classList.toggle("is-blocked", !!(block && block.blocked));
			row.classList.toggle("is-inspect", !!(inspect && inspect.kind === "queue" && inspect.queueId === item.id));
			row.classList.toggle("is-mine", !!mine && st.buildQueue.length > 1);
			row.title = mine && st.buildQueue.length > 1 ? "Drag to reorder" : "";
		}
	);
	}
	const builds = Space4x.settingOf(state).builds;
	const byKind = {};
	const ids = Object.keys(builds);
	for (let i = 0; i < ids.length; i++) {
		const def = builds[ids[i]];
		if (def.requireTech && !Space4x.empireHasTech(empire, def.requireTech)) continue;
		if (def.kind === "structure" && Space4x.countStructure(st, def.id) > 0 && !Space4x.canQueueBuild(state, st, def.id)) continue;
		if (!byKind[def.kind]) byKind[def.kind] = [];
		byKind[def.kind].push(def);
	}
	const kindOrder = ["structure", "spy", "unit", "abstract", "troop"];
	const kindLabel = { structure: "Structures", spy: "Spies", unit: "Ships", abstract: "Empire", troop: "Ground" };
	const catalog = [];
	for (let k = 0; k < kindOrder.length; k++) {
		const group = byKind[kindOrder[k]];
		if (!group || !group.length) continue;
		catalog.push({ id: "g-" + kindOrder[k], type: "group", label: kindLabel[kindOrder[k]] || kindOrder[k] });
		for (let i = 0; i < group.length; i++) catalog.push({ id: group[i].id, type: "build", def: group[i] });
	}
	Space4x.syncKeyedList(ui.settleCatalog, catalog, function (item) { return item.id; },
		function (item) {
			const li = document.createElement("li");
			if (item.type === "group") {
				li.className = "catalog-group";
				return li;
			}
			const btn = document.createElement("button");
			btn.type = "button";
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				cmds.inspectBuild("catalog", li.getAttribute("data-id"));
			});
			btn.addEventListener("dblclick", function () {
				cmds.queueBuild(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, item) {
			if (item.type === "group") {
				row.textContent = item.label;
				row.classList.remove("is-inspect");
				return;
			}
			const def = item.def;
			const btn = row.querySelector("button");
			let label = def.name + " (" + Space4x.buildCost(state, st, def) + ")";
			if (def.requireStructure && !Space4x.countStructure(st, def.requireStructure)) {
				label += " · needs " + Space4x.structureName(state, def.requireStructure);
			}
			const can = Space4x.canQueueBuild(state, st, def.id);
			if (def.unique) label += can ? " · unique" : " · already here";
			btn.textContent = label;
			row.classList.toggle("is-capped", !!(def.unique && !can));
			row.classList.toggle("is-inspect", !!(inspect && inspect.kind === "catalog" && inspect.defId === def.id));
		}
	);
	Space4x.syncSettleInspect(ui, state, st, mine);
	const docked = Space4x.unitsDockedAt(state, st.id);
	ui.settleFleetsEmpty.hidden = docked.length > 0;
	Space4x.syncFleetList(ui.settleFleets, docked, state, cmds);
};

Space4x.syncReport = function (ui, state) {
	Space4x.syncKeyedList(ui.reportList, state.turnLog.map(function (t, i) { return { id: String(i), text: t }; }),
		function (x) { return x.id; },
		function () {
			const li = document.createElement("li");
			li.appendChild(document.createElement("span"));
			return li;
		},
		function (row, item) { row.querySelector("span").textContent = item.text; }
	);
};

Space4x.syncUiFromState = function (app) {
	const ui = app.ui;
	const state = app.state;
	ui.screenGeneration.hidden = state.screen !== "generation";
	ui.screenPlay.hidden = state.screen !== "play";
	if (state.screen === "generation") Space4x.syncGeneration(ui, state, app.cmds);
	if (state.screen === "play") {
		Space4x.syncChrome(ui, state);
		Space4x.syncStage(ui, state);
		Space4x.syncPanels(ui, state);
		Space4x.syncTodos(ui, state, app.cmds);
		Space4x.syncSystem(ui, state, app.cmds);
		Space4x.syncSettlement(ui, state, app.cmds);
		Space4x.syncResearchStage(ui, state, app.cmds);
		Space4x.syncEmpireStage(ui, state, app.cmds);
		Space4x.syncSpyStage(ui, state, app.cmds);
		Space4x.syncDiplomacyStage(ui, state, app.cmds);
		Space4x.syncReport(ui, state);
		Space4x.syncReportStage(ui, state);
		if (!ui.canvas.hidden) Space4x.drawMap(ui, state);
	}
	if (state.winnerEmpireId) {
		ui.winBanner.hidden = false;
		const emp = Space4x.empireById(state, state.winnerEmpireId);
		Space4x.setText(ui.winText, emp ? emp.name + " wins." : "No one remains.");
	} else ui.winBanner.hidden = true;
	Space4x.syncSaveUi(ui, app);
};
