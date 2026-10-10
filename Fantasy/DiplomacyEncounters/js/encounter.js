var DE = DE || {};

DE.transferGift = function (fromStuff, toStuff, gift, state) {
	if (!gift) return { moved: false, value: 0 };
	var advice = gift.advice || null;
	gift = {
		gold: Math.min(gift.gold || 0, fromStuff.gold || 0),
		food: Math.min(gift.food || 0, fromStuff.food || 0),
		weapons: (gift.weapons || []).slice(),
		captives: (gift.captives || []).slice(),
		advice: advice
	};
	fromStuff.gold = (fromStuff.gold || 0) - gift.gold;
	toStuff.gold = (toStuff.gold || 0) + gift.gold;
	fromStuff.food = (fromStuff.food || 0) - gift.food;
	toStuff.food = (toStuff.food || 0) + gift.food;
	fromStuff.weapons = fromStuff.weapons || [];
	toStuff.weapons = toStuff.weapons || [];
	var movedWeapons = [];
	for (var i = 0; i < gift.weapons.length; i++) {
		if (!DE.isWeaponKitType(gift.weapons[i])) continue;
		var ix = fromStuff.weapons.indexOf(gift.weapons[i]);
		if (ix >= 0) {
			fromStuff.weapons.splice(ix, 1);
			toStuff.weapons.push(gift.weapons[i]);
			movedWeapons.push(gift.weapons[i]);
		}
	}
	gift.weapons = movedWeapons;
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
	if (gift.advice && state) {
		DE.markMonsterKnown(state, gift.advice);
		DE.appendChronicle(state, "Received advice about " + DE.formatMonsterAdvice(state, gift.advice) + ".");
	}
	var moved = !!(gift.gold || gift.food || gift.weapons.length || gift.captives.length || gift.advice);
	return { moved: moved, value: DE.giftGoldEquivalent(gift), gift: gift };
};

