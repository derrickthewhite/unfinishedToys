/*
 * Deep Space Battlefield Background — Space4x fork
 *
 * Forked from Generators/deep-space-background.js. This copy lives with Space4x
 * and may diverge; do not treat Generators as the runtime source.
 *
 *   DeepSpaceBackground.generateSpaceBackground(canvas, options)
 */
(function (root) {
	"use strict";

	function mulberry32(seed) {
		return function () {
			let t = seed += 0x6D2B79F5;
			t = Math.imul(t ^ t >>> 15, t | 1);
			t ^= t + Math.imul(t ^ t >>> 7, t | 61);
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		};
	}

	function randomSeed() {
		return Math.floor(Math.random() * 2147483647);
	}

	function clamp(v, a, b) {
		return Math.max(a, Math.min(b, v));
	}

	function lerp(a, b, t) {
		return a + (b - a) * t;
	}

	const MIN_SIZE = 256;
	const MAX_SIZE = 8192;
	const MIN_INTERNAL = 32;
	const MAX_PIXEL_SCALE = 8;

	function internalSize(w, h, scale) {
		const s = clamp(Number(scale) || 1, 1, MAX_PIXEL_SCALE);
		return {
			w: Math.max(MIN_INTERNAL, Math.round(w / s)),
			h: Math.max(MIN_INTERNAL, Math.round(h / s))
		};
	}

	function formatPixelScale(scale, w, h) {
		const s = clamp(Number(scale) || 1, 1, MAX_PIXEL_SCALE);
		const inner = internalSize(w, h, s);
		const text = (Math.round(s * 100) / 100).toString();
		return text + "×  (" + inner.w + " × " + inner.h + ")";
	}

	function smoothstep(t) {
		return t * t * (3 - 2 * t);
	}

	function hash2(x, y, seed) {
		let h = Math.imul(x | 0, 374761393);
		h = Math.imul(h ^ (y | 0), 668265263);
		h ^= seed | 0;
		h = Math.imul(h ^ (h >>> 13), 1274126177);
		return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
	}

	function valueNoise(x, y, scale, seed) {
		x /= scale;
		y /= scale;
		const x0 = Math.floor(x);
		const y0 = Math.floor(y);
		const tx = smoothstep(x - x0);
		const ty = smoothstep(y - y0);
		const a = hash2(x0, y0, seed);
		const b = hash2(x0 + 1, y0, seed);
		const c = hash2(x0, y0 + 1, seed);
		const d = hash2(x0 + 1, y0 + 1, seed);
		return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
	}

	function fractalNoise(x, y, baseScale, seed) {
		let value = 0;
		let amplitude = 1;
		let frequency = 1;
		let total = 0;
		for (let i = 0; i < 4; i++) {
			value += valueNoise(x * frequency, y * frequency, baseScale, seed + i * 7919) * amplitude;
			total += amplitude;
			amplitude *= 0.5;
			frequency *= 2;
		}
		return value / total;
	}

	function hazePalette(type, t, variant) {
		t = clamp(t, 0, 1);
		const palettes = {
			blue: [[8, 18, 40], [25, 45, 110], [75, 65, 180], [145, 105, 220]],
			cyan: [[5, 25, 35], [15, 75, 110], [45, 150, 185], [125, 210, 225]],
			purple: [[25, 8, 35], [75, 20, 95], [155, 45, 145], [225, 105, 190]],
			red: [[35, 8, 8], [100, 20, 15], [185, 55, 25], [235, 130, 60]],
			mixed: [[10, 14, 30], [35, 40, 100], [100, 45, 135], [205, 85, 125]],
			neutral: [[12, 15, 20], [35, 42, 52], [75, 85, 100], [145, 150, 160]]
		};
		const p = palettes[type] || palettes.blue;
		const x = t * (p.length - 1);
		const i = Math.min(p.length - 2, Math.floor(x));
		const f = x - i;
		const shift = (variant || 0) * 8;
		return [
			clamp(lerp(p[i][0], p[i + 1][0], f) + shift, 0, 255),
			clamp(lerp(p[i][1], p[i + 1][1], f) + shift * 0.5, 0, 255),
			clamp(lerp(p[i][2], p[i + 1][2], f) + shift, 0, 255)
		];
	}

	function centerWeight(nx, ny, quiet) {
		if (quiet <= 0) return 1;
		const d = Math.hypot(nx - 0.5, ny - 0.5);
		const rim = smoothstep(clamp((d - 0.12) / 0.32, 0, 1));
		return lerp(1, rim, quiet);
	}

	function placeStar(rand, W, H, band, bias) {
		if (bias <= 0 || rand() > bias) {
			return { x: rand() * W, y: rand() * H };
		}
		for (let i = 0; i < 6; i++) {
			const x = rand() * W;
			const y = rand() * H;
			const u = (x / W - 0.5) * band.dx + (y / H - 0.5) * band.dy - band.offset;
			if (rand() < Math.exp(-(u * u) / (band.width * band.width))) {
				return { x: x, y: y };
			}
		}
		return { x: rand() * W, y: rand() * H };
	}

	function drawStars(ctx, W, H, rand, o, band, quiet) {
		const density = o.starDensity / 100;
		const brightness = lerp(0.55, 1.15, o.starBrightness / 100);
		const colorVar = o.starColor / 100;
		const area = W * H;
		ctx.save();
		const dimCount = Math.floor(area / 700 * density);
		for (let i = 0; i < dimCount; i++) {
			const p = placeStar(rand, W, H, band, 0.45);
			const hush = centerWeight(p.x / W, p.y / H, quiet);
			if (hush < 0.12 && rand() > hush) continue;
			const a = lerp(0.16, 0.48, rand()) * brightness * hush;
			const size = 0.55 + rand() * 0.45;
			ctx.fillStyle = "rgba(200,214,235," + a + ")";
			ctx.fillRect(p.x, p.y, size, size);
		}
		const visibleCount = Math.floor(area / 2800 * density);
		for (let i = 0; i < visibleCount; i++) {
			const p = placeStar(rand, W, H, band, 0.55);
			const hush = centerWeight(p.x / W, p.y / H, quiet);
			if (hush < 0.14 && rand() > hush) continue;
			const a = lerp(0.35, 0.85, rand()) * brightness * hush;
			const size = rand() < 0.9 ? 0.55 + rand() * 0.55 : 0.9 + rand() * 0.55;
			let r = 220, g = 228, b = 242;
			if (rand() < colorVar * 0.8) {
				const type = rand();
				if (type < 0.33) { r = 180; g = 205; b = 255; }
				else if (type < 0.66) { r = 255; g = 220; b = 175; }
				else { r = 255; g = 195; b = 170; }
			}
			ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + a + ")";
			ctx.beginPath();
			ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
			ctx.fill();
		}
		const brightCount = Math.max(2, Math.floor(5 + 12 * density));
		for (let i = 0; i < brightCount; i++) {
			const p = placeStar(rand, W, H, band, 0.35);
			const hush = Math.max(0.25, centerWeight(p.x / W, p.y / H, quiet * 0.7));
			const radius = lerp(0.7, 1.35, rand()) * lerp(0.7, 1, brightness);
			let r = 235, g = 240, b = 255;
			if (rand() < colorVar) {
				if (rand() < 0.5) { r = 185; g = 215; b = 255; }
				else { r = 255; g = 215; b = 180; }
			}
			const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 3.2);
			glow.addColorStop(0, "rgba(" + r + "," + g + "," + b + "," + (0.55 * brightness * hush) + ")");
			glow.addColorStop(0.28, "rgba(" + r + "," + g + "," + b + "," + (0.12 * brightness * hush) + ")");
			glow.addColorStop(1, "rgba(" + r + "," + g + "," + b + ",0)");
			ctx.fillStyle = glow;
			ctx.beginPath();
			ctx.arc(p.x, p.y, radius * 3.2, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (0.85 * brightness * hush) + ")";
			ctx.beginPath();
			ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}

	function generateSpaceBackground(canvas, userOptions) {
		const defaults = {
			seed: 18427,
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
			pixelScale: 1,
			crispPixels: false
		};
		const o = Object.assign({}, defaults, userOptions || {});
		const scale = clamp(Number(o.pixelScale) || 1, 1, MAX_PIXEL_SCALE);
		const internal = internalSize(canvas.width, canvas.height, scale);

		if (internal.w < canvas.width || internal.h < canvas.height) {
			const work = document.createElement("canvas");
			work.width = internal.w;
			work.height = internal.h;
			generateSpaceBackground(work, Object.assign({}, o, { pixelScale: 1 }));
			const out = canvas.getContext("2d", { alpha: false });
			out.imageSmoothingEnabled = !o.crispPixels;
			out.imageSmoothingQuality = "high";
			out.clearRect(0, 0, canvas.width, canvas.height);
			out.drawImage(work, 0, 0, canvas.width, canvas.height);
			return canvas;
		}

		const ctx = canvas.getContext("2d", { alpha: false });
		const W = canvas.width;
		const H = canvas.height;
		const rand = mulberry32((o.seed >>> 0) || 1);
		const quiet = o.centerQuiet / 100;

		const NW = Math.max(240, Math.ceil(W / 3));
		const NH = Math.max(135, Math.ceil(H / 3));
		const small = document.createElement("canvas");
		small.width = NW;
		small.height = NH;
		const sctx = small.getContext("2d", { alpha: false });
		const image = sctx.createImageData(NW, NH);
		const data = image.data;

		const baseSeed = o.seed | 0;
		const hazeScalePx = lerp(NW * 0.06, NW * 0.34, o.hazeScale / 100);
		const hazeStrength = o.hazeAmount / 100;

		const angle = rand() * Math.PI;
		const dx = Math.cos(angle);
		const dy = Math.sin(angle);
		const bandOffset = (rand() - 0.5) * 0.35;
		const bandWidth = lerp(0.10, 0.30, rand());
		const band = { dx: dx, dy: dy, offset: bandOffset, width: bandWidth };
		const voidCol = hazePalette(o.hazeColor, 0.12, 0);

		for (let y = 0; y < NH; y++) {
			for (let x = 0; x < NW; x++) {
				const nx = x / NW;
				const ny = y / NH;
				const fine = fractalNoise(x, y, NW * 0.16, baseSeed + 11);
				const cloud = fractalNoise(x, y, hazeScalePx, baseSeed + 31);
				const wisps = Math.pow(cloud, 1.45);
				const wisps2 = Math.pow(fractalNoise(x, y, hazeScalePx * 0.42, baseSeed + 47), 2.1);
				const u = (nx - 0.5) * dx + (ny - 0.5) * dy - bandOffset;
				const bandAmt = Math.exp(-(u * u) / (bandWidth * bandWidth));
				const hush = centerWeight(nx, ny, quiet);
				const haze = bandAmt * (wisps * 0.72 + wisps2 * 0.5) * hazeStrength * hush;
				const col = hazePalette(o.hazeColor, 0.28 + cloud * 0.55, (fine - 0.5) * 3);
				const brightness = 3.5 + fine * 6.5;
				const idx = (y * NW + x) * 4;
				data[idx] = clamp(voidCol[0] * 0.18 + brightness + col[0] * haze * 2.35, 0, 255);
				data[idx + 1] = clamp(voidCol[1] * 0.18 + brightness + col[1] * haze * 2.35, 0, 255);
				data[idx + 2] = clamp(voidCol[2] * 0.18 + brightness + col[2] * haze * 2.35, 0, 255);
				data[idx + 3] = 255;
			}
		}
		sctx.putImageData(image, 0, 0);

		ctx.clearRect(0, 0, W, H);
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(small, 0, 0, W, H);

		const featureLayer = document.createElement("canvas");
		featureLayer.width = W;
		featureLayer.height = H;
		const fctx = featureLayer.getContext("2d");
		const strength = o.featureStrength / 100;

		for (let i = 0; i < o.featureCount; i++) {
			let fx, fy, tries = 0;
			do {
				fx = rand() * W;
				fy = rand() * H;
				tries++;
			} while (
				o.avoidCenter &&
				Math.hypot(fx / W - 0.5, fy / H - 0.5) < 0.25 &&
				tries < 50
			);
			const hush = centerWeight(fx / W, fy / H, quiet);
			const rx = lerp(W * 0.08, W * 0.28, rand());
			const ry = lerp(H * 0.05, H * 0.18, rand());
			const rotation = rand() * Math.PI;
			const palette = o.hazeColor === "mixed"
				? ["blue", "cyan", "purple", "red"][Math.floor(rand() * 4)]
				: o.hazeColor;
			const col = hazePalette(palette, lerp(0.50, 0.84, rand()), rand() - 0.5);
			const alpha = (0.16 + 0.38 * strength) * lerp(0.65, 1, rand()) * hush;
			fctx.save();
			fctx.translate(fx, fy);
			fctx.rotate(rotation);
			fctx.scale(rx, ry);
			const grad = fctx.createRadialGradient(0, 0, 0, 0, 0, 1);
			grad.addColorStop(0, "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + alpha + ")");
			grad.addColorStop(0.35, "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + (alpha * 0.45) + ")");
			grad.addColorStop(1, "rgba(" + col[0] + "," + col[1] + "," + col[2] + ",0)");
			fctx.fillStyle = grad;
			fctx.beginPath();
			fctx.arc(0, 0, 1, 0, Math.PI * 2);
			fctx.fill();
			fctx.restore();
		}

		ctx.save();
		ctx.filter = "blur(" + Math.max(3, Math.round(Math.min(W, H) * 0.012)) + "px)";
		ctx.drawImage(featureLayer, 0, 0);
		ctx.restore();

		if (o.dustAmount > 0) {
			const dust = document.createElement("canvas");
			dust.width = W;
			dust.height = H;
			const dctx = dust.getContext("2d");
			dctx.save();
			dctx.translate(W / 2, H / 2);
			dctx.rotate(angle + (rand() - 0.5) * 0.7);
			for (let i = 0; i < 4; i++) {
				const y = (rand() - 0.5) * H * 0.55;
				const width = Math.max(2, lerp(10, 42, rand()) * (o.dustAmount / 35));
				const grad = dctx.createLinearGradient(0, y - width, 0, y + width);
				const a = 0.05 + o.dustAmount / 1400;
				grad.addColorStop(0, "rgba(0,0,0,0)");
				grad.addColorStop(0.5, "rgba(0,0,0," + a + ")");
				grad.addColorStop(1, "rgba(0,0,0,0)");
				dctx.fillStyle = grad;
				dctx.fillRect(-W, y - width, W * 2, width * 2);
			}
			dctx.restore();
			ctx.save();
			ctx.globalAlpha = 0.75;
			ctx.filter = "blur(6px)";
			ctx.drawImage(dust, 0, 0);
			ctx.restore();
		}

		drawStars(ctx, W, H, rand, o, band, quiet);
		return canvas;
	}

	const api = {
		generateSpaceBackground: generateSpaceBackground,
		randomSeed: randomSeed,
		clamp: clamp,
		internalSize: internalSize,
		formatPixelScale: formatPixelScale,
		MIN_SIZE: MIN_SIZE,
		MAX_SIZE: MAX_SIZE,
		MAX_PIXEL_SCALE: MAX_PIXEL_SCALE
	};

	root.DeepSpaceBackground = api;
	root.generateSpaceBackground = generateSpaceBackground;
})(typeof window !== "undefined" ? window : globalThis);
