const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE } = require("./harness.js");

const DE = loadDE();

test("worldgen makes six civilized factions in a 2-2-1-1 species split", function () {
	const state = DE.newCampaign("test-seed");
	const civ = DE.civilizedFactions(state);
	assert.equal(civ.length, 6);
	const counts = {};
	for (let i = 0; i < civ.length; i++) {
		counts[civ[i].species] = (counts[civ[i].species] || 0) + 1;
		assert.equal(DE.livingLeaders(state, civ[i]).length, 5);
		assert.ok(civ[i].mages.length >= 3 && civ[i].mages.length <= 5);
		assert.ok(civ[i].roster.indexOf("ranger") >= 0);
		assert.ok(civ[i].colors.length === 2);
		assert.ok(civ[i].symbol);
	}
	const vals = Object.keys(counts).map(function (k) { return counts[k]; }).sort().reverse();
	assert.deepEqual(vals, [2, 2, 1, 1]);
	assert.equal(Object.keys(counts).length, 4);
	const loners = state.factions.filter(function (f) { return f.kind === "loner"; });
	assert.equal(loners.length, 2);
	loners.forEach(function (L) {
		assert.equal(L.name, DE.SPECIES_LABELS[L.monsterType] || L.monsterType);
		assert.equal(DE.livingLeaders(state, L).length, 0);
		assert.ok((L.poolUnits || []).length);
		assert.ok(L.poolUnits[0].name.length > 2);
		assert.notEqual(L.name, L.poolUnits[0].name);
	});
	assert.equal(state.animalTypes.length, 4);
	assert.ok(state.hostileFactionId);
	assert.equal(state.player.gold, 300);
	assert.equal(state.player.units.filter(function (u) { return u.type === "infantry"; }).length, 8);
	assert.equal(state.player.units.filter(function (u) { return u.type === "machineGunner"; }).length, 2);
	assert.equal(state.player.units.filter(function (u) { return u.type === "civilian"; }).length, 5);
	assert.equal(state.player.units.some(function (u) { return u.type === "ranger"; }), false);
	assert.equal(DE.canRecruit(state, "ranger"), false);
	assert.equal(DE.canUseKit(state, "ranger"), false);
	let rangerCount = 0;
	DE.civilizedFactions(state).forEach(function (f) {
		const army = DE.factionArmyUnits(state, f) || [];
		for (let i = 0; i < army.length; i++) {
			if (army[i] && army[i].type === "ranger") rangerCount++;
		}
	});
	assert.ok(rangerCount > 0);
	assert.ok([5, 10, 15, 20].indexOf(state.monsterCvBump) >= 0);
	assert.ok([5, 10, 15, 20].indexOf(state.intelligentCvBump) >= 0);
});

test("empty weight aims near average value 30", function () {
	const state = DE.newCampaign("weights");
	const w = state.encounterWeights;
	const contrib = w.small * 10 + w.medium * 27.5 + w.large * 47.5 + w.huge * 80 + w.monster * 28;
	const sum = w.small + w.medium + w.large + w.huge + w.monster + w.empty;
	const avg = contrib / sum;
	assert.ok(Math.abs(avg - 30) < 1.5);
});

test("each faction has 1d3 villages at pythagorean depths", function () {
	const state = DE.newCampaign("villages");
	const civ = DE.civilizedFactions(state);
	assert.ok(state.villages.length >= civ.length);
	assert.ok(state.villages.length <= civ.length * 3);
	civ.forEach(function (f) {
		const n = DE.villagesByFaction(state, f.id).length;
		assert.ok(n >= 1 && n <= 3);
	});
	state.villages.forEach(function (v) {
		assert.ok(v.distance >= 1 && v.distance <= 9);
		assert.equal(DE.villageMarchLength(v), v.distance * 2 - 1);
	});
});

test("broken revisit lengths resync to depth times two minus one", function () {
	const state = DE.newCampaign("resync");
	const v = state.villages[0];
	v.revisitLength = 2;
	v.distance = 3;
	DE.syncVillageMarch(v);
	assert.equal(v.revisitLength, 5);
});

