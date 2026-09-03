var Space4x = Space4x || {};

Space4x.SHIP_ART_MAGENTA = /#ff00ff\b/gi;
Space4x.SHIP_ART_HEADING_OFFSET = Math.PI;
Space4x._shipArtRawCache = {};
Space4x._shipArtLayerCache = {};
Space4x._shipArtSvgText = {};

Space4x.DEFAULT_SHIP_ART = {
	cruiser: [
		"assets/ships/Cruiser/cruiser-1.svg",
		"assets/ships/Cruiser/crusier-2.svg",
		"assets/ships/Cruiser/crusier-3.svg",
		"assets/ships/Cruiser/cruiser-4.svg",
		"assets/ships/Cruiser/cruiser-5.svg",
		"assets/ships/Cruiser/cruiser-6.svg",
		"assets/ships/Cruiser/cruiser-7.svg",
		"assets/ships/Cruiser/cruiser-8.svg"
	],
	battleship: [
		"assets/ships/Battleship/Battleship-1.svg",
		"assets/ships/Battleship/Battleship-2.svg",
		"assets/ships/Battleship/Battleship-3.svg",
		"assets/ships/Battleship/Battleship-4.svg",
		"assets/ships/Battleship/Battleship-5.svg"
	],
	missile: [
		"assets/ships/missile.svg"
	],
	scout: [
		"assets/ships/scout.svg"
	],
	colonyShip: [
		"assets/ships/colony.svg"
	]
};

Space4x.HULL_SHIP_ART_FALLBACK = {
	cruiser: "assets/ships/cruiser.svg",
	battleship: "assets/ships/battleship.svg",
	missile: "assets/ships/missile.svg",
	scout: "assets/ships/scout.svg",
	colonyShip: "assets/ships/colony.svg"
};

Space4x.OBSERVER_SHIP_COLOR = "#e8eef8";

Space4x.designPreviewColor = function (state, host) {
	if (host && host.isObserverDraft) return Space4x.OBSERVER_SHIP_COLOR;
	if (host && host.id) return Space4x.empireColor(state, host.id);
	return Space4x.OBSERVER_SHIP_COLOR;
};

Space4x.shipArtCatalog = function (state) {
	const set = Space4x.settingOf(state);
	return (set && set.shipArt) || Space4x.DEFAULT_SHIP_ART;
};

Space4x.shipArtPaths = function (state, hullDefId) {
	const cat = Space4x.shipArtCatalog(state);
	const list = cat && hullDefId ? cat[hullDefId] : null;
	return list && list.length ? list.slice() : [];
};

Space4x.shipArtPathForIndex = function (state, hullDefId, index) {
	const paths = Space4x.shipArtPaths(state, hullDefId);
	if (!paths.length) return Space4x.HULL_SHIP_ART_FALLBACK[hullDefId] || null;
	const n = index != null ? index : 0;
	return paths[((n % paths.length) + paths.length) % paths.length];
};

Space4x.hullShipArtPath = function (state, hullDefId) {
	return Space4x.shipArtPathForIndex(state, hullDefId, 0);
};

Space4x.designIndexInPack = function (empire, hullDefId, design) {
	const pack = empire && empire.shipDesigns && empire.shipDesigns[hullDefId];
	if (!pack || !design) return 0;
	for (let i = 0; i < pack.list.length; i++) {
		if (pack.list[i].id === design.id) return i;
	}
	return 0;
};

Space4x.syncDesignShipArt = function (state, hullDefId, design, index) {
	if (!design) return;
	const idx = index != null ? index : 0;
	design.artIndex = idx;
	design.shipArt = Space4x.shipArtPathForIndex(state, hullDefId, idx);
};

Space4x.syncPackShipArt = function (state, hullDefId, pack) {
	if (!pack || !pack.list) return;
	for (let i = 0; i < pack.list.length; i++) {
		const design = pack.list[i];
		const idx = design.artIndex != null ? design.artIndex : i;
		Space4x.syncDesignShipArt(state, hullDefId, design, idx);
	}
};

Space4x.shipArtCount = function (state, hullDefId) {
	return Space4x.shipArtPaths(state, hullDefId).length;
};

Space4x.designArtIndex = function (state, hullDefId, design) {
	if (!design) return 0;
	if (design.artIndex != null) return design.artIndex;
	return 0;
};

Space4x.designShipArtPath = function (state, hullDefId, design) {
	if (design && design.shipArt) return design.shipArt;
	if (design && design.artIndex != null) {
		return Space4x.shipArtPathForIndex(state, hullDefId, design.artIndex);
	}
	return Space4x.hullShipArtPath(state, hullDefId);
};

