const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE, unit } = require("./harness.js");

const DE = loadDE();

test("can hire a willing unit at stuff price", function () {
	const state = { nextId: 8, rng: 1 };
	const buyer = { gold: 40, food: 0, weapons: [], captives: [] };
	const seller = { gold: 0, food: 0, weapons: [], captives: [] };
	const from = [unit("melee", { id: "m1" })];
	const to = [];
	const res = DE.applyTradeDeal(state, buyer, seller, buyer, {
		kind: "unit",
		type: "melee",
		id: "m1",
		fromUnits: from,
		toUnits: to,
		sellerGoldOwner: seller
	});
	assert.equal(res.ok, true);
	assert.equal(res.price, 25);
	assert.equal(to.length, 1);
	assert.equal(from[0].dead, true);
});

test("food trades still work; weapon kits trade as goods", function () {
	const state = { nextId: 1, rng: 1 };
	const buyer = { gold: 200, food: 0, weapons: [], captives: [] };
	const seller = { gold: 10, food: 8, weapons: ["melee"], captives: [] };
	const food = DE.applyTradeDeal(state, buyer, seller, buyer, { kind: "food", amount: 3, sellerGoldOwner: seller });
	assert.equal(food.ok, true);
	assert.equal(buyer.food, 3);
	const kit = DE.applyTradeDeal(state, buyer, seller, buyer, {
		kind: "weapons",
		type: "melee",
		sellerGoldOwner: seller
	});
	assert.equal(kit.ok, true);
	assert.equal(kit.price, 25);
	assert.equal(buyer.weapons.indexOf("melee") >= 0, true);
});

test("village trade is named as that village's market", function () {
	assert.equal(DE.tradeHeadline({
		village: true,
		villageName: "Driphollow",
		leader: { name: "Vesh Qi" }
	}), "Driphollow Market");
});

test("field trade is named as swapping supplies with the leader", function () {
	assert.equal(DE.tradeHeadline({
		village: false,
		leader: { name: "Velzyr Beast-Rider" },
		aiUnits: [{ name: "Velzyr Beast-Rider", dead: false }]
	}), "Swapping Supplies with Velzyr Beast-Rider");
});

test("civilized field trade uses the closest village market", function () {
	assert.equal(DE.tradeHeadline({
		village: false,
		leader: { name: "Velzyr Beast-Rider" },
		tradeVillageRec: { name: "Driphollow", distance: 3 }
	}), "Driphollow Market");
});

test("closest village is the one nearest current depth", function () {
	const state = {
		villages: [
			{ id: "near", factionId: "F1", distance: 2, gold: 40, food: 3, magic: 1, weapons: ["melee"], captives: [] },
			{ id: "far", factionId: "F1", distance: 8, gold: 200, food: 9, magic: 8, weapons: ["archer"], captives: [] },
			{ id: "other", factionId: "F2", distance: 3, gold: 10, food: 0, magic: 0, weapons: [], captives: [] }
		]
	};
	assert.equal(DE.closestVillageForFaction(state, "F1", 3).id, "near");
	assert.equal(DE.closestVillageForFaction(state, "F1", 7).id, "far");
});

