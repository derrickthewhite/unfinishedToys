var Space4x = Space4x || {};

Space4x.clearQueueDrag = function (state) {
	if (!state || !state.ui) return;
	const drag = state.ui.queueDrag;
	if (!drag) return;
	if (drag.row) drag.row.classList.remove("is-dragging");
	state.ui.queueDrag = null;
};

Space4x.setText = function (node, text) {
	if (!node) return;
	const t = text == null ? "" : String(text);
	if (node.textContent !== t) node.textContent = t;
};

Space4x.syncKeyedList = function (root, items, keyFn, makeRow, updateRow) {
	const have = {};
	for (let i = 0; i < root.children.length; i++) {
		have[root.children[i].getAttribute("data-id")] = root.children[i];
	}
	const seen = {};
	for (let i = 0; i < items.length; i++) {
		const key = keyFn(items[i]);
		seen[key] = true;
		let row = have[key];
		if (!row) {
			row = makeRow(items[i]);
			row.setAttribute("data-id", key);
		}
		updateRow(row, items[i]);
		if (root.children[i] !== row) root.insertBefore(row, root.children[i] || null);
	}
	const remove = [];
	for (let i = 0; i < root.children.length; i++) {
		const id = root.children[i].getAttribute("data-id");
		if (!seen[id]) remove.push(root.children[i]);
	}
	for (let i = 0; i < remove.length; i++) root.removeChild(remove[i]);
};

Space4x.bindSettleQueue = function (app) {
	const root = app.ui.settleQueue;
	if (!root) return;
	const DRAG_PX = 6;

	function ownsQueue() {
		const st = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
		const player = Space4x.playerEmpire(app.state);
		return !!(st && player && st.empireId === player.id);
	}

	function rowUnder(ev) {
		const el = document.elementFromPoint(ev.clientX, ev.clientY);
		if (!el || !el.closest) return null;
		const row = el.closest("#settle-queue li");
		if (!row || !root.contains(row)) return null;
		return row;
	}

	function placeRow(ev, row) {
		const over = rowUnder(ev);
		if (!over || over === row) return;
		const rect = over.getBoundingClientRect();
		if (ev.clientY < rect.top + rect.height / 2) root.insertBefore(row, over);
		else root.insertBefore(row, over.nextSibling);
	}

	function onMove(ev) {
		const drag = app.state.ui.queueDrag;
		if (!drag) return;
		const dx = ev.clientX - drag.startX;
		const dy = ev.clientY - drag.startY;
		if (!drag.moved && (dx * dx + dy * dy) >= DRAG_PX * DRAG_PX) {
			if (root.children.length < 2) return;
			drag.moved = true;
			drag.row.classList.add("is-dragging");
			try { drag.row.setPointerCapture(ev.pointerId); } catch (e) {}
		}
		if (!drag.moved) return;
		placeRow(ev, drag.row);
	}

	function onUp() {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		const drag = app.state.ui.queueDrag;
		if (!drag) return;
		const moved = drag.moved;
		const onName = drag.onName;
		const queueId = drag.row.getAttribute("data-id");
		const defId = drag.row.getAttribute("data-def");
		const ids = [];
		for (let i = 0; i < root.children.length; i++) ids.push(root.children[i].getAttribute("data-id"));
		Space4x.clearQueueDrag(app.state);
		if (moved) app.cmds.reorderQueue(ids);
		else if (onName) app.cmds.inspectBuild("queue", defId, queueId);
	}

	root.addEventListener("pointerdown", function (ev) {
		if (ev.button && ev.button !== 0) return;
		if (!ownsQueue()) return;
		if (ev.target.closest && ev.target.closest(".q-rm")) return;
		const row = ev.target.closest("li");
		if (!row || !root.contains(row)) return;
		ev.preventDefault();
		Space4x.ensureUiInteraction(app.state);
		app.state.ui.queueDrag = {
			row: row,
			startX: ev.clientX,
			startY: ev.clientY,
			moved: false,
			onName: !!(ev.target.closest && ev.target.closest(".q-name"))
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
	});
};
