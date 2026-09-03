var Space4x = Space4x || {};

Space4x.spaceBattlesOf = function (state) {
	return (state.turnEvents && state.turnEvents.spaceBattles) || [];
};

Space4x.spaceBattleById = function (state, id) {
	const list = Space4x.spaceBattlesOf(state);
	for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
	return null;
};

Space4x.playerOpenSpaceBattles = function (state) {
	const player = Space4x.playerEmpire(state);
	if (!player) return [];
	const out = [];
	const list = Space4x.spaceBattlesOf(state);
	for (let i = 0; i < list.length; i++) {
		const b = list[i];
		if (b.done) continue;
		if (b.attackerEmpireId === player.id || b.defenderEmpireId === player.id) out.push(b);
	}
	return out;
};

Space4x.euclid = function (ax, ay, bx, by) {
	const dx = ax - bx;
	const dy = ay - by;
	return Math.sqrt(dx * dx + dy * dy);
};

Space4x.stepCost = function (dx, dy) {
	if (!dx && !dy) return 0;
	if (dx && dy) return Math.sqrt(2);
	return 1;
};

Space4x.combatFacingFrom = function (token, fromX, fromY) {
	const dx = fromX - token.x;
	const dy = fromY - token.y;
	const ang = Math.atan2(dy, dx);
	let heading = token.heading != null ? token.heading : 0;
	let rel = ang - heading;
	while (rel > Math.PI) rel -= Math.PI * 2;
	while (rel < -Math.PI) rel += Math.PI * 2;
	const a = Math.abs(rel);
	if (a <= Math.PI / 4) return "front";
	if (a >= 3 * Math.PI / 4) return "back";
	return rel > 0 ? "right" : "left";
};

Space4x.makeShipToken = function (state, battle, unit, side, slot, total) {
	const empire = Space4x.empireById(state, unit.empireId);
	const fit = unit.combatFit || Space4x.snapshotCombatFit(state, empire, unit.defId, null);
	const shield = Space4x.shipLayerHp(state, empire, unit.defId, "shield", fit.load);
	const armor = Space4x.shipLayerHp(state, empire, unit.defId, "armor");
	const structure = Space4x.shipLayerHp(state, empire, unit.defId, "structure");
	const gw = battle.grid.w;
	const gh = battle.grid.h;
	const spacing = total <= 1 ? 0 : Math.min(3, Math.floor((gh - 4) / Math.max(1, total - 1)));
	const midY = Math.floor(gh / 2);
	const startY = midY - Math.floor(((total - 1) * spacing) / 2);
	const y = Math.max(1, Math.min(gh - 2, startY + slot * spacing));
	const edge = Math.max(4, Math.floor(gw * 0.07));
	const x = side === "attacker" ? edge : gw - edge - 1;
	const expanded = fit.load || [];
	const missilePool = Space4x.buildMissileAmmoPool(state, expanded);
	const load = [];
	let wi = 0;
	for (let i = 0; i < expanded.length; i++) {
		let itemId = expanded[i].itemId;
		if (itemId === "energyBolt") itemId = "muonTorpedo";
		const item = Space4x.spaceLoadItem(state, itemId);
		if (!item) continue;
		if (Space4x.isMissileAmmo(item) || item.kind === "shield" || item.kind === "device") continue;
		if (!Space4x.isCombatWeaponItem(item)) continue;
		load.push({
			id: "w" + wi,
			itemId: itemId,
			fired: false,
			launched: false
		});
		wi += 1;
	}
	return {
		id: unit.id,
		unitId: unit.id,
		empireId: unit.empireId,
		side: side,
		kind: "ship",
		defId: unit.defId,
		designId: fit.designId || null,
		shipArt: fit.shipArt || null,
		name: Space4x.unitLabel(state, unit),
		x: x,
		y: y,
		heading: Space4x.quantizeHeading(state, side === "attacker" ? 0 : Math.PI),
		shields: { front: shield, right: shield, back: shield, left: shield },
		shieldMax: shield,
		armor: armor,
		armorMax: armor,
		structure: structure,
		structureMax: structure,
		load: load,
		missilePool: missilePool,
		speed: Space4x.isStationHull(state, unit) ? 0 :
			Space4x.combatSpeedOf(state, empire, { hullDefId: unit.defId, load: fit.load }),
		speedLeft: Space4x.isStationHull(state, unit) ? 0 :
			Space4x.combatSpeedOf(state, empire, { hullDefId: unit.defId, load: fit.load }),
		activated: false,
		dead: false,
		warping: false,
		retreatRound: null,
		left: false,
		immobile: Space4x.isStationHull(state, unit)
	};
};

Space4x.placeTokensOnGrid = function (state, battle, attacker, defender) {
	const tokens = [];
	for (let i = 0; i < attacker.length; i++) {
		tokens.push(Space4x.makeShipToken(state, battle, attacker[i], "attacker", i, attacker.length));
	}
	for (let i = 0; i < defender.length; i++) {
		tokens.push(Space4x.makeShipToken(state, battle, defender[i], "defender", i, defender.length));
	}
	battle.tokens = tokens;
};

Space4x.tokenById = function (battle, id) {
	const list = battle.tokens || [];
	for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
	return null;
};

Space4x.livingTokens = function (battle, side) {
	const out = [];
	const list = battle.tokens || [];
	for (let i = 0; i < list.length; i++) {
		if (list[i].dead) continue;
		if (side && list[i].side !== side) continue;
		out.push(list[i]);
	}
	return out;
};

Space4x.livingShips = function (battle, side) {
	const out = [];
	const list = Space4x.livingTokens(battle, side);
	for (let i = 0; i < list.length; i++) {
		if (list[i].kind !== "ship") continue;
		if (list[i].warping || list[i].left) continue;
		out.push(list[i]);
	}
	return out;
};

Space4x.presentShips = function (battle, side) {
	const out = [];
	const list = Space4x.livingTokens(battle, side);
	for (let i = 0; i < list.length; i++) {
		if (list[i].kind !== "ship") continue;
		if (list[i].left) continue;
		out.push(list[i]);
	}
	return out;
};

Space4x.battleHasFighters = function (battle, empireId) {
	const list = battle.tokens || [];
	for (let i = 0; i < list.length; i++) {
		const t = list[i];
		if (t.empireId !== empireId || t.dead) continue;
		if (t.kind === "fighter") return true;
		if (t.kind === "ship") {
			for (let w = 0; w < t.load.length; w++) {
				const id = t.load[w].itemId;
				if (id === "fighterBay" || id === "interceptorBay" || id === "strikeBay" || id === "assaultBay") return true;
			}
		}
	}
	return false;
};

Space4x.cellBlocked = function (battle, x, y, exceptId) {
	const cfg = battle.grid;
	if (x < 0 || y < 0 || x >= cfg.w || y >= cfg.h) return true;
	const list = battle.tokens || [];
	for (let i = 0; i < list.length; i++) {
		const t = list[i];
		if (t.dead || t.id === exceptId) continue;
		if (t.kind === "missile") continue;
		if (t.x === x && t.y === y) return true;
	}
	return false;
};

Space4x.spaceTurnStepRad = function (state) {
	const deg = Space4x.spaceCombatCfg(state).turnStepDeg || 15;
	return deg * Math.PI / 180;
};

Space4x.spaceHeadingSteps = function (state) {
	return Math.round((Math.PI * 2) / Space4x.spaceTurnStepRad(state));
};

Space4x.normalizeAngle = function (a) {
	while (a <= -Math.PI) a += Math.PI * 2;
	while (a > Math.PI) a -= Math.PI * 2;
	return a;
};

Space4x.quantizeHeading = function (state, angle) {
	const step = Space4x.spaceTurnStepRad(state);
	const n = Math.round(Space4x.normalizeAngle(angle) / step);
	const steps = Space4x.spaceHeadingSteps(state);
	const idx = ((n % steps) + steps) % steps;
	return idx * step;
};

Space4x.headingIndex = function (state, angle) {
	const step = Space4x.spaceTurnStepRad(state);
	const steps = Space4x.spaceHeadingSteps(state);
	const n = Math.round(Space4x.normalizeAngle(angle) / step);
	return ((n % steps) + steps) % steps;
};

Space4x.headingFromIndex = function (state, idx) {
	const steps = Space4x.spaceHeadingSteps(state);
	const i = ((idx % steps) + steps) % steps;
	return i * Space4x.spaceTurnStepRad(state);
};

Space4x.spaceTurnStepsBetween = function (state, from, to) {
	const steps = Space4x.spaceHeadingSteps(state);
	const a = Space4x.headingIndex(state, from);
	const b = Space4x.headingIndex(state, to);
	let diff = Math.abs(b - a) % steps;
	if (diff > steps / 2) diff = steps - diff;
	return diff;
};

Space4x.spaceTurnCost = function (state, from, to) {
	const cfg = Space4x.spaceCombatCfg(state);
	return Space4x.spaceTurnStepsBetween(state, from, to) * (cfg.turnCost || 2);
};