test("mission depth rises to midpoint then falls", function () {
	assert.equal(DE.missionDepth({ distance: 6, progressed: 0 }), 0);
	assert.equal(DE.missionDepth({ distance: 6, progressed: 1 }), 1);
	assert.equal(DE.missionDepth({ distance: 6, progressed: 3 }), 3);
	assert.equal(DE.missionDepth({ distance: 6, progressed: 4 }), 2);
	assert.equal(DE.missionDepth({ distance: 6, progressed: 6 }), 0);
	assert.equal(DE.missionDepth({ distance: 5, progressed: 1 }), 1);
	assert.equal(DE.missionDepth({ distance: 5, progressed: 3 }), 3);
	assert.equal(DE.missionDepth({ distance: 5, progressed: 4 }), 2);
	assert.equal(DE.missionDepth({ distance: 5, progressed: 5 }), 1);
});

test("encounter depth is one step ahead of progress", function () {
	assert.equal(DE.encounterDepth({ distance: 6, progressed: 0 }), 1);
	assert.equal(DE.encounterDepth({ distance: 6, progressed: 2 }), 3);
	assert.equal(DE.encounterDepth({ distance: 6, progressed: 3 }), 2);
	assert.equal(DE.encounterDepth({ distance: 5, progressed: 0 }), 1);
	assert.equal(DE.encounterDepth({ distance: 5, progressed: 2 }), 3);
	assert.equal(DE.encounterDepth({ distance: 5, progressed: 3 }), 2);
	assert.equal(DE.encounterDepth({ distance: 5, progressed: 4 }), 1);
	assert.equal(DE.encounterDepth({ distance: 3, progressed: 0 }), 1);
	assert.equal(DE.encounterDepth({ distance: 3, progressed: 1 }), 2);
	assert.equal(DE.encounterDepth({ distance: 3, progressed: 2 }), 1);
});

test("each village at depth keeps its own scout weight", function () {
	const one = DE.scoutVillageRollTable({
		villages: [{ id: "a", distance: 2, discovered: false }]
	}, 2);
	assert.equal(one.villageWeight, 2);
	assert.equal(one.other, 3);
	assert.equal(one.total, 5);
	assert.equal(one.villageWeight / one.total, 2 / 5);

	const two = DE.scoutVillageRollTable({
		villages: [
			{ id: "a", distance: 2, discovered: false },
			{ id: "b", distance: 2, discovered: false }
		]
	}, 2);
	assert.equal(two.villageWeight, 4);
	assert.equal(two.other, 3);
	assert.equal(two.total, 7);
	assert.equal(two.villageWeight / two.total, 4 / 7);

	const mixed = DE.scoutVillageRollTable({
		villages: [
			{ id: "a", distance: 2, discovered: false },
			{ id: "b", distance: 2, discovered: true }
		]
	}, 2);
	assert.equal(mixed.villageWeight, 3);
	assert.equal(mixed.total, 6);
});

test("scout village weights drop empty buckets", function () {
	const state = { rng: 1, villages: [] };
	assert.equal(DE.pickScoutVillage(state, 2), null);
	state.villages = [{ id: "Vu", distance: 2, discovered: false }];
	const saved = DE.SCOUT_VILLAGE_WEIGHTS;
	DE.SCOUT_VILLAGE_WEIGHTS = { undiscovered: 2, discovered: 1, other: 0 };
	assert.equal(DE.pickScoutVillage(state, 2).id, "Vu");
	state.villages[0].discovered = true;
	assert.equal(DE.pickScoutVillage(state, 2).id, "Vu");
	DE.SCOUT_VILLAGE_WEIGHTS = { undiscovered: 2, discovered: 1, other: 3 };
	state.villages = [{ id: "Vu", distance: 9, discovered: false }];
	assert.equal(DE.pickScoutVillage(state, 2), null);
	DE.SCOUT_VILLAGE_WEIGHTS = saved;
});