test("field trade spends a carried purse and writes leftovers back", function () {
	const state = DE.newCampaign("field-stall");
	const fac = DE.civilizedFactions(state)[0];
	const enc = {
		factionId: fac.id,
		kind: "field",
		village: false,
		aiUnits: [unit("melee", { id: "m1" })],
		playerStuff: { gold: 50, food: 0, magic: 0, weapons: [], captives: [] }
	};
	state.mission = { pendingEncounter: enc, distance: 6, progressed: 2, remaining: 4 };
	const village = DE.closestVillageForFaction(state, fac.id, DE.tradeDepth(state, enc));
	assert.ok(village);
	village.gold = 80;
	village.food = 40;
	village.magic = 8;
	village.weapons = ["melee", "melee", "archer", "melee", "archer"];
	village.captives = [{ id: "c1", type: "melee" }];
	const stall = DE.ensureTradeStall(state, enc);
	assert.equal(enc.tradeVillageRec.id, village.id);
	assert.equal(stall, enc.aiStuff);
	assert.ok(stall.gold < 80);
	assert.ok(stall.food < 40);
	assert.ok(stall.weapons.length < 5);
	assert.equal(stall.captives.length, 0);
	assert.equal(village.gold + stall.gold, 80);
	assert.equal(village.food + stall.food, 40);
	assert.equal(village.weapons.length + stall.weapons.length, 5);
	assert.equal(village.captives.length, 1);
	const buy = DE.applyTradeDeal(state, enc.playerStuff, stall, enc.playerStuff, {
		kind: "food",
		amount: 2,
		sellerGoldOwner: stall
	});
	assert.equal(buy.ok, true);
	DE.finishTradeStall(state, enc);
	assert.equal(village.gold, 82);
	assert.equal(village.food, 38);
	assert.equal(village.weapons.length, 5);
	assert.equal(village.captives.length, 1);
});

test("field seize drains the carried purse, not the whole vault", function () {
	const state = DE.newCampaign("field-seize-treasury");
	const fac = DE.civilizedFactions(state)[0];
	const enc = {
		factionId: fac.id,
		kind: "field",
		village: false,
		playerStuff: { gold: 0, food: 0, magic: 0, weapons: [], captives: [] },
		aiUnits: [unit("melee", { id: "m1" })]
	};
	state.mission = { pendingEncounter: enc, distance: 6, progressed: 2, remaining: 4 };
	const village = DE.closestVillageForFaction(state, fac.id, DE.tradeDepth(state, enc));
	village.gold = 80;
	village.food = 40;
	village.magic = 8;
	village.weapons = ["melee", "archer", "melee"];
	village.captives = [{ id: "h1", type: "infantry" }];
	DE.bindEncounterTreasury(state, enc);
	const carried = enc.aiStuff.gold;
	const rest = village.gold;
	assert.equal(carried + rest, 80);
	assert.ok(carried < 80);
	assert.equal(enc.aiStuff.captives.length, 0);
	assert.equal(village.captives.length, 1);
	const seize = DE.applySeize(enc.aiStuff, enc.playerStuff, enc.aiUnits, { kind: "gold" });
	assert.equal(seize.ok, true);
	assert.equal(seize.amount, Math.floor(carried / 2));
	DE.finishTradeStall(state, enc);
	assert.equal(village.gold, 80 - seize.amount);
	assert.equal(village.food, 40);
	assert.equal(village.captives.length, 1);
});

test("camp raid carries a village purse, not the vault", function () {
	const state = DE.newCampaign("raid-treasury");
	const ids = state.player.units.filter(function (u) { return u.type === "infantry"; }).slice(0, 3).map(function (u) { return u.id; });
	DE.startMission(state, { unitIds: ids, foodBuy: 20, goldTake: 10, distance: 8 });
	const village = DE.closestVillageForFaction(state, state.hostileFactionId, 0);
	assert.ok(village);
	const gold0 = village.gold;
	const food0 = village.food;
	const kits0 = (village.weapons || []).length;
	const caps0 = (village.captives || []).length;
	const enc = DE.buildCampRaidEncounter(state, state.hostileFactionId);
	assert.ok(enc);
	assert.equal(enc.tradeVillageRec.id, village.id);
	assert.equal(enc.aiStuff, enc.tradeStuff);
	assert.equal(village.gold + enc.aiStuff.gold, gold0);
	assert.equal(village.food + enc.aiStuff.food, food0);
	assert.equal((village.weapons || []).length + enc.aiStuff.weapons.length, kits0);
	assert.equal(enc.aiStuff.captives.length, 0);
	assert.equal((village.captives || []).length, caps0);
	DE.finishTradeStall(state, enc);
	assert.equal(village.gold, gold0);
	assert.equal(village.food, food0);
});

