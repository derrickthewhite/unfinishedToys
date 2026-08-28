var Space4x = Space4x || {};

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

Space4x.syncEmpireStage = function (ui, state, cmds) {
	const player = Space4x.playerEmpire(state);
	if (!player) return;
	const list = Space4x.settlementsOf(state, player.id);
	const factor = Space4x.settingOf(state).popMoveFreighterFactor || 5;
	const use = Space4x.empireFreighterUse(state, player.id);
	const canMove = Math.floor(use.idle / factor);
	Space4x.setText(ui.empireFreighters,
		"Freighters: " + use.owned +
		" · food last turn: " + use.food +
		" · in transit: " + use.transit +
		" · idle: " + use.idle +
		" (can move " + canMove + " " + Space4x.peopleWord(canMove) + ")"
	);
	Space4x.setText(ui.empireFreighterNote, "Food uses the empire pool (not map fleets). Moving people launches freighters on the map — 5 hulls per person. Those hulls stay in the pool as in transit until they arrive. Ground units use 1 hull each.");
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
			const body = document.createElement("div");
			body.className = "empire-row-body";
			const name = document.createElement("div");
			name.className = "empire-row-name";
			const meta = document.createElement("div");
			meta.className = "empire-row-meta muted";
			body.appendChild(name);
			body.appendChild(meta);
			const open = document.createElement("button");
			open.type = "button";
			open.textContent = "Open";
			li.appendChild(body);
			li.appendChild(open);
			function go() {
				cmds.selectSettlement(li.getAttribute("data-id"));
			}
			body.addEventListener("click", go);
			open.addEventListener("click", go);
			return li;
		},
		function (row, st) {
			const star = Space4x.starById(state, st.location.starId);
			const idle = Space4x.countJob(st, "idle");
			const n = st.pops.length;
			row.querySelector(".empire-row-name").textContent = st.name;
			let queue = "queue empty";
			if (st.buildQueue.length) {
				const def = Space4x.settingOf(state).builds[st.buildQueue[0].defId];
				queue = "building " + (def ? def.name : st.buildQueue[0].defId);
			}
			const body = Space4x.bodyById(state, st.location.bodyId);
			const rich = Space4x.richnessOf(state, body);
			const outlook = Space4x.settlementPopOutlook(state, st);
			row.querySelector(".empire-row-meta").textContent =
				(star ? star.name : "?") +
				" · " + (rich && rich.name ? rich.name + " · " : "") +
				n + " " + Space4x.peopleWord(n) +
				(idle ? ", " + idle + " idle" : "") +
				" · food " + (st.lastFoodPresent || 0) + "/" + n +
				" · " + Space4x.fmtPercent(Math.abs(outlook.combinedRate)) + "% " +
				(outlook.netPer < 0 ? "decline" : "growth") +
				" · industry " + st.industryPool +
				" · " + queue;
			row.classList.toggle("is-selected", state.ui.selectedSettlementId === st.id);
		}
	);

	const focus = document.activeElement;
	Space4x.syncKeyedList(ui.empireMoveFrom, list, function (s) { return s.id; },
		function () { return document.createElement("option"); },
		function (opt, st) {
			opt.value = st.id;
			opt.textContent = st.name + " (" + st.pops.length + ")";
		}
	);
	Space4x.syncKeyedList(ui.empireMoveTo, list, function (s) { return s.id; },
		function () { return document.createElement("option"); },
		function (opt, st) {
			opt.value = st.id;
			opt.textContent = st.name + " (" + st.pops.length + ")";
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
			let hulls;
			if (Space4x.isTroopHauler(state, unit)) {
				const cargo = unit.cargoTroops || [];
				label = Space4x.troopCargoLabel(state, cargo);
				hulls = unit.hulls || cargo.length;
			} else {
				const n = (unit.cargoPops || []).length;
				label = n + " " + Space4x.peopleWord(n);
				hulls = unit.hulls || n * factor;
			}
			row.querySelector("span").textContent =
				label +
				" · " + (from ? from.name : "?") + " → " + (to ? to.name : "?") +
				" · " + hulls + " freighters · " + Space4x.unitPlaceLabel(state, unit);
		}
	);
};
