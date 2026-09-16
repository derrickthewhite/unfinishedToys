var DE = DE || {};

DE.playerLiving = function (state) {
	return DE.livingUnits(state.player.units);
};

DE.FOOD_GOLD_COST = 0.5;

DE.recruitCost = function (type) {
	return DE.unitStuffPrice(type);
};

DE.knownUnitTypes = function (state) {
	var known = { infantry: true, machineGunner: true };
	var list = state.player.knownTypes || [];
	for (var i = 0; i < list.length; i++) known[list[i]] = true;
	return known;
};

DE.canRecruit = function (state, type) {
	return !!DE.knownUnitTypes(state)[type];
};

DE.recruitUnit = function (state, type) {
	if (!DE.canRecruit(state, type)) return { ok: false, reason: "No one trained for that role yet" };
	var cost = DE.recruitCost(type);
	if (state.player.gold < cost) return { ok: false, reason: "Not enough gold" };
	state.player.gold -= cost;
	var foreign = type !== "infantry" && type !== "machineGunner";
	state.player.units.push(DE.makeUnit(state, type, "human", "player", { foreignWeapons: foreign }));
	return { ok: true };
};

DE.buyWeaponSet = function (state, type) {
	if (!type || type === "civilian") return { ok: false, reason: "Cannot buy that set" };
	var cost = DE.unitStuffPrice(type);
	if (state.player.gold < cost) return { ok: false, reason: "Not enough gold" };
	state.player.weapons = state.player.weapons || [];
	state.player.gold -= cost;
	state.player.weapons.push(type);
	return { ok: true, cost: cost };
};

DE.reequipUnit = function (state, unitId) {
	var u = null;
	for (var i = 0; i < state.player.units.length; i++) {
		if (state.player.units[i].id === unitId) u = state.player.units[i];
	}
	if (!u || u.dead || u.type !== "civilian" || !u.previousType) {
		return { ok: false, reason: "Nothing to reequip" };
	}
	var type = u.previousType;
	var weps = state.player.weapons || [];
	var ix = weps.indexOf(type);
	if (ix < 0) return { ok: false, reason: "Need a " + type + " weapon set in camp" };
	weps.splice(ix, 1);
	u.type = type;
	u.previousType = null;
	u.equippedWeapons = true;
	return { ok: true };
};

DE.startTraining = function (state, unitId) {
	var idx = -1;
	var u = null;
	for (var i = 0; i < state.player.units.length; i++) {
		if (state.player.units[i].id === unitId && !state.player.units[i].dead) {
			idx = i;
			u = state.player.units[i];
			break;
		}
	}
	if (!u) return { ok: false, reason: "Unit not found" };
	if (u.type === "civilian") return { ok: false, reason: "Civilians cannot train a role" };
	if (DE.canRecruit(state, u.type)) return { ok: false, reason: "Already know that role" };
	state.player.training = state.player.training || [];
	state.player.training.push({
		type: u.type,
		species: u.species,
		remaining: 5,
		name: (DE.unitDef(u.type) || {}).name || u.type
	});
	state.player.units.splice(idx, 1);
	return { ok: true };
};

DE.tickTraining = function (state, n) {
	n = n || 1;
	state.player.training = state.player.training || [];
	var done = [];
	for (var i = 0; i < state.player.training.length; i++) {
		state.player.training[i].remaining -= n;
	}
	var still = [];
	for (var j = 0; j < state.player.training.length; j++) {
		var t = state.player.training[j];
		if (t.remaining <= 0) {
			state.player.knownTypes = state.player.knownTypes || [];
			if (state.player.knownTypes.indexOf(t.type) < 0) state.player.knownTypes.push(t.type);
			done.push(t);
		} else still.push(t);
	}
	state.player.training = still;
	return done;
};