test("opening trade without buying does not invent village gold", function () {
	const state = DE.newCampaign("no-ghost-gold");
	const fac = DE.civilizedFactions(state)[0];
	const enc = {
		factionId: fac.id,
		kind: "field",
		aiUnits: [unit("melee", { id: "m1" })],
		playerStuff: { gold: 10, food: 0, weapons: [], captives: [] }
	};
	state.mission = { pendingEncounter: enc, distance: 4, progressed: 0, remaining: 4 };
	const village = DE.closestVillageForFaction(state, fac.id, DE.tradeDepth(state, enc));
	const before = village.gold;
	DE.ensureTradeStall(state, enc);
	assert.ok(enc.aiStuff.gold <= before);
	assert.equal(village.gold + enc.aiStuff.gold, before);
	DE.finishTradeStall(state, enc);
	assert.equal(village.gold, before);
});

test("village market stall is a purse; occupy still sees the site treasury", function () {
	const state = DE.newCampaign("village-stall-purse");
	const fac = DE.civilizedFactions(state)[0];
	const village = DE.villagesByFaction(state, fac.id)[0];
	village.gold = 200;
	village.food = 80;
	village.weapons = ["melee", "melee", "archer", "melee", "archer", "melee", "archer", "melee"];
	village.captives = [{ id: "c1", type: "melee" }];
	state.mission = {
		party: [unit("infantry", { id: "p1" })],
		stuff: { gold: 50, food: 0, magic: 0, weapons: [], captives: [] },
		distance: village.distance,
		progressed: 0,
		remaining: 4
	};
	const enc = DE.buildVillageEncounter(state, village);
	assert.equal(enc.aiStuff.gold, 200);
	assert.equal(enc.aiStuff.captives.length, 1);
	const stall = DE.ensureTradeStall(state, enc);
	assert.notEqual(stall, enc.aiStuff);
	assert.ok(stall.gold < 200);
	assert.equal(village.gold + stall.gold, 200);
	assert.equal(enc.aiStuff.gold, 200);
	assert.equal(stall.captives.length, 0);
	assert.equal(village.captives.length, 1);
	DE.finishTradeStall(state, enc);
	assert.equal(village.gold, 200);
});

test("monsters only trade gold, food, and magic", function () {
	const enc = { kind: "loner", animal: false, factionId: "Fdragon" };
	const state = { factions: [{ id: "Fdragon", kind: "loner", monsterType: "dragon" }] };
	assert.equal(DE.encounterAllowsItemTrade(enc, state), false);
	const buyer = { gold: 200, food: 0, weapons: [], captives: [] };
	const seller = { gold: 0, food: 4, weapons: ["melee"], magic: 3, captives: [] };
	const food = DE.applyTradeDeal(state, buyer, seller, buyer, {
		kind: "food",
		amount: 2,
		sellerGoldOwner: seller,
		allowItems: false
	});
	assert.equal(food.ok, true);
	const kit = DE.applyTradeDeal(state, buyer, seller, buyer, {
		kind: "weapons",
		type: "melee",
		sellerGoldOwner: seller,
		allowItems: false
	});
	assert.equal(kit.ok, false);
	const magic = DE.applyTradeDeal(state, buyer, seller, buyer, {
		kind: "magic",
		amount: 1,
		sellerGoldOwner: seller,
		allowItems: false
	});
	assert.equal(magic.ok, true);
});

test("machine gunner kits cost 100g", function () {
	assert.equal(DE.unitStuffPrice("machineGunner"), 100);
	assert.equal(DE.unitStuffPrice("infantry"), 25);
	assert.equal(DE.unitStuffPrice("melee"), 25);
	assert.equal(DE.unitStuffPrice("fireMage"), 100);
});

test("march weapon sets are infantry and MG only", function () {
	const state = DE.newCampaign("sets");
	assert.equal(DE.marchWeaponSetTypes(state).join(","), "infantry,machineGunner");
	state.player.knownTypes.push("melee");
	state.player.knownTypes.push("archer");
	assert.equal(DE.isAllowedMarchWeaponSet(state, "melee"), false);
	assert.equal(DE.isAllowedMarchWeaponSet(state, "archer"), false);
	assert.equal(DE.isAllowedMarchWeaponSet(state, "infantry"), true);
	assert.equal(DE.isAllowedMarchWeaponSet(state, "machineGunner"), true);
	assert.equal(DE.isAllowedMarchWeaponSet(state, "fireMage"), false);
	const ids = state.player.units.slice(0, 3).map(function (u) { return u.id; });
	const blocked = DE.startMission(state, {
		unitIds: ids,
		foodBuy: 0,
		goldTake: 0,
		distance: 2,
		weaponSetBuys: ["melee"]
	});
	assert.equal(blocked.ok, false);
});

