const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE } = require("./harness.js");

const DE = loadDE();

test("worldgen makes ten civilized factions in 4-3-2-1 species split", function () {
	const state = DE.newCampaign("test-seed");
	const civ = DE.civilizedFactions(state);
	assert.equal(civ.length, 10);
	const counts = {};
	for (let i = 0; i < civ.length; i++) {
		counts[civ[i].species] = (counts[civ[i].species] || 0) + 1;
		assert.equal(civ[i].leaders.length, 5);
		assert.ok(civ[i].mages.length >= 3 && civ[i].mages.length <= 5);
		assert.ok(civ[i].colors.length === 2);
		assert.ok(civ[i].symbol);
	}
	const vals = Object.keys(counts).map(function (k) { return counts[k]; }).sort().reverse();
	assert.deepEqual(vals, [4, 3, 2, 1]);
	const loners = state.factions.filter(function (f) { return f.kind === "loner"; });
	assert.equal(loners.length, 2);
	assert.equal(state.animalTypes.length, 4);
	assert.ok(state.hostileFactionId);
	assert.equal(state.player.gold, 1000);
	assert.equal(state.player.units.filter(function (u) { return u.type === "infantry"; }).length, 15);
	assert.equal(state.player.units.filter(function (u) { return u.type === "machineGunner"; }).length, 5);
});

test("empty weight aims near average value 30", function () {
	const state = DE.newCampaign("weights");
	const w = state.encounterWeights;
	const contrib = w.small * 10 + w.medium * 27.5 + w.large * 47.5 + w.huge * 80 + w.monster * 28;
	const sum = w.small + w.medium + w.large + w.huge + w.monster + w.empty;
	const avg = contrib / sum;
	assert.ok(Math.abs(avg - 30) < 1.5);
});

test("ten villages sit at unique distances from base", function () {
	const state = DE.newCampaign("villages");
	assert.equal(state.villages.length, 10);
	const depths = state.villages.map(function (v) { return v.distance; }).slice().sort(function (a, b) { return a - b; });
	assert.equal(depths.join(","), "2,3,4,5,6,7,8,9,10,11");
	assert.equal(state.villages.filter(function (v) { return v.discovered; }).length, 0);
	assert.equal(DE.discoveredVillages(state).length, 0);
});

test("undiscovered village appears at its depth", function () {
	const state = DE.newCampaign("find-village");
	const target = state.villages[0];
	state.encounterWeights = { empty: 1, small: 0, medium: 0, large: 0, huge: 0, monster: 0 };
	const ids = state.player.units.map(function (u) { return u.id; });
	DE.startMission(state, { unitIds: ids, foodBuy: 400, goldTake: 50, distance: target.distance + 2 });
	while (state.mission && state.mission.progressed < target.distance) {
		if (state.ui.screen === "empty") DE.continueAfterResolve(state);
		else if (state.ui.screen === "encounter") {
			DE.finishEncounter(state, state.mission.pendingEncounter, {
				hold: { player: true, ai: false },
				notes: ["pushed on"],
				battle: null,
				gift: null
			});
			DE.continueAfterResolve(state);
		} else break;
	}
	assert.ok(state.mission);
	assert.equal(state.mission.progressed, target.distance);
	if (state.ui.screen === "empty") DE.continueAfterResolve(state);
	assert.equal(state.ui.screen, "encounter");
	assert.equal(state.mission.pendingEncounter.village, true);
	assert.equal(state.mission.pendingEncounter.villageRec.id, target.id);
	assert.equal(target.discovered, true);
});

test("mission food costs half a gold and hold-ground progress", function () {
	const state = DE.newCampaign("mission");
	state.encounterWeights = { empty: 1, small: 0, medium: 0, large: 0, huge: 0, monster: 0 };
	const ids = state.player.units.map(function (u) { return u.id; });
	const start = DE.startMission(state, { unitIds: ids, foodBuy: 200, goldTake: 100, distance: 3 });
	assert.equal(start.ok, true);
	assert.equal(state.ui.screen, "empty");
	assert.equal(state.mission.remaining, 2);
	assert.equal(state.mission.stuff.food, 200 - 20);
	assert.equal(state.mission.stuff.gold, 100);
	assert.equal(state.player.gold, 1000 - 100 - 100); /* food 200*0.5 + goldTake 100 */
});

test("training unlocks a role after five encounters", function () {
	const state = DE.newCampaign("train");
	state.player.units.push(DE.makeUnit(state, "melee", "goblin", "player"));
	const id = state.player.units[state.player.units.length - 1].id;
	assert.equal(DE.canRecruit(state, "melee"), false);
	assert.equal(DE.startTraining(state, id).ok, true);
	assert.equal(DE.tickTraining(state, 5).length, 1);
	assert.equal(DE.canRecruit(state, "melee"), true);
});

test("base remittance pays 100g per five encounters on return", function () {
	const state = DE.newCampaign("pay");
	state.totalEncounters = 12;
	state.incomeEncountersPaid = 0;
	const income = DE.grantBaseIncome(state);
	assert.equal(income.gold, 200);
	assert.equal(state.player.gold, 1200);
});

test("log search finds leader names", function () {
	const state = DE.newCampaign("log");
	DE.appendLog(state, {
		factionId: "Fdemo",
		leaderName: "Aska of the Pit",
		rounds: [{ player: "greet", ai: "greet" }],
		village: false,
		summary: "4 Melee"
	});
	const rows = DE.searchLog(state, "Fdemo", "aska", "all");
	assert.equal(rows.length, 1);
	assert.equal(DE.searchLog(state, "Fdemo", "dragon", "all").length, 0);
});

test("not holding ground does not spend remaining encounters", function () {
	const state = DE.newCampaign("hold-ground");
	const ids = state.player.units.map(function (u) { return u.id; });
	state.encounterWeights = { empty: 0, small: 1, medium: 0, large: 0, huge: 0, monster: 0 };
	DE.startMission(state, { unitIds: ids, foodBuy: 200, distance: 6 });
	if (!state.mission.pendingEncounter) return;
	const rem = state.mission.remaining;
	DE.finishEncounter(state, state.mission.pendingEncounter, {
		hold: { player: false, ai: true },
		notes: ["gave ground"],
		battle: null,
		gift: null
	});
	assert.equal(state.mission.remaining, rem);
});

test("trade is blocked on the first action of an encounter", function () {
	const state = DE.newCampaign("trade-lock");
	const ids = state.player.units.map(function (u) { return u.id; });
	state.encounterWeights = { empty: 0, small: 1, medium: 0, large: 0, huge: 0, monster: 0 };
	DE.startMission(state, { unitIds: ids, foodBuy: 200, distance: 4 });
	if (!state.mission.pendingEncounter) return;
	const r = DE.playRound(state, "trade", {});
	assert.equal(r.ok, false);
});
