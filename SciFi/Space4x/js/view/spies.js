var Space4x = Space4x || {};

Space4x.spySelHas = function (state, id) {
	const ids = state && state.ui && state.ui.spySel && state.ui.spySel.ids;
	if (!ids) return false;
	for (let i = 0; i < ids.length; i++) if (ids[i] === id) return true;
	return false;
};

Space4x.clearSpySel = function (state) {
	if (!state || !state.ui) return;
	state.ui.spySel = { ids: [], fromLane: null };
};

Space4x.clearSpyDrag = function (state) {
	if (!state || !state.ui) return;
	const drag = state.ui.spyDrag;
	if (!drag) return;
	if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
	state.ui.spyDrag = null;
};

Space4x.makeSpyToken = function (state, spy) {
	const token = document.createElement("span");
	token.className = "pop-token";
	token.setAttribute("data-spy-id", spy.id);
	token.title = "Drag this spy and everyone after them to another post";
	const img = document.createElement("img");
	img.className = "pop-token-art";
	img.draggable = false;
	Space4x.setCultureImg(img, state, spy.culture);
	token.appendChild(img);
	return token;
};

Space4x.bindSpyBoard = function (app) {
	const board = app.ui.spyBoard;
	if (!board) return;
	const DRAG_PX = 6;

	function paintSelected() {
		const tokens = board.querySelectorAll(".pop-token");
		for (let i = 0; i < tokens.length; i++) {
			tokens[i].classList.toggle("is-selected",
				Space4x.spySelHas(app.state, tokens[i].getAttribute("data-spy-id")));
		}
	}

	function clearLaneOver() {
		const lanes = board.querySelectorAll(".job-lane");
		for (let i = 0; i < lanes.length; i++) lanes[i].classList.remove("drag-over");
	}

	function laneUnder(ev) {
		const drag = app.state.ui.spyDrag;
		if (drag && drag.ghost) drag.ghost.style.visibility = "hidden";
		const el = document.elementFromPoint(ev.clientX, ev.clientY);
		if (drag && drag.ghost) drag.ghost.style.visibility = "";
		if (!el || !el.closest) return null;
		return el.closest("#spy-board .job-lane");
	}

	function paintOver(ev) {
		const over = laneUnder(ev);
		const lanes = board.querySelectorAll(".job-lane");
		for (let i = 0; i < lanes.length; i++) lanes[i].classList.toggle("drag-over", lanes[i] === over);
		return over;
	}

	function selectFromToken(token) {
		const lane = token.closest(".job-lane");
		const tokens = lane.querySelectorAll(".pop-token");
		const ids = [];
		let after = false;
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i] === token) after = true;
			if (!after) continue;
			ids.push(tokens[i].getAttribute("data-spy-id"));
		}
		Space4x.ensureUiInteraction(app.state);
		app.state.ui.spySel = { ids: ids, fromLane: lane.getAttribute("data-id") };
		paintSelected();
	}

	function assignToLane(laneId) {
		const ids = app.state.ui.spySel && app.state.ui.spySel.ids;
		if (!ids || !ids.length || !laneId) return false;
		Space4x.clearSpySel(app.state);
		Space4x.clearSpyDrag(app.state);
		app.cmds.setSpyPosts(ids, laneId);
		return true;
	}

	function onMove(ev) {
		const drag = app.state.ui.spyDrag;
		if (!drag) return;
		const dx = ev.clientX - drag.startX;
		const dy = ev.clientY - drag.startY;
		if (!drag.moved && (dx * dx + dy * dy) >= DRAG_PX * DRAG_PX) {
			drag.moved = true;
			const ghost = document.createElement("div");
			ghost.className = "pop-drag-ghost";
			ghost.textContent = drag.ids.length + " spy" + (drag.ids.length === 1 ? "" : "s");
			document.body.appendChild(ghost);
			drag.ghost = ghost;
		}
		if (!drag.moved || !drag.ghost) return;
		drag.ghost.style.left = (ev.clientX + 10) + "px";
		drag.ghost.style.top = (ev.clientY + 10) + "px";
		paintOver(ev);
	}

	function onUp(ev) {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		const drag = app.state.ui.spyDrag;
		if (!drag) return;
		if (drag.moved) {
			const over = paintOver(ev);
			const laneId = over ? over.getAttribute("data-id") : null;
			Space4x.clearSpyDrag(app.state);
			clearLaneOver();
			if (laneId) assignToLane(laneId);
			else paintSelected();
			return;
		}
		Space4x.clearSpyDrag(app.state);
		clearLaneOver();
		paintSelected();
	}

	function onLaneUp(ev) {
		window.removeEventListener("pointerup", onLaneUp);
		window.removeEventListener("pointercancel", onLaneUp);
		const laneId = app.state.ui.pendingSpyLane;
		app.state.ui.pendingSpyLane = null;
		if (!laneId) return;
		const over = laneUnder(ev);
		if (!over || over.getAttribute("data-id") !== laneId) return;
		if (laneId === app.state.ui.spySel.fromLane) {
			Space4x.clearSpySel(app.state);
			paintSelected();
			return;
		}
		assignToLane(laneId);
	}

	board.addEventListener("pointerdown", function (ev) {
		if (ev.button && ev.button !== 0) return;
		const token = ev.target.closest(".pop-token");
		const lane = ev.target.closest(".job-lane");
		if (token && board.contains(token)) {
			ev.preventDefault();
			selectFromToken(token);
			Space4x.ensureUiInteraction(app.state);
			app.state.ui.spyDrag = {
				ids: app.state.ui.spySel.ids.slice(),
				fromLane: app.state.ui.spySel.fromLane,
				startX: ev.clientX,
				startY: ev.clientY,
				moved: false,
				ghost: null
			};
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
			window.addEventListener("pointercancel", onUp);
			return;
		}
		if (lane && app.state.ui.spySel.ids.length) {
			ev.preventDefault();
			app.state.ui.pendingSpyLane = lane.getAttribute("data-id");
			window.addEventListener("pointerup", onLaneUp);
			window.addEventListener("pointercancel", onLaneUp);
		}
	});
};

