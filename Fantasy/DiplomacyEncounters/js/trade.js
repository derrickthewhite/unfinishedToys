var DE = DE || {};

DE.VILLAGE_TIP_TRUST = 0.55;
DE.HIRE_ASK_TRUST = 0.5;
DE.VILLAGE_TIP_PRICE = 50;
DE.MONSTER_ADVICE_PRICE = 50;

DE.priceOf = function (kind, type) {
	if (kind === "food") return 1;
	if (kind === "gold") return 1;
	if (kind === "unit" || kind === "weapons" || kind === "captive" || kind === "pattern") {
		return DE.unitStuffPrice(type);
	}
	return 25;
};

DE.canAfford = function (gold, price) {
	return gold >= price;
};

DE.patternLabel = function (type) {
	var def = DE.unitDef(type);
	return (def ? def.name : type) + " pattern · " + DE.unitStuffPrice(type) + "g";
};

DE.unitLabel = function (unit) {
	var def = DE.unitDef(unit.type);
	return (def ? def.name : unit.type) + " · " + DE.unitStuffPrice(unit.type) + "g";
};

DE.rosterPatterns = function (state, enc) {
	var faction = DE.factionById(state, enc.factionId);
	var out = [];
	if (!faction || !faction.roster) return out;
	for (var i = 0; i < faction.roster.length; i++) {
		var type = faction.roster[i];
		if (type === "civilian") continue;
		out.push(type);
	}
	return out;
};

DE.uniqueTypes = function (list) {
	var seen = {};
	var out = [];
	for (var i = 0; i < list.length; i++) {
		if (!seen[list[i]]) {
			seen[list[i]] = true;
			out.push(list[i]);
		}
	}
	return out;
};

DE.applyTradeDeal = function (state, buyerStuff, sellerStuff, buyerGoldOwner, deal) {
	var price = deal.price != null ? deal.price : DE.priceOf(deal.kind, deal.type);
	if (deal.kind === "food") price = deal.amount || 1;
	if ((buyerGoldOwner.gold || 0) < price) return { ok: false, reason: "Need " + price + " gold" };
	if (deal.kind === "food") {
		var amt = deal.amount || 1;
		if ((sellerStuff.food || 0) < amt) return { ok: false, reason: "No food" };
		sellerStuff.food -= amt;
		buyerStuff.food = (buyerStuff.food || 0) + amt;
		price = amt;
	} else if (deal.kind === "weapons" || deal.kind === "pattern") {
		buyerStuff.weapons = buyerStuff.weapons || [];
		sellerStuff.weapons = sellerStuff.weapons || [];
		var ix = sellerStuff.weapons.indexOf(deal.type);
		if (ix >= 0) sellerStuff.weapons.splice(ix, 1);
		else if (!deal.fromRoster) return { ok: false, reason: "No pattern" };
		if (buyerStuff.weapons.indexOf(deal.type) < 0) buyerStuff.weapons.push(deal.type);
		price = DE.unitStuffPrice(deal.type);
	} else if (deal.kind === "captive") {
		var cap = null;
		var caps = sellerStuff.captives || [];
		for (var i = 0; i < caps.length; i++) {
			if (caps[i].id === deal.id || (!deal.id && caps[i].type === deal.type)) {
				cap = caps[i];
				caps.splice(i, 1);
				break;
			}
		}
		if (!cap) return { ok: false, reason: "No captive" };
		buyerStuff.captives = buyerStuff.captives || [];
		buyerStuff.captives.push(cap);
		price = DE.unitStuffPrice(cap.type);
	} else if (deal.kind === "unit") {
		var units = deal.fromUnits || [];
		var u = null;
		for (var j = 0; j < units.length; j++) {
			if (units[j].id === deal.id && !units[j].dead) {
				u = units[j];
				break;
			}
		}
		if (!u) return { ok: false, reason: "No unit" };
		var copy = DE.deepClone(u);
		copy.dead = false;
		copy.wounded = false;
		copy.id = (state && DE.nextId) ? DE.nextId(state, "u") : copy.id + "-traded";
		if (deal.buyerFactionId) copy.factionId = deal.buyerFactionId;
		if (deal.foreignWeapons) copy.foreignWeapons = true;
		u.dead = true;
		deal.toUnits.push(copy);
		price = DE.unitStuffPrice(u.type);
	} else {
		return { ok: false, reason: "Unknown deal" };
	}
	buyerGoldOwner.gold -= price;
	if (deal.sellerGoldOwner) deal.sellerGoldOwner.gold += price;
	else sellerStuff.gold = (sellerStuff.gold || 0) + price;
	return { ok: true, price: price };
};