Space4x.headingTowardCell = function (x, y, tx, ty) {
	if (x === tx && y === ty) return 0;
	return Math.atan2(ty - y, tx - x);
};

Space4x.forwardStepFromHeading = function (heading) {
	const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
	const hx = Math.cos(heading);
	const hy = Math.sin(heading);
	let best = dirs[0];
	let bestDot = -Infinity;
	for (let i = 0; i < dirs.length; i++) {
		const dx = dirs[i][0];
		const dy = dirs[i][1];
		const len = Math.sqrt(dx * dx + dy * dy);
		const dot = (dx / len) * hx + (dy / len) * hy;
		if (dot > bestDot) {
			bestDot = dot;
			best = dirs[i];
		}
	}
	return { dx: best[0], dy: best[1], cost: Space4x.stepCost(best[0], best[1]) };
};

Space4x.spaceTurnTokenToward = function (state, token, tx, ty) {
	const desired = Space4x.quantizeHeading(state, Space4x.headingTowardCell(token.x, token.y, tx, ty));
	const cost = Space4x.spaceTurnCost(state, token.heading || 0, desired);
	if (cost > token.speedLeft + 1e-9) return false;
	token.speedLeft -= cost;
	token.heading = desired;
	return true;
};

Space4x.spaceStateKey = function (x, y, hi) {
	return x + "," + y + "," + hi;
};

Space4x.spaceSnapHeading = function (state, token) {
	if (!token) return;
	token.heading = Space4x.headingFromIndex(state, Space4x.headingIndex(state, token.heading || 0));
};

Space4x.spaceExpandStates = function (state, battle, token) {
	const out = { cells: {}, parent: {}, best: {}, startKey: "" };
	if (!token || token.dead || !(token.speedLeft > 0.05)) return out;
	Space4x.spaceSnapHeading(state, token);
	const steps = Space4x.spaceHeadingSteps(state);
	const turnCost = Space4x.spaceCombatCfg(state).turnCost || 2;
	const startHi = Space4x.headingIndex(state, token.heading || 0);
	const startKey = Space4x.spaceStateKey(token.x, token.y, startHi);
	out.startKey = startKey;
	out.best[startKey] = token.speedLeft;
	const queue = [{ x: token.x, y: token.y, hi: startHi, speed: token.speedLeft }];
	function relax(x, y, hi, speed, prevKey, action) {
		const nk = Space4x.spaceStateKey(x, y, hi);
		if (out.best[nk] != null && speed <= out.best[nk] + 1e-9) return;
		out.best[nk] = speed;
		out.parent[nk] = { prevKey: prevKey, action: action };
		queue.push({ x: x, y: y, hi: hi, speed: speed });
		if (!(x === token.x && y === token.y)) out.cells[x + "," + y] = { x: x, y: y };
	}
	for (let qi = 0; qi < queue.length; qi++) {
		const cur = queue[qi];
		const pk = Space4x.spaceStateKey(cur.x, cur.y, cur.hi);
		for (let nhi = 0; nhi < steps; nhi++) {
			if (nhi === cur.hi) continue;
			let diff = Math.abs(nhi - cur.hi);
			if (diff > steps / 2) diff = steps - diff;
			const tc = diff * turnCost;
			if (tc > cur.speed + 1e-9) continue;
			relax(cur.x, cur.y, nhi, cur.speed - tc, pk, { type: "turn", hi: nhi, cost: tc });
		}
		const fwd = Space4x.forwardStepFromHeading(Space4x.headingFromIndex(state, cur.hi));
		const nx = cur.x + fwd.dx;
		const ny = cur.y + fwd.dy;
		if (fwd.cost > cur.speed + 1e-9) continue;
		if (Space4x.cellBlocked(battle, nx, ny, token.id)) continue;
		relax(nx, ny, cur.hi, cur.speed - fwd.cost, pk, { type: "forward", x: nx, y: ny, cost: fwd.cost });
	}
	return out;
};

Space4x.spacePathToCell = function (state, battle, token, tx, ty) {
	if (!token || token.dead) return null;
	if (token.x === tx && token.y === ty) return [];
	const ex = Space4x.spaceExpandStates(state, battle, token);
	let goalKey = null;
	let bestSpeed = -1;
	const keys = Object.keys(ex.best);
	for (let i = 0; i < keys.length; i++) {
		const parts = keys[i].split(",");
		const x = parseInt(parts[0], 10);
		const y = parseInt(parts[1], 10);
		if (x !== tx || y !== ty) continue;
		if (ex.best[keys[i]] > bestSpeed) {
			bestSpeed = ex.best[keys[i]];
			goalKey = keys[i];
		}
	}
	if (!goalKey) return null;
	return Space4x.spaceReconstructPath(ex, goalKey);
};

Space4x.spaceReconstructPath = function (ex, goalKey) {
	if (!goalKey) return null;
	const actions = [];
	let k = goalKey;
	while (k !== ex.startKey) {
		const p = ex.parent[k];
		if (!p) return null;
		actions.unshift(p.action);
		k = p.prevKey;
	}
	return actions;
};

Space4x.spacePathTowardCell = function (state, battle, token, tx, ty) {
	if (!token || token.dead) return null;
	if (token.x === tx && token.y === ty) return [];
	const direct = Space4x.spacePathToCell(state, battle, token, tx, ty);
	if (direct) return direct;
	const ex = Space4x.spaceExpandStates(state, battle, token);
	const keys = Object.keys(ex.best);
	let bestKey = null;
	let bestD = Infinity;
	let bestSpeed = -1;
	for (let i = 0; i < keys.length; i++) {
		const parts = keys[i].split(",");
		const x = parseInt(parts[0], 10);
		const y = parseInt(parts[1], 10);
		const d = Space4x.euclid(x, y, tx, ty);
		const speed = ex.best[keys[i]];
		if (d + 1e-9 < bestD || (Math.abs(d - bestD) < 1e-9 && speed > bestSpeed + 1e-9)) {
			bestD = d;
			bestSpeed = speed;
			bestKey = keys[i];
		}
	}
	if (!bestKey) return null;
	const parts = bestKey.split(",");
	if (parseInt(parts[0], 10) === token.x && parseInt(parts[1], 10) === token.y) return [];
	return Space4x.spaceReconstructPath(ex, bestKey);
};

Space4x.spaceApplyAction = function (state, battle, token, action) {
	if (!token || !action) return false;
	if (token.warping || token.left || token.dead) return false;
	if (action.type === "moveTo") {
		token.x = action.x;
		token.y = action.y;
		token.heading = action.heading;
		token.speedLeft = action.speedLeft;
		return true;
	}
	if (action.type === "turn") {
		if (action.cost > token.speedLeft + 1e-9) return false;
		token.speedLeft -= action.cost;
		token.heading = Space4x.headingFromIndex(state, action.hi);
		return true;
	}
	if (action.type === "forward") {
		if (action.cost > token.speedLeft + 1e-9) return false;
		if (Space4x.cellBlocked(battle, action.x, action.y, token.id)) return false;
		token.x = action.x;
		token.y = action.y;
		token.speedLeft -= action.cost;
		return true;
	}
	if (action.type === "launch") {
		const weapon = (token.load || []).filter(function (w) { return w.id === action.weaponId; })[0];
		if (!weapon) return false;
		return Space4x.launchFighter(state, battle, token, weapon);
	}
	if (action.type === "fireBeam") {
		const weapon = (token.load || []).filter(function (w) { return w.id === action.weaponId; })[0];
		const target = Space4x.tokenById(battle, action.targetId);
		if (!weapon || !target || target.dead) return false;
		return Space4x.fireBeam(state, battle, token, weapon, target);
	}
	if (action.type === "fireMissile") {
		const weapon = (token.load || []).filter(function (w) { return w.id === action.weaponId; })[0];
		const target = Space4x.tokenById(battle, action.targetId);
		if (!weapon || !target || target.dead) return false;
		return Space4x.launchMissile(state, battle, token, weapon, target);
	}
	if (action.type === "fighterShot") {
		const target = Space4x.tokenById(battle, action.targetId);
		if (!target || target.dead) return false;
		Space4x.fireFighterShot(state, battle, token, target);
		return true;
	}
	return false;
};

Space4x.spaceNavigateTokenToCell = function (state, battle, token, tx, ty) {
	const path = Space4x.spacePathToCell(state, battle, token, tx, ty);
	if (!path) return false;
	for (let i = 0; i < path.length; i++) {
		if (!Space4x.spaceApplyAction(state, battle, token, path[i])) return false;
	}
	return true;
};

Space4x.spaceReachableCells = function (state, battle, token) {
	if (!token || token.dead || token.left || token.activated || token.warping || token.immobile) return [];
	if (!(token.speedLeft > 0.05)) return [];
	const ex = Space4x.spaceExpandStates(state, battle, token);
	const out = [];
	const keys = Object.keys(ex.cells);
	for (let i = 0; i < keys.length; i++) out.push(ex.cells[keys[i]]);
	return out;
};