Space4x.tokenShipArtPath = function (state, token) {
	if (!token) return null;
	if (token.shipArt) return token.shipArt;
	const empire = Space4x.empireById(state, token.empireId);
	if (empire && token.designId) {
		const design = Space4x.designById(empire, token.defId, token.designId);
		const path = Space4x.designShipArtPath(state, token.defId, design);
		if (path) return path;
	}
	return Space4x.hullShipArtPath(state, token.defId);
};

Space4x.parseCssColor = function (color) {
	if (!color) return { r: 232, g: 238, b: 248 };
	const hex = String(color).match(/^#([0-9a-f]{3,8})$/i);
	if (hex) {
		let h = hex[1];
		if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
		return {
			r: parseInt(h.slice(0, 2), 16),
			g: parseInt(h.slice(2, 4), 16),
			b: parseInt(h.slice(4, 6), 16)
		};
	}
	const rgb = String(color).match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
	if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
	return { r: 232, g: 238, b: 248 };
};

Space4x.isMagentaPixel = function (r, g, b, a) {
	if (a < 4) return false;
	return r > 110 && b > 110 && g < Math.min(r, b) * 0.6;
};

Space4x.tintShipArtSvgText = function (svgText, color) {
	if (!svgText || !color) return svgText;
	return String(svgText).replace(Space4x.SHIP_ART_MAGENTA, color);
};

Space4x.canFetchShipArt = function () {
	try {
		return typeof location !== "undefined" && location.protocol !== "file:";
	} catch (e) {
		return true;
	}
};

Space4x.loadShipArtSvgViaObject = function (path) {
	return new Promise(function (resolve, reject) {
		const obj = document.createElement("object");
		obj.type = "image/svg+xml";
		obj.data = path;
		obj.setAttribute("aria-hidden", "true");
		obj.tabIndex = -1;
		obj.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none";
		function cleanup() {
			if (obj.parentNode) obj.parentNode.removeChild(obj);
		}
		function readDoc() {
			const doc = obj.contentDocument || (obj.getSVGDocument && obj.getSVGDocument());
			if (!doc || !doc.documentElement) return false;
			const text = new XMLSerializer().serializeToString(doc.documentElement);
			cleanup();
			Space4x._shipArtSvgText[path] = text;
			resolve(text);
			return true;
		}
		obj.onload = function () {
			if (readDoc()) return;
			setTimeout(function () {
				if (!readDoc()) {
					cleanup();
					reject(new Error("no svg doc"));
				}
			}, 0);
		};
		obj.onerror = function () {
			cleanup();
			reject(new Error("object"));
		};
		document.body.appendChild(obj);
	});
};

Space4x.loadShipArtSvgText = function (path) {
	if (!path) return Promise.reject(new Error("missing"));
	if (Space4x._shipArtSvgText[path]) return Promise.resolve(Space4x._shipArtSvgText[path]);
	if (Space4x.canFetchShipArt()) {
		return fetch(path).then(function (res) {
			if (!res.ok) throw new Error("missing");
			return res.text();
		}).then(function (text) {
			Space4x._shipArtSvgText[path] = text;
			return text;
		});
	}
	return Space4x.loadShipArtSvgViaObject(path);
};

Space4x.loadShipArtRaw = function (path) {
	if (!path) return null;
	if (Space4x._shipArtRawCache[path]) return Space4x._shipArtRawCache[path];
	const raw = new Image();
	Space4x._shipArtRawCache[path] = raw;
	raw.decoding = "async";
	raw.src = path;
	return raw;
};

Space4x.tryPixelTintRaw = function (raw, color) {
	const w = raw.naturalWidth || 32;
	const h = raw.naturalHeight || 20;
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	ctx.drawImage(raw, 0, 0, w, h);
	try {
		const data = ctx.getImageData(0, 0, w, h);
		const rgb = Space4x.parseCssColor(color);
		const px = data.data;
		let tinted = false;
		for (let i = 0; i < px.length; i += 4) {
			if (Space4x.isMagentaPixel(px[i], px[i + 1], px[i + 2], px[i + 3])) {
				px[i] = rgb.r;
				px[i + 1] = rgb.g;
				px[i + 2] = rgb.b;
				tinted = true;
			}
		}
		if (tinted) {
			ctx.putImageData(data, 0, 0);
			return { canvas: canvas, w: w, h: h };
		}
	} catch (e) { /* tainted canvas */ }
	return null;
};

Space4x.buildShipArtLayerFromSvgText = function (svgText, color, entry) {
	if (!entry.canvas) entry.canvas = document.createElement("canvas");
	const tinted = Space4x.tintShipArtSvgText(svgText, color);
	const raw = new Image();
	raw.onload = function () {
		entry.w = raw.naturalWidth || 32;
		entry.h = raw.naturalHeight || 20;
		entry.canvas.width = entry.w;
		entry.canvas.height = entry.h;
		const ctx = entry.canvas.getContext("2d");
		ctx.drawImage(raw, 0, 0, entry.w, entry.h);
		entry.ready = true;
		if (Space4x.app && Space4x.app.sync) Space4x.app.sync();
	};
	raw.onerror = function () {
		entry.failed = true;
		if (Space4x.app && Space4x.app.sync) Space4x.app.sync();
	};
	raw.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(tinted);
};

Space4x.fallbackSilhouetteTint = function (raw, color) {
	const w = raw.naturalWidth || 32;
	const h = raw.naturalHeight || 20;
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	ctx.drawImage(raw, 0, 0, w, h);
	ctx.globalCompositeOperation = "source-in";
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, w, h);
	return { canvas: canvas, w: w, h: h };
};

