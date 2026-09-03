var Space4x = Space4x || {};

/* Mix of bright and deep tones so neighboring empires stay separable on the map. */
Space4x.EMPIRE_COLORS = [
	"#3b82f6", "#dc2626", "#16a34a", "#facc15", "#5b21b6",
	"#f8cacc", "#94a3b8", "#78350f", "#6b7c3a", "#ea580c",
	"#0891b2", "#be123c", "#1e3a8a", "#db2777", "#365314",
	"#f97316", "#7c3aed", "#0f766e", "#e11d48", "#a16207",
	"#2563eb", "#86198f", "#15803d", "#c2410c", "#312e81",
	"#b91c1c", "#0369a1", "#a21caf", "#4d7c0f", "#7c2d12"
];

Space4x.RANDOM_COLOR = "random";

Space4x.isRandomColor = function (id) {
	return id == null || id === "" || id === Space4x.RANDOM_COLOR;
};

Space4x.colorHex = function (colorId) {
	if (Space4x.isRandomColor(colorId)) return null;
	const n = typeof colorId === "number" ? colorId : parseInt(colorId, 10);
	return Space4x.EMPIRE_COLORS[n] || null;
};

Space4x.empireColor = function (state, empireId) {
	if (!empireId) return "#d8deea";
	const emp = Space4x.empireById(state, empireId);
	if (emp) {
		if (emp.colorId != null && Space4x.EMPIRE_COLORS[emp.colorId]) {
			return Space4x.EMPIRE_COLORS[emp.colorId];
		}
		const idx = state.empires.indexOf(emp);
		return Space4x.EMPIRE_COLORS[idx % Space4x.EMPIRE_COLORS.length] || "#d8deea";
	}
	const meta = state && state.scoreEmpireMeta && state.scoreEmpireMeta[empireId];
	if (meta && meta.colorId != null && Space4x.EMPIRE_COLORS[meta.colorId]) {
		return Space4x.EMPIRE_COLORS[meta.colorId];
	}
	return "#d8deea";
};

Space4x.ensureEmpireColors = function (state) {
	if (!state || !state.empires) return;
	const used = {};
	for (let i = 0; i < state.empires.length; i++) {
		const emp = state.empires[i];
		if (emp.colorId != null && Space4x.EMPIRE_COLORS[emp.colorId] && !used[emp.colorId]) {
			used[emp.colorId] = emp.id;
			continue;
		}
		emp.colorId = null;
	}
	for (let i = 0; i < state.empires.length; i++) {
		const emp = state.empires[i];
		if (emp.colorId != null) continue;
		let pick = i % Space4x.EMPIRE_COLORS.length;
		for (let t = 0; t < Space4x.EMPIRE_COLORS.length; t++) {
			const id = (i + t) % Space4x.EMPIRE_COLORS.length;
			if (!used[id]) {
				pick = id;
				break;
			}
		}
		emp.colorId = pick;
		used[pick] = emp.id;
	}
};

Space4x.setEmpireColor = function (state, empireId, colorId) {
	Space4x.ensureEmpireColors(state);
	const emp = Space4x.empireById(state, empireId);
	if (!emp || colorId == null || !Space4x.EMPIRE_COLORS[colorId]) return false;
	if (emp.colorId === colorId) return true;
	let other = null;
	for (let i = 0; i < state.empires.length; i++) {
		if (state.empires[i].id !== empireId && state.empires[i].colorId === colorId) {
			other = state.empires[i];
			break;
		}
	}
	if (other) other.colorId = emp.colorId;
	emp.colorId = colorId;
	return true;
};

Space4x.genColorOwners = function (gen) {
	const owners = [];
	if (!gen) return owners;
	owners.push({
		key: "player",
		get: function () { return gen.playerColorId; },
		set: function (id) { gen.playerColorId = id; }
	});
	const list = gen.opponents || [];
	for (let i = 0; i < list.length; i++) {
		(function (slot) {
			owners.push({
				key: slot.id,
				get: function () { return slot.colorId; },
				set: function (id) { slot.colorId = id; }
			});
		})(list[i]);
	}
	return owners;
};

