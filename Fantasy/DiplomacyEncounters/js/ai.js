var DE = DE || {};

DE.trustPrior = function (faction, state) {
	if (faction && state && typeof DE.politicsTrust === "function") {
		var seeded = DE.politicsTrust(state, faction.id, "player");
		if (seeded != null) return { center: seeded, width: 0.4 };
	}
	if (!faction) return { center: 0.5, width: 0.4 };
	if (faction.hostileTarget) return { center: 0.2, width: 0.4 };
	if (faction.kind === "loner") return { center: 0.35, width: 0.4 };
	return { center: 0.5, width: 0.4 };
};

DE.trustFromLog = function (state, factionId) {
	var faction = DE.factionById(state, factionId);
	var t = DE.trustPrior(faction, state);
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
			t.center += DE.trustCenterDeltaForAction(act, rounds[r].giftValue || e.giftValue || 0);
			if (pol) lastPol = pol;
		}
		if (e.traded) t.center += 0.05;
		if (e.battle && !e.displayBattle && (e.winner === "player" || e.winner === "ai")) {
			/* war already applied via assault actions; do not move Fear */
		}
	}
	t.width = DE.clamp(t.width, 0.12, 0.7);
	t.center = DE.clamp(t.center, 0.02, 0.98);
	var lo = DE.clamp(t.center - t.width / 2, 0, 1);
	var hi = DE.clamp(t.center + t.width / 2, 0, 1);
	return { lo: lo, hi: hi, center: (lo + hi) / 2, width: hi - lo };
};

DE.trustCenterDeltaForAction = function (act, giftValue) {
	if (act === "greet") return 0.04;
	if (act === "gift") return 0.06 + 0.12 * Math.log(1 + (Number(giftValue) || 0) / 25);
	if (act === "trade") return 0.07;
	if (act === "attack" || act === "seize" || act === "capture" || act === "occupy") return -0.12;
	if (act === "intimidate" || act === "defend") return -0.01;
	if (act === "retreat" || act === "run") return 0.03;
	return 0;
};

DE.attitudeShiftFromEncounter = function (state, enc) {
	if (!state || !enc || !enc.factionId || enc.kind === "animal" || enc.animal) return null;
	if (enc.trustAtMeet == null) return null;
	var after = DE.trustFromLog(state, enc.factionId);
	return {
		before: enc.trustAtMeet,
		after: after.center,
		beforeBand: DE.trustBandName(enc.trustAtMeet),
		afterBand: DE.trustBandName(after.center),
		reasons: DE.attitudeShiftReasons(state, enc)
	};
};

DE.attitudeShiftReasons = function (state, enc) {
	var reasons = [];
	if (!enc) return reasons;
	var lastPol = 0;
	var log = (state && state.logs && state.logs[enc.factionId]) ? state.logs[enc.factionId] : [];
	var older = log.slice(1).slice().reverse();
	var i;
	var r;
	for (i = 0; i < older.length; i++) {
		var prevRounds = older[i].rounds || [];
		for (r = 0; r < prevRounds.length; r++) {
			var prevPol = DE.actionPolarity(prevRounds[r].player);
			if (prevPol) lastPol = prevPol;
		}
	}
	var rounds = enc.rounds || [];
	if (!rounds.length && log[0] && log[0].id === enc.id) rounds = log[0].rounds || [];
	var summed = 0;
	for (r = 0; r < rounds.length; r++) {
		var act = rounds[r].player;
		var pol = DE.actionPolarity(act);
		var delta = DE.trustCenterDeltaForAction(act, rounds[r].giftValue || 0);
		summed += delta;
		var label = DE.ACTION_LABELS[act] || act || "action";
		var line = label + " " + (delta > 0 ? "+" : "") + DE.pct(delta);
		if (act === "gift") line += " (gift worth " + Math.round(rounds[r].giftValue || 0) + "g)";
		if (lastPol && pol && pol !== lastPol) line += " · mixed signals widened uncertainty +8%";
		else if (pol && pol === lastPol) line += " · repeated signals narrowed uncertainty −4%";
		reasons.push(line);
		if (pol) lastPol = pol;
	}
	var traded = !!enc.didTrade;
	if (!traded && log[0] && (log[0].id === enc.id || !enc.id)) traded = !!log[0].traded;
	if (traded) {
		summed += 0.05;
		reasons.push("Trade completed +5%");
	}
	if (!reasons.length) reasons.push("No actions that move attitude.");
	var after = DE.trustFromLog(state, enc.factionId);
	var shown = after.center - enc.trustAtMeet;
	if (Math.abs(shown - summed) > 0.0005) {
		reasons.push("Displayed change is " + (shown > 0 ? "+" : "") + DE.pct(shown) +
			" after clamping to 2%–98% / the 0–100% range.");
	}
	return reasons;
};

