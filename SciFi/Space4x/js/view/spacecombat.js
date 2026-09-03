var Space4x = Space4x || {};

Space4x.spaceLayout = function (ui, battle) {
	if (!battle) return null;
	const canvas = ui && ui.spaceCanvas;
	const w = canvas ? (canvas.clientWidth || canvas.width || 720) : 720;
	const h = canvas ? (canvas.clientHeight || canvas.height || 480) : 480;
	if (canvas) {
		if (canvas.width !== w) canvas.width = w;
		if (canvas.height !== h) canvas.height = h;
	}
	const gw = battle.grid.w;
	const gh = battle.grid.h;
	const view = battle.view || { zoom: 1, panX: null, panY: null };
	const zoom = view.zoom || 1;
	const base = Math.min((w - 16) / gw, (h - 16) / gh);
	const cell = Math.max(3, base * zoom);
	let panX = view.panX;
	let panY = view.panY;
	if (panX == null || panY == null) {
		panX = (w - gw * cell) / 2;
		panY = (h - gh * cell) / 2;
	}
	return { w: w, h: h, gw: gw, gh: gh, cell: cell, panX: panX, panY: panY, zoom: zoom };
};

Space4x.spaceCellToScreen = function (layout, x, y) {
	return { x: layout.panX + (x + 0.5) * layout.cell, y: layout.panY + (y + 0.5) * layout.cell };
};

Space4x.spaceScreenToCell = function (layout, px, py) {
	return {
		x: Math.floor((px - layout.panX) / layout.cell),
		y: Math.floor((py - layout.panY) / layout.cell)
	};
};

Space4x.missileArtPath = function (state) {
	const paths = Space4x.shipArtPaths(state, "missile");
	if (paths.length) return paths[0];
	return "assets/ships/missile.svg";
};

Space4x.missileFormationOffsets = function (count, spacing) {
	const n = Math.max(1, Math.min(7, count | 0));
	const out = [];
	if (n === 1) {
		out.push({ x: 0, y: 0 });
		return out;
	}
	const rows = n <= 3 ? 1 : 2;
	if (rows === 1) {
		const start = -((n - 1) * spacing) / 2;
		for (let i = 0; i < n; i++) out.push({ x: -spacing * 0.15, y: start + i * spacing });
		return out;
	}
	const front = Math.ceil(n / 2);
	const back = n - front;
	const f0 = -((front - 1) * spacing) / 2;
	for (let i = 0; i < front; i++) out.push({ x: spacing * 0.35, y: f0 + i * spacing });
	const b0 = -((back - 1) * spacing) / 2;
	for (let i = 0; i < back; i++) out.push({ x: -spacing * 0.45, y: b0 + i * spacing });
	return out;
};

Space4x.drawMissileToken = function (ctx, state, token, p, cell, color) {
	const heading = token.heading || 0;
	const count = token.salvo != null ? token.salvo : 4;
	const spacing = Math.max(3, cell * 0.22);
	const offsets = Space4x.missileFormationOffsets(count, spacing);
	const path = Space4x.missileArtPath(state);
	const mw = Math.max(4, cell * 0.42);
	const mh = Math.max(2.5, cell * 0.22);
	Space4x.prefetchHullShipArt(state, "missile", color);
	let drew = 0;
	for (let i = 0; i < offsets.length; i++) {
		const ox = offsets[i].x;
		const oy = offsets[i].y;
		const rx = Math.cos(heading) * ox - Math.sin(heading) * oy;
		const ry = Math.sin(heading) * ox + Math.cos(heading) * oy;
		if (Space4x.drawTintedShipArt(ctx, path, color, p.x + rx, p.y + ry, mw, mh, heading, 1)) {
			drew += 1;
			continue;
		}
		ctx.fillStyle = color;
		ctx.save();
		ctx.translate(p.x + rx, p.y + ry);
		ctx.rotate(heading);
		ctx.beginPath();
		ctx.moveTo(mw * 0.45, 0);
		ctx.lineTo(-mw * 0.35, -mh * 0.45);
		ctx.lineTo(-mw * 0.2, 0);
		ctx.lineTo(-mw * 0.35, mh * 0.45);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
		drew += 1;
	}
	return drew > 0;
};