Space4x.spaceWeaponRangeCells = function (state, battle, token, weapon) {
	const out = [];
	if (!token || !weapon || token.dead) return out;
	const item = Space4x.spaceLoadItem(state, weapon.itemId);
	if (!item) return out;
	if (item.kind === "device") return out;
	let range = item.range || 0;
	if (item.kind === "fighter") range = item.fighterRange || 12;
	if (!(range > 0)) return out;
	const gw = battle.grid.w;
	const gh = battle.grid.h;
	for (let y = 0; y < gh; y++) {
		for (let x = 0; x < gw; x++) {
			if (Space4x.euclid(token.x, token.y, x, y) <= range + 1e-9) out.push({ x: x, y: y });
		}
	}
	return out;
};

Space4x.spaceWeaponTargetCells = function (state, battle, token, weapon) {
	const out = [];
	const range = Space4x.spaceWeaponRangeCells(state, battle, token, weapon);
	const enemySide = token.side === "attacker" ? "defender" : "attacker";
	for (let i = 0; i < range.length; i++) {
		const c = range[i];
		const occ = Space4x.tokenAtCell(battle, c.x, c.y);
		if (occ && occ.side === enemySide && !occ.dead && occ.kind !== "missile") out.push(c);
	}
	return out;
};

Space4x.buildAiTokenActions = function (state, battle, token) {
	const actions = [];
	if (token.dead || token.activated) return actions;
	const foe = Space4x.nearestEnemy(battle, token);
	if (!foe) return actions;
	const plan = {
		id: token.id,
		x: token.x,
		y: token.y,
		heading: token.heading,
		speedLeft: token.speedLeft,
		load: token.load,
		kind: token.kind,
		side: token.side,
		fighterRange: token.fighterRange,
		missilePool: token.missilePool
	};
	if (token.kind === "fighter" || token.kind === "ship") {
		for (let w = 0; w < plan.load.length; w++) {
			const item = Space4x.spaceLoadItem(state, plan.load[w].itemId);
			if (item && item.kind === "fighter" && !plan.load[w].launched) {
				actions.push({ type: "launch", weaponId: plan.load[w].id });
			}
		}
	}
	let guard = 0;
	while (plan.speedLeft > 0.05 && guard < 40) {
		guard += 1;
		const path = Space4x.spacePathTowardCell(state, battle, plan, foe.x, foe.y);
		if (!path || !path.length) break;
		Space4x.spaceApplyAction(state, battle, plan, path[0]);
	}
	if (plan.x !== token.x || plan.y !== token.y || plan.heading !== token.heading ||
		Math.abs(plan.speedLeft - token.speedLeft) > 1e-9) {
		actions.push({
			type: "moveTo",
			x: plan.x,
			y: plan.y,
			heading: plan.heading,
			speedLeft: plan.speedLeft
		});
	}
	if (plan.kind === "fighter") {
		const foeLive = Space4x.nearestEnemy(battle, plan);
		if (foeLive) {
			const dist = Space4x.euclid(plan.x, plan.y, foeLive.x, foeLive.y);
			if (dist <= (plan.fighterRange || 12) + 1e-9) {
				actions.push({ type: "fighterShot", targetId: foeLive.id });
			}
		}
	} else {
		const foeLive = Space4x.nearestEnemy(battle, plan);
		if (foeLive) {
			for (let w = 0; w < plan.load.length; w++) {
				const weapon = plan.load[w];
				if (weapon.fired || weapon.launched) continue;
				const item = Space4x.spaceLoadItem(state, weapon.itemId);
				if (!item) continue;
				const dist = Space4x.euclid(plan.x, plan.y, foeLive.x, foeLive.y);
				if (item.kind === "beam" && dist <= (item.range || 0) + 1e-9) {
					actions.push({ type: "fireBeam", weaponId: weapon.id, targetId: foeLive.id });
				}
				const canFireMissile = item.kind === "missile" ||
					(item.kind === "missileLauncher" && Space4x.launcherHasAmmo(state, plan.missilePool || {}, item));
				if (canFireMissile && dist <= (item.range || 0) + 1e-9) {
					actions.push({ type: "fireMissile", weaponId: weapon.id, targetId: foeLive.id });
				}
			}
		}
	}
	return actions;
};

Space4x.playAiSide = function (state, battle, side, onDone) {
	const player = Space4x.playerEmpire(state);
	const playerWatching = player &&
		(battle.attackerEmpireId === player.id || battle.defenderEmpireId === player.id);
	const playerSide = Space4x.playerBattleSide(state, battle);
	const animateEnemy = playerWatching && playerSide !== side && !state.ui.autoPlaying;
	const animatePlayer = playerWatching && playerSide === side && state.ui.spaceCombatAuto;
	if ((animateEnemy || animatePlayer) && Space4x.runAnimatedAiSide) {
		Space4x.runAnimatedAiSide(state, battle, side, onDone);
		return;
	}
	Space4x.aiPlaySide(state, battle, side);
	if (onDone) onDone();
};

Space4x.spaceMoveForward = function (battle, token, maxSteps) {
	let steps = 0;
	const cap = maxSteps != null ? maxSteps : 80;
	while (token.speedLeft > 0.05 && steps < cap) {
		const fwd = Space4x.forwardStepFromHeading(token.heading || 0);
		const nx = token.x + fwd.dx;
		const ny = token.y + fwd.dy;
		if (fwd.cost > token.speedLeft + 1e-9) break;
		if (Space4x.cellBlocked(battle, nx, ny, token.id)) break;
		token.x = nx;
		token.y = ny;
		token.speedLeft -= fwd.cost;
		steps += 1;
	}
	return steps;
};

Space4x.spaceMoveTowardCell = function (state, battle, token, tx, ty) {
	return Space4x.spaceNavigateTokenToCell(state, battle, token, tx, ty) ? 1 : 0;
};

Space4x.bestStepToward = function (battle, token, tx, ty) {
	let best = null;
	let bestD = Space4x.euclid(token.x, token.y, tx, ty);
	const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
	for (let i = 0; i < dirs.length; i++) {
		const nx = token.x + dirs[i][0];
		const ny = token.y + dirs[i][1];
		const cost = Space4x.stepCost(dirs[i][0], dirs[i][1]);
		if (cost > token.speedLeft + 1e-9) continue;
		if (Space4x.cellBlocked(battle, nx, ny, token.id)) continue;
		const d = Space4x.euclid(nx, ny, tx, ty);
		if (d + 1e-9 < bestD) {
			bestD = d;
			best = { x: nx, y: ny, cost: cost, dx: dirs[i][0], dy: dirs[i][1] };
		}
	}
	return best;
};

Space4x.applyDamage = function (state, battle, target, fromX, fromY, amount) {
	const out = { absorbed: 0, leftover: 0, shield: 0, armor: 0, structure: 0, facing: null };
	if (target.dead || target.left || !(amount > 0)) return out;
	let dmg = amount;
	if (target.kind === "ship") {
		const face = Space4x.combatFacingFrom(target, fromX, fromY);
		out.facing = face;
		const sh = target.shields[face] || 0;
		const take = Math.min(sh, dmg);
		target.shields[face] = sh - take;
		out.shield = take;
		dmg -= take;
	}
	if (dmg > 0 && target.armor > 0) {
		const take = Math.min(target.armor, dmg);
		target.armor -= take;
		out.armor = take;
		dmg -= take;
	}
	if (dmg > 0) {
		const take = Math.min(target.structure, dmg);
		target.structure -= take;
		out.structure = take;
		dmg -= take;
	}
	out.absorbed = out.shield + out.armor + out.structure;
	out.leftover = Math.max(0, amount - out.absorbed);
	if (out.absorbed > 0 && target.kind === "ship") {
		battle.roundsSinceDamage = 0;
	}
	if (target.structure <= 0) {
		target.dead = true;
		target.structure = 0;
		battle.log.push((target.name || target.kind) + " destroyed.");
	}
	return out;
};

Space4x.pushSpaceCombatFx = function (battle, fx) {
	if (!battle) return;
	if (!battle.fx) battle.fx = [];
	const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
	fx.t0 = fx.t0 != null ? fx.t0 : now;
	battle.fx.push(fx);
	if (Space4x.kickSpaceCombatFxLoop) Space4x.kickSpaceCombatFxLoop();
};

