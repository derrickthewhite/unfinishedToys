var DE = DE || {};

DE.VILLAGE_TIP_TRUST = 0.55;
DE.HIRE_ASK_TRUST = 0.5;
DE.VILLAGE_TIP_PRICE = 50;

DE.priceOf = function (kind, type) {
	if (kind === "food") return 1;
	if (kind === "gold" || kind === "magic") return 1;
	if (kind === "unit" || kind === "weapons" || kind === "captive" || kind === "pattern") {
		return DE.unitStuffPrice(type);
	}
	return 25;
};

DE.factionCanMakeKit = function (faction, type) {
	if (!faction || !faction.roster || !type) return false;
	return faction.roster.indexOf(type) >= 0;
};

/* Sell kits to a faction: 60% if they craft that kit, 140% if not. */
DE.weaponKitSellPrice = function (type, buyerFaction) {
	var base = DE.unitStuffPrice(type);
	if (DE.factionCanMakeKit(buyerFaction, type)) return Math.max(1, Math.round(base * 0.6));
	return Math.max(1, Math.round(base * 1.4));
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

DE.encounterAllowsItemTrade = function (enc, state) {
	if (!enc || enc.animal || enc.kind === "animal" || enc.kind === "loner") return false;
	var fac = state ? DE.factionById(state, enc.factionId) : null;
	if (fac && (fac.kind === "loner" || fac.monsterType)) return false;
	return true;
};

DE.tradeHeadline = function (enc) {
	if (!enc) return "Trade";
	var market = enc.villageName || (enc.tradeVillageRec && enc.tradeVillageRec.name);
	if (enc.village || enc.tradeVillageRec) return (market || "Village") + " Market";
	var face = typeof DE.encounterFace === "function" ? DE.encounterFace(enc) : enc.leader;
	var who = face && face.name ? face.name : "them";
	return "Swapping Supplies with " + who;
};

DE.tradeDepth = function (state, enc) {
	if (enc && enc.campRaid) return 0;
	if (enc && enc.villageRec && enc.villageRec.distance != null) return enc.villageRec.distance;
	if (state && state.mission && typeof DE.encounterDepth === "function") return DE.encounterDepth(state.mission);
	return 0;
};

DE.pickTradeVillage = function (state, enc) {
	if (!enc) return null;
	if (enc.villageRec) return enc.villageRec;
	if (enc.tradeVillageRec) return enc.tradeVillageRec;
	var fac = state ? DE.factionById(state, enc.factionId) : null;
	if (!fac || fac.kind !== "civilized") return null;
	return DE.closestVillageForFaction(state, fac.id, DE.tradeDepth(state, enc));
};

DE.carryPartySize = function (enc, units) {
	var list = units || (enc && enc.aiUnits) || [];
	var n = 0;
	for (var i = 0; i < list.length; i++) {
		if (list[i] && !list[i].dead) n++;
	}
	n = Math.max(1, n);
	if (enc && enc.village) n = Math.min(n, 8);
	return n;
};

DE.withdrawVillagePurse = function (state, village, units, faction, enc) {
	if (!village) return DE.emptyStuff();
	var n = DE.carryPartySize(enc, units);
	var dummy = [];
	for (var i = 0; i < n; i++) dummy.push({ type: "melee" });
	var want = DE.makePartyStuff(state, dummy, faction, false);
	var purse = DE.emptyStuff();
	function take(key) {
		var amt = Math.min(want[key] || 0, village[key] || 0);
		village[key] = (village[key] || 0) - amt;
		purse[key] = amt;
	}
	take("gold");
	take("food");
	take("magic");
	village.weapons = village.weapons || [];
	var wantKits = (want.weapons || []).length;
	var taken = [];
	for (var w = 0; w < wantKits; w++) {
		var ix = village.weapons.indexOf(want.weapons[w]);
		if (ix >= 0) taken.push(village.weapons.splice(ix, 1)[0]);
	}
	while (taken.length < wantKits && village.weapons.length) {
		taken.push(village.weapons.shift());
	}
	purse.weapons = taken;
	purse.captives = [];
	return purse;
};

DE.depositVillagePurse = function (village, purse) {
	if (!village || !purse) return;
	village.gold = (village.gold || 0) + (purse.gold || 0);
	village.food = (village.food || 0) + (purse.food || 0);
	village.magic = (village.magic || 0) + (purse.magic || 0);
	village.weapons = (village.weapons || []).concat(purse.weapons || []);
	village.captives = (village.captives || []).concat(purse.captives || []);
	purse.gold = 0;
	purse.food = 0;
	purse.magic = 0;
	purse.weapons = [];
	purse.captives = [];
};

DE.returnEncounterTreasury = function (state, enc) {
	if (!enc || !enc.withdrewTreasury || !enc.tradeVillageRec) return;
	DE.depositVillagePurse(enc.tradeVillageRec, enc.tradeStuff || enc.aiStuff);
	enc.withdrewTreasury = false;
};

/* Field fights and trade withdraw a party-sized purse from the closest village, then deposit leftovers.
   Village visits keep the site treasury for occupy/seize; the market stall is a purse. */
DE.bindEncounterTreasury = function (state, enc, units, faction) {
	if (!enc) return null;
	var village = DE.pickTradeVillage(state, enc);
	if (!village) {
		if (!enc.aiStuff) enc.aiStuff = DE.makePartyStuff(state, units || enc.aiUnits, faction, false);
		return enc.aiStuff;
	}
	enc.tradeVillageRec = village;
	if (enc.village) {
		if (!enc.aiStuff) enc.aiStuff = DE.villageStuffView(village);
		return enc.aiStuff;
	}
	if (!enc.withdrewTreasury) {
		enc.aiStuff = DE.withdrawVillagePurse(state, village, units || enc.aiUnits, faction, enc);
		enc.tradeStuff = enc.aiStuff;
		enc.withdrewTreasury = true;
	}
	return enc.aiStuff;
};

DE.ensureTradeStall = function (state, enc) {
	if (!enc) return DE.emptyStuff();
	if (enc.tradeStuff) return enc.tradeStuff;
	var faction = state ? DE.factionById(state, enc.factionId) : null;
	if (typeof DE.bindEncounterTreasury === "function") {
		DE.bindEncounterTreasury(state, enc, enc.aiUnits, faction);
	}
	if (enc.tradeStuff) return enc.tradeStuff;
	var village = enc.tradeVillageRec || DE.pickTradeVillage(state, enc);
	if (village && enc.village && !enc.withdrewTreasury) {
		enc.tradeVillageRec = village;
		enc.tradeStuff = DE.withdrawVillagePurse(state, village, enc.aiUnits, faction, enc);
		enc.withdrewTreasury = true;
		return enc.tradeStuff;
	}
	enc.tradeStuff = enc.aiStuff || DE.emptyStuff();
	return enc.tradeStuff;
};

DE.finishTradeStall = function (state, enc) {
	if (typeof DE.returnEncounterTreasury === "function") DE.returnEncounterTreasury(state, enc);
};

DE.tradePartySpecies = function (enc, faction) {
	if (faction && faction.species) return faction.species;
	var units = (enc && enc.aiUnits) || [];
	for (var i = 0; i < units.length; i++) {
		if (units[i] && !units[i].dead && units[i].species) return units[i].species;
	}
	return "";
};

DE.applyTradeDeal = function (state, buyerStuff, sellerStuff, buyerGoldOwner, deal) {
	deal = deal || {};
	if (deal.allowItems === false && deal.kind !== "food" && deal.kind !== "magic" && deal.kind !== "gold") {
		return { ok: false, reason: "They only trade gold, food, and magic." };
	}
	buyerStuff.magic = buyerStuff.magic || 0;
	sellerStuff.magic = sellerStuff.magic || 0;
	buyerGoldOwner.magic = buyerGoldOwner.magic || 0;

	if (deal.kind === "food") {
		var amt = deal.amount || 1;
		if ((sellerStuff.food || 0) < amt) return { ok: false, reason: "No food" };
		if ((buyerGoldOwner.gold || 0) < amt) return { ok: false, reason: "Need " + amt + " gold" };
		sellerStuff.food -= amt;
		buyerStuff.food = (buyerStuff.food || 0) + amt;
		buyerGoldOwner.gold -= amt;
		if (deal.sellerGoldOwner) deal.sellerGoldOwner.gold = (deal.sellerGoldOwner.gold || 0) + amt;
		else sellerStuff.gold = (sellerStuff.gold || 0) + amt;
		return { ok: true, price: amt };
	}

	if (deal.kind === "magic") {
		var mAmt = deal.amount || 1;
		if ((sellerStuff.magic || 0) < mAmt) return { ok: false, reason: "No magic" };
		if ((buyerGoldOwner.gold || 0) < mAmt) return { ok: false, reason: "Need " + mAmt + " gold" };
		sellerStuff.magic -= mAmt;
		buyerStuff.magic = (buyerStuff.magic || 0) + mAmt;
		buyerGoldOwner.gold -= mAmt;
		if (deal.sellerGoldOwner) deal.sellerGoldOwner.gold = (deal.sellerGoldOwner.gold || 0) + mAmt;
		else sellerStuff.gold = (sellerStuff.gold || 0) + mAmt;
		return { ok: true, price: mAmt };
	}

	var price = deal.price != null ? deal.price : DE.priceOf(deal.kind, deal.type);

	if (deal.kind === "weapons" || deal.kind === "pattern") {
		if (!DE.isWeaponKitType(deal.type)) return { ok: false, reason: "That is not a trade kit" };
		if (deal.price == null && deal.sellToFaction) {
			price = DE.weaponKitSellPrice(deal.type, deal.sellToFaction);
		} else if (deal.price == null) {
			price = DE.unitStuffPrice(deal.type);
		}
		if ((buyerGoldOwner.gold || 0) < price) return { ok: false, reason: "Need " + price + " gold" };
		buyerStuff.weapons = buyerStuff.weapons || [];
		sellerStuff.weapons = sellerStuff.weapons || [];
		var ix = sellerStuff.weapons.indexOf(deal.type);
		if (ix >= 0) sellerStuff.weapons.splice(ix, 1);
		else if (!deal.fromRoster) return { ok: false, reason: "No pattern" };
		buyerStuff.weapons.push(deal.type);
	} else if (deal.kind === "captive") {
		price = DE.unitStuffPrice(deal.type);
		if ((buyerGoldOwner.gold || 0) < price) return { ok: false, reason: "Need " + price + " gold" };
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
		price = DE.unitStuffPrice(deal.type);
		if ((buyerGoldOwner.gold || 0) < price) return { ok: false, reason: "Need " + price + " gold" };
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
		copy.homeFactionId = u.homeFactionId || u.factionId || null;
		if (deal.buyerFactionId) copy.factionId = deal.buyerFactionId;
		if (deal.foreignWeapons) copy.foreignWeapons = true;
		u.dead = true;
		deal.toUnits.push(copy);
		price = DE.unitStuffPrice(u.type);
		if (deal.buyerFactionId === "player" && state) {
			copy.hirePrice = price;
			copy.hireRemitsLeft = 2;
			copy.hireExpired = false;
			copy.homeVillageId = copy.homeVillageId || DE.assignHireVillage(state, copy.homeFactionId);
			DE.onPoliticsHire(state, copy.homeFactionId || u.factionId);
		}
	} else {
		return { ok: false, reason: "Unknown deal" };
	}

	buyerGoldOwner.gold -= price;
	if (deal.sellerGoldOwner) deal.sellerGoldOwner.gold = (deal.sellerGoldOwner.gold || 0) + price;
	else sellerStuff.gold = (sellerStuff.gold || 0) + price;
	if (state) DE.syncPoliticsContacts(state);
	return { ok: true, price: price };
};

DE.trustCenter = function (state, factionId) {
	return DE.trustFromLog(state, factionId).center;
};

DE.askVillageLocation = function (state, enc) {
	if (!enc || enc.kind === "animal" || enc.kind === "loner") {
		return { ok: false, reason: "They have no village to speak of." };
	}
	if (enc.village) {
		return { ok: false, reason: "You're already standing in it." };
	}
	if (typeof DE.canSpeakWithEncounter === "function" && !DE.canSpeakWithEncounter(state, enc)) {
		return { ok: false, reason: "You don't share a language." };
	}
	var trust = DE.trustCenter(state, enc.factionId);
	if (trust < DE.VILLAGE_TIP_TRUST) {
		var cold = trust < 0.35
			? "I don't trust you enough for that"
			: "Not yet, maybe later";
		return { ok: false, reason: cold };
	}
	var village = (typeof DE.pickTradeVillage === "function" ? DE.pickTradeVillage(state, enc) : null) ||
		DE.villageByFaction(state, enc.factionId);
	if (!village) return { ok: false, reason: "They shrug. No village they will name." };
	if (village.discovered) {
		enc.villageTipOffered = true;
		return { ok: true, reason: "You already know " + village.name + " — they'll still confirm it for " + DE.VILLAGE_TIP_PRICE + "g if you want." };
	}
	enc.villageTipOffered = true;
	return {
		ok: true,
		reason: "They'll tell you for " + DE.VILLAGE_TIP_PRICE + " gold."
	};
};

DE.buyVillageLocation = function (state, enc) {
	if (!enc || !enc.villageTipOffered) {
		return { ok: false, reason: "Ask first." };
	}
	if (enc.village) {
		return { ok: false, reason: "You're already standing in it." };
	}
	if (typeof DE.canSpeakWithEncounter === "function" && !DE.canSpeakWithEncounter(state, enc)) {
		return { ok: false, reason: "You don't share a language." };
	}
	var village = (typeof DE.pickTradeVillage === "function" ? DE.pickTradeVillage(state, enc) : null) ||
		DE.villageByFaction(state, enc.factionId);
	if (!village) return { ok: false, reason: "No village they will name." };
	if ((enc.playerStuff.gold || 0) < DE.VILLAGE_TIP_PRICE) {
		return { ok: false, reason: "Need " + DE.VILLAGE_TIP_PRICE + " gold" };
	}
	enc.playerStuff.gold -= DE.VILLAGE_TIP_PRICE;
	var stall = DE.ensureTradeStall(state, enc);
	stall.gold = (stall.gold || 0) + DE.VILLAGE_TIP_PRICE;
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
		enc.hireRefused = "trust";
		return {
			ok: false,
			reason: trust < 0.35
				? "Trust is too low — they won't discuss hiring."
				: "Trust is still too low for hiring — maybe later."
		};
	}
	enc.hireUnlocked = true;
	enc.hireRefused = null;
	var willing = 0;
	var list = DE.fightingUnits(enc.aiUnits);
	for (var i = 0; i < list.length; i++) {
		if (list[i].hirable) willing++;
	}
	if (!willing) enc.hireRefused = "luck";
	return {
		ok: true,
		reason: willing
			? "A few nod. " + willing + " might take your coin."
			: "Trust is high enough, but you got unlucky — nobody here wants to leave."
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

DE.adviceGiftChance = function (state) {
	var unknown = DE.unknownMonsterAdviceKeys(state);
	if (!unknown.length) return 0;
	return 0.5 * (unknown.length / DE.MONSTER_TYPES.length);
};
