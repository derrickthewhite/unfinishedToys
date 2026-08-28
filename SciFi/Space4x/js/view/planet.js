var Space4x = Space4x || {};

Space4x.BIOME_COLORS = {
	garden: "#3d9b5f",
	ocean: "#2a6fb0",
	swamp: "#8a7e5c",
	arid: "#c4a35a",
	desert: "#d4a574",
	tundra: "#c5d4e0",
	barren: "#8a8680",
	toxic: "#7cb342"
};

Space4x.bodyRadius = function (body, maxR) {
	if (!body) return maxR * 0.4;
	if (body.kind === "gasGiant") return maxR;
	if (body.kind === "asteroidBelt") return maxR * 0.9;
	const sizes = { large: 0.85, medium: 0.62, small: 0.42, tiny: 0.28 };
	return maxR * (sizes[body.size] || 0.5);
};

Space4x.drawPlanet = function (canvas, body) {
	const ctx = canvas.getContext("2d");
	const w = canvas.width;
	const h = canvas.height;
	ctx.fillStyle = "#050814";
	ctx.fillRect(0, 0, w, h);
	const cx = w / 2;
	const cy = h / 2;
	const maxR = Math.min(w, h) * 0.42;
	if (!body) return;
	if (body.kind === "asteroidBelt") {
		ctx.strokeStyle = "#9aa0a6";
		ctx.fillStyle = "#6b6560";
		for (let i = 0; i < 18; i++) {
			const a = (i / 18) * Math.PI * 2;
			const r = maxR * (0.55 + (i % 3) * 0.12);
			const x = cx + Math.cos(a) * r;
			const y = cy + Math.sin(a) * r * 0.45;
			ctx.beginPath();
			ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
			ctx.fill();
		}
		return;
	}
	const r = Space4x.bodyRadius(body, maxR);
	if (body.kind === "gasGiant") {
		const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
		g.addColorStop(0, "#c9a36a");
		g.addColorStop(0.45, "#a56b3c");
		g.addColorStop(1, "#6b3d22");
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "rgba(255,220,160,0.35)";
		ctx.beginPath();
		ctx.ellipse(cx, cy, r * 1.25, r * 0.22, 0, 0, Math.PI * 2);
		ctx.stroke();
		return;
	}
	ctx.fillStyle = Space4x.BIOME_COLORS[body.biome] || "#888";
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "rgba(255,255,255,0.12)";
	ctx.beginPath();
	ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.45, 0, Math.PI * 2);
	ctx.fill();
};

Space4x.bodyCaption = function (body, state) {
	if (!body) return "";
	if (body.kind === "gasGiant") return "Gas giant";
	if (body.kind === "asteroidBelt") {
		let cap = "Asteroid belt";
		if (state) {
			const rich = Space4x.richnessOf(state, body);
			if (rich && rich.name) cap += " · " + rich.name;
		}
		return cap;
	}
	const size = body.size ? Space4x.titleCase(body.size) : "Rocky";
	const biome = body.biome ? Space4x.titleCase(body.biome) : "";
	let cap = biome ? size + " · " + biome : size;
	if (state) {
		const rich = Space4x.richnessOf(state, body);
		if (rich && rich.name) cap += " · " + rich.name;
	}
	return cap;
};