Space4x.queueSpaceCombatHitFx = function (battle, shooter, target, result, opts) {
	opts = opts || {};
	if (!battle || !shooter || !target) return;
	const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
	Space4x.pushSpaceCombatFx(battle, {
		type: "beam",
		fromId: shooter.id,
		toId: target.id,
		miss: !!opts.miss,
		t0: now,
		dur: 500
	});
	if (opts.miss) {
		Space4x.pushSpaceCombatFx(battle, {
			type: "float",
			tokenId: target.id,
			text: "Miss",
			color: "#c8d0e0",
			t0: now,
			dur: 3000,
			rise: 28
		});
		return;
	}
	const total = result ? Math.round(result.absorbed || 0) : 0;
	if (total > 0) {
		Space4x.pushSpaceCombatFx(battle, {
			type: "float",
			tokenId: target.id,
			text: "-" + total,
			color: "#ff6b6b",
			t0: now,
			dur: 3000,
			rise: 34
		});
	}
	Space4x.pushSpaceCombatFx(battle, {
		type: "flash",
		tokenId: target.id,
		t0: now,
		dur: 500
	});
};

Space4x.mergeDamageResults = function (into, part) {
	if (!into || !part) return into;
	into.shield += part.shield || 0;
	into.armor += part.armor || 0;
	into.structure += part.structure || 0;
	into.absorbed += part.absorbed || 0;
	into.leftover += part.leftover || 0;
	if (part.facing && !into.facing) into.facing = part.facing;
	return into;
};

Space4x.beamHitChance = function (state, battle, shooter, target, item) {
	const cfg = Space4x.spaceCombatCfg(state);
	const dist = Space4x.euclid(shooter.x, shooter.y, target.x, target.y);
	const atkEmp = Space4x.empireById(state, shooter.empireId);
	let attack = (cfg.attackSkill || 100);
	if (shooter.load) {
		for (let i = 0; i < shooter.load.length; i++) {
			const loadItem = Space4x.spaceLoadItem(state, shooter.load[i].itemId);
			if (loadItem && loadItem.attackSkill) attack += loadItem.attackSkill;
		}
	}
	const dodge = cfg.dodgeSkill || 50;
	if (item && item.attackSkill) attack += item.attackSkill;
	const penMult = item && item.rangePenaltyMult != null ? item.rangePenaltyMult : 1;
	const pen = (cfg.rangePenaltyPerSquare || 1) * dist * penMult;
	return Math.max(0, Math.min(100, attack - dodge - pen));
};

Space4x.fireBeam = function (state, battle, shooter, weapon, target, opts) {
	opts = opts || {};
	const item = Space4x.spaceLoadItem(state, weapon.itemId);
	if (!item || item.kind !== "beam") return null;
	if (!target || target.dead) return null;
	const dist = Space4x.euclid(shooter.x, shooter.y, target.x, target.y);
	if (dist > (item.range || 0) + 1e-9) {
		battle.log.push("Out of range.");
		return null;
	}
	if (weapon.fired) return null;
	weapon.fired = true;
	const chance = Space4x.beamHitChance(state, battle, shooter, target, item);
	const roll = Space4x.rngInt(state, 100);
	if (roll >= chance) {
		battle.log.push((shooter.name || "Ship") + " misses " + (target.name || "target") + " (" + Math.round(chance) + "%).");
		if (!opts.noFx) Space4x.queueSpaceCombatHitFx(battle, shooter, target, null, { miss: true });
		return { ok: true, miss: true, result: null, damage: 0 };
	}
	const min = item.damage[0];
	const max = item.damage[1];
	let dmg = min + Space4x.rngInt(state, max - min + 1);
	dmg = Math.max(1, Math.floor(dmg * Space4x.beamRangeDamageMult(item, dist) * Space4x.beamPhaseBonus(battle, target, item)));
	const result = Space4x.applyBeamDamage(state, battle, target, shooter.x, shooter.y, dmg, item);
	Space4x.markPhaseHit(battle, target, item);
	if (item.knockFacing) Space4x.applyBeamKnock(state, target, item);
	if (item.moveDebuff != null) Space4x.applyBeamMoveDebuff(target, item);
	battle.log.push((shooter.name || "Ship") + " hits " + (target.name || "target") + " for " + dmg + ".");
	if (!opts.noFx) Space4x.queueSpaceCombatHitFx(battle, shooter, target, result, {});
	return { ok: true, miss: false, result: result, damage: dmg };
};

Space4x.launchMissile = function (state, battle, shooter, weapon, target) {
	const item = Space4x.spaceLoadItem(state, weapon.itemId);
	if (!item || (item.kind !== "missileLauncher" && item.kind !== "missile")) return false;
	if (!target || target.dead) return false;
	if (weapon.fired) return false;
	let ammoItem = null;
	if (item.kind === "missile") {
		ammoItem = item;
	} else {
		ammoItem = Space4x.launcherAmmoItem(state, shooter.missilePool || {}, item);
		if (!ammoItem) return false;
		Space4x.consumeLauncherAmmo(shooter.missilePool, item, ammoItem);
	}
	const damage = ammoItem.builtInDamage != null ? ammoItem.builtInDamage : (ammoItem.damage || 10);
	const ammoName = ammoItem.unlimitedAmmo ? item.name : ammoItem.name;
	weapon.fired = true;
	const id = Space4x.nextId(state, "m");
	battle.tokens.push({
		id: id,
		empireId: shooter.empireId,
		side: shooter.side,
		kind: "missile",
		name: ammoName,
		x: shooter.x,
		y: shooter.y,
		heading: Math.atan2(target.y - shooter.y, target.x - shooter.x),
		targetId: target.id,
		speed: Space4x.missileCombatSpeed(state, shooter),
		damage: damage,
		salvo: 4,
		dead: false,
		structure: 1,
		structureMax: 1,
		armor: 0
	});
	battle.log.push((shooter.name || "Ship") + " launches " + ammoName + ".");
	return true;
};

Space4x.launchFighter = function (state, battle, shooter, weapon) {
	const item = Space4x.spaceLoadItem(state, weapon.itemId);
	if (!item || item.kind !== "fighter") return false;
	if (weapon.launched) return false;
	const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
	let spot = null;
	for (let i = 0; i < dirs.length; i++) {
		const nx = shooter.x + dirs[i][0];
		const ny = shooter.y + dirs[i][1];
		if (!Space4x.cellBlocked(battle, nx, ny, null)) {
			spot = { x: nx, y: ny };
			break;
		}
	}
	if (!spot) return false;
	weapon.launched = true;
	const emp = Space4x.empireById(state, shooter.empireId);
	const mods = emp && emp.modifiers ? emp.modifiers : {};
	const baseStruct = item.fighterStructure != null ? item.fighterStructure : 20;
	const structure = Math.max(1, baseStruct + (mods.fighterStructure || 0));
	const beam = item.fighterBeam || [1, 3];
	const dmgBonus = mods.fighterDamage || 0;
	const range = (item.fighterRange || 12) + (mods.fighterRange || 0);
	const fighterSpeed = Space4x.fighterCombatSpeed(state, shooter, item);
	battle.tokens.push({
		id: Space4x.nextId(state, "f"),
		empireId: shooter.empireId,
		side: shooter.side,
		kind: "fighter",
		name: item.name || "Fighter",
		x: spot.x,
		y: spot.y,
		heading: shooter.heading,
		shields: { front: 0, right: 0, back: 0, left: 0 },
		shieldMax: 0,
		armor: 0,
		armorMax: 0,
		structure: structure,
		structureMax: structure,
		load: [{ id: "fb", itemId: "lightCannon", fired: false }],
		fighterBeam: [beam[0] + dmgBonus, beam[1] + dmgBonus],
		fighterRange: range,
		speed: fighterSpeed,
		speedLeft: fighterSpeed,
		activated: false,
		dead: false
	});
	battle.log.push((shooter.name || "Ship") + " launches fighters.");
	return true;
};

Space4x.moveTokenToward = function (state, battle, token, tx, ty, maxSteps) {
	if (token.kind === "missile") {
		let steps = 0;
		const cap = maxSteps != null ? maxSteps : 80;
		while (token.speedLeft > 0.05 && steps < cap) {
			if (token.x === tx && token.y === ty) break;
			const step = Space4x.bestStepToward(battle, token, tx, ty);
			if (!step) break;
			token.x = step.x;
			token.y = step.y;
			token.heading = Math.atan2(step.dy, step.dx);
			token.speedLeft -= step.cost;
			steps += 1;
		}
		return steps;
	}
	Space4x.spaceNavigateTokenToCell(state, battle, token, tx, ty);
	return 1;
};

Space4x.nearestEnemy = function (battle, token) {
	const foes = Space4x.livingTokens(battle, token.side === "attacker" ? "defender" : "attacker");
	let best = null;
	let bestD = Infinity;
	for (let i = 0; i < foes.length; i++) {
		if (foes[i].kind === "missile") continue;
		const d = Space4x.euclid(token.x, token.y, foes[i].x, foes[i].y);
		if (d < bestD) {
			bestD = d;
			best = foes[i];
		}
	}
	return best;
};

Space4x.tokenSpentActions = function (token) {
	if (!token) return true;
	if (token.speed != null && token.speedLeft < token.speed - 0.05) return true;
	const load = token.load || [];
	for (let i = 0; i < load.length; i++) {
		if (load[i].fired || load[i].launched) return true;
	}
	return false;
};