DE.sellMissionWeapon = function (state, unitId) {
	var m = state.mission;
	if (!m) return { ok: false, reason: "Not on a mission" };
	var u = null;
	for (var i = 0; i < m.party.length; i++) {
		if (m.party[i].id === unitId) u = m.party[i];
	}
	if (!u || u.dead) return { ok: false, reason: "Unit not found" };
	if (u.type === "civilian" || !DE.unitDropsWeapon(u)) {
		return { ok: false, reason: "No weapons to sell" };
	}
	var price = DE.unitStuffPrice(u.type);
	u.previousType = u.type;
	u.type = "civilian";
	u.equippedWeapons = false;
	m.stuff.gold = (m.stuff.gold || 0) + price;
	return { ok: true, price: price };
};

DE.startMission = function (state, opts) {
	opts = opts || {};
	var selected = opts.unitIds || [];
	var party = [];
	for (var i = 0; i < state.player.units.length; i++) {
		var u = state.player.units[i];
		if (u.dead) continue;
		if (!selected.length || selected.indexOf(u.id) >= 0) {
			var copy = DE.deepClone(u);
			copy.wounded = false;
			party.push(copy);
		}
	}
	if (!party.length) return { ok: false, reason: "No soldiers" };

	var foodBuy = Math.max(0, Math.floor(opts.foodBuy || 0));
	var foodCost = foodBuy * DE.FOOD_GOLD_COST;
	var setBuys = opts.weaponSetBuys || [];
	var setCost = 0;
	for (var s = 0; s < setBuys.length; s++) {
		setCost += DE.unitStuffPrice(setBuys[s]);
	}
	var reserved = foodCost + setCost;
	if (state.player.gold + 1e-9 < reserved) {
		return { ok: false, reason: "Need " + reserved + " gold for food and weapon sets" };
	}
	var maxTake = Math.floor(state.player.gold - reserved);
	var goldTake = Math.max(0, Math.floor(opts.goldTake != null ? opts.goldTake : maxTake));
	if (goldTake > maxTake) {
		return { ok: false, reason: "Cannot take that much gold" };
	}

	state.player.gold -= foodCost;
	state.player.gold -= setCost;
	state.player.gold -= goldTake;
	state.player.weapons = state.player.weapons || [];
	for (var b = 0; b < setBuys.length; b++) {
		state.player.weapons.push(setBuys[b]);
	}

	var village = null;
	if (opts.villageId) {
		for (var v = 0; v < state.villages.length; v++) {
			if (state.villages[v].id === opts.villageId) village = state.villages[v];
		}
	}
	var distance = village ? village.revisitLength : Math.max(1, Math.floor(opts.distance || 5));
	state.missionCount += 1;
	state.mission = {
		id: "M" + state.missionCount,
		distance: distance,
		remaining: distance,
		progressed: 0,
		attempted: 0,
		returning: false,
		cancelled: false,
		villageId: village ? village.id : null,
		villageAt: village ? Math.floor(distance / 2) : -1,
		party: party,
		stuff: {
			gold: goldTake,
			food: foodBuy,
			weapons: (state.player.weapons || []).slice(),
			captives: DE.deepClone(state.player.captives || [])
		},
		beat: 0,
		encountersAtStart: state.totalEncounters || 0
	};
	/* Weapons taken on the mission leave camp stash empty until return. */
	state.player.weapons = [];
	state.ui.screen = "mission";
	DE.nextBeat(state);
	return { ok: true };
};

DE.cancelMission = function (state) {
	var m = state.mission;
	if (!m || m.returning) return { ok: false };
	if (m.progressed >= m.distance / 2) return { ok: false, reason: "Past halfway" };
	m.returning = true;
	m.cancelled = true;
	m.remaining = Math.max(1, m.progressed);
	m.villageAt = -1;
	return { ok: true };
};

DE.eatFood = function (state) {
	var m = state.mission;
	var n = DE.livingUnits(m.party).length;
	if (m.stuff.food >= n) {
		m.stuff.food -= n;
		return { starved: 0 };
	}
	var unfed = n - m.stuff.food;
	m.stuff.food = 0;
	var living = DE.fightingUnits(m.party);
	var starved = 0;
	for (var i = 0; i < unfed && living.length; i++) {
		var u = DE.rngPick(state, living);
		u.wounded = true;
		starved++;
		living = DE.fightingUnits(m.party);
	}
	return { starved: starved };
};