Space4x.ensureGenColors = function (gen) {
	if (!gen) return;
	const owners = Space4x.genColorOwners(gen);
	const used = {};
	for (let i = 0; i < owners.length; i++) {
		const raw = owners[i].get();
		const isPlayer = owners[i].key === "player";
		if (raw === Space4x.RANDOM_COLOR || raw === "random") {
			owners[i].set(Space4x.RANDOM_COLOR);
			continue;
		}
		if (raw == null || raw === "") {
			owners[i].set(isPlayer ? null : Space4x.RANDOM_COLOR);
			continue;
		}
		const id = typeof raw === "number" ? raw : parseInt(raw, 10);
		if (!Space4x.EMPIRE_COLORS[id] || used[id]) {
			owners[i].set(isPlayer ? null : Space4x.RANDOM_COLOR);
			continue;
		}
		owners[i].set(id);
		used[id] = owners[i].key;
	}
	for (let i = 0; i < owners.length; i++) {
		if (owners[i].key !== "player") continue;
		if (owners[i].get() != null) continue;
		let pick = 0;
		for (let t = 0; t < Space4x.EMPIRE_COLORS.length; t++) {
			if (!used[t]) {
				pick = t;
				break;
			}
		}
		owners[i].set(pick);
		used[pick] = "player";
	}
};

Space4x.setGenColor = function (gen, ownerKey, colorId) {
	Space4x.ensureGenColors(gen);
	const owners = Space4x.genColorOwners(gen);
	let mine = null;
	for (let i = 0; i < owners.length; i++) {
		if (owners[i].key === ownerKey) mine = owners[i];
	}
	if (!mine) return false;
	if (Space4x.isRandomColor(colorId) || colorId === Space4x.RANDOM_COLOR) {
		mine.set(Space4x.RANDOM_COLOR);
		return true;
	}
	const n = typeof colorId === "number" ? colorId : parseInt(colorId, 10);
	if (!Space4x.EMPIRE_COLORS[n]) return false;
	if (mine.get() === n) return true;
	let other = null;
	for (let i = 0; i < owners.length; i++) {
		if (owners[i].key === ownerKey) continue;
		if (!Space4x.isRandomColor(owners[i].get()) && owners[i].get() === n) {
			other = owners[i];
			break;
		}
	}
	if (other) other.set(mine.get());
	mine.set(n);
	return true;
};

Space4x.resolveGenColorId = function (state, colorId, used) {
	const n = typeof colorId === "number" ? colorId : parseInt(colorId, 10);
	if (!Space4x.isRandomColor(colorId) && Space4x.EMPIRE_COLORS[n] && !used[n]) {
		used[n] = true;
		return n;
	}
	const opts = [];
	for (let i = 0; i < Space4x.EMPIRE_COLORS.length; i++) {
		if (!used[i]) opts.push(i);
	}
	if (!opts.length) {
		for (let i = 0; i < Space4x.EMPIRE_COLORS.length; i++) opts.push(i);
	}
	const pick = opts[Space4x.rngInt(state, opts.length)];
	used[pick] = true;
	return pick;
};

Space4x.bindColorDropdownChrome = function () {
	if (Space4x._colorDdBound) return;
	Space4x._colorDdBound = true;
	document.addEventListener("click", function (ev) {
		const open = document.querySelectorAll(".gen-color-dd.is-open");
		for (let i = 0; i < open.length; i++) {
			if (!open[i].contains(ev.target)) open[i].classList.remove("is-open");
		}
	});
};

