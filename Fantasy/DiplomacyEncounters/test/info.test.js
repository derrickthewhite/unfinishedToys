const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE, unit, many } = require("./harness.js");

const DE = loadDE();

test("new campaign seeds languages, seen natives, and mark human intel", function () {
	const state = DE.newCampaign("info-seed");
	DE.SPECIES.forEach(function (sp) {
		assert.equal(DE.hasLanguage(state, sp), false);
	});
	assert.equal(DE.hasSeenType(state, "infantry"), true);
	assert.equal(DE.hasSeenType(state, "machineGunner"), true);
	assert.equal(DE.hasSeenType(state, "civilian"), true);
	assert.equal(DE.hasSeenType(state, "melee"), false);
	assert.equal(Object.keys(state.player.facedTypes || {}).length, 0);
	const mark = DE.factionById(state, state.hostileFactionId);
	DE.HUMAN_INTEL_TYPES.forEach(function (t) {
		assert.equal(DE.factionKnowsHumanType(mark, t), true);
	});
	const other = DE.civilizedFactions(state).find(function (f) { return f.id !== mark.id; });
	assert.equal(DE.factionKnowsHumanType(other, "infantry"), false);
	assert.equal(DE.factionKnowsHumanType(other, "machineGunner"), false);
});

test("seeing units marks dossiers ???; battle unlocks blurbs and faction intel", function () {
	const state = DE.newCampaign("info-battle");
	const fac = DE.civilizedFactions(state).find(function (f) { return f.id !== state.hostileFactionId; });
	assert.ok(fac);
	assert.equal(DE.hasLanguage(state, fac.species), false);
	DE.onPoliticsHire(state, fac.id);
	assert.equal(DE.hasLanguage(state, fac.species), false);

	const enc = {
		factionId: fac.id,
		aiUnits: [unit("melee", { id: "e1" }), unit("archer", { id: "e2" })],
		playerUnits: [unit("infantry", { id: "p1" }), unit("machineGunner", { id: "p2" })]
	};
	DE.markSeenTypesFromUnits(state, enc.aiUnits);
	assert.equal(DE.hasSeenType(state, "melee"), true);
	assert.equal(DE.hasFacedType(state, "melee"), false);

	DE.applyBattleInfo(state, enc, { battle: { winner: "player" }, displayBattle: false });
	assert.equal(DE.hasFacedType(state, "melee"), true);
	assert.equal(DE.hasFacedType(state, "archer"), true);
	assert.equal(DE.hasFacedType(state, "dragon"), false);
	assert.equal(DE.factionKnowsHumanType(fac, "infantry"), true);
	assert.equal(DE.factionKnowsHumanType(fac, "machineGunner"), true);
	assert.equal(DE.factionKnowsHumanType(fac, "melee"), false);
});

test("display battles do not reveal unit dossiers", function () {
	const state = DE.newCampaign("info-display");
	DE.applyBattleInfo(state, {
		factionId: state.hostileFactionId,
		aiUnits: [unit("spider")],
		playerUnits: [unit("infantry")]
	}, { battle: { winner: "player" }, displayBattle: true });
	assert.equal(DE.hasFacedType(state, "spider"), false);
	assert.equal(DE.hasSeenType(state, "spider"), false);
});