DE.nextBeat = function (state) {
	var m = state.mission;
	if (!m) return;
	if (m.remaining <= 0) {
		DE.returnToBase(state);
		return;
	}
	if (!DE.livingUnits(m.party).length) {
		state.ui.message = "The expedition is gone. What remains is dragged home.";
		DE.returnToBase(state);
		return;
	}
	m.beat += 1;
	m.attempted += 1;
	state.totalEncounters = (state.totalEncounters || 0) + 1;
	var ate = DE.eatFood(state);
	var revisitVillage = null;
	if (m.villageId && m.villageAt >= 0 && m.progressed === m.villageAt && !m.returning) {
		revisitVillage = DE.villageById(state, m.villageId);
	}
	var discoverVillage = !m.villageId && !m.returning ? DE.villageAtDepth(state, m.progressed) : null;
	var forcedVillage = revisitVillage || discoverVillage;
	var roll = forcedVillage ? "village" : DE.pickWeighted(state, state.encounterWeights);
	if (roll === "village" && !forcedVillage) {
		roll = DE.pickWeighted(state, {
			small: state.encounterWeights.small,
			medium: state.encounterWeights.medium,
			large: state.encounterWeights.large,
			huge: state.encounterWeights.huge,
			monster: state.encounterWeights.monster,
			empty: state.encounterWeights.empty
		});
	}
	if (roll === "empty") {
		m.progressed += 1;
		m.remaining -= 1;
		state.ui.screen = "empty";
		state.ui.message = ate.starved ? "Empty dark. " + ate.starved + " unfed soldiers slump." : DE.emptyFlavor(state);
		state.mission.pendingEncounter = null;
		DE.appendChronicle(state, "Empty stretch · held " + m.progressed + "/" + m.distance);
		return;
	}
	var enc = forcedVillage
		? DE.buildVillageEncounter(state, forcedVillage)
		: DE.buildEncounter(state, roll, false);
	if (!enc) {
		m.progressed += 1;
		m.remaining -= 1;
		state.ui.screen = "empty";
		state.ui.message = "The tunnel is quiet.";
		return;
	}
	m.pendingEncounter = enc;
	state.ui.screen = "encounter";
	state.ui.pendingAction = null;
	state.ui.pendingExtra = {};
	state.ui.chooser = null;
	state.ui.message = "";
	state.ui.tradeNote = "";
};

DE.emptyFlavor = function (state) {
	var lines = [
		"Dripstone and old air. Nobody here.",
		"A cold gallery, bones long since picked.",
		"Fungus light, no voices.",
		"The passage pinches, then opens on nothing.",
		"Ash of a fire days gone."
	];
	return DE.rngPick(state, lines);
};

DE.buildEncounter = function (state, kind, forcedVillage) {
	if (kind === "monster" || kind === "undead") {
		return DE.buildMonsterEncounter(state);
	}
	if (kind === "village" || forcedVillage) {
		var village = typeof forcedVillage === "object" && forcedVillage ? forcedVillage : null;
		if (!village && state.mission && state.mission.villageId) {
			village = DE.villageById(state, state.mission.villageId);
		}
		if (village) return DE.buildVillageEncounter(state, village);
		return null;
	}
	var size = kind;
	var civ = DE.civilizedFactions(state);
	if (!civ.length) return null;
	var faction = DE.rngPick(state, civ);
	var leaders = DE.livingLeaders(faction);
	if (!leaders.length) {
		var others = civ.filter(function (f) { return DE.livingLeaders(f).length; });
		if (!others.length) return DE.buildMonsterEncounter(state);
		faction = DE.rngPick(state, others);
		leaders = DE.livingLeaders(faction);
	}
	var units = DE.composeForce(state, faction, size, false);
	var leader = DE.rngPick(state, leaders);
	return {
		id: DE.nextId(state, "E"),
		factionId: faction.id,
		kind: "field",
		size: size,
		village: false,
		villageName: null,
		villageRec: null,
		leader: leader,
		playerUnits: state.mission.party,
		aiUnits: units,
		playerStuff: state.mission.stuff,
		aiStuff: DE.makePartyStuff(state, units, faction),
		roundIndex: 0,
		lastPair: null,
		intimidateMayTrade: false,
		hireUnlocked: false,
		resolved: false,
		rounds: []
	};
};