DE.formatAttitudeShift = function (shift, debug) {
	if (!shift) return "";
	var delta = shift.after - shift.before;
	var change = Math.abs(delta) < 0.0005
		? "Attitude unchanged"
		: ("Attitude " + (delta > 0 ? "+" : "") + DE.pct(delta));
	if (!debug) return change;
	var from = shift.beforeBand + " " + DE.pct(shift.before);
	if (Math.abs(delta) < 0.0005) return "Attitude: " + from + " (unchanged)";
	var sign = delta > 0 ? "+" : "";
	return "Attitude: " + from + " → " + shift.afterBand + " " + DE.pct(shift.after) +
		" (" + sign + DE.pct(delta) + ")";
};

DE.pct = function (n) {
	return (Math.round(n * 1000) / 10) + "%";
};

DE.fearBandName = function (F) {
	if (F < 0.4) return "bold";
	if (F < 0.6) return "uneasy";
	return "afraid";
};

DE.trustBandName = function (T) {
	if (T == null) return "none";
	if (T < 0.4) return "hostile";
	if (T < 0.6) return "wary";
	return "friendly";
};

DE.PARTY_TRUST_ONE = 0.05;
DE.PARTY_TRUST_MANY = 0.1;

DE.partyTrustMagnitude = function (count) {
	count = Number(count) || 0;
	if (count <= 0) return 0;
	return count === 1 ? DE.PARTY_TRUST_ONE : DE.PARTY_TRUST_MANY;
};

DE.partyMemberTrustBand = function (state, homeFactionId, towardFactionId) {
	if (!homeFactionId || !towardFactionId) return "unknown";
	if (homeFactionId === towardFactionId) return "friendly";
	if (typeof DE.politicsTrust !== "function" || typeof DE.politicsBand !== "function") return "unknown";
	return DE.politicsBand(DE.politicsTrust(state, homeFactionId, towardFactionId));
};

DE.partyTrustSignForBand = function (band, inverted) {
	var sign = 0;
	if (band === "friendly") sign = 1;
	else if (band === "hostile") sign = -1;
	if (inverted) sign = -sign;
	return sign;
};

DE.formatPartyTrustDelta = function (delta) {
	delta = Number(delta) || 0;
	if (!delta) return "±0%";
	return (delta > 0 ? "+" : "") + DE.pct(delta);
};