DE.describeGiftContents = function (gift, state) {
	if (!gift) return "";
	var bits = [];
	if (gift.gold) bits.push(gift.gold + " gold");
	if (gift.food) bits.push(gift.food + " food");
	if (gift.weapons && gift.weapons.length) bits.push("weapons (" + gift.weapons.join(", ") + ")");
	if (gift.captives && gift.captives.length) bits.push(gift.captives.length + " captive(s)");
	if (gift.advice) {
		bits.push("advice about " + (state ? DE.formatMonsterAdvice(state, gift.advice) : (DE.SPECIES_LABELS[gift.advice] || gift.advice)));
	}
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
		if (!DE.isWeaponKitType(type)) return { ok: false, reason: "Not a weapon kit" };
		fromStuff.weapons = fromStuff.weapons || [];
		toStuff.weapons = toStuff.weapons || [];
		var casualtyUnit = null;
		if (seize.equipped || seize.unitId) {
			for (var i = 0; i < (fromUnits || []).length; i++) {
				var u = fromUnits[i];
				if (!u) continue;
				if (seize.unitId && u.id === seize.unitId) {
					casualtyUnit = u;
					break;
				}
				if (!seize.unitId && !u.dead && u.type === type && u.equippedWeapons) {
					casualtyUnit = u;
					break;
				}
			}
		}
		var ix = fromStuff.weapons.indexOf(type);
		if (ix >= 0) {
			fromStuff.weapons.splice(ix, 1);
		} else if (!casualtyUnit) {
			return { ok: false, reason: "No such kit" };
		}
		toStuff.weapons.push(type);
		if (casualtyUnit) {
			casualtyUnit.equippedWeapons = false;
			casualtyUnit.previousType = casualtyUnit.previousType || casualtyUnit.type;
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
			toStuff.captives.push(DE.makeCaptiveRecord(u));
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
	var lastP = last ? DE.actionClass(last.player) : null;
	var lastA = last ? DE.actionClass(last.ai) : null;
	var repeatIntimidateOpen = last && (
		(lastP === "intimidate" && lastA === "open") ||
		(lastA === "intimidate" && lastP === "open")
	) && (
		(pCls === "intimidate" && aCls === "open") ||
		(aCls === "intimidate" && pCls === "open")
	);

	if (repeatIntimidateOpen) {
		if (pCls === "intimidate") {
			result.hold = DE.holdPlayer();
			return DE.applyAftermath(result, "intimidate_open_repeat_you");
		}
		result.hold = DE.holdAi();
		return DE.applyAftermath(result, "intimidate_open_repeat_they");
	}

	if (pCls === "intimidate" && aCls === "intimidate") {
		var r = DE.rngNext(state);
		if (r < 0.15) {
			result.battle = DE.resolveBattle(state, encounter.playerUnits, encounter.aiUnits, { bothCasualtyDelta: -0.05 });
			result.hold = result.battle.winner === "player" ? DE.holdPlayer() : DE.holdAi();
			return DE.applyAftermath(result, result.battle.winner === "player"
				? "intimidate_intimidate_fight_youWin"
				: "intimidate_intimidate_fight_theyWin");
		} else if (r < 0.50) {
			result.battle = DE.resolveBattle(state, encounter.playerUnits, encounter.aiUnits, { zeroCasualties: true, display: true });
			result.displayBattle = true;
			result.hold = result.battle.winner === "player" ? DE.holdPlayer() : DE.holdAi();
			return DE.applyAftermath(result, result.battle.winner === "player"
				? "intimidate_intimidate_display_youWin"
				: "intimidate_intimidate_display_theyWin");
		} else {
			result.another = true;
			return DE.applyAftermath(result, "intimidate_intimidate_stalemate");
		}
	}

	if (pCls === "assault" && aCls === "assault") {
		return DE.finishAssault(state, encounter, extras, result, {
			bothCasualtyDelta: 0.05,
			aftermathBase: "assault_assault"
		});
	}

	if (pCls === "assault" && aCls === "open") {
		return DE.finishAssault(state, encounter, extras, result, {
			attacker: "player",
			attackerBonus: 0.20,
			aiCasualtyDeltaIfLose: 0.05,
			aftermathBase: "assault_open"
		});
	}
	if (aCls === "assault" && pCls === "open") {
		return DE.finishAssault(state, encounter, extras, result, {
			attacker: "ai",
			attackerBonus: 0.20,
			playerCasualtyDeltaIfLose: 0.05,
			aftermathBase: "open_assault"
		});
	}

	if (pCls === "assault" && (aCls === "intimidate" || aCls === "retreat")) {
		return DE.finishAssault(state, encounter, extras, result, {
			bothCasualtyDelta: -0.05,
			aftermathBase: "assault_ready"
		});
	}
	if (aCls === "assault" && (pCls === "intimidate" || pCls === "retreat")) {
		return DE.finishAssault(state, encounter, extras, result, {
			bothCasualtyDelta: -0.05,
			aftermathBase: "ready_assault"
		});
	}

	if (pCls === "assault" && aiAct === "run") {
		return DE.finishRunFromAssault(state, encounter, extras, result, "player");
	}
	if (aCls === "assault" && playerAct === "run") {
		return DE.finishRunFromAssault(state, encounter, extras, result, "ai");
	}

	if (pCls === "intimidate" && (aiAct === "retreat" || aiAct === "run")) {
		result.hold = DE.holdPlayer();
		return DE.applyAftermath(result, "intimidate_retreat_you");
	}
	if (aCls === "intimidate" && (playerAct === "retreat" || playerAct === "run")) {
		result.hold = DE.holdAi();
		return DE.applyAftermath(result, "intimidate_retreat_they");
	}

	if (pCls === "intimidate" && aCls === "open") {
		result.another = true;
		if (aiAct === "gift" || aiAct === "trade") result.intimidateMayTrade = true;
		return DE.applyAftermath(result, "intimidate_open_first_you");
	}
	if (aCls === "intimidate" && pCls === "open") {
		result.another = true;
		if (playerAct === "gift" || playerAct === "trade") result.intimidateMayTrade = true;
		return DE.applyAftermath(result, "intimidate_open_first_they");
	}

	if ((playerAct === "retreat" || playerAct === "run") && (aiAct === "retreat" || aiAct === "run")) {
		if (playerAct === "retreat" && aiAct === "run") {
			result.hold = DE.holdPlayer();
			return DE.applyAftermath(result, "retreat_run_youRetreat");
		} else if (aiAct === "retreat" && playerAct === "run") {
			result.hold = DE.holdAi();
			return DE.applyAftermath(result, "run_retreat_youRun");
		} else {
			result.hold = DE.holdNone();
			return DE.applyAftermath(result, "both_withdraw");
		}
	}

	if ((playerAct === "retreat" || playerAct === "run") && aCls === "open") {
		result.hold = DE.holdAi();
		return DE.applyAftermath(result, "withdraw_open_youLeave");
	}
	if ((aiAct === "retreat" || aiAct === "run") && pCls === "open") {
		result.hold = DE.holdPlayer();
		return DE.applyAftermath(result, "withdraw_open_theyLeave");
	}

	if (pCls === "open" && aCls === "open") {
		result.hold = DE.holdBoth();
		result.trade = true;
		var giftVars = { gift: "", giftOffer: "a gift" };
		var playerAccepted = null;
		if (playerAct === "gift" && extras.playerGift) {
			giftVars.giftOffer = DE.giftOfferBrief(extras.playerGift, state);
			var acc = DE.aiAcceptsGift(state, encounter, extras.playerGift);
			if (acc) {
				result.gift = DE.transferGift(encounter.playerStuff, encounter.aiStuff, extras.playerGift, null);
				playerAccepted = true;
				giftVars.gift = DE.describeGiftContents(result.gift && result.gift.gift, state);
			} else {
				playerAccepted = false;
			}
		}
		if (aiAct === "gift" && extras.aiGift) {
			var given = DE.transferGift(encounter.aiStuff, encounter.playerStuff, extras.aiGift, state);
			result.gift = given;
			giftVars.gift = DE.describeGiftContents(given.gift, state);
		}
		DE.applyAftermath(result, DE.openOpenAftermathKey(playerAct, aiAct), giftVars);
		if (playerAccepted === true) DE.appendAftermath(result, "gift_accepted");
		if (playerAccepted === false) DE.appendAftermath(result, "gift_declined");
		return result;
	}

	result.another = true;
	return DE.applyAftermath(result, "fallback_another");
};

DE.finishRunFromAssault = function (state, encounter, extras, result, assaulter) {
	var runnerIsPlayer = assaulter === "ai";
	var escaped = DE.rngNext(state) < DE.runEscapeChance(encounter, runnerIsPlayer);
	var baseKey = assaulter === "player" ? "assault_run" : "run_assault";
	if (escaped) {
		result.hold = assaulter === "player" ? DE.holdPlayer() : DE.holdAi();
		return DE.applyAftermath(result, baseKey + "_escape");
	}
	var runnerUnits = runnerIsPlayer ? encounter.playerUnits : encounter.aiUnits;
	var opponentUnits = runnerIsPlayer ? encounter.aiUnits : encounter.playerUnits;
	var inflict = DE.sideStrength(opponentUnits, runnerUnits, state);
	var hit = DE.pickCasualties(state, runnerUnits, inflict * 0.40, [], {
		skipCivilians: DE.actionClass(assaulter === "player" ? result.playerAction : result.aiAction) !== "assault"
	});
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
	if (typeof console !== "undefined" && console.log) {
		console.log("[DE combat] Run caught. Inflictor strength " + inflict + " × 0.40 casualty budget. Hits: " +
			fates.map(function (c) { return c.type + " " + c.fate; }).join(", "));
	}
	DE.healSide(encounter.playerUnits);
	DE.healSide(encounter.aiUnits);
	if (DE.rngNext(state) < 0.5) {
		DE.applyAssaultSpoils(state, encounter, extras, result, assaulter);
	}
	DE.applyOccupyIfHeld(state, encounter, result, assaulter);
	var vars = {
		seize: DE.describeSeizeBrief(result.seize),
		unit: DE.describeCaptiveBrief(result.capture)
	};
	var spoil = DE.assaultSpoilKey(baseKey + "_caught", result, assaulter);
	DE.applyAftermath(result, spoil.key, vars);
	if (spoil.extra) DE.appendAftermath(result, spoil.extra, vars);
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
			var seizeUnit = result.seize.casualtyUnit;
			var alreadyHit = seizeUnit.dead || seizeUnit.wounded;
			if (!alreadyHit) {
				DE.applyCasualtyFate(state, seizeUnit, false);
			}
			DE.rewriteCasualtyFate(
				winner === "player" ? (result.battle && result.battle.aiCasualties) : (result.battle && result.battle.playerCasualties),
				seizeUnit,
				seizeUnit.dead ? "dead" : (seizeUnit.wounded ? "wounded" : null)
			);
		}
	}
	if (winAct === "capture") {
		var capId = winner === "player" ? extras.playerCaptureId : extras.aiCaptureId;
		var fromUnits = winner === "player" ? encounter.aiUnits : encounter.playerUnits;
		var toStuff = winner === "player" ? encounter.playerStuff : encounter.aiStuff;
		result.capture = DE.takeCaptive(fromUnits, toStuff, capId);
		if (result.capture) {
			result.capture.wounded = false;
			DE.rewriteCasualtyFate(
				winner === "player" ? (result.battle && result.battle.aiCasualties) : (result.battle && result.battle.playerCasualties),
				result.capture,
				"captured"
			);
			if (winner === "player" && state) {
				DE.onPoliticsCapture(state, result.capture.factionId || encounter.factionId);
			}
		}
	}
};