test("matching depth does not guarantee an undiscovered village", function () {
	const saved = DE.SCOUT_VILLAGE_WEIGHTS;
	DE.SCOUT_VILLAGE_WEIGHTS = { undiscovered: 0, discovered: 0, other: 3 };
	const state = DE.newCampaign("miss-village");
	const target = state.villages.slice().sort(function (a, b) { return a.distance - b.distance; })[0];
	state.villages = [target];
	state.encounterWeights = { empty: 1, small: 0, medium: 0, large: 0, huge: 0, monster: 0 };
	const ids = state.player.units.map(function (u) { return u.id; });
	const pathLen = Math.max(target.distance * 2, 4);
	DE.startMission(state, { unitIds: ids, foodBuy: 200, goldTake: 50, distance: pathLen });
	var sawVillage = false;
	var guard = 0;
	while (state.mission && guard < 40) {
		guard++;
		if (state.mission.pendingEncounter && state.mission.pendingEncounter.village) sawVillage = true;
		if (state.ui.screen === "empty") DE.continueAfterResolve(state);
		else if (state.ui.screen === "encounter") {
			state.mission.progressed += 1;
			state.mission.remaining -= 1;
			state.mission.pendingEncounter = null;
			state.ui.screen = "empty";
			DE.continueAfterResolve(state);
		} else break;
	}
	DE.SCOUT_VILLAGE_WEIGHTS = saved;
	assert.equal(sawVillage, false);
	assert.equal(target.discovered, false);
});

test("undiscovered village can appear when encounter depth matches", function () {
	const saved = DE.SCOUT_VILLAGE_WEIGHTS;
	DE.SCOUT_VILLAGE_WEIGHTS = { undiscovered: 2, discovered: 1, other: 0 };
	const state = DE.newCampaign("find-village");
	const target = state.villages.slice().sort(function (a, b) { return a.distance - b.distance; })[0];
	state.villages = [target];
	state.encounterWeights = { empty: 1, small: 0, medium: 0, large: 0, huge: 0, monster: 0 };
	const ids = state.player.units.map(function (u) { return u.id; });
	const pathLen = Math.max(target.distance * 2, 4);
	DE.startMission(state, { unitIds: ids, foodBuy: 200, goldTake: 50, distance: pathLen });
	var guard = 0;
	while (state.mission && state.ui.screen !== "encounter" && guard < 40) {
		guard++;
		if (state.ui.screen === "empty") DE.continueAfterResolve(state);
		else break;
	}
	DE.SCOUT_VILLAGE_WEIGHTS = saved;
	assert.equal(state.ui.screen, "encounter");
	assert.equal(state.mission.pendingEncounter.village, true);
	assert.equal(state.mission.pendingEncounter.villageRec.id, target.id);
	assert.equal(DE.encounterDepth(state.mission), target.distance);
	assert.equal(target.discovered, true);
});

test("free scouts can revisit a discovered village at this depth", function () {
	const saved = DE.SCOUT_VILLAGE_WEIGHTS;
	DE.SCOUT_VILLAGE_WEIGHTS = { undiscovered: 2, discovered: 1, other: 0 };
	const state = DE.newCampaign("revisit-scout");
	const v = {
		id: "Vknown",
		name: "Knownhall",
		factionId: DE.civilizedFactions(state)[0].id,
		distance: 1,
		discovered: true,
		revisitLength: 1
	};
	state.villages = [v];
	state.encounterWeights = { empty: 1, small: 0, medium: 0, large: 0, huge: 0, monster: 0 };
	const ids = state.player.units.slice(0, 2).map(function (u) { return u.id; });
	DE.startMission(state, { unitIds: ids, foodBuy: 40, goldTake: 10, distance: 3 });
	DE.SCOUT_VILLAGE_WEIGHTS = saved;
	assert.equal(state.ui.screen, "encounter");
	assert.equal(state.mission.pendingEncounter.village, true);
	assert.equal(state.mission.pendingEncounter.villageRec.id, "Vknown");
});

test("depth-1 village march hits village on the first beat", function () {
	const state = DE.newCampaign("depth-one");
	const v = {
		id: "Vdepth1",
		name: "Nearcamp",
		factionId: DE.civilizedFactions(state)[0].id,
		distance: 1,
		discovered: true,
		revisitLength: 1
	};
	state.villages = [v];
	state.encounterWeights = { empty: 1, small: 0, medium: 0, large: 0, huge: 0, monster: 0 };
	const ids = state.player.units.slice(0, 2).map(function (u) { return u.id; });
	const start = DE.startMission(state, { unitIds: ids, foodBuy: 20, goldTake: 10, villageId: v.id });
	assert.equal(start.ok, true);
	assert.equal(state.mission.distance, 1);
	assert.equal(DE.encounterDepth(state.mission), 1);
	assert.equal(state.ui.screen, "encounter");
	assert.equal(state.mission.pendingEncounter.village, true);
	assert.equal(state.mission.beat, 1);
});

