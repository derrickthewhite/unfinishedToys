var Space4x = Space4x || {};

Space4x.empirePopSelHas = function (state, popId) {
	const ids = state && state.ui && state.ui.empirePopSel && state.ui.empirePopSel.ids;
	if (!ids) return false;
	for (let i = 0; i < ids.length; i++) if (ids[i] === popId) return true;
	return false;
};

Space4x.empireTroopSelHas = function (state, troopId) {
	const ids = state && state.ui && state.ui.empireTroopSel && state.ui.empireTroopSel.ids;
	if (!ids) return false;
	for (let i = 0; i < ids.length; i++) if (ids[i] === troopId) return true;
	return false;
};

Space4x.clearEmpirePopSel = function (state) {
	if (!state || !state.ui) return;
	state.ui.empirePopSel = { settlementId: null, ids: [], fromJob: null };
};

Space4x.clearEmpireTroopSel = function (state) {
	if (!state || !state.ui) return;
	state.ui.empireTroopSel = { settlementId: null, ids: [] };
};

Space4x.bindEmpireTransfers = function (app) {
	const rows = app.ui.empireSettlementRows;
	if (!rows || rows._empireBound) return;
	rows._empireBound = true;
	rows.addEventListener("click", function (ev) {
		if (app.state.ui.stage !== "empire") return;
		const player = Space4x.playerEmpire(app.state);
		if (!player) return;
		if (ev.target.closest("button")) return;

		const row = ev.target.closest(".empire-row");
		if (!row) return;
		const settlementId = row.getAttribute("data-id");
		const st = Space4x.settlementById(app.state, settlementId);
		if (!st || st.empireId !== player.id) return;

		Space4x.ensureUiInteraction(app.state);
		const sel = app.state.ui.empirePopSel;
		const troopSel = app.state.ui.empireTroopSel;

		const token = ev.target.closest(".empire-row .pop-token");
		if (token) {
			ev.stopPropagation();
			Space4x.clearEmpireTroopSel(app.state);
			const lane = token.closest(".empire-lane-mini");
			const lanePops = lane ? lane.querySelectorAll(".pop-token") : [];
			const ids = [];
			let after = false;
			for (let i = 0; i < lanePops.length; i++) {
				if (lanePops[i] === token) after = true;
				if (!after) continue;
				ids.push(lanePops[i].getAttribute("data-pop-id"));
			}
			app.state.ui.empirePopSel = {
				settlementId: settlementId,
				ids: ids,
				fromJob: lane ? lane.getAttribute("data-job") : null
			};
			app.sync();
			return;
		}

		const troopToken = ev.target.closest(".empire-row .troop-glyph-token");
		if (troopToken) {
			ev.stopPropagation();
			Space4x.clearEmpirePopSel(app.state);
			const troopLane = troopToken.closest(".troop-lane");
			const tokens = troopLane ? troopLane.querySelectorAll(".troop-glyph-token") : [];
			const ids = [];
			let after = false;
			for (let i = 0; i < tokens.length; i++) {
				if (tokens[i] === troopToken) after = true;
				if (!after) continue;
				ids.push(tokens[i].getAttribute("data-troop-id"));
			}
			app.state.ui.empireTroopSel = { settlementId: settlementId, ids: ids };
			app.sync();
			return;
		}

		const lane = ev.target.closest(".empire-lane-mini");
		if (lane && sel.ids.length && sel.settlementId === settlementId) {
			const job = lane.getAttribute("data-job");
			if (job && job !== "money") {
				if (job !== sel.fromJob) Space4x.setPopJobs(app.state, st, sel.ids, job);
				Space4x.clearEmpirePopSel(app.state);
				app.sync();
			}
			return;
		}

		if (troopSel.ids.length && troopSel.settlementId && troopSel.settlementId !== settlementId) {
			Space4x.queueTroopMoveByIds(app.state, troopSel.settlementId, settlementId, troopSel.ids);
			Space4x.clearEmpireTroopSel(app.state);
			app.sync();
			return;
		}

		if (sel.ids.length && sel.settlementId && sel.settlementId !== settlementId) {
			Space4x.queuePopMove(app.state, sel.settlementId, settlementId, sel.ids.length);
			Space4x.clearEmpirePopSel(app.state);
			app.sync();
			return;
		}

		if (ev.target.closest(".empire-row-lanes") || ev.target.closest(".empire-row-garrison")) {
			if (troopSel.ids.length && troopSel.settlementId && troopSel.settlementId !== settlementId) {
				Space4x.queueTroopMoveByIds(app.state, troopSel.settlementId, settlementId, troopSel.ids);
				Space4x.clearEmpireTroopSel(app.state);
				app.sync();
				return;
			}
			if (sel.ids.length) Space4x.clearEmpirePopSel(app.state);
			if (troopSel.ids.length) Space4x.clearEmpireTroopSel(app.state);
			if (sel.ids.length || troopSel.ids.length) app.sync();
			return;
		}

		if (sel.ids.length) {
			Space4x.clearEmpirePopSel(app.state);
			app.sync();
			return;
		}
		if (troopSel.ids.length) {
			Space4x.clearEmpireTroopSel(app.state);
			app.sync();
			return;
		}
		app.cmds.selectSettlement(settlementId);
	});
};