DE.computePartyTrustModifier = function (state, towardFactionId, units, captives) {
	var hireFriendly = 0;
	var hireHostile = 0;
	var capFriendly = 0;
	var capHostile = 0;
	var unitBands = {};
	var captiveBands = {};
	var list = units || [];
	var i;
	for (i = 0; i < list.length; i++) {
		var u = list[i];
		if (!u || u.dead || !DE.isHireling(u)) continue;
		var home = u.homeFactionId || null;
		var band = DE.partyMemberTrustBand(state, home, towardFactionId);
		unitBands[u.id] = band;
		if (band === "friendly") hireFriendly += 1;
		else if (band === "hostile") hireHostile += 1;
	}
	var caps = captives || [];
	for (i = 0; i < caps.length; i++) {
		var c = caps[i];
		if (!c) continue;
		var capHome = typeof DE.captiveHomeId === "function" ? DE.captiveHomeId(c) : (c.homeFactionId || c.factionId || null);
		var cBand = DE.partyMemberTrustBand(state, capHome, towardFactionId);
		if (c.id) captiveBands[c.id] = cBand;
		if (cBand === "friendly") capFriendly += 1;
		else if (cBand === "hostile") capHostile += 1;
	}
	var hireling = DE.partyTrustMagnitude(hireFriendly) - DE.partyTrustMagnitude(hireHostile);
	var captive = DE.partyTrustMagnitude(capHostile) - DE.partyTrustMagnitude(capFriendly);
	return {
		total: hireling + captive,
		hireling: hireling,
		captive: captive,
		hireFriendly: hireFriendly,
		hireHostile: hireHostile,
		capFriendly: capFriendly,
		capHostile: capHostile,
		unitBands: unitBands,
		captiveBands: captiveBands
	};
};

DE.partyTrustDisplayDelta = function (band, inverted) {
	var sign = DE.partyTrustSignForBand(band, inverted);
	return sign * DE.PARTY_TRUST_ONE;
};

DE.sampleInRange = function (state, lo, hi) {
	lo = Number(lo) || 0;
	hi = Number(hi) || 0;
	if (hi < lo) {
		var tmp = lo;
		lo = hi;
		hi = tmp;
	}
	if (hi <= lo) return lo;
	return lo + DE.rngNext(state) * (hi - lo);
};

/* Lock Fear/Trust samples for the whole encounter (peek-safe). */
DE.ensureEncounterStance = function (state, encounter) {
	if (encounter.stance && encounter.stance.locked) return encounter.stance;
	var leader = encounter.leader;
	var faction = DE.factionById(state, encounter.factionId);
	var fear = DE.perceivedFearFromStrength(encounter.aiUnits, encounter.playerUnits, leader, state, faction);
	var F = DE.sampleInRange(state, fear.lo, fear.hi);
	var trust = null;
	var T = null;
	var trustLo = null;
	var trustHi = null;
	var trustCenter = null;
	var beast = !faction || faction.kind === "animal" || encounter.animal;
	var partyTrust = null;
	if (!beast) {
		trust = DE.trustFromLog(state, encounter.factionId);
		partyTrust = DE.computePartyTrustModifier(
			state,
			encounter.factionId,
			encounter.playerUnits,
			(encounter.playerStuff && encounter.playerStuff.captives) || []
		);
		trustCenter = DE.clamp(
			trust.center + ((leader && leader.deltaTrust) || 0) + (partyTrust.total || 0),
			0,
			1
		);
		var half = trust.width / 2;
		trustLo = DE.clamp(trustCenter - half, 0, 1);
		trustHi = DE.clamp(trustCenter + half, 0, 1);
		T = DE.sampleInRange(state, trustLo, trustHi);
	}
	encounter.stance = {
		locked: true,
		F: F,
		T: T,
		fear: fear,
		trust: trust,
		fearLo: fear.lo,
		fearHi: fear.hi,
		trustLo: trustLo,
		trustHi: trustHi,
		trustCenter: trustCenter,
		leaderDeltaFear: leader && leader.deltaFear ? leader.deltaFear : 0,
		leaderDeltaTrust: leader && leader.deltaTrust ? leader.deltaTrust : 0,
		partyTrust: partyTrust,
		beast: beast
	};
	return encounter.stance;
};

DE.peekAiAction = function (state, encounter) {
	DE.ensureEncounterStance(state, encounter);
	var saved = state.rng;
	var result = DE.chooseAiAction(state, encounter);
	state.rng = saved;
	return result;
};

DE.pickWeightedAction = function (state, weights, debug, label) {
	var total = 0;
	var keys = Object.keys(weights);
	for (var i = 0; i < keys.length; i++) total += weights[keys[i]];
	var r = DE.rngNext(state);
	if (debug) debug.rolls.push({ label: label || "action pick", value: r });
	var acc = 0;
	for (var k = 0; k < keys.length; k++) {
		acc += weights[keys[k]] / total;
		if (r < acc) return keys[k];
	}
	return keys[keys.length - 1];
};