DE.buildVillageEncounter = function (state, village) {
	var faction = DE.factionById(state, village.factionId);
	if (!faction) return null;
	var leaders = DE.livingLeaders(faction);
	if (!leaders.length) return null;
	var wasNew = !village.discovered;
	village.discovered = true;
	var units = DE.composeForce(state, faction, "huge", true);
	var leader = DE.rngPick(state, leaders);
	if (wasNew) {
		DE.appendChronicle(state, "Found " + village.name + " (" + faction.name + ") at depth " + village.distance + ".");
	}
	return {
		id: DE.nextId(state, "E"),
		factionId: faction.id,
		kind: "village",
		size: "huge",
		village: true,
		villageName: village.name,
		villageRec: village,
		leader: leader,
		playerUnits: state.mission.party,
		aiUnits: units,
		playerStuff: state.mission.stuff,
		aiStuff: DE.makePartyStuff(state, units, faction),
		roundIndex: 0,
		lastPair: null,
		intimidateMayTrade: false,
		hireUnlocked: false,
		resolved: false,
		rounds: []
	};
};

DE.buildMonsterEncounter = function (state) {
	var types = DE.MONSTER_TYPES.slice();
	var t = DE.rngPick(state, types);
	var loner = null;
	for (var i = 0; i < state.factions.length; i++) {
		if (state.factions[i].monsterType === t) loner = state.factions[i];
	}
	if (t === "undead") {
		var pack = DE.composeUndeadForce(state, DE.rngPick(state, ["small", "medium", "large"]));
		var faction = pack.faction || loner;
		if (faction && faction.kind === "loner" && faction.alive === false) {
			t = DE.rngPick(state, state.animalTypes.length ? state.animalTypes : ["ooze"]);
			loner = null;
		} else if (faction && faction.kind === "loner") {
			var L = DE.livingLeaders(faction);
			return {
				id: DE.nextId(state, "E"),
				factionId: faction.id,
				kind: "loner",
				size: "medium",
				village: false,
				leader: L[0] || null,
				playerUnits: state.mission.party,
				aiUnits: pack.units,
				playerStuff: state.mission.stuff,
				aiStuff: DE.makePartyStuff(state, pack.units, faction),
				roundIndex: 0,
				lastPair: null,
				intimidateMayTrade: false,
				resolved: false,
				rounds: []
			};
		}
		return {
			id: DE.nextId(state, "E"),
			factionId: "wild-undead",
			kind: "animal",
			size: "medium",
			village: false,
			leader: null,
			playerUnits: state.mission.party,
			aiUnits: pack.units,
			playerStuff: state.mission.stuff,
			aiStuff: DE.makePartyStuff(state, pack.units, faction),
			roundIndex: 0,
			lastPair: null,
			animal: true,
			resolved: false,
			rounds: []
		};
	}
	if (loner && loner.kind === "loner") {
		if (loner.alive === false) return null;
		var lead = DE.livingLeaders(loner)[0];
		var unit = DE.makeUnit(state, DE.MONSTER_UNIT[t], t, loner.id);
		return {
			id: DE.nextId(state, "E"),
			factionId: loner.id,
			kind: "loner",
			size: "single",
			village: false,
			leader: lead,
			playerUnits: state.mission.party,
			aiUnits: [unit],
			playerStuff: state.mission.stuff,
			aiStuff: DE.makePartyStuff(state, [unit], loner),
			roundIndex: 0,
			lastPair: null,
			resolved: false,
			rounds: []
		};
	}
	var wild = DE.makeUnit(state, DE.MONSTER_UNIT[t], t, "wild-" + t);
	return {
		id: DE.nextId(state, "E"),
		factionId: "wild-" + t,
		kind: "animal",
		size: "single",
		village: false,
		leader: null,
		playerUnits: state.mission.party,
		aiUnits: [wild],
		playerStuff: state.mission.stuff,
		aiStuff: { gold: 0, food: DE.rngIntRange(state, 0, 8), weapons: [], captives: [] },
		roundIndex: 0,
		lastPair: null,
		animal: true,
		resolved: false,
		rounds: []
	};
};