Space4x.canRetreatSpaceShip = function (state, battle, token) {
	if (!battle || battle.done || !token) return false;
	if (token.kind !== "ship" || token.dead || token.left || token.warping) return false;
	if (token.immobile) return false;
	const side = Space4x.playerBattleSide(state, battle);
	if (!side || battle.phase !== side || token.side !== side) return false;
	if (token.activated) return false;
	if (Space4x.tokenSpentActions(token)) return false;
	return true;
};

Space4x.departShipFromBattle = function (state, battle, token) {
	if (!token || token.left) return false;
	token.left = true;
	token.warping = false;
	token.activated = true;
	token.dead = true;
	const unit = Space4x.unitById(state, token.unitId);
	if (!unit) {
		battle.log.push((token.name || "Ship") + " warps away.");
		return true;
	}
	const star = Space4x.starById(state, battle.starId);
	const x = star ? star.x : (unit.location && unit.location.x);
	const y = star ? star.y : (unit.location && unit.location.y);
	let home = Space4x.nearestFriendlyStar(state, unit.empireId, x, y, { excludeStarId: battle.starId });
	if (!home) home = Space4x.starById(state, battle.starId);
	if (home) {
		if (Space4x.isStationHull(state, unit)) {
			const dock = Space4x.settlementById(state, unit.homeSettlementId) ||
				Space4x.settlementsOf(state, unit.empireId).filter(function (st) {
					return st.location.starId === home.id;
				})[0];
			if (dock) {
				unit.location.kind = "settlement";
				unit.location.settlementId = dock.id;
				unit.location.starId = home.id;
				unit.location.x = home.x;
				unit.location.y = home.y;
				unit.targetStarId = null;
			} else {
				Space4x.enterOrbit(unit, home);
			}
		} else {
			Space4x.enterOrbit(unit, home);
		}
		battle.log.push((token.name || "Ship") + " warps to " + home.name + ".");
	} else {
		battle.log.push((token.name || "Ship") + " warps away.");
	}
	return true;
};

Space4x.orderSpaceRetreat = function (state, battle, tokenId) {
	const token = Space4x.tokenById(battle, tokenId);
	if (!Space4x.canRetreatSpaceShip(state, battle, token)) return false;
	token.warping = true;
	token.retreatRound = battle.round;
	token.activated = true;
	token.speedLeft = 0;
	battle.log.push((token.name || "Ship") + " begins warping out.");
	return true;
};

Space4x.resolveWarpDepartures = function (state, battle, side) {
	const list = (battle.tokens || []).slice();
	for (let i = 0; i < list.length; i++) {
		const t = list[i];
		if (t.kind !== "ship" || t.dead || t.left) continue;
		if (side && t.side !== side) continue;
		if (!t.warping) continue;
		if (t.retreatRound == null || t.retreatRound >= battle.round) continue;
		Space4x.departShipFromBattle(state, battle, t);
	}
};

Space4x.resetRoundEnergy = function (battle) {
	const list = battle.tokens || [];
	for (let i = 0; i < list.length; i++) {
		const t = list[i];
		if (t.dead || t.left || t.kind === "missile") continue;
		if (t.warping) {
			t.activated = true;
			t.speedLeft = 0;
			continue;
		}
		t.speedLeft = t.immobile ? 0 : t.speed;
		t.activated = false;
		if (t.load) {
			for (let w = 0; w < t.load.length; w++) t.load[w].fired = false;
		}
	}
};

Space4x.regenShields = function (state, battle) {
	const pct = (Space4x.spaceCombatCfg(state).shieldRegenPct || 25) / 100;
	const list = battle.tokens || [];
	const faces = ["front", "right", "back", "left"];
	for (let i = 0; i < list.length; i++) {
		const t = list[i];
		if (t.dead || t.kind !== "ship") continue;
		for (let f = 0; f < faces.length; f++) {
			const face = faces[f];
			t.shields[face] = Math.min(t.shieldMax, (t.shields[face] || 0) + t.shieldMax * pct);
		}
	}
};

Space4x.advanceMissiles = function (state, battle) {
	const list = (battle.tokens || []).slice();
	for (let i = 0; i < list.length; i++) {
		const m = list[i];
		if (m.kind !== "missile" || m.dead) continue;
		const target = Space4x.tokenById(battle, m.targetId);
		if (!target || target.dead) {
			m.dead = true;
			continue;
		}
		m.speedLeft = m.speed;
		Space4x.moveTokenToward(state, battle, m, target.x, target.y, 40);
		if (Space4x.euclid(m.x, m.y, target.x, target.y) <= 1.01) {
			const cfg = Space4x.spaceCombatCfg(state);
			const chance = Math.max(0, (cfg.missileSkill || 70) - (cfg.missileEvasion || 0));
			if (Space4x.rngInt(state, 100) < chance) {
				const result = Space4x.applyDamage(state, battle, target, m.x, m.y, m.damage);
				battle.log.push("Missile hits " + (target.name || "target") + " for " + m.damage + ".");
				Space4x.queueSpaceCombatHitFx(battle, m, target, result, {});
			} else {
				battle.log.push("Missile misses " + (target.name || "target") + ".");
				Space4x.queueSpaceCombatHitFx(battle, m, target, null, { miss: true });
			}
			m.dead = true;
		}
	}
};

Space4x.battleWeapons = function (token) {
	const out = [];
	const load = token.load || [];
	for (let i = 0; i < load.length; i++) {
		if (!load[i].fired) out.push(load[i]);
	}
	return out;
};

Space4x.aiActivateToken = function (state, battle, token) {
	if (token.dead || token.activated) return;
	const actions = Space4x.buildAiTokenActions(state, battle, token);
	for (let i = 0; i < actions.length; i++) Space4x.spaceApplyAction(state, battle, token, actions[i]);
	token.activated = true;
};

Space4x.fireFighterShot = function (state, battle, shooter, target, opts) {
	opts = opts || {};
	const cfg = Space4x.spaceCombatCfg(state);
	const dist = Space4x.euclid(shooter.x, shooter.y, target.x, target.y);
	const chance = Math.max(0, Math.min(100, (cfg.attackSkill || 100) - (cfg.dodgeSkill || 50) - (cfg.rangePenaltyPerSquare || 1) * dist));
	if (Space4x.rngInt(state, 100) >= chance) {
		battle.log.push("Fighter misses " + (target.name || "target") + ".");
		if (!opts.noFx) Space4x.queueSpaceCombatHitFx(battle, shooter, target, null, { miss: true });
		return { ok: true, miss: true, result: null, damage: 0 };
	}
	const band = shooter.fighterBeam || [1, 3];
	const dmg = band[0] + Space4x.rngInt(state, band[1] - band[0] + 1);
	const result = Space4x.applyDamage(state, battle, target, shooter.x, shooter.y, dmg);
	battle.log.push("Fighter hits " + (target.name || "target") + " for " + dmg + ".");
	if (!opts.noFx) Space4x.queueSpaceCombatHitFx(battle, shooter, target, result, {});
	return { ok: true, miss: false, result: result, damage: dmg };
};

Space4x.aiPlaySide = function (state, battle, side) {
	const list = Space4x.livingTokens(battle, side);
	for (let i = 0; i < list.length; i++) {
		if (list[i].kind === "missile") continue;
		Space4x.aiActivateToken(state, battle, list[i]);
	}
};

Space4x.sideHasShips = function (battle, side) {
	return Space4x.livingShips(battle, side).length > 0;
};

Space4x.sideHasPresentShips = function (battle, side) {
	return Space4x.presentShips(battle, side).length > 0;
};

Space4x.finishSpaceBattle = function (state, battle) {
	if (battle.done) return;
	battle.done = true;
	const atk = Space4x.sideHasShips(battle, "attacker");
	const def = Space4x.sideHasShips(battle, "defender");
	if (atk && !def) battle.winner = "attacker";
	else if (def && !atk) battle.winner = "defender";
	else if (!battle.winner) battle.winner = "draw";
	const winnerSide = battle.winner === "attacker" || battle.winner === "defender" ? battle.winner : null;
	for (let i = 0; i < battle.tokens.length; i++) {
		const t = battle.tokens[i];
		if (t.kind !== "ship" || !t.warping || t.left) continue;
		if (winnerSide && t.side === winnerSide) {
			t.warping = false;
			t.retreatRound = null;
			t.activated = false;
			battle.log.push((t.name || "Ship") + " aborts warp — fleet holds the field.");
		} else {
			Space4x.departShipFromBattle(state, battle, t);
		}
	}
	const deadIds = {};
	for (let i = 0; i < battle.tokens.length; i++) {
		const t = battle.tokens[i];
		if (t.kind === "ship" && t.dead && t.unitId && !t.left) deadIds[t.unitId] = true;
	}
	state.units = (state.units || []).filter(function (u) { return !deadIds[u.id]; });
	Space4x.resolveUnarmedAtStar(state, battle);
	const star = Space4x.starById(state, battle.starId);
	const atkE = Space4x.empireById(state, battle.attackerEmpireId);
	const defE = Space4x.empireById(state, battle.defenderEmpireId);
	const where = star ? star.name : "a star";
	if (battle.winner === "attacker") battle.summary = (atkE ? atkE.name : "Attacker") + " wins at " + where + ".";
	else if (battle.winner === "defender") battle.summary = (defE ? defE.name : "Defender") + " holds " + where + ".";
	else battle.summary = "Stalemate at " + where + ".";
	if (!state.turnLog) state.turnLog = [];
	state.turnLog.push(battle.summary);
	battle.seen = false;
	if (Space4x.maybeResumeTurnAfterSpace) Space4x.maybeResumeTurnAfterSpace(state);
};

