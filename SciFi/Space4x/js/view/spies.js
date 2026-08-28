var Space4x = Space4x || {};

Space4x._spySel = { ids: [], fromLane: null };
Space4x._spyDrag = null;

Space4x.spySelHas = function (id) {
	const ids = Space4x._spySel && Space4x._spySel.ids;
	if (!ids) return false;
	for (let i = 0; i < ids.length; i++) if (ids[i] === id) return true;
	return false;
};

Space4x.clearSpySel = function () {
	Space4x._spySel = { ids: [], fromLane: null };
};

Space4x.clearSpyDrag = function () {
	const drag = Space4x._spyDrag;
	if (!drag) return;
	if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
	Space4x._spyDrag = null;
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
			tokens[i].classList.toggle("is-selected", Space4x.spySelHas(tokens[i].getAttribute("data-spy-id")));
		}
	}

	function clearLaneOver() {
		const lanes = board.querySelectorAll(".job-lane");
		for (let i = 0; i < lanes.length; i++) lanes[i].classList.remove("drag-over");
	}

	function laneUnder(ev) {
		const drag = Space4x._spyDrag;
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
		Space4x._spySel = { ids: ids, fromLane: lane.getAttribute("data-id") };
		paintSelected();
	}

	function assignToLane(laneId) {
		const ids = Space4x._spySel && Space4x._spySel.ids;
		if (!ids || !ids.length || !laneId) return false;
		Space4x.clearSpySel();
		Space4x.clearSpyDrag();
		app.cmds.setSpyPosts(ids, laneId);
		return true;
	}

	function onMove(ev) {
		const drag = Space4x._spyDrag;
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
		const drag = Space4x._spyDrag;
		if (!drag) return;
		if (drag.moved) {
			const over = paintOver(ev);
			const laneId = over ? over.getAttribute("data-id") : null;
			Space4x.clearSpyDrag();
			clearLaneOver();
			if (laneId) assignToLane(laneId);
			else paintSelected();
			return;
		}
		Space4x.clearSpyDrag();
		clearLaneOver();
		paintSelected();
	}

	function onLaneUp(ev) {
		window.removeEventListener("pointerup", onLaneUp);
		window.removeEventListener("pointercancel", onLaneUp);
		const laneId = Space4x._pendingSpyLane;
		Space4x._pendingSpyLane = null;
		if (!laneId) return;
		const over = laneUnder(ev);
		if (!over || over.getAttribute("data-id") !== laneId) return;
		if (laneId === Space4x._spySel.fromLane) {
			Space4x.clearSpySel();
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
			Space4x._spyDrag = {
				ids: Space4x._spySel.ids.slice(),
				fromLane: Space4x._spySel.fromLane,
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
		if (lane && Space4x._spySel.ids.length) {
			ev.preventDefault();
			Space4x._pendingSpyLane = lane.getAttribute("data-id");
			window.addEventListener("pointerup", onLaneUp);
			window.addEventListener("pointercancel", onLaneUp);
		}
	});
};

Space4x.syncSpyStage = function (ui, state, cmds) {
	if (!ui.spyBoard) return;
	if (Space4x._spyDrag && Space4x._spyDrag.moved) return;
	const player = Space4x.playerEmpire(state);
	if (ui.spySkill) {
		const skill = player ? Space4x.spySkill(state, player) : 0;
		const n = player ? Space4x.empireSpies(player).length : 0;
		Space4x.setText(ui.spySkill, "Spy skill " + skill + " · " + n + (n === 1 ? " spy" : " spies") +
			" · idle spies do nothing · Defend is a shared shield");
	}
	const lanes = player ? Space4x.spyLanes(state, player) : [];
	const spies = player ? Space4x.empireSpies(player) : [];
	Space4x.syncKeyedList(ui.spyBoard, lanes, function (lane) { return lane.id; },
		function (lane) {
			if (lane.kind === "head") {
				const h = document.createElement("div");
				h.className = "spy-lane-head";
				return h;
			}
			const row = document.createElement("div");
			row.className = "job-lane";
			const title = document.createElement("div");
			title.className = "job-lane-title";
			const pops = document.createElement("div");
			pops.className = "job-lane-pops";
			row.appendChild(title);
			row.appendChild(pops);
			return row;
		},
		function (row, lane) {
			if (lane.kind === "head") {
				row.textContent = lane.label || "";
				return;
			}
			row.setAttribute("data-id", lane.id);
			row.querySelector(".job-lane-title").textContent = Space4x.spyLaneLabel(state, player, lane);
			const here = [];
			for (let i = 0; i < spies.length; i++) {
				if ((spies[i].post || "idle") === lane.id) here.push(spies[i]);
			}
			const box = row.querySelector(".job-lane-pops");
			Space4x.syncKeyedList(box, here, function (s) { return s.id; },
				function (spy) { return Space4x.makeSpyToken(state, spy); },
				function (token, spy) {
					const img = token.querySelector("img");
					if (img) Space4x.setCultureImg(img, state, spy.culture);
					token.classList.toggle("is-selected", Space4x.spySelHas(spy.id));
					const who = Space4x.cultureName(state, spy.culture);
					token.title = (who ? who + " spy" : "Spy") + " · click then click a lane";
				}
			);
		}
	);
};
