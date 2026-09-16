var DE = DE || {};

DE.hasFlag = function (units, flag) {
	var list = DE.fightingUnits(units);
	for (var i = 0; i < list.length; i++) {
		var def = DE.unitDef(list[i].type);
		if (def && def.flags && def.flags[flag]) return true;
	}
	return false;
};

DE.sideHasMage = function (units) {
	var list = DE.fightingUnits(units);
	for (var i = 0; i < list.length; i++) {
		if (DE.isMageType(list[i].type)) return true;
	}
	return false;
};

DE.applyMindMages = function (state, sideA, sideB) {
	function stealCount(units) {
		var n = 0;
		var list = DE.fightingUnits(units);
		for (var i = 0; i < list.length; i++) {
			var def = DE.unitDef(list[i].type);
			if (def && def.flags && def.flags.mindMage) n++;
		}
		return n;
	}
	function stealFrom(src, dest, n) {
		var taken = [];
		for (var i = 0; i < n; i++) {
			var pool = [];
			for (var j = 0; j < src.length; j++) {
				if (!src[j].dead && !src[j].wounded && !DE.isMageType(src[j].type)) pool.push(src[j]);
			}
			if (!pool.length) {
				for (var k = 0; k < src.length; k++) {
					if (!src[k].dead && !src[k].wounded) pool.push(src[k]);
				}
			}
			if (!pool.length) break;
			var u = DE.rngPick(state, pool);
			u.factionId = dest.length && dest[0].factionId ? dest[0].factionId : u.factionId;
			taken.push(u);
			var idx = src.indexOf(u);
			if (idx >= 0) src.splice(idx, 1);
			dest.push(u);
		}
		return taken;
	}
	var aN = stealCount(sideA);
	var bN = stealCount(sideB);
	var stolenByA = stealFrom(sideB, sideA, aN);
	var stolenByB = stealFrom(sideA, sideB, bN);
	return { stolenByA: stolenByA, stolenByB: stolenByB };
};

DE.rangedShare = function (units) {
	var list = DE.fightingUnits(units);
	var combat = 0;
	var ranged = 0;
	for (var i = 0; i < list.length; i++) {
		var def = DE.unitDef(list[i].type);
		if (!def || def.role === "civilian") continue;
		combat++;
		if (DE.isRangedRole(def.role) || (def.flags && def.flags.mixed) || def.id === "machineGunner" || def.id === "infantry" || def.id === "archer") {
			ranged++;
		}
	}
	if (!combat) return 0;
	return ranged / combat;
};

DE.unitContribution = function (unit, ownUnits, enemyUnits, state) {
	var def = DE.unitDef(unit.type);
	if (!def || unit.dead || unit.wounded) return 0;
	if (def.role === "civilian") return 0;
	if (def.flags && (def.flags.illusionist || def.flags.earthMage || def.flags.mindMage || def.flags.healer)) return 0;

	var ownEarth = DE.hasFlag(ownUnits, "earthMage");
	var enemyMG = DE.hasFlag(enemyUnits, "machineGun") && !ownEarth;
	var enemyOoze = DE.hasFlag(enemyUnits, "ooze");
	var enemyTunnel = DE.hasFlag(enemyUnits, "tunnelWorm");
	var enemySpider = DE.hasFlag(enemyUnits, "spider");
	var mixed = !!(def.flags && def.flags.mixed) || def.id === "dragon" || def.id === "webWorm" || def.id === "ghost";
	var v = def.worth;
	if (def.flags && def.flags.skeleton) {
		var share = DE.rangedShare(enemyUnits);
		if (share >= 0.8) v = 10;
		else if (share >= 0.5) v = 5;
		else v = 2;
	}
	if (!mixed && def.role === "melee") {
		if (ownEarth) v = v * 2;
		if (enemyMG) v = 0;
		if (enemySpider) v = v * 0.5;
	}
	if (!mixed && def.role === "ranged") {
		if (enemyOoze) v = 0;
		else if (enemyTunnel) v = v * 0.5;
	}
	if (unit.foreignWeapons) v = v * 0.8;
	if (DE.monsterKeyForUnit(unit) && !DE.isMonsterKnown(state, DE.monsterKeyForUnit(unit))) {
		v = v * 1.5;
	}
	return v;
};