Space4x.drawSpaceCombat = function (ui, state) {
	const battle = Space4x.spaceBattleById(state, state.ui.selectedSpaceBattleId);
	const canvas = ui.spaceCanvas;
	if (!canvas || !battle) return;
	if (!battle.view) battle.view = { zoom: 1, panX: null, panY: null };
	const layout = Space4x.spaceLayout(ui, battle);
	battle.view.zoom = layout.zoom;
	battle.view.panX = layout.panX;
	battle.view.panY = layout.panY;
	ui._spaceLayout = layout;
	const ctx = canvas.getContext("2d");
	ctx.fillStyle = "#050814";
	ctx.fillRect(0, 0, layout.w, layout.h);
	const seed = Space4x.ensureCombatBgSeed(state, battle);
	Space4x.drawSpaceBackgroundForGrid(ctx, "combat", seed, layout, 0.1);
	const cell = layout.cell;
	ctx.strokeStyle = cell < 6 ? "#10182c" : "#182238";
	ctx.lineWidth = 1;
	const step = cell < 5 ? 5 : 1;
	for (let x = 0; x <= layout.gw; x += step) {
		const px = layout.panX + x * cell;
		ctx.beginPath();
		ctx.moveTo(px, layout.panY);
		ctx.lineTo(px, layout.panY + layout.gh * cell);
		ctx.stroke();
	}
	for (let y = 0; y <= layout.gh; y += step) {
		const py = layout.panY + y * cell;
		ctx.beginPath();
		ctx.moveTo(layout.panX, py);
		ctx.lineTo(layout.panX + layout.gw * cell, py);
		ctx.stroke();
	}
	const sel = state.ui.spaceTokenId;
	const tokens = battle.tokens || [];
	const playerSide = Space4x.playerBattleSide(state, battle);
	const highlightToken = sel ? Space4x.tokenById(battle, sel) : null;
	if (highlightToken && !highlightToken.dead && !highlightToken.activated &&
		!battle.done && highlightToken.side === playerSide && battle.phase === playerSide) {
		const reachable = Space4x.spaceReachableCells(state, battle, highlightToken);
		ctx.fillStyle = "rgba(72, 128, 220, 0.28)";
		for (let r = 0; r < reachable.length; r++) {
			const c = reachable[r];
			ctx.fillRect(layout.panX + c.x * cell, layout.panY + c.y * cell, cell, cell);
		}
		let weapon = null;
		if (state.ui.spaceWeaponId && highlightToken.load) {
			for (let w = 0; w < highlightToken.load.length; w++) {
				const lw = highlightToken.load[w];
				if (lw.itemId === state.ui.spaceWeaponId && !lw.fired && !lw.launched) {
					weapon = lw;
					break;
				}
			}
		}
		if (weapon) {
			const item = Space4x.spaceLoadItem(state, weapon.itemId);
			if (item && item.kind !== "device") {
				const zones = Space4x.beamRangeZones
					? Space4x.beamRangeZones(state, battle, highlightToken, weapon)
					: { full: Space4x.spaceWeaponRangeCells(state, battle, highlightToken, weapon), half: [] };
				ctx.fillStyle = "rgba(210, 110, 55, 0.38)";
				for (let r = 0; r < zones.full.length; r++) {
					const c = zones.full[r];
					ctx.fillRect(layout.panX + c.x * cell, layout.panY + c.y * cell, cell, cell);
				}
				if (zones.half.length) {
					ctx.fillStyle = "rgba(210, 110, 55, 0.18)";
					for (let r = 0; r < zones.half.length; r++) {
						const c = zones.half[r];
						ctx.fillRect(layout.panX + c.x * cell, layout.panY + c.y * cell, cell, cell);
					}
				}
				const targets = Space4x.spaceWeaponTargetCells(state, battle, highlightToken, weapon);
				ctx.fillStyle = "rgba(255, 150, 70, 0.62)";
				for (let r = 0; r < targets.length; r++) {
					const c = targets[r];
					ctx.fillRect(layout.panX + c.x * cell, layout.panY + c.y * cell, cell, cell);
				}
			}
		}
	}
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (t.dead) continue;
		const drawPos = Space4x.spaceTokenDrawPos(battle, t);
		const p = Space4x.spaceCellToScreen(layout, drawPos.x, drawPos.y);
		const emp = Space4x.empireById(state, t.empireId);
		const color = Space4x.empireColor(state, t.empireId);
		ctx.fillStyle = color;
		if (t.kind === "missile") {
			Space4x.drawMissileToken(ctx, state, t, p, cell, color);
		} else if (t.kind === "fighter") {
			ctx.beginPath();
			ctx.moveTo(p.x, p.y - cell * 0.28);
			ctx.lineTo(p.x + cell * 0.22, p.y + cell * 0.2);
			ctx.lineTo(p.x - cell * 0.22, p.y + cell * 0.2);
			ctx.closePath();
			ctx.fill();
		} else {
			const rw = Math.max(4, cell * 0.7);
			const rh = Math.max(3, cell * 0.4);
			const heading = drawPos.heading != null ? drawPos.heading : (t.heading || 0);
			if (!Space4x.drawShipArtToken(ctx, state, t, p, cell, color, heading)) {
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(heading);
				ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
				ctx.restore();
			}
		}
		if (t.id === sel) {
			ctx.strokeStyle = "#fff";
			ctx.lineWidth = 2;
			ctx.strokeRect(p.x - cell * 0.5, p.y - cell * 0.5, cell, cell);
		}
		if (t.id === state.ui.spaceEnemyTokenId) {
			ctx.strokeStyle = "#ff8a70";
			ctx.lineWidth = 2;
			ctx.setLineDash([4, 3]);
			ctx.strokeRect(p.x - cell * 0.55, p.y - cell * 0.55, cell * 1.1, cell * 1.1);
			ctx.setLineDash([]);
		}
		if (cell >= 10 && t.kind === "ship") {
			ctx.fillStyle = "#c8d4ef";
			ctx.font = "10px sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(t.name, p.x, p.y + cell * 0.7);
		}
	}
	Space4x.drawSpaceCombatFx(ctx, battle, layout);
};

