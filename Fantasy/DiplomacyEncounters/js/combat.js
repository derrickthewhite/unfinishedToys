var DE = DE || {};

DE.CIVILIAN_ASSAULT_CV = 2;
DE.SITE_ASSAULT_BONUS = 0.5;

DE.civilianCount = function (units) {
	var n = 0;
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		if (!list[i] || list[i].dead || list[i].wounded) continue;
		if (list[i].type === "civilian") n++;
	}
	return n;
};

DE.civilianFightValue = function (units) {
	return DE.civilianCount(units) * DE.CIVILIAN_ASSAULT_CV;
};

DE.combatSideOpts = function (encounter, playerAct, aiAct, side) {
	var pA = DE.actionClass(playerAct) === "assault";
	var aA = DE.actionClass(aiAct) === "assault";
	var garrison = (side === "player" && encounter && encounter.campRaid) ||
		(side === "ai" && encounter && encounter.village);
	var opponentAssault = side === "player" ? aA : pA;
	return {
		civiliansFight: !!(garrison && opponentAssault),
		siteBonus: !!(garrison && opponentAssault)
	};
};

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

DE.mindMageCount = function (units) {
	var n = 0;
	var list = DE.fightingUnits(units);
	for (var i = 0; i < list.length; i++) {
		var def = DE.unitDef(list[i].type);
		if (def && def.flags && def.flags.mindMage) n++;
	}
	return n;
};