DE.monsterKeyForUnit = function (unit) {
	if (!unit) return null;
	var def = DE.unitDef(unit.type);
	if (!def) return null;
	if (def.undead) return "undead";
	if (def.monster) return unit.type;
	return null;
};

DE.isMonsterKnown = function (state, key) {
	if (!key) return true;
	if (!state || !state.player) return true;
	state.player.knownMonsters = state.player.knownMonsters || {};
	return !!state.player.knownMonsters[key];
};

DE.markMonsterKnown = function (state, key) {
	if (!key || !state || !state.player) return;
	state.player.knownMonsters = state.player.knownMonsters || {};
	state.player.knownMonsters[key] = true;
};

DE.markMonstersKnownFromUnits = function (state, units) {
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		var key = DE.monsterKeyForUnit(list[i]);
		if (key) DE.markMonsterKnown(state, key);
	}
};

DE.sideStrength = function (units, enemyUnits, state) {
	var list = DE.fightingUnits(units);
	var sum = 0;
	var maxUnitWorth = 0;
	var hasHealer = false;
	var hasIllusionist = DE.hasFlag(units, "illusionist") && !DE.hasFlag(enemyUnits, "spider");
	for (var i = 0; i < list.length; i++) {
		var def = DE.unitDef(list[i].type);
		var c = DE.unitContribution(list[i], units, enemyUnits, state);
		sum += c;
		if (def && def.flags && def.flags.healer) hasHealer = true;
		if (def && def.worth > maxUnitWorth && !(def.flags && def.flags.healer)) maxUnitWorth = def.worth;
		if (def && def.flags && def.flags.skeleton) {
			var sk = c;
			if (sk > maxUnitWorth) maxUnitWorth = sk;
		}
	}
	if (hasHealer) sum += maxUnitWorth;
	if (hasIllusionist) sum = sum * 1.5;
	return sum;
};

DE.ghostWins = function (units, enemyUnits) {
	return DE.hasFlag(units, "ghost") && !DE.sideHasMage(enemyUnits);
};

DE.fearFromStrength = function (ownUnits, enemyUnits, leader, state) {
	var own = DE.sideStrength(ownUnits, enemyUnits, state);
	var enemy = DE.sideStrength(enemyUnits, ownUnits, state);
	if (DE.ghostWins(enemyUnits, ownUnits) && !DE.ghostWins(ownUnits, enemyUnits)) {
		own = 0;
		enemy = Math.max(enemy, 1);
	} else if (DE.ghostWins(ownUnits, enemyUnits) && !DE.ghostWins(enemyUnits, ownUnits)) {
		own = Math.max(own, 1);
		enemy = 0;
	}
	var pWin;
	if (own <= 0 && enemy <= 0) pWin = 0.5;
	else if (own <= 0) pWin = 0.02;
	else if (enemy <= 0) pWin = 0.98;
	else {
		var lr = Math.log(own / enemy);
		pWin = 1 / (1 + Math.exp(-3 * lr));
	}
	var center = 1 - pWin;
	if (leader && leader.deltaFear) center += leader.deltaFear;
	center = DE.clamp(center, 0, 1);
	var swing = DE.hasFlag(ownUnits, "illusionist") || DE.hasFlag(enemyUnits, "illusionist") ||
		DE.hasFlag(ownUnits, "ghost") || DE.hasFlag(enemyUnits, "ghost") ||
		DE.fightingUnits(ownUnits).some(function (u) { var d = DE.unitDef(u.type); return d && d.kind === "monster"; }) ||
		DE.fightingUnits(enemyUnits).some(function (u) { var d = DE.unitDef(u.type); return d && d.kind === "monster"; }) ||
		DE.sideHasMage(ownUnits) || DE.sideHasMage(enemyUnits);
	var width = swing ? 0.3 : 0.15;
	var lo = DE.clamp(center - width / 2, 0, 1);
	var hi = DE.clamp(center + width / 2, 0, 1);
	return { lo: lo, hi: hi, center: (lo + hi) / 2, width: hi - lo, own: own, enemy: enemy };
};