DE.remapSiteActionWeights = function (weights, encounter) {
	if (!weights || !encounter) return weights;
	if (DE.actionAvailable(encounter, "defend", "ai") && weights.intimidate) {
		weights.defend = weights.intimidate / 2;
		weights.intimidate = weights.intimidate / 2;
	}
	if (DE.actionAvailable(encounter, "occupy", "ai")) {
		var share = 0;
		if (weights.attack) {
			share += weights.attack / 2;
			weights.attack = weights.attack / 2;
		}
		if (weights.seize) {
			share += weights.seize / 2;
			weights.seize = weights.seize / 2;
		}
		if (share) weights.occupy = share;
	}
	return weights;
};

DE.chooseAiAction = function (state, encounter) {
	var stance = DE.ensureEncounterStance(state, encounter);
	var faction = DE.factionById(state, encounter.factionId);
	var F = stance.F;
	var T = stance.T;
	var fear = stance.fear;
	var trust = stance.trust;
	var tradeOk = encounter.roundIndex > 0;
	var debug = {
		F: F,
		T: T,
		fearOwn: fear.own,
		fearEnemy: fear.enemy,
		fearLo: stance.fearLo,
		fearHi: stance.fearHi,
		fearWidth: fear.width,
		leaderDeltaFear: stance.leaderDeltaFear,
		leaderDeltaTrust: stance.leaderDeltaTrust,
		partyTrust: stance.partyTrust,
		trustCenter: stance.trustCenter,
		trustWidth: trust ? trust.width : null,
		trustLo: stance.trustLo,
		trustHi: stance.trustHi,
		fearBand: DE.fearBandName(F),
		trustBand: DE.trustBandName(T),
		band: null,
		reasons: [],
		rolls: [],
		overrides: [],
		weights: null
	};

	var stuff = encounter.aiStuff || DE.emptyStuff();
	function canSeize() {
		return (stuff.gold > 0) || (stuff.food > 0) || (stuff.weapons && stuff.weapons.length) ||
			encounter.playerStuff && (encounter.playerStuff.gold > 0 || encounter.playerStuff.food > 0 || (encounter.playerStuff.weapons || []).length);
	}
	function captureTarget() {
		var pool = DE.fightingUnits(encounter.playerUnits);
		return pool.length ? DE.rngPick(state, pool) : null;
	}

	if (stance.beast) {
		debug.band = "animal/beast · " + debug.fearBand;
		var animalAction;
		if (F >= 0.6) {
			animalAction = "run";
			debug.reasons.push("Beast Fear " + DE.pct(F) + " ≥ 60% → run");
		} else if (F >= 0.4) {
			animalAction = "retreat";
			debug.reasons.push("Beast Fear " + DE.pct(F) + " ≥ 40% → retreat");
		} else {
			animalAction = "attack";
			debug.reasons.push("Beast Fear " + DE.pct(F) + " < 40% → attack");
		}
		debug.reasons.push("Sampled Fear " + DE.pct(F) + " in [" + DE.pct(stance.fearLo) + ", " + DE.pct(stance.fearHi) + "]");
		debug.reasons.push("Their CV " + Math.round(fear.own) + " vs your CV " + Math.round(fear.enemy));
		return { action: animalAction, extra: {}, fear: fear, trust: null, debug: debug };
	}

	var action;
	var weights = null;

	if (trust && trust.width > 0.45 && encounter.roundIndex === 0) {
		debug.band = "uncertain first meeting (trust width > 45%)";
		weights = { intimidate: 50, retreat: 50 };
		DE.remapSiteActionWeights(weights, encounter);
		debug.weights = weights;
		action = DE.pickWeightedAction(state, weights, debug, "wide-trust first meeting");
		debug.reasons.push("Trust width " + DE.pct(trust.width) + " on round 1 → intimidate 50% / retreat 50%");
	} else {
		var fearBand = DE.fearBandName(F);
		var trustBand = DE.trustBandName(T);
		debug.band = fearBand + " × " + trustBand;

		if (fearBand === "bold" && trustBand === "hostile") {
			weights = { seize: 45, attack: 35, capture: 20 };
		} else if (fearBand === "bold" && trustBand === "wary") {
			weights = { intimidate: 40, greet: 35, seize: 25 };
		} else if (fearBand === "bold" && trustBand === "friendly") {
			weights = tradeOk
				? { trade: 30, greet: 35, gift: 35 }
				: { greet: 50, gift: 50 };
		} else if (fearBand === "uneasy" && trustBand === "hostile") {
			weights = { intimidate: 40, attack: 40, retreat: 20 };
		} else if (fearBand === "uneasy" && trustBand === "wary") {
			weights = { intimidate: 35, greet: 35, retreat: 30 };
		} else if (fearBand === "uneasy" && trustBand === "friendly") {
			weights = tradeOk
				? { greet: 35, gift: 35, trade: 30 }
				: { greet: 50, gift: 50 };
		} else if (fearBand === "afraid" && trustBand === "hostile") {
			weights = { run: 45, retreat: 45, gift: 10 };
		} else if (fearBand === "afraid" && trustBand === "wary") {
			weights = { retreat: 40, run: 35, gift: 25 };
		} else if (fearBand === "afraid" && trustBand === "friendly") {
			weights = { gift: 40, greet: 35, retreat: 25 };
		} else {
			weights = { intimidate: 50, greet: 50 };
		}

		DE.remapSiteActionWeights(weights, encounter);
		debug.weights = weights;
		action = DE.pickWeightedAction(state, weights, debug, fearBand + "×" + trustBand);
		debug.reasons.push("Grid " + fearBand + " × " + trustBand + " → " + DE.formatWeightTable(weights));

		if (action === "seize" && !canSeize()) {
			debug.overrides.push("Seize unavailable → attack");
			action = "attack";
		}
		if (action === "capture" && !DE.fightingUnits(encounter.playerUnits).length) {
			debug.overrides.push("Capture unavailable → attack");
			action = "attack";
		}
		if (action === "trade" && !tradeOk) {
			debug.overrides.push("Trade blocked on first round → greet");
			action = "greet";
		}
	}

	if (!DE.actionAvailable(encounter, action, "ai")) {
		debug.overrides.push((DE.ACTION_LABELS[action] || action) + " unavailable → attack");
		action = DE.actionAvailable(encounter, "occupy", "ai") ? "occupy" : "attack";
	}

	if (faction && faction.hostileTarget && F < 0.6) {
		var rH = DE.rngNext(state);
		debug.rolls.push({ label: "hostile mark force-attack", value: rH });
		if (rH < 0.35) {
			var forced = encounter.campRaid && DE.actionAvailable(encounter, "occupy", "ai") ? "occupy" : "attack";
			debug.overrides.push("Hostile mark: roll " + DE.pct(rH) + " < 35% and F<60% → force " + forced + " (was " + action + ")");
			action = forced;
		} else {
			debug.overrides.push("Hostile mark: roll " + DE.pct(rH) + " ≥ 35% → no force");
		}
	}
	if (encounter.intimidateMayTrade && F < 0.45 && T > 0.3) {
		debug.overrides.push("Post-intimidate trade window (F<45%, T>30%) → trade");
		action = "trade";
	}

	debug.reasons.unshift(
		"Fear sample " + DE.pct(F) + " in [" + DE.pct(stance.fearLo) + ", " + DE.pct(stance.fearHi) + "]" +
			" · CV them " + Math.round(fear.own) + " / you " + Math.round(fear.enemy) +
			(stance.leaderDeltaFear ? " · leader ΔF " + DE.pct(stance.leaderDeltaFear) : "")
	);
	debug.reasons.unshift(
		"Trust sample " + DE.pct(T) + " in [" + DE.pct(stance.trustLo) + ", " + DE.pct(stance.trustHi) + "]" +
			" · log center " + DE.pct(trust.center) + ", width " + DE.pct(trust.width) +
			(stance.leaderDeltaTrust ? " · leader ΔT " + DE.pct(stance.leaderDeltaTrust) : "")
	);
	debug.reasons.push("Chosen action: " + (DE.ACTION_LABELS[action] || action));

	var extra = {};
	if (action === "seize") extra.seize = DE.chooseSeizeTarget(state, encounter.playerStuff, encounter.playerUnits, encounter);
	if (action === "capture") {
		var cap = captureTarget();
		if (cap) extra.captureId = cap.id;
		else {
			debug.overrides.push("Capture had no target → attack");
			action = "attack";
		}
	}
	if (action === "gift") extra.gift = DE.chooseAiGift(state, encounter);
	return { action: action, extra: extra, fear: fear, trust: trust, debug: debug };
};