Space4x.syncColorDropdown = function (root, selectedId, takenMap, onPick) {
	if (!root) return;
	Space4x.bindColorDropdownChrome();
	root._onPick = onPick;
	if (!root._colorDdBuilt) {
		root._colorDdBuilt = true;
		root.classList.add("gen-color-dd");
		root.innerHTML = "";
		const toggle = document.createElement("button");
		toggle.type = "button";
		toggle.className = "gen-color-dd-toggle";
		const swatch = document.createElement("span");
		swatch.className = "gen-color-dd-swatch";
		const label = document.createElement("span");
		label.className = "gen-color-dd-label";
		const caret = document.createElement("span");
		caret.className = "gen-color-dd-caret";
		caret.textContent = "▾";
		toggle.appendChild(swatch);
		toggle.appendChild(label);
		toggle.appendChild(caret);
		const menu = document.createElement("div");
		menu.className = "gen-color-dd-menu";
		const randomBtn = document.createElement("button");
		randomBtn.type = "button";
		randomBtn.className = "gen-color-dd-random";
		randomBtn.textContent = "Random";
		const grid = document.createElement("div");
		grid.className = "gen-color-dd-grid";
		menu.appendChild(randomBtn);
		menu.appendChild(grid);
		root.appendChild(toggle);
		root.appendChild(menu);
		toggle.addEventListener("click", function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			const willOpen = !root.classList.contains("is-open");
			const open = document.querySelectorAll(".gen-color-dd.is-open");
			for (let i = 0; i < open.length; i++) open[i].classList.remove("is-open");
			if (willOpen) root.classList.add("is-open");
		});
		randomBtn.addEventListener("click", function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			root.classList.remove("is-open");
			if (root._onPick) root._onPick(Space4x.RANDOM_COLOR);
		});
	}
	const random = Space4x.isRandomColor(selectedId);
	const hex = Space4x.colorHex(selectedId);
	const swatchEl = root.querySelector(".gen-color-dd-swatch");
	const labelEl = root.querySelector(".gen-color-dd-label");
	const randomBtn = root.querySelector(".gen-color-dd-random");
	if (swatchEl) {
		swatchEl.style.background = hex || "transparent";
		swatchEl.classList.toggle("is-random", random);
	}
	if (labelEl) labelEl.textContent = random ? "Random" : (hex || "Color");
	if (randomBtn) randomBtn.classList.toggle("is-selected", random);
	const grid = root.querySelector(".gen-color-dd-grid");
	const items = Space4x.EMPIRE_COLORS.map(function (h, i) {
		return { id: String(i), hex: h, index: i };
	});
	Space4x.syncKeyedList(grid, items, function (c) { return c.id; },
		function () {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "empire-color-swatch";
			btn.addEventListener("click", function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
				root.classList.remove("is-open");
				if (root._onPick) root._onPick(parseInt(btn.getAttribute("data-id"), 10));
			});
			return btn;
		},
		function (btn, color) {
			btn.style.background = color.hex;
			btn.title = color.hex;
			btn.classList.toggle("is-selected", !random && selectedId === color.index);
			btn.classList.toggle("is-taken", !!(takenMap && takenMap[color.index] && selectedId !== color.index));
		}
	);
};

Space4x.starEmpireIds = function (state, starId) {
	const out = [];
	const seen = {};
	for (let i = 0; i < state.settlements.length; i++) {
		const st = state.settlements[i];
		if (st.location.starId !== starId || seen[st.empireId]) continue;
		seen[st.empireId] = true;
		out.push(st.empireId);
	}
	return out;
};

Space4x.drawStarDiamondPath = function (ctx, x, y, r) {
	const tip = r * 1.25;
	const waist = r * 0.42;
	ctx.beginPath();
	for (let i = 0; i < 4; i++) {
		const aTip = -Math.PI / 2 + i * (Math.PI / 2);
		const aWaist = aTip + Math.PI / 4;
		const tx = x + Math.cos(aTip) * tip;
		const ty = y + Math.sin(aTip) * tip;
		if (i === 0) ctx.moveTo(tx, ty);
		else ctx.lineTo(tx, ty);
		ctx.lineTo(x + Math.cos(aWaist) * waist, y + Math.sin(aWaist) * waist);
	}
	ctx.closePath();
};

