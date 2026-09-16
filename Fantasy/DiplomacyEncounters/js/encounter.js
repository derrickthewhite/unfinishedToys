var DE = DE || {};

DE.transferGift = function (fromStuff, toStuff, gift) {
	if (!gift) return { moved: false, value: 0 };
	gift = {
		gold: Math.min(gift.gold || 0, fromStuff.gold || 0),
		food: Math.min(gift.food || 0, fromStuff.food || 0),
		weapons: (gift.weapons || []).slice(),
		captives: (gift.captives || []).slice()
	};
	fromStuff.gold = (fromStuff.gold || 0) - gift.gold;
	toStuff.gold = (toStuff.gold || 0) + gift.gold;
	fromStuff.food = (fromStuff.food || 0) - gift.food;
	toStuff.food = (toStuff.food || 0) + gift.food;
	fromStuff.weapons = fromStuff.weapons || [];
	toStuff.weapons = toStuff.weapons || [];
	for (var i = 0; i < gift.weapons.length; i++) {
		var ix = fromStuff.weapons.indexOf(gift.weapons[i]);
		if (ix >= 0) {
			fromStuff.weapons.splice(ix, 1);
			toStuff.weapons.push(gift.weapons[i]);
		}
	}
	fromStuff.captives = fromStuff.captives || [];
	toStuff.captives = toStuff.captives || [];
	var movedCaps = [];
	for (var c = 0; c < gift.captives.length; c++) {
		var id = gift.captives[c].id || gift.captives[c];
		for (var j = 0; j < fromStuff.captives.length; j++) {
			if (fromStuff.captives[j].id === id || fromStuff.captives[j] === gift.captives[c]) {
				movedCaps.push(fromStuff.captives[j]);
				toStuff.captives.push(fromStuff.captives[j]);
				fromStuff.captives.splice(j, 1);
				break;
			}
		}
	}
	gift.captives = movedCaps;
	return { moved: true, value: DE.giftGoldEquivalent(gift), gift: gift };
};

DE.describeGiftContents = function (gift) {
	if (!gift) return "";
	var bits = [];
	if (gift.gold) bits.push(gift.gold + " gold");
	if (gift.food) bits.push(gift.food + " food");
	if (gift.weapons && gift.weapons.length) bits.push("weapons (" + gift.weapons.join(", ") + ")");
	if (gift.captives && gift.captives.length) bits.push(gift.captives.length + " captive(s)");
	return bits.length ? " (" + bits.join(", ") + ")" : "";
};

DE.applySeize = function (fromStuff, toStuff, fromUnits, seize) {
	if (!seize) return { ok: false };
	if (seize.kind === "food") {
		var food = Math.floor((fromStuff.food || 0) / 2);
		fromStuff.food -= food;
		toStuff.food = (toStuff.food || 0) + food;
		return { ok: true, kind: "food", amount: food };
	}
	if (seize.kind === "gold") {
		var gold = Math.floor((fromStuff.gold || 0) / 2);
		fromStuff.gold -= gold;
		toStuff.gold = (toStuff.gold || 0) + gold;
		return { ok: true, kind: "gold", amount: gold };
	}
	if (seize.kind === "weapons") {
		var type = seize.type;
		fromStuff.weapons = fromStuff.weapons || [];
		toStuff.weapons = toStuff.weapons || [];
		var ix = fromStuff.weapons.indexOf(type);
		if (ix >= 0) fromStuff.weapons.splice(ix, 1);
		if (toStuff.weapons.indexOf(type) < 0) toStuff.weapons.push(type);
		var casualtyUnit = null;
		if (seize.equipped || seize.unitId) {
			for (var i = 0; i < (fromUnits || []).length; i++) {
				var u = fromUnits[i];
				if (u.dead) continue;
				if (seize.unitId && u.id === seize.unitId) casualtyUnit = u;
				else if (!seize.unitId && u.type === type && u.equippedWeapons) casualtyUnit = u;
				if (casualtyUnit) break;
			}
		}
		return { ok: true, kind: "weapons", type: type, casualtyUnit: casualtyUnit };
	}
	return { ok: false };
};

DE.takeCaptive = function (fromUnits, toStuff, unitId) {
	if (!unitId) return null;
	toStuff.captives = toStuff.captives || [];
	for (var i = 0; i < fromUnits.length; i++) {
		if (fromUnits[i].id === unitId) {
			var u = fromUnits[i];
			u.dead = true;
			u.wounded = false;
			toStuff.captives.push({
				id: u.id,
				type: u.type,
				species: u.species,
				factionId: u.factionId
			});
			return u;
		}
	}
	return null;
};