Space4x.checkBattleEnd = function (state, battle) {
	if (!Space4x.sideHasPresentShips(battle, "attacker") || !Space4x.sideHasPresentShips(battle, "defender")) {
		Space4x.finishSpaceBattle(state, battle);
		return true;
	}
	return false;
};

Space4x.endSpaceSide = function (state, battle) {
	if (battle.done) return;
	if (battle.phase === "attacker") {
		battle.phase = "defender";
		Space4x.resolveWarpDepartures(state, battle, "defender");
		if (Space4x.checkBattleEnd(state, battle)) return;
		const player = Space4x.playerEmpire(state);
		if (!player || battle.defenderEmpireId !== player.id) {
			Space4x.playAiSide(state, battle, "defender", function () {
				Space4x.endSpaceSide(state, battle);
			});
			return;
		}
		return;
	}
	Space4x.advanceMissiles(state, battle);
	if (Space4x.checkBattleEnd(state, battle)) return;
	Space4x.commitPhaseTurnMarks(battle);
	battle.round += 1;
	battle.roundsSinceDamage = (battle.roundsSinceDamage || 0) + 1;
	if (battle.roundsSinceDamage >= 20) {
		battle.winner = "draw";
		battle.log.push("No damage for 20 rounds — combat ends in a draw.");
		Space4x.finishSpaceBattle(state, battle);
		return;
	}
	if (battle.round > 80) {
		battle.winner = "draw";
		Space4x.finishSpaceBattle(state, battle);
		return;
	}
	Space4x.regenShields(state, battle);
	battle.phase = "attacker";
	Space4x.resetRoundEnergy(battle);
	Space4x.resolveWarpDepartures(state, battle, "attacker");
	if (Space4x.checkBattleEnd(state, battle)) return;
	const player = Space4x.playerEmpire(state);
	if (!player || battle.attackerEmpireId !== player.id) {
		Space4x.playAiSide(state, battle, "attacker", function () {
			Space4x.endSpaceSide(state, battle);
		});
	}
};

Space4x.playerBattleSide = function (state, battle) {
	const player = Space4x.playerEmpire(state);
	if (!player || !battle) return null;
	if (battle.attackerEmpireId === player.id) return "attacker";
	if (battle.defenderEmpireId === player.id) return "defender";
	return null;
};

Space4x.tokenAtCell = function (battle, x, y) {
	const list = battle.tokens || [];
	for (let i = 0; i < list.length; i++) {
		const t = list[i];
		if (t.dead || t.kind === "missile") continue;
		if (t.x === x && t.y === y) return t;
	}
	return null;
};

Space4x.endSpaceShip = function (state, battle, tokenId) {
	const side = Space4x.playerBattleSide(state, battle);
	if (!side || battle.done || battle.phase !== side) return false;
	const token = Space4x.tokenById(battle, tokenId);
	if (!token || token.side !== side || token.activated) return false;
	token.activated = true;
	return true;
};

Space4x.spaceWeaponGroups = function (state, load) {
	const groups = [];
	const byItem = {};
	const list = load || [];
	for (let i = 0; i < list.length; i++) {
		const weapon = list[i];
		const item = Space4x.spaceLoadItem(state, weapon.itemId);
		if (!item || !Space4x.isCombatWeaponItem(item)) continue;
		let group = byItem[weapon.itemId];
		if (!group) {
			group = {
				id: weapon.itemId,
				itemId: weapon.itemId,
				weapons: [],
				ready: []
			};
			byItem[weapon.itemId] = group;
			groups.push(group);
		}
		group.weapons.push(weapon);
		if (!weapon.fired && !weapon.launched) group.ready.push(weapon);
	}
	return groups;
};

Space4x.spaceWeaponGroupLabel = function (state, group, token) {
	const item = Space4x.spaceLoadItem(state, group.itemId);
	const name = item ? item.name : group.itemId;
	const n = group.weapons.length;
	let label = n === 1 ? name : (n + " " + name + (n === 1 ? "" : "s"));
	if (item && item.kind === "missileLauncher") {
		if (item.unlimitedAmmo) {
			label += " (∞)";
		} else if (item.ammoId) {
			const pool = token && token.missilePool ? token.missilePool : {};
			const n = pool[item.ammoId] || 0;
			label += " (" + n + " ammo)";
		}
	}
	if (item && item.kind === "missile" && item.ammo != null) {
		let ammo = 0;
		for (let i = 0; i < group.weapons.length; i++) ammo += group.weapons[i].ammo || 0;
		label += " (" + ammo + ")";
	}
	if (!group.ready.length) {
		if (item && item.kind === "fighter") label += " · launched";
		else label += " · fired";
	} else if (group.ready.length < group.weapons.length) {
		label += " · " + group.ready.length + "/" + group.weapons.length + " ready";
	}
	return label;
};

Space4x.playerSpaceFire = function (state, battle, shooter, weapon, target, opts) {
	opts = opts || {};
	if (!shooter || !target || shooter.dead || target.dead) return null;
	if (shooter.kind === "fighter") {
		const dist = Space4x.euclid(shooter.x, shooter.y, target.x, target.y);
		if (dist > (shooter.fighterRange || 12) + 1e-9) {
			battle.log.push("Out of range.");
			return null;
		}
		const shot = Space4x.fireFighterShot(state, battle, shooter, target, opts);
		if (weapon) weapon.fired = true;
		return shot;
	}
	if (!weapon) return null;
	const item = Space4x.spaceLoadItem(state, weapon.itemId);
	if (!item) return null;
	if (item.kind === "beam") return Space4x.fireBeam(state, battle, shooter, weapon, target, opts);
	if (item.kind === "missileLauncher" || item.kind === "missile") {
		return Space4x.launchMissile(state, battle, shooter, weapon, target)
			? { ok: true, miss: false, result: null, damage: 0 } : null;
	}
	if (item.kind === "fighter") {
		return Space4x.launchFighter(state, battle, shooter, weapon)
			? { ok: true, miss: false, result: null, damage: 0 } : null;
	}
	return null;
};

Space4x.playerSpaceFireGroup = function (state, battle, shooter, itemId, target) {
	if (!shooter || !target || !itemId) return false;
	const item = Space4x.spaceLoadItem(state, itemId);
	const batchBeams = item && item.kind === "beam";
	const load = shooter.load || [];
	let any = false;
	let shots = 0;
	let hits = 0;
	const combined = { absorbed: 0, leftover: 0, shield: 0, armor: 0, structure: 0, facing: null };
	for (let i = 0; i < load.length; i++) {
		const weapon = load[i];
		if (weapon.itemId !== itemId) continue;
		if (weapon.fired || weapon.launched) continue;
		const shot = Space4x.playerSpaceFire(state, battle, shooter, weapon, target, batchBeams ? { noFx: true } : {});
		if (!shot) continue;
		any = true;
		if (batchBeams) {
			shots++;
			if (!shot.miss && shot.result) {
				hits++;
				Space4x.mergeDamageResults(combined, shot.result);
			}
		}
		if (target.dead) break;
	}
	if (batchBeams && shots > 0) {
		if (hits === 0) Space4x.queueSpaceCombatHitFx(battle, shooter, target, null, { miss: true });
		else Space4x.queueSpaceCombatHitFx(battle, shooter, target, combined, {});
	}
	return any;
};

