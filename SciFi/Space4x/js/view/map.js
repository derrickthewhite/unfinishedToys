var Space4x = Space4x || {};

Space4x.EMPIRE_COLORS = ["#6ea8fe", "#f07178", "#c3e88d", "#ffcb6b", "#c792ea"];

Space4x.mapLayout = function (ui, state) {
	const canvas = ui.canvas;
	const w = canvas.clientWidth || canvas.width;
	const h = canvas.clientHeight || canvas.height;
	if (canvas.width !== w) canvas.width = w;
	if (canvas.height !== h) canvas.height = h;
	const gw = state.galaxy.width;
	const gh = state.galaxy.height;
	const view = state.ui.mapView || { zoom: 1, panX: null, panY: null };
	const zoom = view.zoom || 1;
	const base = Math.min((w - 24) / Math.max(1, gw), (h - 24) / Math.max(1, gh));
	const cell = Math.max(6, base * zoom);
	let panX = view.panX;
	let panY = view.panY;
	if (panX == null || panY == null) {
		panX = (w - gw * cell) / 2;
		panY = (h - gh * cell) / 2;
	}
	return { w: w, h: h, gw: gw, gh: gh, cell: cell, panX: panX, panY: panY, zoom: zoom };
};

Space4x.gridToScreen = function (layout, gx, gy) {
	return {
		x: layout.panX + (gx + 0.5) * layout.cell,
		y: layout.panY + (gy + 0.5) * layout.cell
	};
};