test("fleeing a village march does not force the village again", function () {
	const state = DE.newCampaign("flee-village");
	const ids = state.player.units.map(function (u) { return u.id; });
	const fac = DE.civilizedFactions(state)[0];
	const v = {
		id: "Vflee",
		name: "Fleehall",
		factionId: fac.id,
		distance: 2,
		discovered: true,
		revisitLength: 3
	};
	state.villages = [v];
	state.encounterWeights = { empty: 0, small: 1, medium: 0, large: 0, huge: 0, monster: 0 };
	DE.startMission(state, { unitIds: ids, foodBuy: 80, goldTake: 20, villageId: v.id });
	assert.equal(state.mission.villageAt, 2);
	/* Reach the village depth by holding ground on the approach beat. */
	while (state.mission && !(state.mission.pendingEncounter && state.mission.pendingEncounter.village)) {
		if (state.ui.screen === "empty") {
			DE.nextBeat(state);
			continue;
		}
		assert.ok(state.mission.pendingEncounter, "expected an encounter while approaching");
		DE.finishEncounter(state, state.mission.pendingEncounter, {
			hold: { player: true, ai: false },
			notes: ["held"],
			battle: null,
			gift: null
		});
		DE.nextBeat(state);
	}
	assert.ok(state.mission.pendingEncounter);
	assert.equal(state.mission.pendingEncounter.village, true);
	const rem = state.mission.remaining;
	DE.finishEncounter(state, state.mission.pendingEncounter, {
		hold: { player: false, ai: true },
		notes: ["ran"],
		battle: null,
		gift: null
	});
	assert.equal(state.mission.villageAt, -1);
	assert.equal(state.mission.remaining, rem);
	DE.nextBeat(state);
	if (state.mission && state.mission.pendingEncounter) {
		assert.equal(state.mission.pendingEncounter.village, false);
	}
});

test("fleeing a scouted village does not roll it again this march", function () {
	const state = DE.newCampaign("scout-flee-repeat");
	const fac = DE.civilizedFactions(state)[0];
	const v = {
		id: "Vloop",
		name: "Loopwell",
		factionId: fac.id,
		distance: 2,
		discovered: false,
		revisitLength: 3,
		units: [],
		gold: 100,
		magic: 0,
		food: 20,
		weapons: []
	};
	state.villages = [v];
	state.encounterWeights = { empty: 0, small: 1, medium: 0, large: 0, huge: 0, monster: 0 };
	const saved = DE.SCOUT_VILLAGE_WEIGHTS;
	DE.SCOUT_VILLAGE_WEIGHTS = { undiscovered: 2, discovered: 1, other: 0 };
	const ids = state.player.units.map(function (u) { return u.id; });
	DE.startMission(state, { unitIds: ids, foodBuy: 80, goldTake: 20, distance: 5 });
	var guard = 0;
	while (state.mission && !(state.mission.pendingEncounter && state.mission.pendingEncounter.village) && guard < 20) {
		guard++;
		if (state.ui.screen === "empty") {
			DE.nextBeat(state);
			continue;
		}
		assert.ok(state.mission.pendingEncounter, "expected an encounter while approaching");
		DE.finishEncounter(state, state.mission.pendingEncounter, {
			hold: { player: true, ai: false },
			notes: ["held"],
			battle: null,
			gift: null
		});
		DE.nextBeat(state);
	}
	assert.ok(state.mission && state.mission.pendingEncounter && state.mission.pendingEncounter.village);
	assert.equal(state.mission.pendingEncounter.villageName, "Loopwell");
	DE.finishEncounter(state, state.mission.pendingEncounter, {
		hold: { player: false, ai: true },
		notes: ["ran"],
		battle: null,
		gift: null
	});
	assert.equal(state.mission.metVillageIds && state.mission.metVillageIds[0], "Vloop");
	assert.equal(DE.pickScoutVillage(state, 2), null);
	DE.nextBeat(state);
	if (state.mission && state.mission.pendingEncounter) {
		assert.equal(state.mission.pendingEncounter.village, false);
		assert.notEqual(state.mission.pendingEncounter.villageName, "Loopwell");
	}
	DE.SCOUT_VILLAGE_WEIGHTS = saved;
});