DE.casualtyCost = function (unit) {
	var def = DE.unitDef(unit.type);
	return def ? def.casualty : 5;
};

DE.pickCasualties = function (state, units, budget, preferIds) {
	var remaining = budget;
	var picked = [];
	var pool = [];
	for (var i = 0; i < units.length; i++) {
		if (!units[i].dead && !units[i].wounded) pool.push(units[i]);
	}
	function take(u) {
		picked.push(u);
		remaining -= DE.casualtyCost(u);
		var idx = pool.indexOf(u);
		if (idx >= 0) pool.splice(idx, 1);
	}
	if (preferIds && preferIds.length) {
		for (var p = 0; p < preferIds.length; p++) {
			if (remaining <= 0) break;
			for (var j = 0; j < pool.length; j++) {
				if (pool[j].id === preferIds[p]) {
					take(pool[j]);
					break;
				}
			}
		}
	}
	while (remaining > 0 && pool.length) {
		take(DE.rngPick(state, pool));
	}
	return { units: picked, leftover: remaining };
};

DE.applyCasualtyFate = function (state, unit, winner) {
	var deadChance = winner ? 0.2 : 0.5;
	if (DE.rngNext(state) < deadChance) {
		unit.dead = true;
		unit.wounded = false;
		return "dead";
	}
	unit.wounded = true;
	return "wounded";
};

DE.healSide = function (units) {
	var has = false;
	for (var i = 0; i < units.length; i++) {
		if (units[i].dead) continue;
		var def = DE.unitDef(units[i].type);
		if (def && def.flags && def.flags.healer) has = true;
	}
	if (!has) return 0;
	var n = 0;
	for (var j = 0; j < units.length; j++) {
		if (units[j].wounded && !units[j].dead) {
			units[j].wounded = false;
			n++;
		}
	}
	return n;
};

DE.resolveBattle = function (state, playerUnits, aiUnits, opts) {
	opts = opts || {};
	var player = playerUnits;
	var ai = aiUnits;
	var stolen = DE.applyMindMages(state, player, ai);
	var pStr = DE.sideStrength(player, ai, state);
	var aStr = DE.sideStrength(ai, player, state);
	var ghostP = DE.ghostWins(player, ai);
	var ghostA = DE.ghostWins(ai, player);
	var pVar = opts.playerVariance != null ? opts.playerVariance : DE.rngRange(state, 0.8, 1.2);
	var aVar = opts.aiVariance != null ? opts.aiVariance : DE.rngRange(state, 0.8, 1.2);
	if (opts.attackerBonus) {
		if (opts.attacker === "player") pStr *= (1 + opts.attackerBonus);
		if (opts.attacker === "ai") aStr *= (1 + opts.attackerBonus);
	}
	var winner;
	if (ghostP && !ghostA) winner = "player";
	else if (ghostA && !ghostP) winner = "ai";
	else if (ghostP && ghostA) winner = (pStr * pVar >= aStr * aVar) ? "player" : "ai";
	else winner = (pStr * pVar >= aStr * aVar) ? "player" : "ai";
	if (opts.forceWinner) winner = opts.forceWinner;

	var pRate = winner === "player" ? 0.20 : 0.40;
	var aRate = winner === "ai" ? 0.20 : 0.40;
	pRate += (opts.playerCasualtyDelta || 0);
	aRate += (opts.aiCasualtyDelta || 0);
	if (opts.bothCasualtyDelta) {
		pRate += opts.bothCasualtyDelta;
		aRate += opts.bothCasualtyDelta;
	}
	if (opts.zeroCasualties) {
		pRate = 0;
		aRate = 0;
	}
	pRate = Math.max(0, pRate);
	aRate = Math.max(0, aRate);

	/* Casualties inflicted on a side use the *opponent's* fighting value. */
	var pBudget = aStr * pRate;
	var aBudget = pStr * aRate;
	var preferP = opts.preferPlayerIds || [];
	var preferA = opts.preferAiIds || [];
	var pHit = DE.pickCasualties(state, player, pBudget, preferP);
	var aHit = DE.pickCasualties(state, ai, aBudget, preferA);
	var pFate = [];
	var aFate = [];
	for (var i = 0; i < pHit.units.length; i++) {
		pFate.push({ id: pHit.units[i].id, type: pHit.units[i].type, fate: DE.applyCasualtyFate(state, pHit.units[i], winner === "player") });
	}
	for (var j = 0; j < aHit.units.length; j++) {
		aFate.push({ id: aHit.units[j].id, type: aHit.units[j].type, fate: DE.applyCasualtyFate(state, aHit.units[j], winner === "ai") });
	}

	var healP = DE.healSide(player);
	var healA = DE.healSide(ai);

	var result = {
		winner: winner,
		playerStrength: pStr,
		aiStrength: aStr,
		playerVariance: pVar,
		aiVariance: aVar,
		playerRoll: pStr * pVar,
		aiRoll: aStr * aVar,
		ghostPlayer: ghostP,
		ghostAi: ghostA,
		playerCasualtyRate: pRate,
		aiCasualtyRate: aRate,
		playerBudget: pBudget,
		aiBudget: aBudget,
		playerCasualties: pFate,
		aiCasualties: aFate,
		stolen: stolen,
		healedPlayer: healP,
		healedAi: healA,
		display: !!opts.display
	};
	DE.logCombatMath(player, ai, result, state);
	return result;
};