Space4x.syncSpyStage = function (ui, state, cmds) {
	if (!ui.spyBoard) return;
	Space4x.ensureUiInteraction(state);
	if (state.ui.spyDrag && state.ui.spyDrag.moved) return;
	const player = Space4x.playerEmpire(state);
	if (ui.spySkill) {
		const skill = player ? Space4x.spySkill(state, player) : 0;
		const n = player ? Space4x.empireSpies(player).length : 0;
		Space4x.setText(ui.spySkill, "Spy skill " + skill + " · " + n + (n === 1 ? " spy" : " spies") +
			" · idle spies do nothing · Defend is a shared shield");
	}
	const lanes = player ? Space4x.spyLanes(state, player) : [];
	const spies = player ? Space4x.empireSpies(player) : [];
	const items = Space4x.groupSpyBoardItems(lanes);

	function syncTrack(row, lane) {
		row.className = "job-lane spy-track";
		row.setAttribute("data-id", lane.id);
		const title = row.querySelector(".job-lane-title");
		const box = row.querySelector(".job-lane-pops");
		if (lane.kind === "settlement") {
			title.className = "job-lane-title spy-track-title is-group";
			while (title.firstChild) title.removeChild(title.firstChild);
			const badge = document.createElement("span");
			badge.className = "spy-group-badge";
			const color = (Space4x.JOB_COLORS && Space4x.JOB_COLORS[lane.job]) || "#888";
			badge.style.boxShadow = "0 0 0 2px " + color;
			const img = document.createElement("img");
			img.className = "spy-group-badge-art";
			img.alt = "";
			Space4x.setCultureImg(img, state, lane.culture);
			badge.appendChild(img);
			const meta = document.createElement("span");
			meta.className = "spy-track-meta";
			const L = lane.loyalty != null ? lane.loyalty : "?";
			meta.textContent = L + "%" + (lane.n ? " · " + lane.n : "");
			title.appendChild(badge);
			title.appendChild(meta);
			title.title = Space4x.spyLaneLabel(state, player, lane);
		} else {
			title.className = "job-lane-title spy-track-title";
			title.textContent = Space4x.spyLaneLabel(state, player, lane);
			title.title = "";
		}
		const here = [];
		for (let i = 0; i < spies.length; i++) {
			if ((spies[i].post || "idle") === lane.id) here.push(spies[i]);
		}
		Space4x.syncKeyedList(box, here, function (s) { return s.id; },
			function (spy) { return Space4x.makeSpyToken(state, spy); },
			function (token, spy) {
				const img = token.querySelector("img");
				if (img) Space4x.setCultureImg(img, state, spy.culture);
				token.classList.toggle("is-selected", Space4x.spySelHas(state, spy.id));
				const who = Space4x.cultureName(state, spy.culture);
				token.title = (who ? who + " spy" : "Spy") + " · click then click a lane";
			}
		);
	}

	Space4x.syncKeyedList(ui.spyBoard, items, function (item) { return item.id; },
		function (item) {
			if (item.kind === "head") {
				const h = document.createElement("div");
				h.className = "spy-lane-head";
				const swatch = document.createElement("span");
				swatch.className = "spy-lane-swatch";
				const label = document.createElement("span");
				label.className = "spy-lane-head-label";
				h.appendChild(swatch);
				h.appendChild(label);
				return h;
			}
			const row = document.createElement("div");
			row.className = "spy-track-row";
			return row;
		},
		function (node, item) {
			if (item.kind === "head") {
				const lane = item.lane;
				const swatch = node.querySelector(".spy-lane-swatch");
				const label = node.querySelector(".spy-lane-head-label");
				if (label) label.textContent = lane.label || "";
				if (swatch) {
					if (lane.empireId) {
						swatch.hidden = false;
						swatch.style.background = Space4x.empireColor(state, lane.empireId);
					} else {
						swatch.hidden = true;
					}
				}
				return;
			}
			Space4x.syncKeyedList(node, item.lanes, function (lane) { return lane.id; },
				function () {
					const track = document.createElement("div");
					track.className = "job-lane spy-track";
					const title = document.createElement("div");
					title.className = "job-lane-title spy-track-title";
					const pops = document.createElement("div");
					pops.className = "job-lane-pops";
					track.appendChild(title);
					track.appendChild(pops);
					return track;
				},
				syncTrack
			);
		}
	);

	const popRows = ui.spyBoard.querySelectorAll(".job-lane-pops");
	for (let i = 0; i < popRows.length; i++) {
		if (Space4x.fitOverlappingRow) Space4x.fitOverlappingRow(popRows[i], 22, 6);
	}

	const targets = player ? Space4x.inciteRevoltTargets(state, player) : [];
	if (ui.spyIncite) ui.spyIncite.hidden = !targets.length;
	if (ui.spyInciteTarget && targets.length) {
		const prev = ui.spyInciteTarget.value;
		while (ui.spyInciteTarget.firstChild) ui.spyInciteTarget.removeChild(ui.spyInciteTarget.firstChild);
		for (let t = 0; t < targets.length; t++) {
			const opt = document.createElement("option");
			opt.value = targets[t].id;
			opt.textContent = Space4x.settlementLabel(state, targets[t]);
			ui.spyInciteTarget.appendChild(opt);
		}
		if (prev) ui.spyInciteTarget.value = prev;
		if (!ui.spyInciteTarget.value && targets[0]) ui.spyInciteTarget.value = targets[0].id;
	}
	if (ui.spyInciteCost && targets.length) {
		const pick = Space4x.settlementById(state, ui.spyInciteTarget ? ui.spyInciteTarget.value : null);
		if (pick) {
			const cost = Space4x.inciteRevoltCost(state, pick);
			const posted = Space4x.spyCountAtSettlement(player, pick.id);
			Space4x.setText(ui.spyInciteCost, "Costs " + Space4x.fmtMoney(cost) + " and " +
				posted + " posted " + (posted === 1 ? "spy" : "spies") + " (one is lost).");
		}
	}
	if (ui.btnSpyIncite && targets.length) {
		const pick = Space4x.settlementById(state, ui.spyInciteTarget ? ui.spyInciteTarget.value : null);
		const cost = pick ? Space4x.inciteRevoltCost(state, pick) : 0;
		ui.btnSpyIncite.disabled = !pick || (player.stockpiles.money || 0) < cost;
	}
};