test("ghost and skeleton never enter weapon inventories", function () {
	assert.equal(DE.isWeaponKitType("ghost"), false);
	assert.equal(DE.isWeaponKitType("skeleton"), false);
	assert.equal(DE.isWeaponKitType("ranger"), false);
	assert.equal(DE.isWeaponKitType("melee"), true);
	assert.equal(DE.filterWeaponKits(["melee", "skeleton", "ghost", "archer", "ranger"]).join(","), "melee,archer");
	const state = DE.newCampaign("no-undead-kits");
	const nec = state.factions.find(function (f) { return (f.roster || []).indexOf("skeleton") >= 0; });
	if (nec) {
		const stuff = DE.makePartyStuff(state, [unit("melee")], nec);
		assert.equal(stuff.weapons.indexOf("skeleton"), -1);
		assert.equal(stuff.weapons.indexOf("ghost"), -1);
	}
});

test("camp kits can stay home while bought sets march", function () {
	const state = DE.newCampaign("kit-split");
	state.player.weapons = ["melee", "melee", "archer"];
	state.encounterWeights = { empty: 1, small: 0, medium: 0, large: 0, huge: 0, monster: 0 };
	const ids = state.player.units.slice(0, 3).map(function (u) { return u.id; });
	const start = DE.startMission(state, {
		unitIds: ids,
		foodBuy: 20,
		goldTake: 10,
		distance: 2,
		weaponTakeCounts: { melee: 1 },
		weaponSetBuys: ["infantry"]
	});
	assert.equal(start.ok, true);
	assert.equal(state.player.weapons.slice().sort().join(","), "archer,melee");
	assert.equal(state.mission.stuff.weapons.slice().sort().join(","), "infantry,melee");
	assert.ok(state.chronicle.some(function (c) { return /Mission M\d+ began/.test(c.text) && c.text.indexOf("3 soldiers") >= 0; }));
	DE.returnToBase(state);
	assert.ok(state.chronicle.some(function (c) { return /Mission M\d+ (ended|aborted)/.test(c.text); }));
	assert.equal(DE.filterWeaponKits(state.player.weapons).length, 4);
});

test("village tip unlocks purchase instead of buying immediately", function () {
	const state = DE.newCampaign("trade-gates");
	const fac = DE.civilizedFactions(state)[0];
	DE.knowLanguage(state, fac.species);
	const enc = {
		factionId: fac.id,
		kind: "field",
		playerStuff: { gold: 200, food: 0, weapons: [], captives: [] },
		aiStuff: { gold: 10, food: 0, weapons: [], captives: [] },
		aiUnits: [unit("melee", { id: "m1", hirable: true }), unit("melee", { id: "m2", hirable: false })],
		hireUnlocked: false
	};
	const village = DE.pickTradeVillage(state, enc);
	assert.ok(village);
	village.discovered = false;
	state.logs[fac.id] = [];
	const cold = DE.askVillageLocation(state, enc);
	assert.equal(cold.ok, false);
	assert.match(cold.reason, /trust|later/i);
	state.logs[fac.id] = [
		{ rounds: [{ player: "gift", ai: "greet", giftValue: 200 }], traded: true, gifted: true, giftValue: 200 }
	];
	const tip = DE.askVillageLocation(state, enc);
	assert.equal(tip.ok, true);
	assert.equal(enc.villageTipOffered, true);
	assert.equal(village.discovered, false);
	assert.equal(enc.playerStuff.gold, 200);
	const bought = DE.buyVillageLocation(state, enc);
	assert.equal(bought.ok, true);
	assert.equal(village.discovered, true);
	assert.equal(enc.playerStuff.gold, 150);
	const hire = DE.askToHire(state, enc);
	assert.equal(hire.ok, true);
	assert.equal(enc.hireUnlocked, true);
	assert.equal(DE.hirableGroups(enc).length, 1);
});