test("short scouts never find villages deeper than the path apex", function () {
	const state = DE.newCampaign("no-deep-end");
	state.villages = [{
		id: "Vdeep",
		name: "TooDeep",
		factionId: DE.civilizedFactions(state)[0].id,
		distance: 3,
		discovered: false,
		revisitLength: 5
	}];
	state.encounterWeights = { empty: 1, small: 0, medium: 0, large: 0, huge: 0, monster: 0 };
	const ids = state.player.units.slice(0, 2).map(function (u) { return u.id; });
	DE.startMission(state, { unitIds: ids, foodBuy: 40, goldTake: 10, distance: 3 });
	var sawVillage = false;
	var depths = [];
	var guard = 0;
	while (state.mission && guard < 20) {
		guard++;
		if (state.ui.screen === "encounter" || state.ui.screen === "empty") {
			depths.push(DE.encounterDepth(state.mission));
			if (state.mission.pendingEncounter && state.mission.pendingEncounter.village) sawVillage = true;
			if (state.ui.screen === "encounter") {
				state.mission.progressed += 1;
				state.mission.remaining -= 1;
				state.mission.pendingEncounter = null;
				state.ui.screen = "empty";
			}
			DE.continueAfterResolve(state);
		} else break;
	}
	assert.equal(sawVillage, false);
	assert.ok(depths.length >= 1);
	assert.ok(Math.max.apply(null, depths) <= 2);
});

test("leftover mission food is sold for half a gold each", function () {
	const state = DE.newCampaign("sell-food");
	state.player.food = 0;
	state.mission = {
		id: "M99",
		party: [],
		stuff: { gold: 10, food: 8, weapons: [], captives: [] },
		encountersAtStart: 0,
		startSnapshot: { party: 0, gold: 10, food: 8, weapons: 0, captives: 0 },
		cancelled: false
	};
	const goldBefore = state.player.gold;
	DE.returnToBase(state);
	assert.equal(state.player.food, 0);
	assert.equal(state.player.gold, goldBefore + 10 + 4);
	assert.ok(/Sold 8 leftover/.test(state.ui.flash || ""));
});

test("expected food buy is party times encounters minus camp stores", function () {
	const state = DE.newCampaign("expected-food");
	state.player.food = 10;
	state.ui.missionDistance = 4;
	state.ui.sendCounts = {};
	const groups = DE.groupUnits(DE.playerLiving(state));
	const infantry = groups.find(function (g) { return g.type === "infantry"; });
	state.ui.sendCounts[DE.groupSendKey(infantry)] = 5;
	assert.equal(DE.expectedFoodPartySize(state), 5);
	assert.equal(DE.expectedFoodBuy(state), 5 * 4 - 10);
});

test("hunger cuts combat value and wipes at minus 40 percent", function () {
	const state = DE.newCampaign("hunger");
	state.villages = [];
	state.encounterWeights = { empty: 1, small: 0, medium: 0, large: 0, huge: 0, monster: 0 };
	const ids = state.player.units.filter(function (u) { return u.type === "infantry"; }).slice(0, 2).map(function (u) { return u.id; });
	const start = DE.startMission(state, { unitIds: ids, foodBuy: 0, goldTake: 0, distance: 12 });
	assert.equal(start.ok, true);
	assert.equal(state.mission.hungryBeats, 1);
	assert.equal(DE.hungerPenalty(state), 0.05);
	assert.equal(DE.hungerLabel(state), "Hungry −5%");
	const fed = DE.sideStrength(state.mission.party, [], { mission: null });
	const hungry = DE.sideStrength(state.mission.party, [], state);
	assert.ok(Math.abs(hungry - fed * 0.95) < 1e-9);
	state.mission.hungryBeats = 7;
	state.mission.stuff.food = 0;
	const ate = DE.eatFood(state);
	assert.equal(ate.hungry, true);
	assert.equal(ate.penalty, 0.4);
	DE.starveExpedition(state);
	assert.equal(state.mission, null);
	assert.equal(state.ui.screen, "base");
	assert.ok(/starved/i.test(state.ui.flash || ""));
	assert.equal(DE.playerLiving(state).filter(function (u) {
		return ids.indexOf(u.id) >= 0;
	}).length, 0);
});

