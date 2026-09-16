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

test("food trades still work; weapon pattern deals are unused", function () {
	const state = { nextId: 1, rng: 1 };
	const buyer = { gold: 200, food: 0, weapons: [], captives: [] };
	const seller = { gold: 10, food: 8, weapons: ["melee"], captives: [] };
	const food = DE.applyTradeDeal(state, buyer, seller, buyer, { kind: "food", amount: 3, sellerGoldOwner: seller });
	assert.equal(food.ok, true);
	assert.equal(buyer.food, 3);
});

test("village tip and hire ask gate on trust", function () {
	const state = DE.newCampaign("trade-gates");
	const fac = DE.civilizedFactions(state)[0];
	const village = DE.villageByFaction(state, fac.id);
	const enc = {
		factionId: fac.id,
		kind: "field",
		playerStuff: { gold: 200, food: 0, weapons: [], captives: [] },
		aiStuff: { gold: 10, food: 0, weapons: [], captives: [] },
		aiUnits: [unit("melee", { id: "m1", hirable: true }), unit("melee", { id: "m2", hirable: false })],
		hireUnlocked: false
	};
	state.logs[fac.id] = [];
	const cold = DE.askVillageLocation(state, enc);
	assert.equal(cold.ok, false);
	assert.match(cold.reason, /trust|later/i);
	state.logs[fac.id] = [
		{ rounds: [{ player: "gift", ai: "greet", giftValue: 200 }], traded: true, gifted: true, giftValue: 200 }
	];
	const tip = DE.askVillageLocation(state, enc);
	assert.equal(tip.ok, true);
	assert.equal(village.discovered, true);
	assert.equal(enc.playerStuff.gold, 150);
	const hire = DE.askToHire(state, enc);
	assert.equal(hire.ok, true);
	assert.equal(enc.hireUnlocked, true);
	assert.equal(DE.hirableGroups(enc).length, 1);
});

test("monster advice marks a foe known for 50g", function () {
	const state = DE.newCampaign("advice");
	const enc = {
		playerStuff: { gold: 80, food: 0, weapons: [], captives: [] },
		aiStuff: { gold: 0, food: 0, weapons: [], captives: [] }
	};
	assert.equal(DE.isMonsterKnown(state, "ooze"), false);
	const res = DE.buyMonsterAdvice(state, enc, "ooze");
	assert.equal(res.ok, true);
	assert.equal(DE.isMonsterKnown(state, "ooze"), true);
	assert.equal(enc.playerStuff.gold, 30);
});