Space4x.finishShipArtLayer = function (entry, layer) {
	entry.canvas = layer.canvas;
	entry.w = layer.w;
	entry.h = layer.h;
	entry.ready = true;
	if (Space4x.app && Space4x.app.sync) Space4x.app.sync();
};

Space4x.ensureShipArtLayer = function (path, color) {
	if (!path || !color) return null;
	const key = path + "|" + color;
	if (Space4x._shipArtLayerCache[key]) return Space4x._shipArtLayerCache[key];

	const entry = { canvas: null, w: 0, h: 0, ready: false };
	Space4x._shipArtLayerCache[key] = entry;

	function buildFromRaw(raw) {
		const pixel = Space4x.tryPixelTintRaw(raw, color);
		if (pixel) {
			Space4x.finishShipArtLayer(entry, pixel);
			return;
		}
		Space4x.loadShipArtSvgText(path).then(function (text) {
			Space4x.buildShipArtLayerFromSvgText(text, color, entry);
		}).catch(function () {
			Space4x.finishShipArtLayer(entry, Space4x.fallbackSilhouetteTint(raw, color));
		});
	}

	const raw = Space4x.loadShipArtRaw(path);
	if (raw.complete && raw.naturalWidth) buildFromRaw(raw);
	else raw.addEventListener("load", function () { buildFromRaw(raw); }, { once: true });

	return entry;
};

Space4x.prefetchHullShipArt = function (state, hullDefId, color) {
	const paths = Space4x.shipArtPaths(state, hullDefId);
	for (let i = 0; i < paths.length; i++) Space4x.ensureShipArtLayer(paths[i], color);
};

Space4x.ensureShipArt = function (path, color) {
	return Space4x.ensureShipArtLayer(path, color);
};

Space4x.shipArtHeading = function (heading) {
	return (heading != null ? heading : 0) + Space4x.SHIP_ART_HEADING_OFFSET;
};

Space4x.drawTintedShipArt = function (ctx, path, color, cx, cy, maxW, maxH, heading, scale) {
	if (!path || !ctx) return false;
	scale = scale || 1;
	const layer = Space4x.ensureShipArtLayer(path, color);
	if (!layer || !layer.ready || !layer.canvas || !layer.w) return false;
	const aspect = layer.w / Math.max(1, layer.h);
	let w = maxW * scale;
	let h = w / aspect;
	if (h > maxH * scale) {
		h = maxH * scale;
		w = h * aspect;
	}
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(Space4x.shipArtHeading(heading));
	ctx.drawImage(layer.canvas, -w / 2, -h / 2, w, h);
	ctx.restore();
	return true;
};

Space4x.drawShipArtToken = function (ctx, state, token, p, cell, color, heading, size) {
	const path = Space4x.tokenShipArtPath(state, token);
	if (!path) return false;
	return Space4x.drawTintedShipArt(ctx, path, color, p.x, p.y, cell * 0.85, cell * 0.55, heading, size || 1);
};

Space4x.drawDesignShipArt = function (canvas, state, hullDefId, design, previewColor) {
	if (!canvas) return;
	if (!design) {
		const ctx = canvas.getContext("2d");
		const w = canvas.width || 400;
		const h = canvas.height || 220;
		ctx.clearRect(0, 0, w, h);
		ctx.fillStyle = "#050814";
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = "#243048";
		ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
		canvas._designArtKey = null;
		return;
	}
	const path = Space4x.designShipArtPath(state, hullDefId, design);
	const color = previewColor || Space4x.OBSERVER_SHIP_COLOR;
	const drawKey = path + "|" + color;
	if (canvas._designArtKey === drawKey) return;

	Space4x.ensureShipArtLayer(path, color);

	const ctx = canvas.getContext("2d");
	const w = canvas.width || 400;
	const h = canvas.height || 220;
	const pad = Math.min(w, h) * 0.05;
	const maxW = w - pad * 2;
	const maxH = h - pad * 2;
	ctx.fillStyle = "#050814";
	ctx.fillRect(0, 0, w, h);
	ctx.strokeStyle = "#243048";
	ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
	if (Space4x.drawTintedShipArt(ctx, path, color, w / 2, h / 2, maxW, maxH, 0, 1)) {
		canvas._designArtKey = drawKey;
	}
};