DE.holdNone = function () { return { player: false, ai: false }; };
DE.holdPlayer = function () { return { player: true, ai: false }; };
DE.holdAi = function () { return { player: false, ai: true }; };
DE.holdBoth = function () { return { player: true, ai: true }; };

DE.resolveRound = function (state, encounter, playerAct, aiAct, extras) {
	extras = extras || {};
	var pCls = DE.actionClass(playerAct);
	var aCls = DE.actionClass(aiAct);
	var result = {
		playerAction: playerAct,
		aiAction: aiAct,
		hold: DE.holdNone(),
		another: false,
		trade: false,
		battle: null,
		notes: [],
		seize: null,
		capture: null,
		gift: null,
		intimidateMayTrade: false,
		displayBattle: false
	};

	var last = encounter.lastPair;
	var repeatIntimidateOpen = last && (
		(last.player === "intimidate" && DE.actionClass(last.ai) === "open") ||
		(last.ai === "intimidate" && DE.actionClass(last.player) === "open")
	) && (
		(playerAct === "intimidate" && aCls === "open") ||
		(aiAct === "intimidate" && pCls === "open")
	);

	if (repeatIntimidateOpen) {
		if (playerAct === "intimidate") result.hold = DE.holdPlayer();
		else result.hold = DE.holdAi();
		result.notes.push("Intimidate holds after a repeated standoff.");
		return result;
	}

	if (playerAct === "intimidate" && aiAct === "intimidate") {
		var r = DE.rngNext(state);
		if (r < 0.15) {
			result.battle = DE.resolveBattle(state, encounter.playerUnits, encounter.aiUnits, { bothCasualtyDelta: -0.05 });
			result.hold = result.battle.winner === "player" ? DE.holdPlayer() : DE.holdAi();
			result.notes.push("The staredown snaps into a fight.");
		} else if (r < 0.50) {
			result.battle = DE.resolveBattle(state, encounter.playerUnits, encounter.aiUnits, { zeroCasualties: true, display: true });
			result.displayBattle = true;
			result.hold = result.battle.winner === "player" ? DE.holdPlayer() : DE.holdAi();
			result.notes.push("A clash of presence, no blood. The winner keeps the ground.");
		} else {
			result.another = true;
			result.notes.push("Neither side blinks. Another move.");
		}
		return result;
	}

	if (pCls === "assault" && aCls === "assault") {
		return DE.finishAssault(state, encounter, extras, result, {
			bothCasualtyDelta: 0.05
		});
	}

	if (pCls === "assault" && aCls === "open") {
		return DE.finishAssault(state, encounter, extras, result, {
			attacker: "player",
			attackerBonus: 0.20,
			aiCasualtyDeltaIfLose: 0.05
		});
	}
	if (aCls === "assault" && pCls === "open") {
		return DE.finishAssault(state, encounter, extras, result, {
			attacker: "ai",
			attackerBonus: 0.20,
			playerCasualtyDeltaIfLose: 0.05
		});
	}

	if (pCls === "assault" && (aiAct === "intimidate" || aiAct === "retreat")) {
		return DE.finishAssault(state, encounter, extras, result, { bothCasualtyDelta: -0.05 });
	}
	if (aCls === "assault" && (playerAct === "intimidate" || playerAct === "retreat")) {
		return DE.finishAssault(state, encounter, extras, result, { bothCasualtyDelta: -0.05 });
	}

	if (pCls === "assault" && aiAct === "run") {
		return DE.finishRunFromAssault(state, encounter, extras, result, "player");
	}
	if (aCls === "assault" && playerAct === "run") {
		return DE.finishRunFromAssault(state, encounter, extras, result, "ai");
	}

	if (playerAct === "intimidate" && (aiAct === "retreat" || aiAct === "run")) {
		result.hold = DE.holdPlayer();
		result.notes.push("They give the ground. You hold.");
		return result;
	}
	if (aiAct === "intimidate" && (playerAct === "retreat" || playerAct === "run")) {
		result.hold = DE.holdAi();
		result.notes.push("You give the ground.");
		return result;
	}

	if (playerAct === "intimidate" && aCls === "open") {
		result.another = true;
		if (aiAct === "gift" || aiAct === "trade") result.intimidateMayTrade = true;
		result.notes.push("You hold a hard line. They stay open. Another move.");
		return result;
	}
	if (aiAct === "intimidate" && pCls === "open") {
		result.another = true;
		if (playerAct === "gift" || playerAct === "trade") result.intimidateMayTrade = true;
		result.notes.push("They hold a hard line. Another move.");
		return result;
	}

	if ((playerAct === "retreat" || playerAct === "run") && (aiAct === "retreat" || aiAct === "run")) {
		if (playerAct === "retreat" && aiAct === "run") {
			result.hold = DE.holdPlayer();
			result.notes.push("You withdraw ready to fight. They flee. You hold.");
		} else if (aiAct === "retreat" && playerAct === "run") {
			result.hold = DE.holdAi();
			result.notes.push("They withdraw ready to fight. You flee.");
		} else {
			result.hold = DE.holdNone();
			result.notes.push("Both sides melt back into the dark.");
		}
		return result;
	}

	if ((playerAct === "retreat" || playerAct === "run") && aCls === "open") {
		result.hold = DE.holdAi();
		result.notes.push("You leave. They keep the ground.");
		return result;
	}
	if ((aiAct === "retreat" || aiAct === "run") && pCls === "open") {
		result.hold = DE.holdPlayer();
		result.notes.push("They leave. You keep the ground.");
		return result;
	}

	if (pCls === "open" && aCls === "open") {
		result.hold = DE.holdBoth();
		var greetGreet = playerAct === "greet" && aiAct === "greet";
		if (greetGreet) {
			result.another = true;
			result.notes.push("A greeting is returned. You may speak again — trade is open.");
		} else {
			result.trade = true;
			result.notes.push("Hands open. Trading can begin.");
		}
		if (playerAct === "gift" && extras.playerGift) {
			var acc = DE.aiAcceptsGift(state, encounter, extras.playerGift);
			if (acc) {
				result.gift = DE.transferGift(encounter.playerStuff, encounter.aiStuff, extras.playerGift);
				result.notes.push("They take the gift (worth " + result.gift.value + "g).");
			} else result.notes.push("They decline the gift, but stay.");
		}
		if (aiAct === "gift" && extras.aiGift) {
			var given = DE.transferGift(encounter.aiStuff, encounter.playerStuff, extras.aiGift);
			result.gift = given;
			result.notes.push("They offer a gift worth " + given.value + "g" + DE.describeGiftContents(given.gift) + ".");
		}
		return result;
	}

	result.another = true;
	result.notes.push("The moment hangs. Another move.");
	return result;
};

