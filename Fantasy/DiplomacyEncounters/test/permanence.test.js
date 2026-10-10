const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE, unit } = require("./harness.js");

const DE = loadDE();

function living(list) {
	return (list || []).filter(function (u) { return u && !u.dead; });
}

function named(list) {
	return (list || []).every(function (u) { return u && String(u.name || "").length > 1; });
}

test("village and pool gold budgets scale with necromancer goldMult", function () {
	const state = DE.newCampaign("perm-gold");
	DE.civilizedFactions(state).forEach(function (f) {
		const mult = DE.factionGoldMult(f);
		assert.equal(mult, f.roster.indexOf("necromancer") >= 0 ? 1.2 : 1);
		assert.ok(f.poolRaisedGold <= Math.round(2500 * mult));
		assert.ok(f.poolRaisedGold >= Math.round(2500 * mult) - 100, f.name + " pool " + f.poolRaisedGold);
		DE.villagesByFaction(state, f.id).forEach(function (v) {
			assert.ok(v.raisedGold >= Math.round(750 * mult) - 100, v.name + " " + v.raisedGold);
			assert.ok(v.raisedGold <= Math.round(1650 * mult), v.name + " " + v.raisedGold);
			assert.equal(v.gold, 100);
		});
	});
});

test("civilized factions promote five leaders and station one per village", function () {
	const state = DE.newCampaign("perm-leaders");
	DE.civilizedFactions(state).forEach(function (f) {
		const leaders = DE.livingLeaders(state, f);
		assert.equal(leaders.length, 5);
		const villages = DE.villagesByFaction(state, f.id);
		villages.forEach(function (v) {
			const stationed = (v.units || []).filter(function (u) { return u.leader && !u.dead; });
			assert.equal(stationed.length, 1, v.name);
		});
		const poolLeaders = (f.poolUnits || []).filter(function (u) { return u.leader && !u.dead; });
		assert.equal(poolLeaders.length, 5 - villages.length);
	});
});

test("necromancer weight is double among specials and leader picks", function () {
	assert.equal(DE.specialTypeWeight("necromancer"), 2);
	assert.equal(DE.specialTypeWeight("fireMage"), 1);
	const necro = { type: "necromancer" };
	const fire = { type: "fireMage" };
	assert.equal(
		DE.leaderPickWeight(necro),
		2 * (DE.unitStuffPrice("necromancer") + DE.unitCombatValue("necromancer"))
	);
	assert.equal(
		DE.leaderPickWeight(fire),
		DE.unitStuffPrice("fireMage") + DE.unitCombatValue("fireMage")
	);
	const state = DE.newCampaign("perm-necro-rate");
	const fac = state.factions.find(function (f) {
		return f.kind === "civilized" && (f.roster || []).indexOf("necromancer") >= 0;
	});
	assert.ok(fac);
	let necroSpecials = 0;
	let otherSpecials = 0;
	for (let i = 0; i < 400; i++) {
		const type = DE.pickForceType(state, fac, [{ type: "necromancer" }]);
		const def = DE.unitDef(type);
		if (!def || def.kind === "standard") continue;
		if (type === "necromancer") necroSpecials++;
		else otherSpecials++;
	}
	assert.ok(necroSpecials + otherSpecials > 20);
	const necroShare = necroSpecials / (necroSpecials + otherSpecials);
	assert.ok(necroShare > 0.12, "necro special share " + necroShare);
});

test("every generated unit has a personal name, including the expedition", function () {
	const state = DE.newCampaign("perm-names");
	assert.ok(named(state.player.units));
	state.factions.forEach(function (f) {
		assert.ok(named(f.poolUnits), f.name);
	});
	state.villages.forEach(function (v) {
		assert.ok(named(v.units), v.name);
	});
	assert.ok(DE.UNIT_NAMES.goblin.first.length);
	assert.ok(DE.UNIT_NAMES.dragon.second.length);
});

test("loner pools are about 250 CV and have no leaders", function () {
	const state = DE.newCampaign("perm-loners");
	state.factions.filter(function (f) { return f.kind === "loner"; }).forEach(function (L) {
		assert.equal(DE.livingLeaders(state, L).length, 0);
		const cv = DE.forceCombatValue(L.poolUnits);
		assert.ok(cv >= 250, L.name + " cv " + cv);
		assert.ok(cv < 250 + DE.unitCombatValue(L.roster[0]), L.name + " cv " + cv);
		assert.ok(named(L.poolUnits));
	});
});