DE.trustCenter = function (state, factionId) {
	return DE.trustFromLog(state, factionId).center;
};

DE.askVillageLocation = function (state, enc) {
	if (!enc || enc.kind === "animal" || enc.kind === "loner") {
		return { ok: false, reason: "They have no village to speak of." };
	}
	var trust = DE.trustCenter(state, enc.factionId);
	if (trust < DE.VILLAGE_TIP_TRUST) {
		var cold = trust < 0.35
			? "I don't trust you enough for that"
			: "Not yet, maybe later";
		return { ok: false, reason: cold };
	}
	var village = DE.villageByFaction(state, enc.factionId);
	if (!village) return { ok: false, reason: "They shrug. No village they will name." };
	if ((enc.playerStuff.gold || 0) < DE.VILLAGE_TIP_PRICE) {
		return { ok: false, reason: "Need " + DE.VILLAGE_TIP_PRICE + " gold" };
	}
	enc.playerStuff.gold -= DE.VILLAGE_TIP_PRICE;
	enc.aiStuff.gold = (enc.aiStuff.gold || 0) + DE.VILLAGE_TIP_PRICE;
	village.discovered = true;
	enc.didTrade = true;
	DE.appendChronicle(state, "Learned of " + village.name + " at depth " + village.distance + ".");
	return {
		ok: true,
		price: DE.VILLAGE_TIP_PRICE,
		reason: village.name + " lies " + village.distance + " encounters from your base."
	};
};

DE.askToHire = function (state, enc) {
	if (!enc || enc.kind === "animal") {
		return { ok: false, reason: "Nothing here will take gold to join you." };
	}
	var trust = DE.trustCenter(state, enc.factionId);
	if (trust < DE.HIRE_ASK_TRUST) {
		var line = trust < 0.35
			? "I don't trust you enough for that"
			: "Not yet, maybe later";
		return { ok: false, reason: line };
	}
	enc.hireUnlocked = true;
	var willing = 0;
	var list = DE.fightingUnits(enc.aiUnits);
	for (var i = 0; i < list.length; i++) {
		if (list[i].hirable) willing++;
	}
	return {
		ok: true,
		reason: willing
			? "A few nod. " + willing + " might take your coin."
			: "They hear you out, but nobody here wants to leave."
	};
};

DE.buyMonsterAdvice = function (state, enc, monsterKey) {
	if (!monsterKey) return { ok: false, reason: "Which beast?" };
	if (DE.isMonsterKnown(state, monsterKey)) {
		return { ok: false, reason: "You already know that foe." };
	}
	if ((enc.playerStuff.gold || 0) < DE.MONSTER_ADVICE_PRICE) {
		return { ok: false, reason: "Need " + DE.MONSTER_ADVICE_PRICE + " gold" };
	}
	enc.playerStuff.gold -= DE.MONSTER_ADVICE_PRICE;
	enc.aiStuff.gold = (enc.aiStuff.gold || 0) + DE.MONSTER_ADVICE_PRICE;
	DE.markMonsterKnown(state, monsterKey);
	enc.didTrade = true;
	var label = DE.SPECIES_LABELS[monsterKey] || monsterKey;
	DE.appendChronicle(state, "Bought advice about " + label + ".");
	return {
		ok: true,
		price: DE.MONSTER_ADVICE_PRICE,
		reason: "They warn you about the " + label + ". Its measure is known now."
	};
};

DE.hirableGroups = function (enc) {
	var list = DE.fightingUnits(enc.aiUnits).filter(function (u) { return !!u.hirable; });
	return DE.groupUnits(list);
};

DE.unknownMonsterAdviceKeys = function (state) {
	var out = [];
	for (var i = 0; i < DE.MONSTER_TYPES.length; i++) {
		var key = DE.MONSTER_TYPES[i];
		if (!DE.isMonsterKnown(state, key)) out.push(key);
	}
	return out;
};