DE.finishRunFromAssault = function (state, encounter, extras, result, assaulter) {
	var escaped = DE.rngNext(state) < 0.5;
	var runnerIsPlayer = assaulter === "ai";
	if (escaped) {
		result.hold = assaulter === "player" ? DE.holdPlayer() : DE.holdAi();
		result.notes.push("The flight works. No blood.");
		return result;
	}
	var runnerUnits = runnerIsPlayer ? encounter.playerUnits : encounter.aiUnits;
	var opponentUnits = runnerIsPlayer ? encounter.aiUnits : encounter.playerUnits;
	var inflict = DE.sideStrength(opponentUnits, runnerUnits, state);
	var hit = DE.pickCasualties(state, runnerUnits, inflict * 0.40, []);
	var fates = [];
	for (var i = 0; i < hit.units.length; i++) {
		fates.push({
			id: hit.units[i].id,
			type: hit.units[i].type,
			fate: DE.applyCasualtyFate(state, hit.units[i], false)
		});
	}
	result.battle = {
		winner: assaulter,
		display: false,
		playerCasualties: runnerIsPlayer ? fates : [],
		aiCasualties: runnerIsPlayer ? [] : fates,
		playerStrength: DE.sideStrength(encounter.playerUnits, encounter.aiUnits, state),
		aiStrength: DE.sideStrength(encounter.aiUnits, encounter.playerUnits, state)
	};
	result.hold = assaulter === "player" ? DE.holdPlayer() : DE.holdAi();
	result.notes.push("Caught in the dark. Casualties on the flight.");
	if (typeof console !== "undefined" && console.log) {
		console.log("[DE combat] Run caught. Inflictor strength " + inflict + " × 0.40 casualty budget. Hits: " +
			fates.map(function (c) { return c.type + " " + c.fate; }).join(", "));
	}
	DE.healSide(encounter.playerUnits);
	DE.healSide(encounter.aiUnits);
	if (DE.rngNext(state) < 0.5) {
		DE.applyAssaultSpoils(state, encounter, extras, result, assaulter);
	}
	return result;
};

