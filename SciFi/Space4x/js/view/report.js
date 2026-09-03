var Space4x = Space4x || {};

Space4x.reportLineNoise = function (seed, along, axis) {
	const h = Math.sin(seed * 12.9898 + along * 0.417 + axis * 78.233) * 43758.5453;
	return (h - Math.floor(h) - 0.5) * 1.6;
};

Space4x.reportEmpires = function (state) {
	if (!state.scoreEmpireMeta) state.scoreEmpireMeta = {};
	const byId = {};
	const out = [];
	for (let i = 0; i < state.empires.length; i++) {
		const e = state.empires[i];
		byId[e.id] = true;
		out.push(e);
		state.scoreEmpireMeta[e.id] = { name: e.name, colorId: e.colorId, isPlayer: !!e.isPlayer };
	}
	const history = state.scoreHistory || [];
	for (let t = 0; t < history.length; t++) {
		const scores = history[t].scores || {};
		const ids = Object.keys(scores);
		for (let i = 0; i < ids.length; i++) {
			const id = ids[i];
			if (byId[id]) continue;
			byId[id] = true;
			const meta = state.scoreEmpireMeta[id] || {};
			out.push({
				id: id,
				name: meta.name || "Fallen empire",
				colorId: meta.colorId,
				isPlayer: !!meta.isPlayer,
				fallen: true
			});
		}
	}
	return out;
};

Space4x.drawScoreChart = function (canvas, history, empires, key, state) {
	if (!canvas) return;
	const cssW = canvas.clientWidth || 280;
	const cssH = canvas.clientHeight || 140;
	const dpr = window.devicePixelRatio || 1;
	const w = Math.max(1, Math.round(cssW * dpr));
	const h = Math.max(1, Math.round(cssH * dpr));
	if (canvas.width !== w) canvas.width = w;
	if (canvas.height !== h) canvas.height = h;
	const ctx = canvas.getContext("2d");
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, cssW, cssH);
	ctx.fillStyle = "#070b16";
	ctx.fillRect(0, 0, cssW, cssH);
	ctx.strokeStyle = "#3a4d7a";
	ctx.strokeRect(0.5, 0.5, cssW - 1, cssH - 1);
	if (!history.length || !empires.length) return;
	let max = 0;
	for (let t = 0; t < history.length; t++) {
		const scores = history[t].scores || {};
		for (let e = 0; e < empires.length; e++) {
			const row = scores[empires[e].id];
			const n = row ? (row[key] || 0) : 0;
			if (n > max) max = n;
		}
	}
	const padX = 10;
	const padY = 10;
	const innerW = Math.max(1, cssW - padX * 2);
	const innerH = Math.max(1, cssH - padY * 2);
	ctx.strokeStyle = "#182238";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(padX, padY + innerH * 0.5);
	ctx.lineTo(padX + innerW, padY + innerH * 0.5);
	ctx.stroke();
	const drawOrder = empires.slice();
	drawOrder.sort(function (a, b) {
		if (a.isPlayer) return 1;
		if (b.isPlayer) return -1;
		return 0;
	});
	for (let e = 0; e < drawOrder.length; e++) {
		const empire = drawOrder[e];
		const idx = empires.indexOf(empire);
		const color = state
			? Space4x.empireColor(state, empire.id)
			: (Space4x.EMPIRE_COLORS[empire.colorId != null ? empire.colorId : idx] || "#fff");
		const pts = [];
		let stopped = false;
		for (let t = 0; t < history.length; t++) {
			const row = (history[t].scores || {})[empire.id];
			if (!row) {
				if (pts.length) stopped = true;
				continue;
			}
			if (stopped) continue;
			const x = history.length === 1
				? padX
				: padX + t * innerW / (history.length - 1);
			const v = row[key] || 0;
			const y = padY + innerH - (max > 0 ? (v / max) * innerH : 0);
			pts.push({
				x: x + Space4x.reportLineNoise(idx + 1, t, 0),
				y: y + Space4x.reportLineNoise(idx + 1, t, 1)
			});
		}
		if (!pts.length) continue;
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineWidth = empire.isPlayer ? 2.6 : 2;
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		ctx.shadowColor = color;
		ctx.shadowBlur = 0.65;
		ctx.beginPath();
		if (pts.length === 1) {
			ctx.moveTo(pts[0].x, pts[0].y);
			ctx.lineTo(Math.min(padX + innerW, pts[0].x + 8), pts[0].y);
		} else {
			ctx.moveTo(pts[0].x, pts[0].y);
			for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
		}
		ctx.stroke();
		ctx.shadowBlur = 0;
	}
};

Space4x.syncReportStage = function (ui, state) {
	if (!state.scoreHistory) state.scoreHistory = [];
	if (!state.scoreHistory.length && state.empires && state.empires.length) {
		Space4x.recordScoreSnapshot(state);
	}
	const empires = Space4x.reportEmpires(state);
	if (ui.reportLegend) {
		Space4x.syncKeyedList(ui.reportLegend, empires, function (e) { return e.id; },
			function () {
				const li = document.createElement("li");
				const swatch = document.createElement("span");
				swatch.className = "report-swatch";
				const name = document.createElement("span");
				li.appendChild(swatch);
				li.appendChild(name);
				return li;
			},
			function (row, empire) {
				row.querySelector(".report-swatch").style.background = Space4x.empireColor(state, empire.id);
				row.querySelector("span:last-child").textContent =
					empire.name + (empire.fallen ? " (fallen)" : "");
			}
		);
	}
	const canvases = ui.reportCharts ? ui.reportCharts.querySelectorAll("canvas") : [];
	for (let i = 0; i < canvases.length; i++) {
		const key = canvases[i].getAttribute("data-score");
		if (key) Space4x.drawScoreChart(canvases[i], state.scoreHistory, empires, key, state);
	}
};