DE.formatWeightTable = function (weights) {
	var parts = [];
	var keys = Object.keys(weights);
	var total = 0;
	for (var i = 0; i < keys.length; i++) total += weights[keys[i]];
	for (var k = 0; k < keys.length; k++) {
		parts.push((DE.ACTION_LABELS[keys[k]] || keys[k]) + " " + Math.round(weights[keys[k]] * 100 / total) + "%");
	}
	return parts.join(", ");
};

DE.chooseSeizeTarget = function (state, stuff, units, encounter) {
	stuff = stuff || DE.emptyStuff();
	var options = [];
	if ((stuff.food || 0) > 0) options.push({ kind: "food" });
	if ((stuff.gold || 0) > 0) options.push({ kind: "gold" });
	var itemsOk = !encounter || DE.encounterAllowsItemTrade(encounter, state);
	if (itemsOk) {
		var weps = stuff.weapons || [];
		for (var i = 0; i < weps.length; i++) {
			if (DE.isWeaponKitType(weps[i])) options.push({ kind: "weapons", type: weps[i] });
		}
		var equipped = {};
		var list = units || [];
		for (var j = 0; j < list.length; j++) {
			if (list[j].equippedWeapons && !list[j].dead) equipped[list[j].type] = list[j];
		}
		var keys = Object.keys(equipped);
		for (var k = 0; k < keys.length; k++) {
			if (DE.isWeaponKitType(keys[k])) {
				options.push({ kind: "weapons", type: keys[k], unitId: equipped[keys[k]].id, equipped: true });
			}
		}
	}
	if (!options.length) return { kind: "gold" };
	return DE.rngPick(state, options);
};