DE.rewriteCasualtyFate = function (casualties, unit, fate) {
	if (!unit || !fate) return;
	casualties = casualties || [];
	for (var i = 0; i < casualties.length; i++) {
		if (casualties[i].id === unit.id) {
			casualties[i].fate = fate;
			return;
		}
	}
	casualties.push({ id: unit.id, type: unit.type, fate: fate });
};

DE.transferAllStuff = function (fromStuff, toStuff) {
	fromStuff = fromStuff || DE.emptyStuff();
	toStuff = toStuff || DE.emptyStuff();
	var moved = {
		gold: fromStuff.gold || 0,
		food: fromStuff.food || 0,
		magic: fromStuff.magic || 0,
		weapons: (fromStuff.weapons || []).slice(),
		captives: (fromStuff.captives || []).slice()
	};
	toStuff.gold = (toStuff.gold || 0) + moved.gold;
	toStuff.food = (toStuff.food || 0) + moved.food;
	toStuff.magic = (toStuff.magic || 0) + moved.magic;
	toStuff.weapons = (toStuff.weapons || []).concat(moved.weapons);
	toStuff.captives = (toStuff.captives || []).concat(moved.captives);
	fromStuff.gold = 0;
	fromStuff.food = 0;
	fromStuff.magic = 0;
	fromStuff.weapons = [];
	fromStuff.captives = [];
	return moved;
};