DE.ensureVillage = function (state, faction) {
	var existing = DE.villageByFaction(state, faction.id);
	if (existing) return existing;
	var v = {
		id: DE.nextId(state, "V"),
		name: DE.villageName(state, {}),
		factionId: faction.id,
		distance: 4,
		discovered: false,
		revisitLength: 4
	};
	state.villages.push(v);
	return v;
};

DE.villageById = function (state, id) {
	for (var i = 0; i < state.villages.length; i++) {
		if (state.villages[i].id === id) return state.villages[i];
	}
	return null;
};

DE.updateVillageRevisit = function (state, enc) {
	if (!enc.village || !enc.villageRec) return;
	var m = state.mission;
	var n = 2 * Math.max(1, Math.min(m.remaining, Math.max(m.progressed, 1)));
	enc.villageRec.revisitLength = n;
};

DE.playRound = function (state, playerAction, extra) {
	var enc = state.mission && state.mission.pendingEncounter;
	if (!enc || enc.resolved) return { ok: false };
	extra = extra || {};
	if (playerAction === "trade" && enc.roundIndex === 0) return { ok: false, reason: "Trade is not offered at first meeting." };
	var ai = DE.chooseAiAction(state, enc);
	enc.intimidateMayTrade = !!enc.intimidateMayTrade;
	var extras = {
		playerAction: playerAction,
		aiAction: ai.action,
		playerSeize: extra.seize,
		aiSeize: ai.extra && ai.extra.seize,
		playerCaptureId: extra.captureId,
		aiCaptureId: ai.extra && ai.extra.captureId,
		playerGift: extra.gift,
		aiGift: ai.extra && ai.extra.gift
	};
	var result = DE.resolveRound(state, enc, playerAction, ai.action, extras);
	enc.rounds.push({
		player: playerAction,
		ai: ai.action,
		giftValue: extra.gift ? DE.giftGoldEquivalent(extra.gift) : 0
	});
	enc.lastPair = { player: playerAction, ai: ai.action };
	enc.roundIndex += 1;
	enc.intimidateMayTrade = !!result.intimidateMayTrade;
	result.ai = ai;
	if (result.another) {
		state.ui.lastResult = result;
		state.ui.screen = "encounter";
		state.ui.message = result.notes.join(" ");
		return { ok: true, result: result };
	}
	DE.finishEncounter(state, enc, result);
	return { ok: true, result: result };
};

DE.finishEncounter = function (state, enc, result) {
	enc.resolved = true;
	DE.lootBattleWeapons(enc, result);
	var m = state.mission;
	if (result.hold.player) {
		m.progressed += 1;
		m.remaining -= 1;
	}
	DE.updateVillageRevisit(state, enc);
	if (result.battle && !result.displayBattle && result.battle.winner === "player") {
		DE.maybeKillLeader(state, enc, 0.5);
		DE.markMonstersKnownFromUnits(state, enc.aiUnits);
	}
	if (enc.kind === "loner" && result.battle && !result.displayBattle && result.battle.winner === "player") {
		var loner = DE.factionById(state, enc.factionId);
		if (loner && DE.rngNext(state) < 0.5) {
			loner.alive = false;
			if (enc.leader) enc.leader.alive = false;
		}
	}
	if (enc.factionId && enc.kind !== "animal") {
		DE.appendLog(state, {
			id: enc.id,
			factionId: enc.factionId,
			missionId: m.id,
			beat: m.beat,
			leaderName: enc.leader ? enc.leader.name : "",
			kind: enc.kind,
			village: !!enc.village,
			villageName: enc.villageName,
			summary: DE.summarizeUnits(enc.aiUnits),
			playerSummary: DE.summarizeUnits(enc.playerUnits),
			rounds: enc.rounds.slice(),
			gifted: !!(result.gift && result.gift.moved),
			giftValue: result.gift && result.gift.value,
			traded: !!enc.didTrade,
			battle: !!result.battle,
			displayBattle: !!result.displayBattle,
			winner: result.battle ? result.battle.winner : null,
			playerHeld: result.hold.player,
			aiHeld: result.hold.ai,
			outcome: result.notes.join(" ")
		});
	}
	var fac = DE.factionById(state, enc.factionId);
	var who = enc.village
		? (enc.villageName || "a village")
		: (fac ? fac.name : (enc.kind === "animal" ? "wild beasts" : "strangers"));
	var line = who + ": " + (result.notes && result.notes.length ? result.notes.join(" ") : "encounter ends");
	if (result.battle && result.battle.winner === "player") line += " (you won)";
	else if (result.battle && result.battle.winner === "ai") line += " (they won)";
	DE.appendChronicle(state, line);
	if (result.trade) {
		enc.awaitingTrade = true;
		state.ui.screen = "trade";
		state.ui.lastResult = result;
		state.ui.message = result.notes.join(" ");
		DE.checkWin(state);
		return;
	}
	state.ui.screen = "resolve";
	state.ui.lastResult = result;
	state.ui.message = result.notes.join(" ");
	DE.checkWin(state);
};