/* Each mind mage moves up to 10 CV from the enemy side to its own (capped by enemy raw CV). */
DE.mindMageTransfer = function (ownUnits, enemyUnits, ownRaw, enemyRaw) {
	var ownMM = DE.mindMageCount(ownUnits);
	var enemyMM = DE.mindMageCount(enemyUnits);
	var stealOwn = Math.min(10 * ownMM, Math.max(0, enemyRaw));
	var stealEnemy = Math.min(10 * enemyMM, Math.max(0, ownRaw));
	return {
		ownMages: ownMM,
		enemyMages: enemyMM,
		gained: stealOwn,
		lost: stealEnemy,
		delta: stealOwn - stealEnemy
	};
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

DE.unitContribution = function (unit, ownUnits, enemyUnits, state, opts) {
	opts = opts || {};
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
	var mKey = DE.monsterKeyForUnit(unit);
	if (mKey) v += DE.monsterTrueWorthBonus(state, mKey);
	if (!mixed && def.role === "melee" && !(def.flags && def.flags.skeleton) && !(def.flags && def.flags.ooze)) {
		if (ownEarth) v = v * 2;
		if (enemyMG) v = 0;
		if (enemySpider) v = v * 0.5;
	}
	if (def.flags && def.flags.skeleton) {
		if (ownEarth) v = v * 2;
		if (enemySpider) v = v * 0.5;
	}
	if (!mixed && def.role === "ranged") {
		if (def.flags && def.flags.ranger) {
			/* Stub: rangers later counter extra monster abilities. */
		}
		if (enemyOoze) v = 0;
		else if (enemyTunnel) v = v * 0.5;
	}
	if (unit.foreignWeapons) v = v * 0.8;
	if (!opts.skipUnknownMonsterBonus && mKey && !DE.isMonsterKnown(state, mKey)) {
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

DE.monsterIsIntelligent = function (state, key) {
	if (!key || !state || !state.factions) return false;
	for (var i = 0; i < state.factions.length; i++) {
		var f = state.factions[i];
		if (f.kind === "loner" && f.monsterType === key) return true;
	}
	return false;
};

DE.monsterTrueWorthBonus = function (state, key) {
	if (!key || key === "undead") return 0;
	if (!state) return 0;
	var bonus = Number(state.monsterCvBump) || 0;
	if (DE.monsterIsIntelligent(state, key)) bonus += Number(state.intelligentCvBump) || 0;
	return bonus;
};

DE.formatMonsterAdvice = function (state, key) {
	var label = DE.SPECIES_LABELS[key] || key;
	return label + (DE.monsterIsIntelligent(state, key) ? " (intelligent)" : " (not intelligent)");
};

DE.markMonsterKnown = function (state, key) {
	if (!key || !state || !state.player) return;
	state.player.knownMonsters = state.player.knownMonsters || {};
	state.player.knownMonsters[key] = {
		intelligent: DE.monsterIsIntelligent(state, key)
	};
};

DE.markMonstersKnownFromUnits = function (state, units) {
	var list = units || [];
	for (var i = 0; i < list.length; i++) {
		var key = DE.monsterKeyForUnit(list[i]);
		if (key) DE.markMonsterKnown(state, key);
	}
};

DE.rawSideStrength = function (units, enemyUnits, state) {
	var list = DE.fightingUnits(units);
	var sum = 0;
	var maxUnitWorth = 0;
	var hasHealer = false;
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
	return sum;
};

DE.sideStrength = function (units, enemyUnits, state, opts) {
	opts = opts || {};
	var ownRaw = DE.rawSideStrength(units, enemyUnits, state);
	var enemyRaw = DE.rawSideStrength(enemyUnits, units, state);
	var mind = DE.mindMageTransfer(units, enemyUnits, ownRaw, enemyRaw);
	var sum = ownRaw + mind.delta;
	var hasIllusionist = DE.hasFlag(units, "illusionist") && !DE.hasFlag(enemyUnits, "spider");
	if (hasIllusionist) sum = sum * 1.5;
	if (state && state.mission && units === state.mission.party) {
		sum *= (1 - DE.hungerPenalty(state));
	}
	if (opts.civiliansFight) sum += DE.civilianFightValue(units);
	if (opts.siteBonus) sum *= (1 + DE.SITE_ASSAULT_BONUS);
	return sum;
};

DE.ghostWins = function (units, enemyUnits) {
	return DE.hasFlag(units, "ghost") && !DE.sideHasMage(enemyUnits);
};

DE.fearWidthFromUnits = function (ownUnits, enemyUnits) {
	var swing = DE.hasFlag(ownUnits, "illusionist") || DE.hasFlag(enemyUnits, "illusionist") ||
		DE.hasFlag(ownUnits, "ghost") || DE.hasFlag(enemyUnits, "ghost") ||
		DE.fightingUnits(ownUnits).some(function (u) { var d = DE.unitDef(u.type); return d && d.kind === "monster"; }) ||
		DE.fightingUnits(enemyUnits).some(function (u) { var d = DE.unitDef(u.type); return d && d.kind === "monster"; }) ||
		DE.sideHasMage(ownUnits) || DE.sideHasMage(enemyUnits);
	return swing ? 0.3 : 0.15;
};

DE.fearFromCvPair = function (own, enemy, leader, width) {
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
	var lo = DE.clamp(center - width / 2, 0, 1);
	var hi = DE.clamp(center + width / 2, 0, 1);
	return { lo: lo, hi: hi, center: (lo + hi) / 2, width: hi - lo, own: own, enemy: enemy };
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
	return DE.fearFromCvPair(own, enemy, leader, DE.fearWidthFromUnits(ownUnits, enemyUnits));
};

DE.UNKNOWN_SPECIAL_CV = 15;
DE.UNKNOWN_MONSTER_CV = 60;
DE.UNKNOWN_SMALL_CV = 5;

DE.isPlayerObserver = function (state, observer) {
	if (!observer) return false;
	if (observer === "player") return true;
	if (state && observer === state.player) return true;
	return observer.kind === "player" || observer.id === "player";
};

DE.observerOwnsUnit = function (observer, unit) {
	if (!observer || !unit) return false;
	var oid = null;
	if (observer === "player" || observer.kind === "player" || observer.id === "player") oid = "player";
	else if (observer.id) oid = observer.id;
	return !!(oid && unit.factionId === oid);
};

DE.unitInHomeList = function (unit, homeUnits) {
	if (!unit || !homeUnits) return false;
	for (var i = 0; i < homeUnits.length; i++) {
		if (homeUnits[i] === unit) return true;
		if (unit.id && homeUnits[i] && homeUnits[i].id === unit.id) return true;
	}
	return false;
};

DE.unknownUnitEstimate = function (def) {
	if (!def || def.role === "civilian") return 0;
	if (def.monster || def.undead) return DE.UNKNOWN_MONSTER_CV;
	if (def.kind === "special" || (def.flags && def.flags.ranger)) return DE.UNKNOWN_SPECIAL_CV;
	return DE.UNKNOWN_SMALL_CV;
};

DE.observerKnowsUnitType = function (state, observer, type) {
	if (!type) return false;
	var def = DE.unitDef(type);
	var mKey = null;
	if (def) {
		if (def.undead) mKey = "undead";
		else if (def.monster) mKey = type;
	}
	if (DE.isPlayerObserver(state, observer)) {
		if (mKey) return DE.isMonsterKnown(state, mKey);
		return DE.hasFacedType(state, type);
	}
	if (!observer) return false;
	if (mKey) return false;
	if (typeof DE.factionKnowsHumanType === "function") return DE.factionKnowsHumanType(observer, type);
	return !!(observer.knownHumanTypes && observer.knownHumanTypes[type]);
};

DE.observerKnowsUnit = function (state, observer, unit, homeUnits) {
	if (!unit) return false;
	if (unit.type === "civilian") return true;
	if (DE.observerOwnsUnit(observer, unit) || DE.unitInHomeList(unit, homeUnits)) return true;
	return DE.observerKnowsUnitType(state, observer, unit.type);
};

DE.knownUnitsForObserver = function (units, state, observer, homeUnits) {
	var list = units || [];
	var out = [];
	for (var i = 0; i < list.length; i++) {
		if (DE.observerKnowsUnit(state, observer, list[i], homeUnits)) out.push(list[i]);
	}
	return out;
};

DE.sideHasUnknownForObserver = function (units, state, observer, homeUnits) {
	var list = DE.fightingUnits(units);
	for (var i = 0; i < list.length; i++) {
		var def = DE.unitDef(list[i].type);
		if (!def || def.role === "civilian") continue;
		if (!DE.observerKnowsUnit(state, observer, list[i], homeUnits)) return true;
	}
	return false;
};

DE.perceivedUnitContribution = function (unit, ownUnits, enemyUnits, state, observer, homeUnits) {
	var def = DE.unitDef(unit.type);
	if (!def || unit.dead || unit.wounded) return 0;
	if (def.role === "civilian") return 0;
	if (!DE.observerKnowsUnit(state, observer, unit, homeUnits)) {
		return DE.unknownUnitEstimate(def);
	}
	var knownOwn = DE.knownUnitsForObserver(ownUnits, state, observer, homeUnits);
	var knownEnemy = DE.knownUnitsForObserver(enemyUnits, state, observer, homeUnits);
	return DE.unitContribution(unit, knownOwn, knownEnemy, state, { skipUnknownMonsterBonus: true });
};

DE.perceivedRawSideStrength = function (units, enemyUnits, state, observer, homeUnits) {
	var list = DE.fightingUnits(units);
	var sum = 0;
	var maxUnitWorth = 0;
	var hasHealer = false;
	for (var i = 0; i < list.length; i++) {
		var u = list[i];
		var def = DE.unitDef(u.type);
		var known = DE.observerKnowsUnit(state, observer, u, homeUnits);
		var c = DE.perceivedUnitContribution(u, units, enemyUnits, state, observer, homeUnits);
		sum += c;
		if (known && def && def.flags && def.flags.healer) hasHealer = true;
		if (known && def && def.worth > maxUnitWorth && !(def.flags && def.flags.healer)) maxUnitWorth = def.worth;
		if (known && def && def.flags && def.flags.skeleton) {
			if (c > maxUnitWorth) maxUnitWorth = c;
		}
	}
	if (hasHealer) sum += maxUnitWorth;
	return sum;
};

DE.perceivedSideStrength = function (units, enemyUnits, state, observer, homeUnits) {
	var ownRaw = DE.perceivedRawSideStrength(units, enemyUnits, state, observer, homeUnits);
	var enemyRaw = DE.perceivedRawSideStrength(enemyUnits, units, state, observer, homeUnits);
	var knownOwn = DE.knownUnitsForObserver(units, state, observer, homeUnits);
	var knownEnemy = DE.knownUnitsForObserver(enemyUnits, state, observer, homeUnits);
	var mind = DE.mindMageTransfer(knownOwn, knownEnemy, ownRaw, enemyRaw);
	var sum = ownRaw + mind.delta;
	var hasIllusionist = DE.hasFlag(knownOwn, "illusionist") && !DE.hasFlag(knownEnemy, "spider");
	if (hasIllusionist) sum = sum * 1.5;
	if (state && state.mission && units === state.mission.party) {
		sum *= (1 - DE.hungerPenalty(state));
	}
	return sum;
};

DE.perceivedGhostWins = function (units, enemyUnits, state, observer, homeUnits) {
	var knownOwn = DE.knownUnitsForObserver(units, state, observer, homeUnits);
	var knownEnemy = DE.knownUnitsForObserver(enemyUnits, state, observer, homeUnits);
	return DE.ghostWins(knownOwn, knownEnemy);
};

DE.formatPerceivedCv = function (value, uncertain) {
	var n = Math.round(Number(value) || 0);
	return uncertain ? n + " +??" : String(n);
};

DE.perceivedFearFromStrength = function (ownUnits, enemyUnits, leader, state, observer) {
	var homeUnits = ownUnits;
	var own = DE.perceivedSideStrength(ownUnits, enemyUnits, state, observer, homeUnits);
	var enemy = DE.perceivedSideStrength(enemyUnits, ownUnits, state, observer, homeUnits);
	if (DE.perceivedGhostWins(enemyUnits, ownUnits, state, observer, homeUnits) &&
		!DE.perceivedGhostWins(ownUnits, enemyUnits, state, observer, homeUnits)) {
		own = 0;
		enemy = Math.max(enemy, 1);
	} else if (DE.perceivedGhostWins(ownUnits, enemyUnits, state, observer, homeUnits) &&
		!DE.perceivedGhostWins(enemyUnits, ownUnits, state, observer, homeUnits)) {
		own = Math.max(own, 1);
		enemy = 0;
	}
	var fear = DE.fearFromCvPair(own, enemy, leader, DE.fearWidthFromUnits(ownUnits, enemyUnits));
	fear.uncertainOwn = DE.sideHasUnknownForObserver(ownUnits, state, observer, homeUnits);
	fear.uncertainEnemy = DE.sideHasUnknownForObserver(enemyUnits, state, observer, homeUnits);
	return fear;
};

DE.casualtyCost = function (unit) {
	var def = DE.unitDef(unit.type);
	return def ? def.casualty : 5;
};

DE.pickCasualties = function (state, units, budget, preferIds, opts) {
	opts = opts || {};
	var remaining = budget;
	var picked = [];
	var pool = [];
	for (var i = 0; i < units.length; i++) {
		if (!units[i] || units[i].dead) continue;
		if (opts.skipCivilians && units[i].type === "civilian") continue;
		pool.push(units[i]);
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
	if (unit.wounded) {
		unit.dead = true;
		unit.wounded = false;
		return "dead";
	}
	var deadChance = winner ? 0.2 : 0.5;
	if (DE.rngNext(state) < deadChance) {
		unit.dead = true;
		unit.wounded = false;
		return "dead";
	}
	unit.wounded = true;
	return "wounded";
};

DE.healSide = function (units, opts) {
	opts = opts || {};
	units = units || [];
	var has = false;
	for (var i = 0; i < units.length; i++) {
		if (units[i].dead) continue;
		var def = DE.unitDef(units[i].type);
		if (def && def.flags && def.flags.healer) has = true;
	}
	if (!has) return 0;
	var n = 0;
	for (var j = 0; j < units.length; j++) {
		if (opts.skipPlayer && DE.isPlayerControlledUnit(units[j])) continue;
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
	var pOpts = opts.playerCombat || DE.combatSideOpts(opts.encounter, opts.playerAction, opts.aiAction, "player");
	var aOpts = opts.aiCombat || DE.combatSideOpts(opts.encounter, opts.playerAction, opts.aiAction, "ai");
	var pRaw = DE.rawSideStrength(player, ai, state);
	var aRaw = DE.rawSideStrength(ai, player, state);
	var mindP = DE.mindMageTransfer(player, ai, pRaw, aRaw);
	var mindA = DE.mindMageTransfer(ai, player, aRaw, pRaw);
	var pStr = DE.sideStrength(player, ai, state, pOpts);
	var aStr = DE.sideStrength(ai, player, state, aOpts);
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
	var pHit = DE.pickCasualties(state, player, pBudget, preferP, {
		skipCivilians: DE.actionClass(opts.aiAction) !== "assault"
	});
	var aHit = DE.pickCasualties(state, ai, aBudget, preferA, {
		skipCivilians: DE.actionClass(opts.playerAction) !== "assault"
	});
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
		mindTransfer: { player: mindP, ai: mindA },
		stolen: { stolenByA: [], stolenByB: [] },
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
	var ownRaw = DE.rawSideStrength(units, enemyUnits, state);
	var enemyRaw = DE.rawSideStrength(enemyUnits, units, state);
	var mind = DE.mindMageTransfer(units, enemyUnits, ownRaw, enemyRaw);
	if (mind.delta) {
		rows.push({
			label: mind.delta > 0 ? "Mind Mage (+CV)" : "Mind Mage (−CV)",
			count: mind.ownMages || mind.enemyMages,
			type: "mindMage",
			subtotal: mind.delta
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

DE.weaponDropsFromFates = function (units, fates, skipIds) {
	var drops = [];
	fates = fates || [];
	skipIds = skipIds || {};
	for (var i = 0; i < fates.length; i++) {
		if (fates[i].fate !== "dead") continue;
		if (skipIds[fates[i].id]) continue;
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
	for (var i = 0; i < drops.length; i++) {
		if (DE.isWeaponKitType(drops[i])) stuff.weapons.push(drops[i]);
	}
};