Space4x.syncEmpireMoveCost = function (ui, state) {
	const player = Space4x.playerEmpire(state);
	const factor = Space4x.settingOf(state).popMoveFreighterFactor || 5;
	const n = parseInt(ui.empireMoveCount.value, 10) || 0;
	const need = n * factor;
	const use = player ? Space4x.empireFreighterUse(state, player.id) : { idle: 0 };
	const list = player ? Space4x.settlementsOf(state, player.id) : [];
	const from = ui.empireMoveFrom ? Space4x.settlementById(state, ui.empireMoveFrom.value) : null;
	const to = ui.empireMoveTo ? Space4x.settlementById(state, ui.empireMoveTo.value) : null;
	const warpOk = !from || !to || Space4x.canLeaveSystem(state, player, from.location.starId, to.location.starId);
	let cost = "";
	let disabled = list.length < 2 || n < 1 || !from || !to || from.id === to.id;
	if (!warpOk) {
		cost = "Needs Warp Drive to move between stars";
		disabled = true;
	} else if (n > 0) {
		cost = need + " freighters (in transit until arrival)";
		if (need > use.idle) {
			cost += " · " + use.idle + " idle";
			disabled = true;
		}
	}
	if (from && n > from.pops.length) disabled = true;
	Space4x.setText(ui.empireMoveCost, cost);
	if (ui.btnEmpireMove) ui.btnEmpireMove.disabled = disabled;
};

Space4x.syncEmpireSettlementGraphic = function (state, row, st) {
	const garrisonEl = row.querySelector(".empire-row-garrison");
	const lanesEl = row.querySelector(".empire-row-lanes");
	const troopSel = state.ui.empireTroopSel || { ids: [] };
	Space4x.syncTroopLaneBoard(garrisonEl, state, st, {
		inline: true,
		selectedIds: troopSel.settlementId === st.id ? troopSel.ids : [],
		transferTip: "click to select, then click another colony"
	});

	const jobs = Space4x.visibleJobs(state, st).filter(function (lane) { return lane.id !== "money"; });
	const popSel = state.ui.empirePopSel || { settlementId: null, ids: [] };
	Space4x.syncKeyedList(lanesEl, jobs, function (lane) { return lane.id; },
		function (lane) {
			const mini = document.createElement("div");
			mini.className = "empire-lane-mini";
			mini.setAttribute("data-job", lane.id);
			const pops = document.createElement("div");
			pops.className = "empire-lane-pops";
			mini.appendChild(pops);
			return mini;
		},
		function (mini, lane) {
			const color = Space4x.JOB_COLORS[lane.id] || "#888";
			let title = lane.label;
			if (lane.cap !== Infinity) title = lane.count + "/" + lane.cap + " " + lane.label;
			mini.title = title;
			mini.style.borderBottomColor = color;
			mini.classList.toggle("is-job-target",
				popSel.ids.length > 0 && popSel.settlementId === st.id && lane.id !== popSel.fromJob && lane.id !== "money");
			const popsHere = [];
			for (let i = 0; i < st.pops.length; i++) {
				if (st.pops[i].job === lane.id) popsHere.push(st.pops[i]);
			}
			const popsBox = mini.querySelector(".empire-lane-pops");
			Space4x.syncKeyedList(popsBox, popsHere, function (p) { return p.id; },
				function (pop) {
					return Space4x.makePopToken(state, pop, lane.id);
				},
				function (token, pop) {
					token.style.borderColor = color;
					const img = token.querySelector("img");
					if (img) Space4x.setCultureImg(img, state, pop.culture);
					token.classList.toggle("is-selected", Space4x.empirePopSelHas(state, pop.id));
					const who = Space4x.cultureName(state, pop.culture);
					token.title = (who || "Pop") + " · " + title +
						" · click to select workers, another lane for jobs, another colony to move";
				}
			);
			Space4x.fitOverlappingRow(popsBox, 0, 4);
		}
	);
};