DE.closeTrade = function (state, didTrade) {
	var enc = state.mission && state.mission.pendingEncounter;
	if (enc) {
		enc.didTrade = enc.didTrade || !!didTrade;
		if (didTrade && state.logs[enc.factionId] && state.logs[enc.factionId][0]) {
			state.logs[enc.factionId][0].traded = true;
		}
	}
	state.ui.screen = "resolve";
};

DE.maybeKillLeader = function (state, enc, chance) {
	if (!enc.leader) return false;
	if (DE.rngNext(state) >= chance) return false;
	enc.leader.alive = false;
	return true;
};

DE.checkWin = function (state) {
	var f = DE.factionById(state, state.hostileFactionId);
	if (f && DE.livingLeaders(f).length === 0) {
		state.won = true;
	}
};

DE.continueAfterResolve = function (state) {
	if (state.won) {
		state.ui.screen = "win";
		return;
	}
	DE.nextBeat(state);
};

DE.grantBaseIncome = function (state) {
	state.totalEncounters = state.totalEncounters || 0;
	state.incomeEncountersPaid = state.incomeEncountersPaid || 0;
	var due = Math.floor(state.totalEncounters / 5) - Math.floor(state.incomeEncountersPaid / 5);
	if (due <= 0) return { gold: 0, blocks: 0 };
	var gold = due * 100;
	state.player.gold += gold;
	state.incomeEncountersPaid = Math.floor(state.totalEncounters / 5) * 5;
	return { gold: gold, blocks: due };
};

DE.returnToBase = function (state) {
	var m = state.mission;
	var notices = [];
	if (m) {
		var beats = Math.max(0, (state.totalEncounters || 0) - (m.encountersAtStart || 0));
		var trained = DE.tickTraining(state, beats);
		for (var t = 0; t < trained.length; t++) {
			notices.push(trained[t].name + " training finished — you can raise that role.");
		}
		var kept = [];
		var ids = {};
		for (var i = 0; i < m.party.length; i++) {
			var u = m.party[i];
			ids[u.id] = true;
			if (u.dead) continue;
			u.wounded = false;
			kept.push(u);
		}
		var leftovers = [];
		for (var j = 0; j < state.player.units.length; j++) {
			if (!ids[state.player.units[j].id] && !state.player.units[j].dead) leftovers.push(state.player.units[j]);
		}
		state.player.units = leftovers.concat(kept);
		state.player.weapons = m.stuff.weapons || [];
		state.player.captives = m.stuff.captives || [];
		state.player.gold += (m.stuff.gold || 0);
		state.player.food = 0;
	}
	var income = DE.grantBaseIncome(state);
	if (income.gold > 0) {
		notices.unshift("Camp remittance: +" + income.gold + "g from " + (income.blocks * 5) + " encounters.");
	}
	state.mission = null;
	state.ui.screen = state.won ? "win" : "base";
	state.ui.selectedUnitIds = [];
	state.ui.sendCounts = {};
	if (notices.length) state.ui.flash = notices.join(" ");
};