DE.chooseAiGift = function (state, encounter) {
	var stuff = encounter.aiStuff || DE.emptyStuff();
	var gift = { gold: 0, food: 0, weapons: [], captives: [], advice: null };
	var faction = DE.factionById(state, encounter.factionId);
	if (faction && (faction.kind === "loner" || faction.monsterType)) {
		if (stuff.food > 0) gift.food = Math.min(stuff.food, 3 + DE.rngInt(state, 4));
		else if (stuff.gold >= 5) gift.gold = Math.min(stuff.gold, 5 + DE.rngInt(state, 11));
		return gift;
	}
	var unknown = DE.unknownMonsterAdviceKeys(state);
	var adviceChance = DE.adviceGiftChance(state);
	if (faction && faction.kind === "civilized" && unknown.length && DE.rngNext(state) < adviceChance) {
		gift.advice = DE.rngPick(state, unknown);
		return gift;
	}
	if (stuff.gold >= 10) gift.gold = Math.min(stuff.gold, 10 + DE.rngInt(state, 21));
	else if (stuff.food > 0) gift.food = Math.min(stuff.food, 2 + DE.rngInt(state, 4));
	else if ((stuff.weapons || []).length) {
		var kitGift = DE.filterWeaponKits(stuff.weapons);
		if (kitGift.length) gift.weapons = [kitGift[0]];
	}
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
