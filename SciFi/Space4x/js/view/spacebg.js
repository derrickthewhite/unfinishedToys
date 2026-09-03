var Space4x = Space4x || {};

Space4x._spaceBgCache = Space4x._spaceBgCache || {};
Space4x.SPACE_BG_CACHE_VER = 2;

Space4x.spaceBgPresets = {
	galaxy: {
		starDensity: 62,
		starBrightness: 52,
		starColor: 28,
		hazeAmount: 30,
		hazeScale: 55,
		dustAmount: 16,
		hazeColor: "mixed",
		featureCount: 3,
		featureStrength: 34,
		centerQuiet: 18,
		avoidCenter: false,
		pixelScale: 2.5,
		crispPixels: false
	},
	combat: {
		starDensity: 58,
		starBrightness: 48,
		starColor: 22,
		hazeAmount: 24,
		hazeScale: 48,
		dustAmount: 14,
		hazeColor: "blue",
		featureCount: 2,
		featureStrength: 30,
		centerQuiet: 62,
		avoidCenter: true,
		pixelScale: 2,
		crispPixels: false
	}
};

Space4x.ensureGalaxyBgSeed = function (state) {
	if (!state || !state.galaxy) return 1;
	if (state.galaxy.bgSeed == null) {
		const base = state.gen && state.gen.seed != null ? String(state.gen.seed) : String(state.rng || 1);
		state.galaxy.bgSeed = (Space4x.seedFromString(base + ":galaxy-bg") >>> 0) || 1;
	}
	return state.galaxy.bgSeed;
};

Space4x.ensureCombatBgSeed = function (state, battle) {
	if (!battle) return 1;
	if (battle.bgSeed == null) {
		const base = battle.id || ("sb" + Space4x.rngInt(state, 1e9));
		battle.bgSeed = (Space4x.seedFromString(String(base) + ":combat-bg") >>> 0) ||
			(1 + Space4x.rngInt(state, 2147483646));
	}
	return battle.bgSeed;
};

Space4x.spaceBgCacheKey = function (kind, seed, w, h) {
	return (Space4x.SPACE_BG_CACHE_VER || 1) + ":" + kind + ":" + seed + ":" + w + "x" + h;
};

Space4x.getSpaceBackgroundCanvas = function (kind, seed, w, h) {
	w = Math.max(64, Math.round(w) || 720);
	h = Math.max(64, Math.round(h) || 480);
	seed = (seed >>> 0) || 1;
	const key = Space4x.spaceBgCacheKey(kind, seed, w, h);
	const hit = Space4x._spaceBgCache[key];
	if (hit) return hit;
	const prefix = (Space4x.SPACE_BG_CACHE_VER || 1) + ":" + kind + ":" + seed + ":";
	const keys = Object.keys(Space4x._spaceBgCache);
	for (let i = 0; i < keys.length; i++) {
		if (keys[i].indexOf(prefix) === 0) delete Space4x._spaceBgCache[keys[i]];
	}
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const preset = Space4x.spaceBgPresets[kind] || Space4x.spaceBgPresets.combat;
	const options = Object.assign({}, preset, { seed: seed });
	if (typeof DeepSpaceBackground !== "undefined" && DeepSpaceBackground.generateSpaceBackground) {
		DeepSpaceBackground.generateSpaceBackground(canvas, options);
	} else if (typeof generateSpaceBackground === "function") {
		generateSpaceBackground(canvas, options);
	} else {
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = kind === "galaxy" ? "#070b16" : "#050814";
		ctx.fillRect(0, 0, w, h);
	}
	Space4x._spaceBgCache[key] = canvas;
	return canvas;
};

/** Texture size tied to grid dimensions so the image stays fixed while panning/zooming. */
Space4x.spaceBgTextureSize = function (gw, gh) {
	const aspect = Math.max(0.25, (gw || 1) / Math.max(1, gh || 1));
	let tw = Math.max(512, Math.min(2048, Math.round((gw || 30) * 28)));
	let th = Math.max(512, Math.min(2048, Math.round(tw / aspect)));
	if (th * aspect > tw + 1) tw = Math.round(th * aspect);
	return { w: tw, h: th };
};

/**
 * Draw a space background locked to a cell grid, with margin outside the grid edges.
 * marginFrac 0.1 => 10% of grid size on each side.
 */
Space4x.drawSpaceBackgroundForGrid = function (ctx, kind, seed, layout, marginFrac) {
	if (!ctx || !layout) return;
	const m = marginFrac != null ? marginFrac : 0.1;
	const gridW = layout.gw * layout.cell;
	const gridH = layout.gh * layout.cell;
	const mx = gridW * m;
	const my = gridH * m;
	const dx = layout.panX - mx;
	const dy = layout.panY - my;
	const dw = gridW + mx * 2;
	const dh = gridH + my * 2;
	const tex = Space4x.spaceBgTextureSize(layout.gw, layout.gh);
	const bg = Space4x.getSpaceBackgroundCanvas(kind, seed, tex.w, tex.h);
	ctx.drawImage(bg, dx, dy, dw, dh);
};

Space4x.drawSpaceBackground = function (ctx, kind, seed, w, h) {
	if (!ctx) return;
	const bg = Space4x.getSpaceBackgroundCanvas(kind, seed, w, h);
	ctx.drawImage(bg, 0, 0, w, h);
};

/** Assign combat backgrounds to any live battles that predate the feature. */
Space4x.ensureAllCombatBgSeeds = function (state) {
	const list = Space4x.spaceBattlesOf(state);
	for (let i = 0; i < list.length; i++) Space4x.ensureCombatBgSeed(state, list[i]);
};