DE.applyAssaultSpoils = function (state, encounter, extras, result, winner) {
	var winAct = winner === "player" ? extras.playerAction || result.playerAction : extras.aiAction || result.aiAction;
	if (winner === "player" && extras.playerAction) winAct = extras.playerAction;
	if (winAct !== "seize" && winAct !== "capture") {
		if (result.playerAction === "seize" && winner === "player") winAct = "seize";
		if (result.aiAction === "seize" && winner === "ai") winAct = "seize";
		if (result.playerAction === "capture" && winner === "player") winAct = "capture";
		if (result.aiAction === "capture" && winner === "ai") winAct = "capture";
	}
	if (winAct === "seize") {
		var seize = winner === "player" ? extras.playerSeize : extras.aiSeize;
		var fromS = winner === "player" ? encounter.aiStuff : encounter.playerStuff;
		var toS = winner === "player" ? encounter.playerStuff : encounter.aiStuff;
		var fromU = winner === "player" ? encounter.aiUnits : encounter.playerUnits;
		result.seize = DE.applySeize(fromS, toS, fromU, seize);
		if (result.seize && result.seize.casualtyUnit) {
			DE.applyCasualtyFate(state, result.seize.casualtyUnit, false);
		}
		result.notes.push("Seize succeeds.");
	}
	if (winAct === "capture") {
		var capId = winner === "player" ? extras.playerCaptureId : extras.aiCaptureId;
		var fromUnits = winner === "player" ? encounter.aiUnits : encounter.playerUnits;
		var toStuff = winner === "player" ? encounter.playerStuff : encounter.aiStuff;
		result.capture = DE.takeCaptive(fromUnits, toStuff, capId);
		if (result.capture) result.notes.push("A captive is taken.");
	}
};

DE.finishAssault = function (state, encounter, extras, result, battleOpts) {
	battleOpts = battleOpts || {};
	var pLoseExtra = battleOpts.playerCasualtyDeltaIfLose || 0;
	var aLoseExtra = battleOpts.aiCasualtyDeltaIfLose || 0;
	var opts = {
		attacker: battleOpts.attacker,
		attackerBonus: battleOpts.attackerBonus || 0,
		bothCasualtyDelta: battleOpts.bothCasualtyDelta || 0,
		preferPlayerIds: [],
		preferAiIds: []
	};
	if (result.playerAction === "capture" && extras.playerCaptureId) opts.preferAiIds.push(extras.playerCaptureId);
	if (result.aiAction === "capture" && extras.aiCaptureId) opts.preferPlayerIds.push(extras.aiCaptureId);
	if (result.playerAction === "seize" && extras.playerSeize && extras.playerSeize.unitId) {
		opts.preferAiIds.push(extras.playerSeize.unitId);
	}
	if (result.aiAction === "seize" && extras.aiSeize && extras.aiSeize.unitId) {
		opts.preferPlayerIds.push(extras.aiSeize.unitId);
	}
	var preview = DE.sideStrength(encounter.playerUnits, encounter.aiUnits, state);
	var previewA = DE.sideStrength(encounter.aiUnits, encounter.playerUnits, state);
	if (battleOpts.attacker === "player") {
		/* applied inside resolveBattle */
	}
	result.battle = DE.resolveBattle(state, encounter.playerUnits, encounter.aiUnits, opts);
	if (result.battle.winner === "player" && aLoseExtra) {
		var extra = DE.pickCasualties(state, encounter.aiUnits, preview * aLoseExtra, []);
		for (var i = 0; i < extra.units.length; i++) {
			var f = DE.applyCasualtyFate(state, extra.units[i], false);
			result.battle.aiCasualties.push({ id: extra.units[i].id, type: extra.units[i].type, fate: f });
		}
	}
	if (result.battle.winner === "ai" && pLoseExtra) {
		var extraP = DE.pickCasualties(state, encounter.playerUnits, previewA * pLoseExtra, []);
		for (var j = 0; j < extraP.units.length; j++) {
			var fp = DE.applyCasualtyFate(state, extraP.units[j], false);
			result.battle.playerCasualties.push({ id: extraP.units[j].id, type: extraP.units[j].type, fate: fp });
		}
	}
	result.hold = result.battle.winner === "player" ? DE.holdPlayer() : DE.holdAi();
	result.notes.push("Steel in the dark.");
	DE.applyAssaultSpoils(state, encounter, extras, result, result.battle.winner);
	return result;
};

DE.lootBattleWeapons = function (encounter, result) {
	if (!result || !result.battle || result.displayBattle || result.battle.display) return [];
	var fromEnemy = DE.weaponDropsFromFates(encounter.aiUnits, result.battle.aiCasualties);
	var fromYou = DE.weaponDropsFromFates(encounter.playerUnits, result.battle.playerCasualties);
	if (result.seize && result.seize.casualtyUnit && result.seize.casualtyUnit.dead && DE.unitDropsWeapon(result.seize.casualtyUnit)) {
		fromEnemy.push(result.seize.casualtyUnit.type);
	}
	DE.addWeaponDrops(encounter.playerStuff, fromEnemy);
	DE.addWeaponDrops(encounter.aiStuff, fromYou);
	if (fromEnemy.length) result.notes.push("Salvaged weapons: " + fromEnemy.join(", "));
	return fromEnemy;
};
