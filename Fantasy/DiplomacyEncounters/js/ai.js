var DE = DE || {};

DE.trustPrior = function (faction) {
	if (!faction) return { center: 0.5, width: 0.4 };
	if (faction.hostileTarget) return { center: 0.2, width: 0.4 };
	if (faction.kind === "loner") return { center: 0.35, width: 0.4 };
	return { center: 0.5, width: 0.4 };
};

DE.trustFromLog = function (state, factionId) {
	var faction = DE.factionById(state, factionId);
	var t = DE.trustPrior(faction);
	var log = (state.logs && state.logs[factionId]) ? state.logs[factionId].slice().reverse() : [];
	var lastPol = 0;
	for (var i = 0; i < log.length; i++) {
		var e = log[i];
		var rounds = e.rounds || [];
		for (var r = 0; r < rounds.length; r++) {
			var act = rounds[r].player;
			var pol = DE.actionPolarity(act);
			if (lastPol && pol && pol !== lastPol) t.width += 0.08;
			else if (pol && pol === lastPol) t.width -= 0.04;
			if (act === "greet") t.center += 0.04;
			else if (act === "gift") {
				var g = rounds[r].giftValue || e.giftValue || 0;
				t.center += 0.06 + 0.12 * Math.log(1 + g / 25);
			} else if (act === "trade") t.center += 0.07;
			else if (act === "attack" || act === "seize" || act === "capture") t.center -= 0.12;
			else if (act === "intimidate") t.center -= 0.01;
			else if (act === "retreat" || act === "run") t.center += 0.03;
			if (pol) lastPol = pol;
		}
		if (e.traded) t.center += 0.05;
		if (e.battle && !e.displayBattle && (e.winner === "player" || e.winner === "ai")) {
			/* war already applied via assault actions; do not move Fear */
		}
	}
	t.width = DE.clamp(t.width, 0.12, 0.7);
	t.center = DE.clamp(t.center, 0.02, 0.98);
	if (faction && faction.kind !== "animal") {
		/* leader offset applied at decision time */
	}
	var lo = DE.clamp(t.center - t.width / 2, 0, 1);
	var hi = DE.clamp(t.center + t.width / 2, 0, 1);
	return { lo: lo, hi: hi, center: (lo + hi) / 2, width: hi - lo };
};

DE.chooseAiAction = function (state, encounter) {
	var faction = DE.factionById(state, encounter.factionId);
	var leader = encounter.leader;
	var fear = DE.fearFromStrength(encounter.aiUnits, encounter.playerUnits, leader, state);
	var F = fear.center;
	var tradeOk = encounter.roundIndex > 0;
	if (!faction || faction.kind === "animal" || encounter.animal) {
		if (F > 0.6) return { action: "run" };
		if (F > 0.45) return { action: "retreat" };
		return { action: "attack" };
	}
	var trust = DE.trustFromLog(state, encounter.factionId);
	var T = trust.center + ((leader && leader.deltaTrust) || 0);
	T = DE.clamp(T, 0, 1);
	var stuff = encounter.aiStuff || DE.emptyStuff();

	function canSeize() {
		return (stuff.gold > 0) || (stuff.food > 0) || (stuff.weapons && stuff.weapons.length) ||
			encounter.playerStuff && (encounter.playerStuff.gold > 0 || encounter.playerStuff.food > 0 || (encounter.playerStuff.weapons || []).length);
	}
	function captureTarget() {
		var pool = DE.fightingUnits(encounter.playerUnits);
		return pool.length ? DE.rngPick(state, pool) : null;
	}

	var action;
	if (trust.width > 0.45 && encounter.roundIndex === 0) {
		action = DE.rngNext(state) < 0.5 ? "intimidate" : "greet";
	} else if (F < 0.4 && T < 0.4) {
		var roll = DE.rngNext(state);
		if (roll < 0.5) action = "attack";
		else if (roll < 0.75 && canSeize()) action = "seize";
		else if (captureTarget()) action = "capture";
		else action = "attack";
	} else if (F < 0.4 && T >= 0.4) {
		var r2 = DE.rngNext(state);
		if (tradeOk && r2 < 0.25) action = "trade";
		else if (r2 < 0.45) action = "greet";
		else if (r2 < 0.7) action = "gift";
		else action = "intimidate";
	} else if (F >= 0.55 && T >= 0.35) {
		var r3 = DE.rngNext(state);
		if (r3 < 0.4) action = "gift";
		else if (r3 < 0.75) action = "greet";
		else action = "retreat";
	} else if (F >= 0.55 && T < 0.35) {
		var r4 = DE.rngNext(state);
		if (r4 < 0.45) action = "run";
		else if (r4 < 0.75) action = "gift";
		else action = "attack";
	} else {
		action = DE.rngNext(state) < 0.5 ? "intimidate" : "greet";
	}

	if (faction && faction.hostileTarget && DE.rngNext(state) < 0.35 && F < 0.55) action = "attack";
	if (action === "trade" && !tradeOk) action = "greet";
	if (encounter.intimidateMayTrade && F < 0.45 && T > 0.3) action = "trade";

	var extra = {};
	if (action === "seize") extra.seize = DE.chooseSeizeTarget(state, encounter.playerStuff, encounter.playerUnits);
	if (action === "capture") {
		var cap = captureTarget();
		if (cap) extra.captureId = cap.id;
		else action = "attack";
	}
	if (action === "gift") extra.gift = DE.chooseAiGift(state, encounter);
	return { action: action, extra: extra, fear: fear, trust: trust };
};