Space4x.playerSpaceGridAct = function (state, battle, x, y) {
	if (battle._aiAnim) return;
	const side = Space4x.playerBattleSide(state, battle);
	if (!side || battle.done) return;
	const occ = Space4x.tokenAtCell(battle, x, y);
	if (occ && occ.side !== side && !occ.dead && occ.kind !== "missile") {
		state.ui.spaceEnemyTokenId = occ.id;
	}
	if (battle.phase !== side) return;
	if (occ && occ.side === side && !occ.dead) {
		state.ui.spaceTokenId = occ.id;
		state.ui.spaceWeaponId = null;
		return;
	}
	const token = Space4x.tokenById(battle, state.ui.spaceTokenId);
	if (!token || token.side !== side || token.activated || token.dead || token.warping || token.left) return;
	if (occ && occ.id === token.id) return;
	if (occ && occ.side !== side) {
		if (token.kind === "fighter") {
			Space4x.playerSpaceFire(state, battle, token, (token.load || [])[0] || null, occ);
		} else if (state.ui.spaceWeaponId) {
			Space4x.playerSpaceFireGroup(state, battle, token, state.ui.spaceWeaponId, occ);
		}
		Space4x.checkBattleEnd(state, battle);
		return;
	}
	const itemId = state.ui.spaceWeaponId;
	const item = itemId ? Space4x.spaceLoadItem(state, itemId) : null;
	if (item && item.kind === "fighter") {
		const load = token.load || [];
		for (let i = 0; i < load.length; i++) {
			if (load[i].itemId === itemId && !load[i].launched) {
				Space4x.launchFighter(state, battle, token, load[i]);
				return;
			}
		}
		return;
	}
	Space4x.spaceNavigateTokenToCell(state, battle, token, x, y);
};

Space4x.autoResolveSpaceBattle = function (state, battle) {
	let n = 0;
	while (!battle.done && n < 80) {
		Space4x.aiPlaySide(state, battle, battle.phase);
		Space4x.endSpaceSide(state, battle);
		n += 1;
	}
	if (!battle.done) Space4x.finishSpaceBattle(state, battle);
};

Space4x.combatShipsAtStar = function (state, empireId, starId) {
	const ships = Space4x.shipsAtStar(state, starId);
	const out = [];
	for (let i = 0; i < ships.length; i++) {
		if (ships[i].empireId !== empireId) continue;
		if (Space4x.isCombatHull(state, ships[i])) out.push(ships[i]);
	}
	return out;
};

Space4x.unarmedAtStar = function (state, empireId, starId) {
	const ships = Space4x.shipsAtStar(state, starId);
	const out = [];
	for (let i = 0; i < ships.length; i++) {
		const u = ships[i];
		if (u.empireId !== empireId) continue;
		if (Space4x.isCombatHull(state, u)) continue;
		if (Space4x.isTroopHauler(state, u)) continue;
		out.push(u);
	}
	return out;
};

Space4x.resolveUnarmedAtStar = function (state, battle) {
	const winnerId = battle.winner === "attacker" ? battle.attackerEmpireId : battle.winner === "defender" ? battle.defenderEmpireId : null;
	if (!winnerId) return;
	const loserId = winnerId === battle.attackerEmpireId ? battle.defenderEmpireId : battle.attackerEmpireId;
	const unarmed = Space4x.unarmedAtStar(state, loserId, battle.starId);
	if (!unarmed.length) return;
	if (Space4x.battleHasFighters(battle, loserId)) {
		state.turnLog.push("Unarmed ships flee under fighter cover.");
		return;
	}
	const names = [];
	const kill = {};
	for (let i = 0; i < unarmed.length; i++) {
		kill[unarmed[i].id] = true;
		names.push(Space4x.unitLabel(state, unarmed[i]));
	}
	state.units = state.units.filter(function (u) { return !kill[u.id]; });
	const star = Space4x.starById(state, battle.starId);
	const line = names.join(", ") + " destroyed at " + (star ? star.name : "a star") + " (no fighter cover).";
	state.turnLog.push(line);
	if (!state.turnEvents.spaceLosses) state.turnEvents.spaceLosses = [];
	state.turnEvents.spaceLosses.push({
		id: Space4x.nextId(state, "sl"),
		starId: battle.starId,
		empireId: loserId,
		text: line,
		seen: false
	});
};

Space4x.createSpaceBattle = function (state, starId, attackerId, defenderId, atkShips, defShips) {
	const cfg = Space4x.spaceCombatCfg(state);
	const battleId = Space4x.nextId(state, "sb");
	const battle = {
		id: battleId,
		starId: starId,
		attackerEmpireId: attackerId,
		defenderEmpireId: defenderId,
		grid: { w: cfg.grid.w || 120, h: cfg.grid.h || 80 },
		round: 1,
		phase: "attacker",
		tokens: [],
		log: [],
		done: false,
		winner: null,
		seen: false,
		roundsSinceDamage: 0,
		bgSeed: (Space4x.seedFromString(battleId + ":" + starId + ":" + attackerId + ":" + defenderId) >>> 0) ||
			(1 + Space4x.rngInt(state, 2147483646)),
		view: { zoom: 1, panX: null, panY: null }
	};
	Space4x.placeTokensOnGrid(state, battle, atkShips, defShips);
	Space4x.resetRoundEnergy(battle);
	if (!state.turnEvents.spaceBattles) state.turnEvents.spaceBattles = [];
	state.turnEvents.spaceBattles.push(battle);
	return battle;
};

Space4x.startSpaceBattleTurns = function (state, battle) {
	if (battle.done || battle.started) return;
	battle.started = true;
	const player = Space4x.playerEmpire(state);
	if (!player || battle.attackerEmpireId !== player.id) {
		Space4x.playAiSide(state, battle, "attacker", function () {
			Space4x.endSpaceSide(state, battle);
		});
	}
};

Space4x.empiresWithCombatAtStar = function (state, starId) {
	const ships = Space4x.shipsAtStar(state, starId);
	const ids = [];
	const seen = {};
	for (let i = 0; i < ships.length; i++) {
		if (!Space4x.isCombatHull(state, ships[i])) continue;
		const id = ships[i].empireId;
		if (seen[id]) continue;
		seen[id] = true;
		ids.push(id);
	}
	return ids;
};

Space4x.pickSpaceAttacker = function (state, starId, aId, bId) {
	const aShips = Space4x.combatShipsAtStar(state, aId, starId);
	const bShips = Space4x.combatShipsAtStar(state, bId, starId);
	let aArrived = false;
	let bArrived = false;
	for (let i = 0; i < aShips.length; i++) if (aShips[i].arrivedThisTurn) aArrived = true;
	for (let i = 0; i < bShips.length; i++) if (bShips[i].arrivedThisTurn) bArrived = true;
	const player = Space4x.playerEmpire(state);
	if (aArrived && !bArrived) return aId;
	if (bArrived && !aArrived) return bId;
	if (player && aId === player.id) return aId;
	if (player && bId === player.id) return bId;
	return aId;
};

Space4x.destroyUnarmedWithoutCover = function (state, starId, loserId, winnerId) {
	const unarmed = Space4x.unarmedAtStar(state, loserId, starId);
	if (!unarmed.length) return;
	const names = [];
	const kill = {};
	for (let i = 0; i < unarmed.length; i++) {
		kill[unarmed[i].id] = true;
		names.push(Space4x.unitLabel(state, unarmed[i]));
	}
	state.units = state.units.filter(function (u) { return !kill[u.id]; });
	const star = Space4x.starById(state, starId);
	const line = names.join(", ") + " destroyed at " + (star ? star.name : "a star") + " (no fighter cover).";
	state.turnLog.push(line);
	if (!state.turnEvents.spaceLosses) state.turnEvents.spaceLosses = [];
	state.turnEvents.spaceLosses.push({
		id: Space4x.nextId(state, "sl"),
		starId: starId,
		empireId: loserId,
		winnerId: winnerId,
		text: line,
		seen: false
	});
};

Space4x.phaseUnarmedSweep = function (state) {
	const stars = {};
	for (let i = 0; i < state.units.length; i++) {
		const sid = Space4x.unitStarId(state, state.units[i]);
		if (sid) stars[sid] = true;
	}
	const starIds = Object.keys(stars);
	for (let s = 0; s < starIds.length; s++) {
		const starId = starIds[s];
		const combatIds = Space4x.empiresWithCombatAtStar(state, starId);
		if (!combatIds.length) continue;
		const ships = Space4x.shipsAtStar(state, starId);
		const present = {};
		for (let i = 0; i < ships.length; i++) present[ships[i].empireId] = true;
		const empireIds = Object.keys(present);
		for (let a = 0; a < empireIds.length; a++) {
			const loserId = empireIds[a];
			if (Space4x.combatShipsAtStar(state, loserId, starId).length) continue;
			const unarmed = Space4x.unarmedAtStar(state, loserId, starId);
			if (!unarmed.length) continue;
			for (let c = 0; c < combatIds.length; c++) {
				const winnerId = combatIds[c];
				if (winnerId === loserId) continue;
				const we = Space4x.empireById(state, winnerId);
				const le = Space4x.empireById(state, loserId);
				if (!Space4x.atWar(we, loserId) && !Space4x.atWar(le, winnerId)) continue;
				Space4x.destroyUnarmedWithoutCover(state, starId, loserId, winnerId);
				break;
			}
		}
	}
};