test("village economy ticks every five totalEncounters", function () {
	const state = DE.newCampaign("perm-tick");
	const village = state.villages[0];
	const skip = state.villages[1] || null;
	state.mission = { pendingEncounter: skip ? { villageRec: skip } : null };
	state.totalEncounters = 5;
	DE.maybeTickVillages(state);
	assert.equal(state.villageTickPaid, 5);
	assert.ok(village.magic > 0 || (village.weapons || []).length > 0);
	assert.ok(village.food >= 0);
	if (skip) {
		assert.equal(skip.gold, 100);
		assert.equal(skip.magic, 0);
	}
	DE.maybeTickVillages(state);
	assert.equal(state.villageTickPaid, 5);
});

test("wounded AI rest in villages and field wounded evacuate there", function () {
	const state = DE.newCampaign("wound-evac");
	const fac = DE.civilizedFactions(state)[0];
	const village = DE.villagesByFaction(state, fac.id)[0];
	assert.ok(village);
	const bed = unit("melee", { id: "bed1", species: fac.species, factionId: fac.id, wounded: true });
	village.units.push(bed);
	const field = unit("archer", { id: "field1", species: fac.species, factionId: fac.id, wounded: true });
	fac.poolUnits.push(field);
	state.totalEncounters = 5;
	state.villageTickPaid = 0;
	DE.maybeTickVillages(state);
	assert.equal(bed.wounded, false);
	assert.equal(bed.dead, false);
	assert.equal(field.wounded, false);
	const inPool = fac.poolUnits.some(function (u) { return u && u.id === "field1"; });
	assert.equal(inPool, false);
	const somewhere = (state.villages || []).some(function (v) {
		return (v.units || []).some(function (u) { return u && u.id === "field1"; });
	});
	assert.equal(somewhere, true);
});

test("a healer with wounded AI heals them immediately, even in the pool", function () {
	const state = DE.newCampaign("wound-healer");
	const fac = DE.civilizedFactions(state)[0];
	const hurt = unit("melee", { id: "hurt1", species: fac.species, factionId: fac.id, wounded: true });
	const medic = unit("healer", { id: "doc1", species: fac.species, factionId: fac.id });
	fac.poolUnits.push(hurt, medic);
	state.totalEncounters = 5;
	state.villageTickPaid = 0;
	DE.maybeTickVillages(state);
	assert.equal(hurt.wounded, false);
	assert.equal(fac.poolUnits.some(function (u) { return u && u.id === "hurt1"; }), true);
});

test("player wounded are not rest-healed in a village", function () {
	const state = DE.newCampaign("wound-player");
	const village = state.villages[0];
	const hire = unit("melee", { id: "hirew", species: "human", factionId: "player", homeFactionId: village.factionId, wounded: true });
	village.units.push(hire);
	state.totalEncounters = 5;
	state.villageTickPaid = 0;
	DE.maybeTickVillages(state);
	assert.equal(hire.wounded, true);
});

test("killing a drawn pool unit shrinks the living pool", function () {
	const state = DE.newCampaign("perm-persist");
	const fac = DE.civilizedFactions(state).find(function (f) {
		return DE.availableUnits(f.poolUnits).length > 2;
	});
	const before = living(fac.poolUnits).length;
	const units = DE.drawUnitsFromList(fac.poolUnits, 20, {
		state: state,
		shuffle: true,
		preferLeader: true,
		combatOnly: true
	});
	assert.ok(units.length);
	units[0].dead = true;
	DE.releaseAwayUnits(fac.poolUnits);
	assert.equal(living(fac.poolUnits).length, before - 1);
});

test("village assault-run escape is 75 percent", function () {
	assert.equal(DE.runEscapeChance({ village: true }), 0.75);
	assert.equal(DE.runEscapeChance({ village: false }), 0.5);
	assert.equal(DE.runEscapeChance(null), 0.5);
});

test("the side with more rangers shifts run-escape by 20 percent", function () {
	const field = {
		village: false,
		playerUnits: [{ type: "ranger", dead: false, wounded: false }],
		aiUnits: [{ type: "melee", dead: false, wounded: false }]
	};
	assert.equal(DE.runEscapeChance(field, true), 0.7);
	assert.equal(DE.runEscapeChance(field, false), 0.3);
	const village = {
		village: true,
		playerUnits: [{ type: "melee", dead: false, wounded: false }],
		aiUnits: [{ type: "ranger", dead: false, wounded: false }, { type: "ranger", dead: false, wounded: false }]
	};
	assert.equal(DE.runEscapeChance(village, true), 0.55);
	assert.equal(DE.runEscapeChance(village, false), 0.95);
});