DE.strengthBreakdown = function (units, enemyUnits, state) {
	var rows = [];
	var list = DE.fightingUnits(units);
	var grouped = DE.groupUnits(list);
	for (var i = 0; i < grouped.length; i++) {
		var g = grouped[i];
		var sub = 0;
		for (var j = 0; j < g.units.length; j++) {
			sub += DE.unitContribution(g.units[j], units, enemyUnits, state);
		}
		rows.push({
			label: DE.groupLabel(g),
			count: g.count,
			type: g.type,
			subtotal: sub
		});
	}
	return { total: DE.sideStrength(units, enemyUnits, state), rows: rows };
};

DE.logCombatMath = function (playerUnits, aiUnits, result, state) {
	if (typeof console === "undefined" || !console.log) return;
	var you = DE.strengthBreakdown(playerUnits, aiUnits, state);
	var them = DE.strengthBreakdown(aiUnits, playerUnits, state);
	function lines(side) {
		return side.rows.map(function (r) {
			return "    " + r.label + " → " + r.subtotal;
		}).join("\n");
	}
	var msg = [
		"[DE combat]",
		"  You base " + you.total + " × " + result.playerVariance + " = " + result.playerRoll,
		lines(you) || "    (no fighting value)",
		"  Them base " + them.total + " × " + result.aiVariance + " = " + result.aiRoll,
		lines(them) || "    (no fighting value)",
		"  Ghost auto-win you=" + !!result.ghostPlayer + " them=" + !!result.ghostAi,
		"  Winner: " + result.winner + (result.display ? " (display)" : ""),
		"  Casualty rates (of inflictor) you-take=" + result.playerCasualtyRate + " them-take=" + result.aiCasualtyRate,
		"  Budgets (inflicted) you=" + result.playerBudget + " (from their " + them.total + ") them=" + result.aiBudget + " (from your " + you.total + ")",
		"  Hits you: " + (result.playerCasualties || []).map(function (c) { return c.type + " " + c.fate; }).join(", "),
		"  Hits them: " + (result.aiCasualties || []).map(function (c) { return c.type + " " + c.fate; }).join(", ")
	].join("\n");
	console.log(msg);
};

DE.weaponDropsFromFates = function (units, fates) {
	var drops = [];
	fates = fates || [];
	for (var i = 0; i < fates.length; i++) {
		if (fates[i].fate !== "dead") continue;
		var u = null;
		for (var j = 0; j < units.length; j++) {
			if (units[j].id === fates[i].id) {
				u = units[j];
				break;
			}
		}
		if (u && DE.unitDropsWeapon(u)) drops.push(u.type);
	}
	return drops;
};

DE.addWeaponDrops = function (stuff, drops) {
	if (!stuff || !drops || !drops.length) return;
	stuff.weapons = stuff.weapons || [];
	for (var i = 0; i < drops.length; i++) stuff.weapons.push(drops[i]);
};