test("mission food costs half a gold and hold-ground progress", function () {
	const state = DE.newCampaign("mission");
	state.encounterWeights = { empty: 1, small: 0, medium: 0, large: 0, huge: 0, monster: 0 };
	const ids = state.player.units.map(function (u) { return u.id; });
	const start = DE.startMission(state, { unitIds: ids, foodBuy: 200, goldTake: 100, distance: 3 });
	assert.equal(start.ok, true);
	assert.equal(state.ui.screen, "empty");
	assert.equal(state.mission.remaining, 2);
	assert.equal(state.mission.stuff.food, 200 - 15);
	assert.equal(state.mission.stuff.gold, 100);
	assert.equal(state.player.gold, 300 - 100 - 100); /* food 200*0.5 + goldTake 100 */
});


test("training unlocks a role after five encounters", function () {
	const state = DE.newCampaign("train");
	state.player.units.push(DE.makeUnit(state, "melee", "goblin", "player"));
	const id = state.player.units[state.player.units.length - 1].id;
	assert.equal(DE.canUseKit(state, "melee"), false);
	assert.equal(DE.startTraining(state, id).ok, true);
	assert.equal(state.player.units.some(function (u) { return u.id === id; }), false);
	assert.equal(DE.tickTraining(state, 5).length, 1);
	assert.equal(DE.canUseKit(state, "melee"), true);
	assert.equal(state.player.units.some(function (u) { return u.id === id; }), true);
});