Space4x.openSpaceBattleAtStar = function (state, starId, aId, bId, aShipsOpt, bShipsOpt) {
	const as = aShipsOpt || Space4x.combatShipsAtStar(state, aId, starId);
	const bs = bShipsOpt || Space4x.combatShipsAtStar(state, bId, starId);
	if (!as.length || !bs.length) return null;
	const ea = Space4x.empireById(state, aId);
	const eb = Space4x.empireById(state, bId);
	if (!Space4x.atWar(ea, bId) && !Space4x.atWar(eb, aId)) return null;
	const atkId = Space4x.pickSpaceAttacker(state, starId, aId, bId);
	const defId = atkId === aId ? bId : aId;
	const atkShips = atkId === aId ? as : bs;
	const defShips = atkId === aId ? bs : as;
	const battle = Space4x.createSpaceBattle(state, starId, atkId, defId, atkShips, defShips);
	const player = Space4x.playerEmpire(state);
	const playerIn = player && (atkId === player.id || defId === player.id);
	if (!playerIn || state.ui.autoPlaying) Space4x.autoResolveSpaceBattle(state, battle);
	else Space4x.startSpaceBattleTurns(state, battle);
	return battle;
};

Space4x.resolveSpaceCombatAtStar = function (state, starId) {
	const empires = Space4x.empiresWithCombatAtStar(state, starId);
	if (empires.length < 2) return [];
	const started = [];
	const used = {};
	let guard = 0;
	while (guard < 8) {
		guard += 1;
		let pair = null;
		for (let a = 0; a < empires.length; a++) {
			for (let b = a + 1; b < empires.length; b++) {
				const ea = Space4x.empireById(state, empires[a]);
				const eb = Space4x.empireById(state, empires[b]);
				if (!Space4x.atWar(ea, empires[b]) && !Space4x.atWar(eb, empires[a])) continue;
				const as = Space4x.combatShipsAtStar(state, empires[a], starId);
				const bs = Space4x.combatShipsAtStar(state, empires[b], starId);
				if (!as.length || !bs.length) continue;
				const key = empires[a] < empires[b] ? empires[a] + ":" + empires[b] : empires[b] + ":" + empires[a];
				if (used[key]) continue;
				pair = { a: empires[a], b: empires[b], key: key };
				break;
			}
			if (pair) break;
		}
		if (!pair) break;
		used[pair.key] = true;
		const battle = Space4x.openSpaceBattleAtStar(state, starId, pair.a, pair.b);
		if (battle) started.push(battle);
	}
	return started;
};

Space4x.openSpaceBattleAtStarForPlayer = function (state, starId, playerShips) {
	const player = Space4x.playerEmpire(state);
	if (!player) return null;
	const ps = playerShips || Space4x.selectedCombatShipsAtStar(state, player.id, starId);
	if (!ps.length) return null;
	const empires = Space4x.empiresWithCombatAtStar(state, starId);
	for (let i = 0; i < empires.length; i++) {
		if (empires[i] === player.id) continue;
		if (!Space4x.atWar(player, empires[i])) continue;
		const battle = Space4x.openSpaceBattleAtStar(state, starId, player.id, empires[i], ps, null);
		if (battle) return battle;
	}
	return null;
};

Space4x.spaceCombatSituation = function (state, starId, empireId) {
	const out = {
		starId: starId,
		canEngage: false,
		hasOpenBattle: false,
		openBattleId: null,
		rivals: [],
		text: ""
	};
	if (!starId || !empireId) return out;
	const player = Space4x.empireById(state, empireId);
	if (!player) return out;
	const open = Space4x.playerOpenSpaceBattles(state);
	for (let i = 0; i < open.length; i++) {
		if (open[i].starId === starId) {
			out.hasOpenBattle = true;
			out.openBattleId = open[i].id;
			out.text = "Space battle in progress. Open Combat to continue.";
			return out;
		}
	}
	const ships = Space4x.shipsAtStar(state, starId);
	const selectedCombat = Space4x.selectedCombatShipsAtStar(state, empireId, starId);
	const byEmpire = {};
	for (let i = 0; i < ships.length; i++) {
		const u = ships[i];
		if (!byEmpire[u.empireId]) byEmpire[u.empireId] = { all: 0, combat: 0 };
		byEmpire[u.empireId].all += 1;
		if (Space4x.isCombatHull(state, u)) byEmpire[u.empireId].combat += 1;
	}
	if (!byEmpire[empireId] || !byEmpire[empireId].all) return out;
	const mine = byEmpire[empireId];
	let rivalPresent = false;
	const empireIds = Object.keys(byEmpire);
	for (let e = 0; e < empireIds.length; e++) {
		const id = empireIds[e];
		if (id === empireId) continue;
		const atWar = Space4x.atWar(player, id);
		if (!atWar) continue;
		rivalPresent = true;
		const them = Space4x.empireById(state, id);
		const pack = byEmpire[id];
		const canFight = selectedCombat.length > 0 && pack.combat > 0;
		out.rivals.push({
			empireId: id,
			name: them ? them.name : id,
			ships: pack.all,
			combatShips: pack.combat,
			atWar: atWar,
			canFight: canFight
		});
		if (canFight) out.canEngage = true;
	}
	if (!rivalPresent) return out;
	if (out.canEngage) {
		out.text = selectedCombat.length + " warship" + (selectedCombat.length === 1 ? "" : "s") +
			" selected. Send to Space to fight, or end the turn.";
		return out;
	}
	if (mine.combat > 0 && !selectedCombat.length) {
		out.text = "Select warships in Fleets, then Send to Space.";
		return out;
	}
	if (mine.combat < 1) {
		out.text = "Enemy ships present, but scouts and freighters do not fight. Build cruisers or battleships.";
		return out;
	}
	for (let r = 0; r < out.rivals.length; r++) {
		const rival = out.rivals[r];
		if (rival.combatShips < 1 && rival.ships > 0) {
			out.text = rival.name + " has ships here, but no combat hulls in orbit.";
			return out;
		}
	}
	out.text = "Enemy warships in orbit. End the turn to resolve combat.";
	return out;
};

Space4x.engageSpaceCombatAtStar = function (state, starId) {
	const player = Space4x.playerEmpire(state);
	if (!player) return null;
	const sit = Space4x.spaceCombatSituation(state, starId, player.id);
	if (sit.hasOpenBattle && sit.openBattleId) return Space4x.spaceBattleById(state, sit.openBattleId);
	const selected = Space4x.selectedCombatShipsAtStar(state, player.id, starId);
	if (!selected.length) {
		state.turnLog.push("Select warships in Fleets, then Send to Space.");
		return null;
	}
	if (!sit.canEngage) return null;
	if (!state.turnEvents.spaceBattles) state.turnEvents.spaceBattles = [];
	const battle = Space4x.openSpaceBattleAtStarForPlayer(state, starId, selected);
	if (battle && !battle.done && (battle.attackerEmpireId === player.id || battle.defenderEmpireId === player.id)) {
		state.turnHold = "afterSpace";
	}
	return battle;
};

Space4x.phaseSpaceCombat = function (state) {
	if (!state.turnEvents.spaceBattles) state.turnEvents.spaceBattles = [];
	if (!state.turnEvents.spaceLosses) state.turnEvents.spaceLosses = [];
	const stars = {};
	for (let i = 0; i < state.units.length; i++) {
		const sid = Space4x.unitStarId(state, state.units[i]);
		if (sid) stars[sid] = true;
	}
	const starIds = Object.keys(stars);
	for (let s = 0; s < starIds.length; s++) {
		Space4x.resolveSpaceCombatAtStar(state, starIds[s]);
	}
	Space4x.phaseUnarmedSweep(state);
	const player = Space4x.playerEmpire(state);
	if (player && Space4x.playerOpenSpaceBattles(state).length) state.turnHold = "afterSpace";
};

Space4x.markSpaceBattleSeen = function (state, id) {
	const b = Space4x.spaceBattleById(state, id);
	if (b) b.seen = true;
};

Space4x.playerSpaceBattles = function (state) {
	const player = Space4x.playerEmpire(state);
	if (!player) return [];
	const out = [];
	const list = Space4x.spaceBattlesOf(state);
	for (let i = 0; i < list.length; i++) {
		const b = list[i];
		if (b.attackerEmpireId === player.id || b.defenderEmpireId === player.id) out.push(b);
	}
	return out;
};

Space4x.playerUnseenSpaceBattles = function (state) {
	const list = Space4x.playerSpaceBattles(state);
	const out = [];
	for (let i = 0; i < list.length; i++) if (!list[i].seen) out.push(list[i]);
	return out;
};

Space4x.playerUnseenSpaceLosses = function (state) {
	const player = Space4x.playerEmpire(state);
	if (!player || !state.turnEvents || !state.turnEvents.spaceLosses) return [];
	const out = [];
	const list = state.turnEvents.spaceLosses;
	for (let i = 0; i < list.length; i++) {
		if (list[i].empireId === player.id && !list[i].seen) out.push(list[i]);
	}
	return out;
};

Space4x.markSpaceLossSeen = function (state, id) {
	const list = state.turnEvents && state.turnEvents.spaceLosses;
	if (!list) return;
	for (let i = 0; i < list.length; i++) if (list[i].id === id) list[i].seen = true;
};