Space4x.syncEmpireStage = function (ui, state, cmds) {
	Space4x.ensureUiInteraction(state);
	const player = Space4x.playerEmpire(state);
	if (!player) {
		Space4x.setText(ui.empireFreighters, "Observer — settlements and transfers are player-only.");
		Space4x.setText(ui.empireFreighterNote, "");
		Space4x.setText(ui.empireRivalsStage, "");
		if (ui.empireSettlementRows) {
			Space4x.syncKeyedList(ui.empireSettlementRows, [], function () { return ""; },
				function () { return document.createElement("li"); }, function () {});
		}
		if (ui.empireMove) ui.empireMove.hidden = true;
		return;
	}
	if (ui.empireMove) ui.empireMove.hidden = false;
	const list = Space4x.settlementsOf(state, player.id);
	const factor = Space4x.settingOf(state).popMoveFreighterFactor || 5;
	const use = Space4x.empireFreighterUse(state, player.id);
	const canMove = Math.floor(use.idle / factor);
	const popSel = state.ui.empirePopSel || { settlementId: null, ids: [] };
	const troopSel = state.ui.empireTroopSel || { settlementId: null, ids: [] };
	Space4x.setText(ui.empireFreighters,
		"Freighters: " + use.owned +
		" · food last turn: " + use.food +
		" · in transit: " + use.transit +
		" · idle: " + use.idle +
		" (can move " + canMove + " " + Space4x.peopleWord(canMove) + ")"
	);
	Space4x.setText(ui.empireFreighterNote,
		"Click workers to reassign jobs within a colony or move people between colonies. " +
		"Click troop glyphs in a lane, then click another colony to send them.");
	const names = [];
	for (let i = 0; i < state.empires.length; i++) {
		if (!state.empires[i].isPlayer) {
			const e = state.empires[i];
			const who = Space4x.cultureName(state, e.cultureId);
			names.push(e.name + (who ? " (" + who + ")" : ""));
		}
	}
	Space4x.setText(ui.empireRivalsStage, names.length ? "Rivals: " + names.join(", ") : "No rivals");

	Space4x.syncKeyedList(ui.empireSettlementRows, list, function (s) { return s.id; },
		function () {
			const li = document.createElement("li");
			li.className = "empire-row";
			const top = document.createElement("div");
			top.className = "empire-row-top";
			const body = document.createElement("div");
			body.className = "empire-row-body";
			const head = document.createElement("div");
			head.className = "empire-row-head";
			const name = document.createElement("span");
			name.className = "empire-row-name";
			const meta = document.createElement("span");
			meta.className = "empire-row-meta";
			head.appendChild(name);
			head.appendChild(meta);
			body.appendChild(head);
			const open = document.createElement("button");
			open.type = "button";
			open.textContent = "Open";
			top.appendChild(body);
			top.appendChild(open);
			const garrison = document.createElement("div");
			garrison.className = "empire-row-garrison";
			const lanes = document.createElement("div");
			lanes.className = "empire-row-lanes";
			li.appendChild(top);
			li.appendChild(lanes);
			li.appendChild(garrison);
			open.addEventListener("click", function () {
				cmds.selectSettlement(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, st) {
			const idle = Space4x.countJob(st, "idle");
			const n = st.pops.length;
			row.querySelector(".empire-row-name").textContent = Space4x.settlementLabel(state, st);
			let queue = "queue empty";
			if (st.buildQueue.length) {
				const def = Space4x.settingOf(state).builds[st.buildQueue[0].defId];
				queue = "building " + (def ? def.name : st.buildQueue[0].defId);
			}
			const body = Space4x.bodyById(state, st.location.bodyId);
			const rich = Space4x.richnessOf(state, body);
			const outlook = Space4x.settlementPopOutlook(state, st);
			row.querySelector(".empire-row-meta").textContent =
				(rich && rich.name ? rich.name + " · " : "") +
				n + " " + Space4x.peopleWord(n) +
				(idle ? ", " + idle + " idle" : "") +
				" · food " + outlook.produced + "/" + outlook.need +
				" (" + outlook.fed + " fed)" +
				" · " + Space4x.fmtPercent(Math.abs(outlook.combinedRate)) + "% " +
				(outlook.netPer < 0 ? "decline" : "growth") +
				" · industry " + st.industryPool +
				" · " + queue;
			row.classList.toggle("is-selected", state.ui.selectedSettlementId === st.id);
			row.classList.toggle("is-pop-source", popSel.settlementId === st.id && popSel.ids.length > 0);
			row.classList.toggle("is-troop-source", troopSel.settlementId === st.id && troopSel.ids.length > 0);
			row.classList.toggle("is-pop-target", popSel.ids.length > 0 && popSel.settlementId && popSel.settlementId !== st.id);
			row.classList.toggle("is-troop-target", troopSel.ids.length > 0 && troopSel.settlementId && troopSel.settlementId !== st.id);
			Space4x.syncEmpireSettlementGraphic(state, row, st);
		}
	);

	const focus = document.activeElement;
	Space4x.syncKeyedList(ui.empireMoveFrom, list, function (s) { return s.id; },
		function () { return document.createElement("option"); },
		function (opt, st) {
			opt.value = st.id;
			opt.textContent = Space4x.settlementLabel(state, st) + " (" + st.pops.length + ")";
		}
	);
	Space4x.syncKeyedList(ui.empireMoveTo, list, function (s) { return s.id; },
		function () { return document.createElement("option"); },
		function (opt, st) {
			opt.value = st.id;
			opt.textContent = Space4x.settlementLabel(state, st) + " (" + st.pops.length + ")";
		}
	);
	if (focus !== ui.empireMoveFrom) {
		let fromId = state.ui.moveFromId;
		const selected = Space4x.settlementById(state, state.ui.selectedSettlementId);
		if (!fromId || !list.some(function (s) { return s.id === fromId; })) {
			fromId = (selected && selected.empireId === player.id) ? selected.id : (list[0] ? list[0].id : "");
		}
		if (fromId) ui.empireMoveFrom.value = fromId;
	}
	state.ui.moveFromId = ui.empireMoveFrom.value;
	if (focus !== ui.empireMoveTo) {
		let toId = state.ui.moveToId;
		if (!toId || toId === ui.empireMoveFrom.value || !list.some(function (s) { return s.id === toId; })) {
			toId = "";
			for (let i = 0; i < list.length; i++) {
				if (list[i].id !== ui.empireMoveFrom.value) {
					toId = list[i].id;
					break;
				}
			}
		}
		if (toId) ui.empireMoveTo.value = toId;
	}
	state.ui.moveToId = ui.empireMoveTo.value;
	Space4x.syncEmpireMoveCost(ui, state);

	const popMoves = Space4x.popHaulers(state, player.id);
	const troopMoves = Space4x.troopHaulers(state, player.id);
	const moves = popMoves.concat(troopMoves);
	ui.empireMovesEmpty.hidden = moves.length > 0;
	Space4x.syncKeyedList(ui.empireMoves, moves, function (m) { return m.id; },
		function () {
			const li = document.createElement("li");
			const span = document.createElement("span");
			const rm = document.createElement("button");
			rm.type = "button";
			rm.textContent = "Cancel";
			li.appendChild(span);
			li.appendChild(rm);
			rm.addEventListener("click", function () {
				cmds.cancelPopMove(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, unit) {
			const from = Space4x.settlementById(state, unit.originSettlementId);
			const to = Space4x.settlementById(state, unit.destSettlementId);
			let label;
			if (Space4x.isTroopHauler(state, unit)) {
				const cargo = unit.cargoTroops || [];
				label = Space4x.troopCargoLabel(state, cargo);
				if (unit.fleetMode) label += " (fleet)";
			} else {
				const n = (unit.cargoPops || []).length;
				label = n + " " + Space4x.peopleWord(n);
			}
			const hulls = Space4x.unitFreighterHulls(state, unit);
			const destLabel = unit.fleetMode ? "fleet" : (to ? Space4x.settlementLabel(state, to) : "?");
			row.querySelector("span").textContent =
				label +
				" · " + hulls + " freighters in use" +
				" · " + (from ? Space4x.settlementLabel(state, from) : "?") + " → " + destLabel +
				" · " + Space4x.unitPlaceLabel(state, unit);
		}
	);
};
