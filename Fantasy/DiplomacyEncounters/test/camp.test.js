const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE, unit } = require("./harness.js");

const DE = loadDE();

function civFaction(state) {
	return DE.civilizedFactions(state).find(function (f) {
		return f.id !== state.hostileFactionId;
	});
}

function addHireling(state, fac, extras) {
	extras = extras || {};
	const u = DE.makeUnit(state, extras.type || "melee", fac.species, "player", {
		homeFactionId: fac.id
	});
	u.homeFactionId = fac.id;
	u.hirePrice = extras.hirePrice != null ? extras.hirePrice : 25;
	u.hireRemitsLeft = extras.hireRemitsLeft != null ? extras.hireRemitsLeft : 2;
	u.hireExpired = !!extras.hireExpired;
	u.homeVillageId = extras.homeVillageId || DE.villagesByFaction(state, fac.id)[0].id;
	state.player.units.push(u);
	return u;
}

test("interrogate chance is 30 percent cheap and 50 percent expensive", function () {
	assert.equal(DE.interrogateChance("melee"), 0.3);
	assert.equal(DE.interrogateChance("archer"), 0.3);
	assert.equal(DE.interrogateChance("ranger"), 0.5);
	assert.equal(DE.interrogateChance("fireMage"), 0.5);
});

test("language training takes 10 encounters and teaches the species", function () {
	const state = DE.newCampaign("lang-train");
	const fac = civFaction(state);
	const cap = DE.makeCaptiveRecord(DE.makeUnit(state, "melee", fac.species, fac.id, { homeFactionId: fac.id }));
	state.player.captives = [cap];
	assert.equal(DE.hasLanguage(state, fac.species), false);
	assert.equal(DE.startLanguageTraining(state, cap.id).ok, true);
	assert.equal(state.player.captives.length, 0);
	assert.equal(state.player.training[0].remaining, 10);
	assert.equal(DE.tickTraining(state, 10).length, 1);
	assert.equal(DE.hasLanguage(state, fac.species), true);
	assert.equal(state.player.captives.length, 1);
	assert.equal(state.player.captives[0].id, cap.id);
});

test("a hireling cannot kit-train without the language and returns after training", function () {
	const state = DE.newCampaign("hire-train");
	const fac = civFaction(state);
	const u = addHireling(state, fac);
	assert.equal(DE.startTraining(state, u.id).ok, false);
	DE.knowLanguage(state, fac.species);
	assert.equal(DE.startTraining(state, u.id).ok, true);
	assert.equal(state.player.units.some(function (x) { return x.id === u.id; }), false);
	DE.tickTraining(state, 5);
	assert.equal(state.player.units.some(function (x) { return x.id === u.id; }), true);
	assert.equal(DE.canUseKit(state, "melee"), true);
});

test("hiring a player unit assigns a village and a two-remittance contract", function () {
	const state = DE.newCampaign("hire-assign");
	const fac = civFaction(state);
	const village = DE.villagesByFaction(state, fac.id)[0];
	const raw = unit("melee", { id: "h1", factionId: fac.id, species: fac.species, hirable: true });
	state.mission = { pendingEncounter: { villageRec: village, factionId: fac.id } };
	const buyer = { gold: 80, food: 0, weapons: [], captives: [] };
	const seller = { gold: 0, food: 0, weapons: [], captives: [] };
	const to = [];
	const res = DE.applyTradeDeal(state, buyer, seller, buyer, {
		kind: "unit",
		type: "melee",
		id: "h1",
		fromUnits: [raw],
		toUnits: to,
		sellerGoldOwner: seller,
		buyerFactionId: "player"
	});
	assert.equal(res.ok, true);
	assert.equal(to[0].homeVillageId, village.id);
	assert.equal(to[0].hireRemitsLeft, 2);
	assert.equal(to[0].hirePrice, 25);
	assert.equal(to[0].hireExpired, false);
});

test("two remittances expire a hireling; pay again lasts three and funds the village", function () {
	const state = DE.newCampaign("hire-remit");
	const fac = civFaction(state);
	const u = addHireling(state, fac);
	const village = DE.villageById(state, u.homeVillageId);
	const gold0 = village.gold;
	DE.tickHireContracts(state, 1);
	assert.equal(u.hireExpired, false);
	assert.equal(u.hireRemitsLeft, 1);
	DE.tickHireContracts(state, 1);
	assert.equal(u.hireExpired, true);
	state.player.gold = 200;
	const paid = DE.rehireUnit(state, u.id);
	assert.equal(paid.ok, true);
	assert.equal(u.hireRemitsLeft, 3);
	assert.equal(u.hireExpired, false);
	assert.equal(village.gold, gold0 + 25);
	assert.equal(state.player.gold, 175);
});

test("letting a hireling go returns them to the faction pool", function () {
	const state = DE.newCampaign("hire-release");
	const fac = civFaction(state);
	const before = (fac.poolUnits || []).length;
	const u = addHireling(state, fac);
	const res = DE.releaseHireling(state, u.id);
	assert.equal(res.ok, true);
	assert.equal(state.player.units.some(function (x) { return x.id === u.id; }), false);
	assert.equal(fac.poolUnits.length, before + 1);
	assert.equal(fac.poolUnits[fac.poolUnits.length - 1].factionId, fac.id);
});

test("capturing a hireling makes a captive and hits attitude", function () {
	const state = DE.newCampaign("hire-capture");
	const fac = civFaction(state);
	const u = addHireling(state, fac);
	const before = DE.trustFromLog(state, fac.id).center;
	const res = DE.captureHireling(state, u.id);
	assert.equal(res.ok, true);
	assert.equal(state.player.captives.some(function (c) { return c.id === u.id; }), true);
	assert.ok(DE.trustFromLog(state, fac.id).center < before);
});

test("a camp gift to a hireling moves faction trust", function () {
	const state = DE.newCampaign("hire-gift");
	const fac = civFaction(state);
	const u = addHireling(state, fac);
	state.player.gold = 80;
	state.player.food = 10;
	const before = DE.trustFromLog(state, fac.id).center;
	const res = DE.giftHireling(state, u.id, { gold: 20, food: 2 });
	assert.equal(res.ok, true);
	assert.equal(state.player.gold, 60);
	assert.equal(state.player.food, 8);
	assert.ok(DE.trustFromLog(state, fac.id).center > before);
});

test("interrogating a captive can reveal a hidden village", function () {
	const state = DE.newCampaign("interrogate");
	const fac = civFaction(state);
	DE.knowLanguage(state, fac.species);
	const hidden = DE.villagesByFaction(state, fac.id).filter(function (v) { return !v.discovered; });
	assert.ok(hidden.length);
	const cap = DE.makeCaptiveRecord(DE.makeUnit(state, "melee", fac.species, fac.id, { homeFactionId: fac.id }));
	state.player.captives = [cap];
	let found = false;
	for (let i = 0; i < 40 && !found; i++) {
		cap.interrogated = false;
		hidden.forEach(function (v) { v.discovered = false; });
		const res = DE.interrogateCaptive(state, cap.id);
		assert.equal(res.ok, true);
		assert.equal(cap.interrogated, true);
		if (res.found) found = true;
	}
	assert.equal(found, true);
});

test("hire and capture do not teach a language", function () {
	const state = DE.newCampaign("no-instant-lang");
	const fac = civFaction(state);
	DE.onPoliticsHire(state, fac.id);
	assert.equal(DE.hasLanguage(state, fac.species), false);
	DE.onPoliticsCapture(state, fac.id);
	assert.equal(DE.hasLanguage(state, fac.species), false);
});