Space4x.drawSpaceCombatFx = function (ctx, battle, layout) {
	const list = battle.fx || [];
	if (!list.length) return;
	const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
	const keep = [];
	for (let i = 0; i < list.length; i++) {
		const fx = list[i];
		const age = now - fx.t0;
		const dur = fx.dur || 500;
		if (age > dur) continue;
		keep.push(fx);
		const t = Math.max(0, Math.min(1, age / dur));
		if (fx.type === "beam") {
			const from = Space4x.tokenById(battle, fx.fromId);
			const to = Space4x.tokenById(battle, fx.toId);
			if (!from || !to) continue;
			const a = Space4x.spaceCellToScreen(layout, Space4x.spaceTokenDrawPos(battle, from).x, Space4x.spaceTokenDrawPos(battle, from).y);
			const b = Space4x.spaceCellToScreen(layout, Space4x.spaceTokenDrawPos(battle, to).x, Space4x.spaceTokenDrawPos(battle, to).y);
			const alpha = fx.miss ? (0.35 * (1 - t)) : (0.9 * (1 - t * 0.55));
			ctx.save();
			ctx.strokeStyle = fx.miss ? ("rgba(180,190,210," + alpha + ")") : ("rgba(255,220,140," + alpha + ")");
			ctx.lineWidth = fx.miss ? 1.5 : 2.5;
			ctx.beginPath();
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
			ctx.stroke();
			if (!fx.miss) {
				ctx.fillStyle = "rgba(255,240,200," + (0.7 * (1 - t)) + ")";
				ctx.beginPath();
				ctx.arc(b.x, b.y, 4 + 10 * (1 - t), 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
		} else if (fx.type === "flash") {
			const tok = Space4x.tokenById(battle, fx.tokenId);
			if (!tok || tok.dead) continue;
			const pos = Space4x.spaceTokenDrawPos(battle, tok);
			const p = Space4x.spaceCellToScreen(layout, pos.x, pos.y);
			ctx.save();
			ctx.fillStyle = "rgba(255,120,80," + (0.35 * (1 - t)) + ")";
			ctx.beginPath();
			ctx.arc(p.x, p.y, layout.cell * (0.55 + 0.35 * (1 - t)), 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		} else if (fx.type === "float") {
			const tok = Space4x.tokenById(battle, fx.tokenId);
			if (!tok) continue;
			const pos = Space4x.spaceTokenDrawPos(battle, tok);
			const p = Space4x.spaceCellToScreen(layout, pos.x, pos.y);
			const rise = (fx.rise || 30) * t;
			const alpha = t < 0.15 ? (t / 0.15) : (1 - ((t - 0.15) / 0.85));
			ctx.save();
			ctx.globalAlpha = Math.max(0, alpha);
			ctx.fillStyle = fx.color || "#ff6b6b";
			ctx.font = "bold 14px sans-serif";
			ctx.textAlign = "center";
			ctx.textBaseline = "bottom";
			ctx.fillText(fx.text || "", p.x + (fx.slot || 0) * 8, p.y - layout.cell * 0.45 - rise);
			ctx.restore();
		}
	}
	battle.fx = keep;
};

Space4x.kickSpaceCombatFxLoop = function () {
	const app = Space4x.app;
	if (!app || app._spaceFxLoop) return;
	app._spaceFxLoop = true;
	function tick() {
		app._spaceFxLoop = false;
		if (!app.state || app.state.ui.stage !== "spaceCombat") return;
		const battle = Space4x.spaceBattleById(app.state, app.state.ui.selectedSpaceBattleId);
		if (!battle || !(battle.fx && battle.fx.length)) {
			if (app.sync) app.sync();
			return;
		}
		Space4x.drawSpaceCombat(app.ui, app.state);
		Space4x.syncSpaceStatusPanels(app.ui, app.state);
		app._spaceFxLoop = true;
		requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);
};

Space4x.syncSpaceCombatStage = function (ui, state, cmds) {
	const battle = Space4x.spaceBattleById(state, state.ui.selectedSpaceBattleId);
	if (!ui.stageSpaceCombat) return;
	if (!battle) {
		Space4x.setText(ui.spaceCombatTitle, "Space combat");
		Space4x.setText(ui.spaceCombatMeta, "No battle selected.");
		return;
	}
	const star = Space4x.starById(state, battle.starId);
	const atk = Space4x.empireById(state, battle.attackerEmpireId);
	const def = Space4x.empireById(state, battle.defenderEmpireId);
	Space4x.setText(ui.spaceCombatTitle, battle.done ? (battle.summary || "Battle over") : "Space combat");
	let meta = (star ? star.name : "Star") + " · Round " + battle.round + " · " +
		(battle.phase === "attacker" ? "Attacker" : "Defender") + " to move · " +
		(atk ? atk.name : "?") + " vs " + (def ? def.name : "?");
	if (battle._aiAnim) meta += " · Enemy moving…";
	Space4x.setText(ui.spaceCombatMeta, meta);
	const player = Space4x.playerEmpire(state);
	const mySide = player && player.id === battle.attackerEmpireId ? "attacker" :
		player && player.id === battle.defenderEmpireId ? "defender" : null;
	const mine = mySide && battle.phase === mySide && !battle.done && !battle._aiAnim;
	const ships = Space4x.livingTokens(battle, mySide);
	Space4x.syncKeyedList(ui.spaceShipList, ships.filter(function (t) { return t.kind !== "missile"; }),
		function (t) { return t.id; },
		function () {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.type = "button";
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				cmds.selectSpaceToken(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, token) {
			const btn = row.querySelector("button");
			let label = token.name;
			if (token.warping) label += " · Warping";
			else if (token.immobile) label += token.activated ? " · done" : " · fixed";
			else label += token.activated ? " · done" : " · " + token.speedLeft.toFixed(1) + " spd";
			btn.textContent = label;
			row.classList.toggle("is-selected", token.id === state.ui.spaceTokenId);
			row.classList.toggle("is-done", !!token.activated);
			btn.disabled = !mine || token.activated;
		}
	);
	const token = Space4x.tokenById(battle, state.ui.spaceTokenId);
	const weapons = token && token.side === mySide && !token.activated && !token.warping
		? Space4x.spaceWeaponGroups(state, token.load || [])
		: [];
	Space4x.syncKeyedList(ui.spaceWeaponList, weapons, function (g) { return g.id; },
		function () {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.type = "button";
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				cmds.selectSpaceWeapon(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, group) {
			const btn = row.querySelector("button");
			btn.textContent = Space4x.spaceWeaponGroupLabel(state, group, token);
			row.classList.toggle("is-selected", group.id === state.ui.spaceWeaponId);
			btn.disabled = !group.ready.length;
		}
	);
	if (ui.btnSpaceEndSide) ui.btnSpaceEndSide.disabled = !mine || !!battle._aiAnim;
	if (ui.btnSpaceEndShip) ui.btnSpaceEndShip.disabled = !mine || !token || token.activated || !!battle._aiAnim;
	if (ui.btnSpaceRetreat) {
		ui.btnSpaceRetreat.disabled = !Space4x.canRetreatSpaceShip(state, battle, token) || !!battle._aiAnim;
	}
	if (ui.btnSpaceAutocombat) {
		ui.btnSpaceAutocombat.textContent = state.ui.spaceCombatAuto ? "Pause Autocombat" : "Autocombat";
		ui.btnSpaceAutocombat.disabled = !player || battle.done;
		ui.btnSpaceAutocombat.classList.toggle("is-active", !!state.ui.spaceCombatAuto);
	}
	if (ui.btnSpaceOk) ui.btnSpaceOk.hidden = !battle.done;
	if (ui.btnBackGalaxySpace) ui.btnBackGalaxySpace.hidden = !!battle.done;
	const lines = (battle.log || []).slice(-12);
	Space4x.syncKeyedList(ui.spaceCombatLog, lines.map(function (t, i) { return { id: String(i), text: t }; }),
		function (x) { return x.id; },
		function () { return document.createElement("li"); },
		function (row, item) { row.textContent = item.text; }
	);
	Space4x.syncSpaceStatusPanels(ui, state, cmds);
	Space4x.drawSpaceCombat(ui, state);
	if (battle.fx && battle.fx.length) Space4x.kickSpaceCombatFxLoop();
	Space4x.maybeRunSpaceCombatAuto(state, battle);
};

Space4x.maybeRunSpaceCombatAuto = function (state, battle) {
	if (!battle || battle.done || battle._aiAnim) return;
	if (!state.ui.spaceCombatAuto) return;
	const side = Space4x.playerBattleSide(state, battle);
	if (!side || battle.phase !== side) return;
	const app = Space4x.app;
	if (!app) return;
	Space4x.runAnimatedAiSide(state, battle, side, function () {
		if (!state.ui.spaceCombatAuto || battle.done) return;
		Space4x.endSpaceSide(state, battle);
		if (app.sync) app.sync();
	});
};

Space4x.spaceStatCurMax = function (cur, max) {
	const c = Math.max(0, Math.round(cur || 0));
	const m = Math.max(0, Math.round(max != null ? max : cur || 0));
	return c + "/" + m;
};

Space4x.fillSpaceStatusStats = function (node, state, token, emptyText) {
	if (!node) return;
	node.textContent = "";
	if (!token) {
		node.textContent = emptyText || "";
		node.classList.add("muted");
		return;
	}
	node.classList.remove("muted");
	const name = document.createElement("div");
	name.className = "space-stat-name";
	const emp = Space4x.empireById(state, token.empireId);
	name.textContent = (token.name || token.kind || "Unit") + (emp ? " · " + emp.name : "");
	if (token.warping) name.textContent += " · Warping";
	else if (token.immobile) name.textContent += " · Fixed";
	node.appendChild(name);
	function addLine(text, hurt) {
		const line = document.createElement("div");
		if (hurt) line.className = "is-hurt";
		line.textContent = text;
		node.appendChild(line);
	}
	if (token.kind === "ship" || token.kind === "fighter") {
		const sh = token.shields || {};
		const sm = token.shieldMax || 0;
		if (sm > 0) {
			addLine("Shields F " + Space4x.spaceStatCurMax(sh.front, sm) +
				" · R " + Space4x.spaceStatCurMax(sh.right, sm) +
				" · B " + Space4x.spaceStatCurMax(sh.back, sm) +
				" · L " + Space4x.spaceStatCurMax(sh.left, sm));
		} else {
			addLine("Shields —");
		}
		addLine("Armor " + Space4x.spaceStatCurMax(token.armor, token.armorMax),
			(token.armor || 0) < (token.armorMax || 0));
		addLine("Structure " + Space4x.spaceStatCurMax(token.structure, token.structureMax),
			(token.structure || 0) < (token.structureMax || 0));
		if (token.kind === "ship") {
			const spd = token.speedLeft != null ? token.speedLeft : 0;
			const spdMax = token.speed != null ? token.speed : spd;
			addLine("Speed " + spd.toFixed(1) + "/" + Number(spdMax).toFixed(1) +
				(token.activated ? " · done" : ""));
		}
	} else {
		addLine(token.kind || "Unit");
	}
	if (token.dead) addLine("Destroyed", true);
};

Space4x.drawSpaceStatusPortrait = function (canvas, state, token) {
	if (!canvas) return;
	const ctx = canvas.getContext("2d");
	const w = canvas.width || 96;
	const h = canvas.height || 72;
	ctx.clearRect(0, 0, w, h);
	ctx.fillStyle = "#050814";
	ctx.fillRect(0, 0, w, h);
	if (!token || token.dead) {
		ctx.strokeStyle = "#243048";
		ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
		return;
	}
	const color = Space4x.empireColor(state, token.empireId);
	const cx = w / 2;
	const cy = h / 2;
	ctx.fillStyle = color;
	ctx.strokeStyle = "#d8e2f8";
	ctx.lineWidth = 1;
	if (token.kind === "fighter") {
		ctx.beginPath();
		ctx.moveTo(cx, cy - 18);
		ctx.lineTo(cx + 14, cy + 14);
		ctx.lineTo(cx - 14, cy + 14);
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	} else if (token.kind === "ship" && Space4x.drawShipArtToken(ctx, state, token, { x: cx, y: cy }, Math.min(w, h) * 0.35, color, token.heading || 0, 1.1)) {
		// tinted SVG art
	} else {
		const rw = 52;
		const rh = 22;
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(token.heading || 0);
		ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
		ctx.strokeRect(-rw / 2, -rh / 2, rw, rh);
		ctx.fillStyle = "rgba(255,255,255,0.35)";
		ctx.beginPath();
		ctx.moveTo(rw / 2, 0);
		ctx.lineTo(rw / 2 - 10, -6);
		ctx.lineTo(rw / 2 - 10, 6);
		ctx.closePath();
		ctx.fill();
		ctx.restore();
	}
};

Space4x.syncSpaceStatusLoad = function (uiList, state, token, opts) {
	if (!uiList) return;
	opts = opts || {};
	const groups = token && !token.dead ? Space4x.spaceWeaponGroups(state, token.load || []) : [];
	const cmds = opts.cmds;
	const useButtons = !!opts.useButtons && !!cmds;
	const selectable = !!opts.selectable && useButtons;
	Space4x.syncKeyedList(uiList, groups, function (g) { return (useButtons ? "b:" : "t:") + g.id; },
		function () {
			const li = document.createElement("li");
			if (useButtons) {
				const btn = document.createElement("button");
				btn.type = "button";
				li.appendChild(btn);
				btn.addEventListener("click", function () {
					cmds.selectSpaceWeapon(li.getAttribute("data-id").replace(/^b:/, ""));
				});
			}
			return li;
		},
		function (row, group) {
			const label = Space4x.spaceWeaponGroupLabel(state, group, token);
			const spent = !group.ready.length;
			const btn = row.querySelector("button");
			if (btn) {
				btn.textContent = label;
				btn.disabled = !selectable || spent;
				row.classList.toggle("is-selected", selectable && group.id === state.ui.spaceWeaponId);
			} else {
				row.textContent = label;
				row.classList.remove("is-selected");
			}
			row.classList.toggle("is-spent", spent);
		}
	);
};

Space4x.syncSpaceStatusPanels = function (ui, state, cmds) {
	if (!ui) return;
	cmds = cmds || (Space4x.app && Space4x.app.cmds) || null;
	const battle = Space4x.spaceBattleById(state, state.ui.selectedSpaceBattleId);
	const friendly = battle ? Space4x.tokenById(battle, state.ui.spaceTokenId) : null;
	const enemy = battle ? Space4x.tokenById(battle, state.ui.spaceEnemyTokenId) : null;
	const playerSide = battle ? Space4x.playerBattleSide(state, battle) : null;
	const showFriendly = friendly && (!playerSide || friendly.side === playerSide);
	const showEnemy = enemy && (!playerSide || enemy.side !== playerSide);
	const canSelectWeapons = !!(showFriendly && cmds && battle && !friendly.activated && !battle.done &&
		battle.phase === playerSide && !battle._aiAnim);

	Space4x.drawSpaceStatusPortrait(ui.spaceStatusFriendlyArt, state, showFriendly ? friendly : null);
	Space4x.fillSpaceStatusStats(ui.spaceStatusFriendlyStats, state, showFriendly ? friendly : null,
		"Select one of your ships.");
	Space4x.syncSpaceStatusLoad(ui.spaceStatusFriendlyLoad, state, showFriendly ? friendly : null, {
		useButtons: !!cmds,
		selectable: canSelectWeapons,
		cmds: cmds
	});

	Space4x.drawSpaceStatusPortrait(ui.spaceStatusEnemyArt, state, showEnemy ? enemy : null);
	Space4x.fillSpaceStatusStats(ui.spaceStatusEnemyStats, state, showEnemy ? enemy : null,
		"Click an enemy ship to inspect.");
	Space4x.syncSpaceStatusLoad(ui.spaceStatusEnemyLoad, state, showEnemy ? enemy : null, {
		useButtons: false
	});
};

Space4x.spaceTokenDrawPos = function (battle, token) {
	const tw = battle && battle._aiTween;
	if (tw && tw.tokenId === token.id) {
		return { x: tw.x, y: tw.y, heading: tw.heading };
	}
	return { x: token.x, y: token.y, heading: token.heading };
};

Space4x.panSpaceCombatToToken = function (ui, battle, token) {
	if (!battle || !token) return;
	if (!battle.view) battle.view = { zoom: 1, panX: null, panY: null };
	const layout = Space4x.spaceLayout(ui || {}, battle);
	if (!layout) return;
	if (battle.view.panX == null) battle.view.panX = layout.panX;
	if (battle.view.panY == null) battle.view.panY = layout.panY;
	layout.panX = battle.view.panX;
	layout.panY = battle.view.panY;
	const draw = Space4x.spaceTokenDrawPos(battle, token);
	const cx = layout.panX + (draw.x + 0.5) * layout.cell;
	const cy = layout.panY + (draw.y + 0.5) * layout.cell;
	const margin = 0.3;
	const w = layout.w;
	const h = layout.h;
	if (cx < w * margin) battle.view.panX += w * margin - cx;
	else if (cx > w * (1 - margin)) battle.view.panX -= cx - w * (1 - margin);
	if (cy < h * margin) battle.view.panY += h * margin - cy;
	else if (cy > h * (1 - margin)) battle.view.panY -= cy - h * (1 - margin);
};

Space4x.runAnimatedAiSide = function (state, battle, side, onDone) {
	const app = Space4x.app;
	if (!app) {
		Space4x.aiPlaySide(state, battle, side);
		if (onDone) onDone();
		return;
	}
	if (battle._aiAnim) {
		battle._aiQueue = battle._aiQueue || [];
		battle._aiQueue.push({ side: side, onDone: onDone });
		return;
	}
	battle._aiAnim = true;
	battle._aiGen = (battle._aiGen || 0) + 1;
	const gen = battle._aiGen;
	const tokens = Space4x.livingTokens(battle, side).filter(function (t) {
		return t.kind !== "missile";
	});
	let tidx = 0;
	function clearAiTimer() {
		if (battle._aiTimer) {
			clearTimeout(battle._aiTimer);
			battle._aiTimer = null;
		}
		if (battle._aiRaf) {
			cancelAnimationFrame(battle._aiRaf);
			battle._aiRaf = null;
		}
	}
	function schedule(fn, ms) {
		clearAiTimer();
		battle._aiTimer = setTimeout(function () {
			if (battle._aiGen !== gen || !battle._aiAnim) return;
			fn();
		}, ms);
	}
	function flushQueue() {
		const q = battle._aiQueue;
		battle._aiQueue = null;
		if (!q || !q.length) return;
		const next = q.shift();
		if (q.length) battle._aiQueue = q;
		Space4x.runAnimatedAiSide(state, battle, next.side, next.onDone);
	}
	function finish() {
		if (battle._aiGen !== gen) return;
		clearAiTimer();
		battle._aiTween = null;
		battle._aiAnim = false;
		if (onDone) onDone();
		flushQueue();
		if (!battle._aiAnim && app.sync) app.sync();
	}
	function redraw() {
		Space4x.drawSpaceCombat(app.ui, state);
	}
	function animateMoveTo(token, action, after) {
		const fromX = token.x;
		const fromY = token.y;
		const fromH = token.heading || 0;
		const toX = action.x;
		const toY = action.y;
		const toH = action.heading != null ? action.heading : fromH;
		const duration = 500;
		const start = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
		function frame(now) {
			if (battle._aiGen !== gen || !battle._aiAnim) return;
			const t = Math.min(1, (now - start) / duration);
			battle._aiTween = {
				tokenId: token.id,
				x: fromX + (toX - fromX) * t,
				y: fromY + (toY - fromY) * t,
				heading: fromH + (toH - fromH) * t
			};
			Space4x.panSpaceCombatToToken(app.ui, battle, token);
			redraw();
			if (t < 1) {
				battle._aiRaf = requestAnimationFrame(frame);
				return;
			}
			battle._aiRaf = null;
			battle._aiTween = null;
			Space4x.spaceApplyAction(state, battle, token, action);
			Space4x.panSpaceCombatToToken(app.ui, battle, token);
			if (app.sync) app.sync();
			after();
		}
		battle._aiRaf = requestAnimationFrame(frame);
	}
	function runToken() {
		try {
			if (battle._aiGen !== gen || !battle._aiAnim) return;
			if (battle.done) {
				finish();
				return;
			}
			while (tidx < tokens.length && (tokens[tidx].activated || tokens[tidx].dead)) tidx += 1;
			if (tidx >= tokens.length) {
				finish();
				return;
			}
			const token = tokens[tidx++];
			if (token.dead || token.activated) {
				schedule(runToken, 0);
				return;
			}
			const actions = Space4x.buildAiTokenActions(state, battle, token);
			state.ui.spaceTokenId = token.id;
			Space4x.panSpaceCombatToToken(app.ui, battle, token);
			if (app.sync) app.sync();

			function applyRest(startIdx) {
				for (let i = startIdx; i < actions.length; i++) {
					Space4x.spaceApplyAction(state, battle, token, actions[i]);
					if (Space4x.checkBattleEnd(state, battle)) {
						finish();
						return;
					}
				}
				token.activated = true;
				if (Space4x.checkBattleEnd(state, battle)) {
					finish();
					return;
				}
				schedule(runToken, 250);
			}

			if (!actions.length) {
				token.activated = true;
				schedule(runToken, 250);
				return;
			}

			if (actions[0].type === "moveTo") {
				animateMoveTo(token, actions[0], function () {
					if (battle.done) {
						finish();
						return;
					}
					applyRest(1);
				});
				return;
			}
			applyRest(0);
		} catch (err) {
			battle.log.push("AI error: " + (err && err.message ? err.message : String(err)));
			finish();
		}
	}
	runToken();
};

Space4x.bindSpaceCombatInput = function (app) {
	const canvas = app.ui.spaceCanvas;
	if (!canvas || canvas._spaceBound) return;
	canvas._spaceBound = true;
	const drag = { on: false, panned: false, x: 0, y: 0, panX: 0, panY: 0 };
	canvas.addEventListener("pointerdown", function (ev) {
		if (ev.button !== 0 || app.state.ui.stage !== "spaceCombat") return;
		const battle = Space4x.spaceBattleById(app.state, app.state.ui.selectedSpaceBattleId);
		if (!battle) return;
		if (!battle.view) battle.view = { zoom: 1, panX: null, panY: null };
		drag.on = true;
		drag.panned = false;
		drag.x = ev.clientX;
		drag.y = ev.clientY;
		const layout = app.ui._spaceLayout || Space4x.spaceLayout(app.ui, battle);
		drag.panX = layout ? layout.panX : (battle.view.panX || 0);
		drag.panY = layout ? layout.panY : (battle.view.panY || 0);
		try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
	});
	canvas.addEventListener("pointermove", function (ev) {
		if (!drag.on) return;
		const dx = ev.clientX - drag.x;
		const dy = ev.clientY - drag.y;
		if (!drag.panned && dx * dx + dy * dy < 36) return;
		drag.panned = true;
		const battle = Space4x.spaceBattleById(app.state, app.state.ui.selectedSpaceBattleId);
		if (!battle) return;
		battle.view.panX = drag.panX + dx;
		battle.view.panY = drag.panY + dy;
		Space4x.drawSpaceCombat(app.ui, app.state);
	});
	function endDrag(ev) {
		if (!drag.on) return;
		drag.on = false;
		if (drag.panned) return;
		const battle = Space4x.spaceBattleById(app.state, app.state.ui.selectedSpaceBattleId);
		if (battle && battle._aiAnim) return;
		const battleForLayout = battle;
		if (!battleForLayout) return;
		const layout = app.ui._spaceLayout || Space4x.spaceLayout(app.ui, battleForLayout);
		if (!layout) return;
		const rect = canvas.getBoundingClientRect();
		const cell = Space4x.spaceScreenToCell(layout, ev.clientX - rect.left, ev.clientY - rect.top);
		app.cmds.spaceGridClick(cell.x, cell.y);
	}
	canvas.addEventListener("pointerup", endDrag);
	canvas.addEventListener("wheel", function (ev) {
		if (app.state.ui.stage !== "spaceCombat") return;
		ev.preventDefault();
		const battle = Space4x.spaceBattleById(app.state, app.state.ui.selectedSpaceBattleId);
		const layout = app.ui._spaceLayout;
		if (!battle || !layout) return;
		const rect = canvas.getBoundingClientRect();
		const mx = ev.clientX - rect.left;
		const my = ev.clientY - rect.top;
		const worldX = (mx - layout.panX) / layout.cell;
		const worldY = (my - layout.panY) / layout.cell;
		const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
		battle.view.zoom = Math.max(0.4, Math.min(8, (battle.view.zoom || 1) * factor));
		const next = Space4x.spaceLayout(app.ui, battle);
		battle.view.panX = mx - worldX * next.cell;
		battle.view.panY = my - worldY * next.cell;
		Space4x.drawSpaceCombat(app.ui, app.state);
	}, { passive: false });
};
