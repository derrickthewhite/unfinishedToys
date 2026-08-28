var Space4x = Space4x || {};

Space4x.drawScoreChart = function (canvas, history, empires, key) {
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
		const color = Space4x.EMPIRE_COLORS[idx] || "#fff";
		const pts = [];
		for (let t = 0; t < history.length; t++) {
			const row = (history[t].scores || {})[empire.id];
			if (!row) continue;
			const x = history.length === 1
				? padX
				: padX + t * innerW / (history.length - 1);
			const v = row[key] || 0;
			const y = padY + innerH - (max > 0 ? (v / max) * innerH : 0);
			pts.push({ x: x, y: y });
		}
		if (!pts.length) continue;
		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineWidth = empire.isPlayer ? 2.6 : 2;
		ctx.beginPath();
		if (pts.length === 1) {
			ctx.moveTo(padX, pts[0].y);
			ctx.lineTo(padX + innerW, pts[0].y);
		} else {
			ctx.moveTo(pts[0].x, pts[0].y);
			for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
		}
		ctx.stroke();
		for (let i = 0; i < pts.length; i++) {
			ctx.beginPath();
			ctx.arc(pts[i].x, pts[i].y, empire.isPlayer ? 3 : 2.5, 0, Math.PI * 2);
			ctx.fill();
		}
	}
};

Space4x.syncReportStage = function (ui, state) {
	if (!state.scoreHistory) state.scoreHistory = [];
	if (!state.scoreHistory.length && state.empires && state.empires.length) {
		Space4x.recordScoreSnapshot(state);
	}
	if (ui.reportLegend) {
		Space4x.syncKeyedList(ui.reportLegend, state.empires, function (e) { return e.id; },
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
				const idx = state.empires.indexOf(empire);
				row.querySelector(".report-swatch").style.background = Space4x.EMPIRE_COLORS[idx] || "#fff";
				row.querySelector("span:last-child").textContent = empire.name;
			}
		);
	}
	const canvases = ui.reportCharts ? ui.reportCharts.querySelectorAll("canvas") : [];
	for (let i = 0; i < canvases.length; i++) {
		const key = canvases[i].getAttribute("data-score");
		if (key) Space4x.drawScoreChart(canvases[i], state.scoreHistory, state.empires, key);
	}
};