DE.chooseSeizeTarget = function (state, stuff, units) {
	stuff = stuff || DE.emptyStuff();
	var options = [];
	if ((stuff.food || 0) > 0) options.push({ kind: "food" });
	if ((stuff.gold || 0) > 0) options.push({ kind: "gold" });
	var weps = stuff.weapons || [];
	for (var i = 0; i < weps.length; i++) options.push({ kind: "weapons", type: weps[i] });
	var equipped = {};
	var list = units || [];
	for (var j = 0; j < list.length; j++) {
		if (list[j].equippedWeapons && !list[j].dead) equipped[list[j].type] = list[j];
	}
	var keys = Object.keys(equipped);
	for (var k = 0; k < keys.length; k++) {
		if (keys[k] !== "civilian") options.push({ kind: "weapons", type: keys[k], unitId: equipped[keys[k]].id, equipped: true });
	}
	if (!options.length) return { kind: "gold" };
	return DE.rngPick(state, options);
};

DE.chooseAiGift = function (state, encounter) {
	var stuff = encounter.aiStuff || DE.emptyStuff();
	var gift = { gold: 0, food: 0, weapons: [], captives: [] };
	var faction = DE.factionById(state, encounter.factionId);
	if (faction && (faction.kind === "loner" || faction.monsterType) && stuff.food > 0) {
		gift.food = Math.min(stuff.food, 3 + DE.rngInt(state, 4));
		return gift;
	}
	if (stuff.gold >= 10) gift.gold = Math.min(stuff.gold, 10 + DE.rngInt(state, 21));
	else if (stuff.food > 0) gift.food = Math.min(stuff.food, 2 + DE.rngInt(state, 4));
	else if ((stuff.weapons || []).length) gift.weapons = [stuff.weapons[0]];
	return gift;
};

DE.aiAcceptsGift = function (state, encounter, gift) {
	var faction = DE.factionById(state, encounter.factionId);
	var trust = DE.trustFromLog(state, encounter.factionId);
	var value = DE.giftGoldEquivalent(gift);
	var score = trust.center + Math.log(1 + value / 25) * 0.25;
	if (faction && (faction.kind === "loner" || faction.kind === "animal") && gift && gift.food > 0) score += 0.2;
	if (faction && faction.kind !== "animal" && gift && gift.gold > 0) score += 0.05;
	if (gift && gift.weapons && gift.weapons.length) {
		var roster = (faction && faction.roster) || [];
		for (var i = 0; i < gift.weapons.length; i++) {
			if (roster.indexOf(gift.weapons[i]) < 0) score += 0.15;
		}
	}
	return score >= 0.38;
};