DE.applyOccupyIfHeld = function (state, encounter, result, winner) {
	if (!result || !winner) return null;
	var winAct = winner === "player" ? result.playerAction : result.aiAction;
	if (winAct !== "occupy") return null;
	var holder = winner === "player" ? result.hold && result.hold.player : result.hold && result.hold.ai;
	if (!holder) return null;
	var fromS = winner === "player" ? encounter.aiStuff : encounter.playerStuff;
	var toS = winner === "player" ? encounter.playerStuff : encounter.aiStuff;
	result.occupy = DE.transferAllStuff(fromS, toS);
	var nCaps = (result.occupy.captives || []).length;
	var bits = [];
	if (result.occupy.gold) bits.push(result.occupy.gold + "g");
	if (result.occupy.food) bits.push(result.occupy.food + " food");
	if ((result.occupy.weapons || []).length) bits.push(result.occupy.weapons.length + " kit(s)");
	if (nCaps) bits.push(nCaps + " captive(s)");
	result.notes = result.notes || [];
	result.notes.push(bits.length ? ("Occupied the site (" + bits.join(", ") + ").") : "Occupied the site.");
	return result.occupy;
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
		preferAiIds: [],
		encounter: encounter,
		playerAction: result.playerAction,
		aiAction: result.aiAction
	};
	if (result.playerAction === "capture" && extras.playerCaptureId) opts.preferAiIds.push(extras.playerCaptureId);
	if (result.aiAction === "capture" && extras.aiCaptureId) opts.preferPlayerIds.push(extras.aiCaptureId);
	if (result.playerAction === "seize" && extras.playerSeize && extras.playerSeize.unitId) {
		opts.preferAiIds.push(extras.playerSeize.unitId);
	}
	if (result.aiAction === "seize" && extras.aiSeize && extras.aiSeize.unitId) {
		opts.preferPlayerIds.push(extras.aiSeize.unitId);
	}
	var preview = DE.sideStrength(encounter.playerUnits, encounter.aiUnits, state, DE.combatSideOpts(encounter, result.playerAction, result.aiAction, "player"));
	var previewA = DE.sideStrength(encounter.aiUnits, encounter.playerUnits, state, DE.combatSideOpts(encounter, result.playerAction, result.aiAction, "ai"));
	result.battle = DE.resolveBattle(state, encounter.playerUnits, encounter.aiUnits, opts);
	if (result.battle.winner === "player" && aLoseExtra) {
		var extra = DE.pickCasualties(state, encounter.aiUnits, preview * aLoseExtra, [], {
			skipCivilians: DE.actionClass(result.playerAction) !== "assault"
		});
		for (var i = 0; i < extra.units.length; i++) {
			var f = DE.applyCasualtyFate(state, extra.units[i], false);
			result.battle.aiCasualties.push({ id: extra.units[i].id, type: extra.units[i].type, fate: f });
		}
	}
	if (result.battle.winner === "ai" && pLoseExtra) {
		var extraP = DE.pickCasualties(state, encounter.playerUnits, previewA * pLoseExtra, [], {
			skipCivilians: DE.actionClass(result.aiAction) !== "assault"
		});
		for (var j = 0; j < extraP.units.length; j++) {
			var fp = DE.applyCasualtyFate(state, extraP.units[j], false);
			result.battle.playerCasualties.push({ id: extraP.units[j].id, type: extraP.units[j].type, fate: fp });
		}
	}
	result.hold = result.battle.winner === "player" ? DE.holdPlayer() : DE.holdAi();
	DE.applyAssaultSpoils(state, encounter, extras, result, result.battle.winner);
	DE.applyOccupyIfHeld(state, encounter, result, result.battle.winner);
	var base = battleOpts.aftermathBase || "assault_assault";
	var winKey = result.battle.winner === "player" ? "youWin" : "theyWin";
	var vars = {
		seize: DE.describeSeizeBrief(result.seize),
		unit: DE.describeCaptiveBrief(result.capture)
	};
	var spoil = DE.assaultSpoilKey(base + "_" + winKey, result, result.battle.winner);
	DE.applyAftermath(result, spoil.key, vars);
	if (spoil.extra) DE.appendAftermath(result, spoil.extra, vars);
	return result;
};

DE.lootBattleWeapons = function (encounter, result) {
	if (!result || !result.battle || result.displayBattle || result.battle.display) return [];
	var skipIds = {};
	if (result.capture && result.capture.id) skipIds[result.capture.id] = true;
	if (result.seize && result.seize.kind === "weapons" && result.seize.casualtyUnit && result.seize.casualtyUnit.id) {
		/* Kit already moved by seize — do not salvage it again from the bearer. */
		skipIds[result.seize.casualtyUnit.id] = true;
	}
	var fromEnemy = DE.weaponDropsFromFates(encounter.aiUnits, result.battle.aiCasualties, skipIds);
	var fromYou = DE.weaponDropsFromFates(encounter.playerUnits, result.battle.playerCasualties, skipIds);
	DE.addWeaponDrops(encounter.playerStuff, fromEnemy);
	DE.addWeaponDrops(encounter.aiStuff, fromYou);
	if (fromEnemy.length) DE.appendAftermath(result, "salvage_weapons", { weapons: fromEnemy.join(", ") });
	return fromEnemy;
};