test("village tip needs a shared language and is hidden in villages", function () {
	const state = DE.newCampaign("village-ask-lang");
	const fac = DE.civilizedFactions(state)[0];
	state.logs[fac.id] = [
		{ rounds: [{ player: "gift", ai: "greet", giftValue: 200 }], traded: true, gifted: true, giftValue: 200 }
	];
	const enc = {
		factionId: fac.id,
		kind: "field",
		playerStuff: { gold: 200, food: 0, weapons: [], captives: [] },
		aiStuff: { gold: 10, food: 0, weapons: [], captives: [] },
		aiUnits: [unit("melee", { id: "m1", species: fac.species })]
	};
	const mute = DE.askVillageLocation(state, enc);
	assert.equal(mute.ok, false);
	assert.match(mute.reason, /language/i);
	DE.knowLanguage(state, fac.species);
	const ok = DE.askVillageLocation(state, enc);
	assert.equal(ok.ok, true);
	enc.village = true;
	enc.villageTipOffered = false;
	const onSite = DE.askVillageLocation(state, enc);
	assert.equal(onSite.ok, false);
	assert.match(onSite.reason, /already/i);
});

test("wiped parties free captives back to their home pools", function () {
	const state = DE.newCampaign("captive-release");
	const fac = DE.civilizedFactions(state)[0];
	const captiveUnit = DE.makeUnit(state, "melee", fac.species, fac.id, { homeFactionId: fac.id });
	captiveUnit.id = "cap-home-1";
	fac.poolUnits.push(captiveUnit);
	captiveUnit.dead = true;
	const captives = [DE.makeCaptiveRecord(captiveUnit)];
	const n = DE.releaseCaptivesToPools(state, captives);
	assert.equal(n, 1);
	assert.equal(captives.length, 0);
	assert.equal(captiveUnit.dead, false);
	assert.equal(captiveUnit.away, false);

	const hired = DE.makeUnit(state, "archer", fac.species, "player", { homeFactionId: fac.id });
	hired.id = "cap-hire-1";
	hired.name = "Scout";
	const hireCaps = [DE.makeCaptiveRecord(hired)];
	assert.equal(DE.findFactionUnit(state, fac.id, hired.id), null);
	assert.equal(DE.releaseCaptivesToPools(state, hireCaps), 1);
	const back = DE.findFactionUnit(state, fac.id, hired.id);
	assert.ok(back);
	assert.equal(back.dead, false);
	assert.equal(back.type, "archer");
});

test("a wiped player party does not keep mission captives", function () {
	const state = DE.newCampaign("wipe-keeps-no-caps");
	const fac = DE.civilizedFactions(state)[0];
	const ids = state.player.units.slice(0, 2).map(function (u) { return u.id; });
	assert.equal(DE.startMission(state, {
		unitIds: ids,
		foodBuy: 20,
		goldTake: 50,
		distance: 3
	}).ok, true);
	const homeCap = DE.makeUnit(state, "melee", fac.species, fac.id, { homeFactionId: fac.id });
	homeCap.id = "wipe-cap-1";
	fac.poolUnits.push(homeCap);
	homeCap.dead = true;
	state.mission.stuff.captives = [DE.makeCaptiveRecord(homeCap)];
	for (var i = 0; i < state.mission.party.length; i++) {
		state.mission.party[i].dead = true;
	}
	DE.nextBeat(state);
	assert.equal(state.mission, null);
	assert.equal((state.player.captives || []).length, 0);
	assert.equal(homeCap.dead, false);
});