Space4x.drawStarMarker = function (ctx, x, y, r, colors) {
	if (!colors || !colors.length) {
		ctx.fillStyle = "#d8deea";
		Space4x.drawStarDiamondPath(ctx, x, y, r);
		ctx.fill();
		return;
	}
	if (colors.length === 1) {
		ctx.fillStyle = colors[0];
		Space4x.drawStarDiamondPath(ctx, x, y, r);
		ctx.fill();
		return;
	}
	ctx.save();
	Space4x.drawStarDiamondPath(ctx, x, y, r);
	ctx.clip();
	const n = colors.length;
	const reach = r * 1.4;
	for (let i = 0; i < n; i++) {
		const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2;
		const a1 = -Math.PI / 2 + ((i + 1) / n) * Math.PI * 2;
		ctx.fillStyle = colors[i];
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.arc(x, y, reach, a0, a1);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
};
Space4x.drawStarLabel = function (ctx, x, y, r, name, cell) {
	if (!name || cell < 12) return;
	const size = Math.max(9, Math.min(12, cell * 0.3));
	ctx.font = size + "px sans-serif";
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	ctx.fillStyle = "#a8b4cc";
	ctx.fillText(name, x, y + r + Math.max(2, cell * 0.06));
};

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
	if (state.screen === "play" && state.galaxy && state.galaxy.stars && state.galaxy.stars.length) {
		const seed = Space4x.ensureGalaxyBgSeed(state);
		Space4x.drawSpaceBackgroundForGrid(ctx, "galaxy", seed, layout, 0.1);
	}
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
		const shipReach = Space4x.shipStats(state, player).range;
		const scanReach = Space4x.commsRangeOf(state, player);
		for (let gy = 0; gy < layout.gh; gy++) {
			for (let gx = 0; gx < layout.gw; gx++) {
				const cx = gx + 0.5;
				const cy = gy + 0.5;
				const inShip = Space4x.inRangeOfEmpire(state, player.id, cx, cy);
				const inScan = Space4x.inCommsRangeOfEmpire(state, player.id, cx, cy);
				if (!inScan && !inShip) continue;
				if (inScan && !inShip) ctx.fillStyle = "rgba(255,203,107,0.11)";
				else ctx.fillStyle = "rgba(110,168,254,0.14)";
				ctx.fillRect(layout.panX + gx * cell, layout.panY + gy * cell, cell, cell);
			}
		}
		Space4x.drawMapRangeLegend(ctx, layout, shipReach, scanReach);
	}

	for (let i = 0; i < state.galaxy.stars.length; i++) {
		const star = state.galaxy.stars[i];
		const p = Space4x.gridToScreen(layout, star.x, star.y);
		const r = Math.max(3, cell * 0.22);
		const owners = Space4x.starEmpireIds(state, star.id);
		const colors = [];
		for (let o = 0; o < owners.length; o++) colors.push(Space4x.empireColor(state, owners[o]));
		Space4x.drawStarMarker(ctx, p.x, p.y, r, colors);
		if (state.ui.selectedStarId === star.id) {
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(p.x, p.y, Math.max(5, cell * 0.35), 0, Math.PI * 2);
			ctx.stroke();
		}
		Space4x.drawStarLabel(ctx, p.x, p.y, r, star.name, cell);
	}

	const fleets = Space4x.fleetMarkers(state, layout);
	layout.fleets = fleets;
	Space4x.drawFleetPaths(ctx, state, layout, fleets);
	const shipR = Math.max(2.5, cell * 0.16);
	for (let i = 0; i < fleets.length; i++) {
		const f = fleets[i];
		const emp = Space4x.empireById(state, f.units[0].empireId);
		ctx.fillStyle = Space4x.empireColor(state, emp && emp.id);
		ctx.beginPath();
		ctx.moveTo(f.px, f.py - shipR);
		ctx.lineTo(f.px + shipR * 0.95, f.py + shipR * 0.75);
		ctx.lineTo(f.px - shipR * 0.95, f.py + shipR * 0.75);
		ctx.closePath();
		ctx.fill();
		let selected = false;
		for (let u = 0; u < f.units.length; u++) {
			if (Space4x.unitIsSelected(state, f.units[u].id)) selected = true;
		}
		if (selected) {
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = Math.max(1, cell * 0.04);
			const box = shipR * 1.35;
			ctx.strokeRect(f.px - box, f.py - box, box * 2, box * 2);
		}
		let mark = f.units.length;
		const mapLabel = mark > 1 ? String(mark) : "";
		if (mapLabel) {
			ctx.fillStyle = "#e8eef8";
			const fontPx = Math.max(7, Math.min(11, cell * 0.28));
			ctx.font = fontPx + "px sans-serif";
			ctx.fillText(mapLabel, f.px + shipR + 2, f.py - shipR * 0.4);
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

Space4x.drawMapRangeLegend = function (ctx, layout, shipReach, scanReach) {
	const pad = 8;
	const lineH = 14;
	const sw = 10;
	const rows = scanReach > shipReach ? 2 : 1;
	const boxH = pad * 2 + rows * lineH;
	const boxW = 132;
	const x = pad;
	const y = layout.h - boxH - pad;
	ctx.fillStyle = "rgba(7,11,22,0.82)";
	ctx.fillRect(x, y, boxW, boxH);
	ctx.strokeStyle = "#2a3555";
	ctx.lineWidth = 1;
	ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);
	ctx.font = "11px sans-serif";
	ctx.textBaseline = "middle";
	function row(i, color, label) {
		const ly = y + pad + i * lineH + lineH / 2;
		ctx.fillStyle = color;
		ctx.fillRect(x + pad, ly - sw / 2, sw, sw);
		ctx.fillStyle = "#c8d0e0";
		ctx.fillText(label, x + pad + sw + 6, ly);
	}
	row(0, "rgba(110,168,254,0.55)", "Ship " + shipReach);
	if (scanReach > shipReach) row(1, "rgba(255,203,107,0.55)", "Scan " + scanReach);
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
			ctx.strokeStyle = Space4x.empireColor(state, emp && emp.id);
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
			cmds.selectStar(bestFleet.starId, { keepShips: true });
			cmds.selectUnits(ids);
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