Space4x.drawMap = function (ui, state) {
	const canvas = ui.canvas;
	const ctx = canvas.getContext("2d");
	const layout = Space4x.mapLayout(ui, state);
	ctx.fillStyle = "#070b16";
	ctx.fillRect(0, 0, layout.w, layout.h);
	if (state.screen !== "play" || !state.galaxy.stars.length) return;
	const cell = layout.cell;
	state.ui._map = layout;

	ctx.strokeStyle = "#182238";
	ctx.lineWidth = 1;
	for (let x = 0; x <= layout.gw; x++) {
		const px = layout.panX + x * cell;
		ctx.beginPath();
		ctx.moveTo(px, layout.panY);
		ctx.lineTo(px, layout.panY + layout.gh * cell);
		ctx.stroke();
	}
	for (let y = 0; y <= layout.gh; y++) {
		const py = layout.panY + y * cell;
		ctx.beginPath();
		ctx.moveTo(layout.panX, py);
		ctx.lineTo(layout.panX + layout.gw * cell, py);
		ctx.stroke();
	}

	const player = Space4x.playerEmpire(state);
	if (player) {
		const stats = Space4x.shipStats(state, player);
		const homes = Space4x.friendlyStars(state, player.id);
		ctx.fillStyle = "rgba(110,168,254,0.08)";
		for (let i = 0; i < homes.length; i++) {
			const p = Space4x.gridToScreen(layout, homes[i].x, homes[i].y);
			ctx.beginPath();
			ctx.arc(p.x, p.y, stats.range * cell, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	for (let i = 0; i < state.galaxy.stars.length; i++) {
		const star = state.galaxy.stars[i];
		const p = Space4x.gridToScreen(layout, star.x, star.y);
		let color = "#d8deea";
		for (let s = 0; s < state.settlements.length; s++) {
			if (state.settlements[s].location.starId === star.id) {
				const emp = Space4x.empireById(state, state.settlements[s].empireId);
				const idx = state.empires.indexOf(emp);
				color = Space4x.EMPIRE_COLORS[idx] || "#fff";
			}
		}
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(p.x, p.y, Math.max(3, cell * 0.22), 0, Math.PI * 2);
		ctx.fill();
		if (state.ui.selectedStarId === star.id) {
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(p.x, p.y, Math.max(5, cell * 0.35), 0, Math.PI * 2);
			ctx.stroke();
		}
	}

	const fleets = Space4x.fleetMarkers(state, layout);
	layout.fleets = fleets;
	Space4x.drawFleetPaths(ctx, state, layout, fleets);
	for (let i = 0; i < fleets.length; i++) {
		const f = fleets[i];
		const emp = Space4x.empireById(state, f.units[0].empireId);
		const idx = state.empires.indexOf(emp);
		ctx.fillStyle = Space4x.EMPIRE_COLORS[idx] || "#fff";
		ctx.beginPath();
		ctx.moveTo(f.px, f.py - 5);
		ctx.lineTo(f.px + 5, f.py + 4);
		ctx.lineTo(f.px - 5, f.py + 4);
		ctx.closePath();
		ctx.fill();
		let selected = false;
		for (let u = 0; u < f.units.length; u++) {
			if (Space4x.unitIsSelected(state, f.units[u].id)) selected = true;
		}
		if (selected) {
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 1.5;
			ctx.strokeRect(f.px - 7, f.py - 7, 14, 14);
		}
		let mark = f.units.length;
		let popCargo = 0;
		let troopCargo = 0;
		for (let u = 0; u < f.units.length; u++) {
			if (Space4x.isPopHauler(state, f.units[u])) popCargo += (f.units[u].cargoPops || []).length;
			if (Space4x.isTroopHauler(state, f.units[u])) troopCargo += (f.units[u].cargoTroops || []).length;
		}
		if (popCargo) mark = popCargo;
		else if (troopCargo) mark = troopCargo;
		if (mark > 1) {
			ctx.fillStyle = "#e8eef8";
			ctx.font = "10px sans-serif";
			ctx.fillText(String(mark), f.px + 6, f.py - 4);
		}
	}
};

Space4x.fleetMarkers = function (state, layout) {
	const groups = {};
	const order = [];
	const player = Space4x.playerEmpire(state);
	for (let i = 0; i < state.units.length; i++) {
		const unit = state.units[i];
		if (player && !Space4x.unitVisibleTo(state, player.id, unit)) continue;
		let key;
		let starId = null;
		let gx = unit.location.x;
		let gy = unit.location.y;
		let kind = unit.location.kind;
		if (kind === "space") {
			key = "space:" + unit.empireId + ":" + Space4x.fmtCoord(gx) + ":" + Space4x.fmtCoord(gy);
		} else {
			starId = Space4x.unitStarId(state, unit);
			const star = Space4x.starById(state, starId);
			if (star) {
				gx = star.x;
				gy = star.y;
			}
			key = "star:" + unit.empireId + ":" + (starId || gx + ":" + gy);
			kind = "star";
		}
		if (!groups[key]) {
			groups[key] = { key: key, kind: kind, starId: starId, gx: gx, gy: gy, units: [] };
			order.push(groups[key]);
		}
		groups[key].units.push(unit);
	}
	const off = Math.max(8, layout.cell * 0.38);
	for (let i = 0; i < order.length; i++) {
		const g = order[i];
		const c = Space4x.gridToScreen(layout, g.gx, g.gy);
		if (g.kind === "star") {
			const emp = Space4x.empireById(state, g.units[0].empireId);
			const idx = Math.max(0, state.empires.indexOf(emp));
			const ang = -0.35 + idx * 0.9;
			g.px = c.x + Math.cos(ang) * off;
			g.py = c.y + Math.sin(ang) * off * 0.7;
		} else {
			g.px = c.x;
			g.py = c.y;
		}
	}
	return order;
};

Space4x.drawFleetPaths = function (ctx, state, layout, fleets) {
	const dash = Math.max(3, layout.cell * 0.14);
	ctx.lineWidth = Math.max(1.25, layout.cell * 0.06);
	ctx.setLineDash([dash, dash * 0.85]);
	for (let i = 0; i < fleets.length; i++) {
		const f = fleets[i];
		const seen = {};
		for (let u = 0; u < f.units.length; u++) {
			const destId = f.units[u].targetStarId;
			if (!destId || seen[destId]) continue;
			seen[destId] = true;
			const dest = Space4x.starById(state, destId);
			if (!dest) continue;
			if (f.kind === "star" && f.starId === destId) continue;
			const p = Space4x.gridToScreen(layout, dest.x, dest.y);
			const emp = Space4x.empireById(state, f.units[0].empireId);
			const idx = state.empires.indexOf(emp);
			ctx.strokeStyle = Space4x.EMPIRE_COLORS[idx] || "#fff";
			ctx.beginPath();
			ctx.moveTo(f.px, f.py);
			ctx.lineTo(p.x, p.y);
			ctx.stroke();
		}
	}
	ctx.setLineDash([]);
};

Space4x.mapClick = function (ui, state, cmds, ev) {
	const info = state.ui._map;
	if (!info) return;
	const rect = ui.canvas.getBoundingClientRect();
	const x = ev.clientX - rect.left;
	const y = ev.clientY - rect.top;
	const fleets = info.fleets || [];
	const fleetHitR = Math.max(14, info.cell * 0.42);
	let bestFleet = null;
	let bestFleetD = fleetHitR;
	for (let i = 0; i < fleets.length; i++) {
		const f = fleets[i];
		const d = Math.sqrt((x - f.px) * (x - f.px) + (y - f.py) * (y - f.py));
		if (d < bestFleetD) {
			bestFleetD = d;
			bestFleet = f;
		}
	}
	const gx = Math.floor((x - info.panX) / info.cell);
	const gy = Math.floor((y - info.panY) / info.cell);
	const star = (gx >= 0 && gy >= 0 && gx < state.galaxy.width && gy < state.galaxy.height)
		? Space4x.starAt(state, gx, gy) : null;
	let starD = Infinity;
	if (star) {
		const p = Space4x.gridToScreen(info, star.x, star.y);
		starD = Math.sqrt((x - p.x) * (x - p.x) + (y - p.y) * (y - p.y));
	}
	const starHitR = Math.max(10, info.cell * 0.4);
	const starHit = star && starD <= starHitR;
	if (bestFleet && (!starHit || bestFleetD < starD)) {
		const ids = [];
		for (let i = 0; i < bestFleet.units.length; i++) ids.push(bestFleet.units[i].id);
		if (bestFleet.starId) {
			cmds.selectUnits(ids);
			cmds.selectStar(bestFleet.starId);
		} else {
			state.ui.selectedStarId = null;
			state.ui.stage = "galaxy";
			state.ui.panel = "system";
			cmds.selectUnits(ids);
		}
		return;
	}
	if (star) {
		const ids = Space4x.orderableSelectedIds(state);
		if (ids.length) cmds.sendSelectedToStar(star.id);
		else cmds.selectStar(star.id);
	}
};

Space4x.bindMapInput = function (app) {
	const canvas = app.ui.canvas;
	const drag = { on: false, panned: false, x: 0, y: 0, panX: 0, panY: 0 };
	canvas.addEventListener("pointerdown", function (ev) {
		if (ev.button !== 0) return;
		if (app.state.ui.stage !== "galaxy") return;
		const info = app.state.ui._map;
		if (!info) return;
		drag.on = true;
		drag.panned = false;
		drag.x = ev.clientX;
		drag.y = ev.clientY;
		drag.panX = info.panX;
		drag.panY = info.panY;
		try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
	});
	canvas.addEventListener("pointermove", function (ev) {
		if (!drag.on) return;
		const dx = ev.clientX - drag.x;
		const dy = ev.clientY - drag.y;
		if (!drag.panned && dx * dx + dy * dy < 36) return;
		drag.panned = true;
		canvas.style.cursor = "grabbing";
		app.state.ui.mapView.panX = drag.panX + dx;
		app.state.ui.mapView.panY = drag.panY + dy;
		Space4x.drawMap(app.ui, app.state);
	});
	function endDrag(ev) {
		if (!drag.on) return;
		drag.on = false;
		canvas.style.cursor = "";
		if (!drag.panned) Space4x.mapClick(app.ui, app.state, app.cmds, ev);
	}
	canvas.addEventListener("pointerup", endDrag);
	canvas.addEventListener("pointercancel", function () {
		drag.on = false;
		canvas.style.cursor = "";
	});
	canvas.addEventListener("wheel", function (ev) {
		if (app.state.ui.stage !== "galaxy") return;
		ev.preventDefault();
		const info = app.state.ui._map;
		if (!info) return;
		const rect = canvas.getBoundingClientRect();
		const mx = ev.clientX - rect.left;
		const my = ev.clientY - rect.top;
		const worldX = (mx - info.panX) / info.cell;
		const worldY = (my - info.panY) / info.cell;
		const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
		let zoom = (app.state.ui.mapView.zoom || 1) * factor;
		if (zoom < 0.4) zoom = 0.4;
		if (zoom > 8) zoom = 8;
		app.state.ui.mapView.zoom = zoom;
		const next = Space4x.mapLayout(app.ui, app.state);
		app.state.ui.mapView.panX = mx - worldX * next.cell;
		app.state.ui.mapView.panY = my - worldY * next.cell;
		Space4x.drawMap(app.ui, app.state);
	}, { passive: false });
};