test("ask-hire says trust vs unlucky when nobody will join", function () {
	const state = DE.newCampaign("hire-reasons");
	const fac = DE.civilizedFactions(state)[0];
	const enc = {
		factionId: fac.id,
		kind: "field",
		aiUnits: [unit("melee", { id: "m1", hirable: false }), unit("archer", { id: "a1", hirable: false })],
		hireUnlocked: false
	};
	state.logs[fac.id] = [
		{ rounds: [{ player: "attack", ai: "attack" }], battle: true, winner: "player" },
		{ rounds: [{ player: "seize", ai: "attack" }], battle: true, winner: "player" }
	];
	const cold = DE.askToHire(state, enc);
	assert.equal(cold.ok, false);
	assert.equal(enc.hireUnlocked, false);
	assert.equal(enc.hireRefused, "trust");
	assert.match(cold.reason, /trust is too low/i);

	state.logs[fac.id] = [
		{ rounds: [{ player: "gift", ai: "greet", giftValue: 200 }], traded: true, gifted: true, giftValue: 200 }
	];
	const unlucky = DE.askToHire(state, enc);
	assert.equal(unlucky.ok, true);
	assert.equal(enc.hireUnlocked, true);
	assert.equal(enc.hireRefused, "luck");
	assert.match(unlucky.reason, /unlucky/i);
	assert.match(unlucky.reason, /trust is high enough/i);
});

test("advice arrives as a gift option, not a purchase", function () {
	const state = DE.newCampaign("advice-gift");
	assert.equal(DE.isMonsterKnown(state, "ooze"), false);
	const from = { gold: 0, food: 0, weapons: [], captives: [] };
	const to = { gold: 0, food: 0, weapons: [], captives: [] };
	const given = DE.transferGift(from, to, { advice: "ooze" }, state);
	assert.equal(given.moved, true);
	assert.equal(given.value, 50);
	assert.equal(DE.isMonsterKnown(state, "ooze"), true);
	assert.equal(typeof DE.buyMonsterAdvice, "undefined");
	assert.match(DE.formatMonsterAdvice(state, "ooze"), /intelligent|not intelligent/);
});

test("advice gift chance falls as monsters become known", function () {
	const state = DE.newCampaign("advice-chance");
	assert.equal(DE.unknownMonsterAdviceKeys(state).length, 6);
	assert.ok(Math.abs(DE.adviceGiftChance(state) - 0.5) < 1e-9);
	DE.markMonsterKnown(state, "ooze");
	DE.markMonsterKnown(state, "spider");
	DE.markMonsterKnown(state, "dragon");
	assert.equal(DE.unknownMonsterAdviceKeys(state).length, 3);
	assert.ok(Math.abs(DE.adviceGiftChance(state) - 0.25) < 1e-9);
	DE.MONSTER_TYPES.forEach(function (key) { DE.markMonsterKnown(state, key); });
	assert.equal(DE.adviceGiftChance(state), 0);
	assert.equal(DE.unknownMonsterAdviceKeys(state).length, 0);
});

test("serialize round-trips a campaign", function () {
	const state = DE.newCampaign("save-me");
	state.player.gold = 777;
	const again = DE.deserializeState(DE.serializeState(state));
	assert.equal(again.player.gold, 777);
	assert.equal(again.seedText, state.seedText);
	assert.equal(again.factions.length, state.factions.length);
});

test("named save store can save load and delete", function () {
	const mem = {};
	DE._storage = {
		getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
		setItem: function (k, v) { mem[k] = String(v); },
		removeItem: function (k) { delete mem[k]; }
	};
	const state = DE.newCampaign("named-save");
	assert.equal(DE.saveToLocal(state, "  ").ok, false);
	assert.equal(DE.saveToLocal(state, "Deep Camp").ok, true);
	assert.equal(DE.listLocalSaves().length, 1);
	assert.equal(DE.listLocalSaves()[0].name, "Deep Camp");
	const loaded = DE.loadFromLocal("Deep Camp");
	assert.equal(loaded.ok, true);
	assert.equal(loaded.state.seedText, "named-save");
	assert.equal(DE.deleteLocalSave("Deep Camp").ok, true);
	assert.equal(DE.listLocalSaves().length, 0);
	DE._storage = null;
});