test("base remittance pays 100g per five encounters on return", function () {
	const state = DE.newCampaign("pay");
	state.totalEncounters = 12;
	state.incomeEncountersPaid = 0;
	const income = DE.grantBaseIncome(state);
	assert.equal(income.gold, 200);
	assert.equal(state.player.gold, 500);
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

test("civilized undead only appear with a necromancer", function () {
	const state = DE.newCampaign("necro-undead");
	const necroFac = state.factions.find(function (f) {
		return f.kind === "civilized" && (f.roster || []).indexOf("necromancer") >= 0;
	});
	assert.ok(necroFac);
	for (var i = 0; i < 40; i++) {
		const force = DE.composeForce(state, necroFac, "large", false);
		const undead = force.filter(function (u) {
			const d = DE.unitDef(u.type);
			return d && d.undead;
		});
		const necros = force.filter(function (u) { return u.type === "necromancer"; });
		if (undead.length) assert.ok(necros.length >= 1);
	}
});

test("pythagorean village depth stays in band", function () {
	const state = { rng: 1 };
	for (let i = 0; i < 40; i++) {
		const d = DE.rollVillageDepth(state);
		assert.ok(d >= 1 && d <= 9, String(d));
	}
});

test("leader death is the leader-unit dying, with no extra coin flip", function () {
	const state = DE.newCampaign("last-leader");
	const h = DE.factionById(state, state.hostileFactionId);
	const leaders = DE.livingLeaders(state, h);
	for (let i = 0; i < leaders.length - 1; i++) leaders[i].dead = true;
	const last = DE.livingLeaders(state, h)[0];
	assert.ok(last);
	const enc = {
		factionId: h.id,
		leader: last
	};
	assert.equal(DE.maybeKillLeader(state, enc), false);
	last.dead = true;
	assert.equal(DE.maybeKillLeader(state, enc), true);
	assert.equal(DE.livingLeaders(state, h).length, 0);
});

test("mark leader kill is its own complete-history line", function () {
	const state = DE.newCampaign("mark-kill-history");
	const h = DE.factionById(state, state.hostileFactionId);
	const leaders = DE.livingLeaders(state, h);
	for (let i = 1; i < leaders.length; i++) leaders[i].dead = true;
	const leader = DE.livingLeaders(state, h)[0];
	assert.ok(leader);
	leader.dead = true;
	state.mission = {
		id: "Mtest",
		beat: 1,
		progressed: 0,
		remaining: 3,
		distance: 3,
		pendingEncounter: null
	};
	const enc = {
		id: "Etest",
		factionId: h.id,
		kind: "small",
		leader: leader,
		aiUnits: [],
		playerUnits: [],
		rounds: [],
		resolved: false
	};
	state.mission.pendingEncounter = enc;
	const before = (state.chronicle || []).length;
	DE.finishEncounter(state, enc, {
		hold: { player: true, ai: false },
		notes: ["steel decided it"],
		battle: { winner: "player" },
		displayBattle: false,
		gift: null,
		trade: false
	});
	assert.equal(leader.dead, true);
	const rows = state.chronicle || [];
	assert.ok(rows.length >= before + 2);
	assert.match(rows[0].text, new RegExp("^" + leader.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " of .+ has fallen\\.$"));
	assert.ok(rows[1].text.indexOf("steel decided it") >= 0);
	assert.ok(!/has fallen/.test(rows[1].text));
});

test("villages start with 1-5 hostile captives and the mark holds five human hostages", function () {
	const state = DE.newCampaign("village-caps");
	const keys = Object.keys(state.politics.trust);
	for (let i = 0; i < keys.length; i++) state.politics.trust[keys[i]] = 0.1;
	DE.seedVillageCaptives(state);
	DE.placeMarkHostages(state);
	assert.equal(state.markHostageIds.length, 5);
	let hostages = 0;
	for (let v = 0; v < state.villages.length; v++) {
		const caps = state.villages[v].captives || [];
		const extra = caps.filter(function (c) { return !c.markHostage; });
		assert.ok(extra.length >= 1 && extra.length <= 5, String(extra.length));
		for (let c = 0; c < caps.length; c++) {
			if (caps[c].markHostage) {
				hostages++;
				assert.equal(caps[c].species, "human");
				assert.equal(caps[c].type, "infantry");
			}
		}
	}
	assert.equal(hostages, 5);
	assert.equal(DE.markHostagesStillHeld(state), 5);
	state.player.captives = state.markHostageIds.map(function (id) {
		return { id: id, type: "infantry", markHostage: true };
	});
	DE.checkWin(state);
	assert.equal(state.won, true);
	assert.equal(DE.markHostagesStillHeld(state), 0);
});

test("killing mark leaders is not the win", function () {
	const state = DE.newCampaign("no-leader-win");
	const h = DE.factionById(state, state.hostileFactionId);
	const leaders = DE.livingLeaders(state, h);
	for (let i = 0; i < leaders.length; i++) leaders[i].dead = true;
	DE.checkWin(state);
	assert.equal(state.won, false);
	assert.equal(DE.markHostagesStillHeld(state), 5);
});

test("intelligent loners are encountered one at a time", function () {
	const state = DE.newCampaign("loner-one");
	const ids = state.player.units.slice(0, 4).map(function (u) { return u.id; });
	DE.startMission(state, { unitIds: ids, foodBuy: 40, goldTake: 10, distance: 8 });
	let found = null;
	for (let i = 0; i < 80 && !found; i++) {
		const enc = DE.buildMonsterEncounter(state);
		if (enc && enc.kind === "loner") found = enc;
	}
	assert.ok(found);
	assert.equal(found.aiUnits.length, 1);
	assert.equal(found.size, "single");
});

test("camp raid uses leftovers and does not spend remaining", function () {
	const state = DE.newCampaign("camp-raid");
	const ids = state.player.units.filter(function (u) { return u.type === "infantry"; }).slice(0, 3).map(function (u) { return u.id; });
	DE.startMission(state, { unitIds: ids, foodBuy: 20, goldTake: 10, distance: 8 });
	const leftovers = DE.campLeftoverUnits(state);
	assert.ok(leftovers.length > 0);
	const before = state.mission.remaining;
	const saved = DE.CAMP_RAID_CHANCE;
	DE.CAMP_RAID_CHANCE = 1;
	state.totalEncounters = 5;
	state.villageTickPaid = 0;
	DE.maybeTickVillages(state);
	DE.CAMP_RAID_CHANCE = saved;
	assert.ok(state.queuedCampRaid);
	assert.equal(DE.openQueuedCampRaid(state), true);
	const enc = state.mission.pendingEncounter;
	assert.equal(enc.campRaid, true);
	assert.equal(state.mission.remaining, before);
	assert.equal(enc.playerUnits.length, leftovers.length);
	assert.equal(DE.encounterHeadline(state, enc).indexOf("are at your camp") >= 0, true);
	assert.equal(DE.actionAvailable(enc, "defend", "player"), true);
	assert.equal(DE.actionAvailable(enc, "occupy", "ai"), true);
});
