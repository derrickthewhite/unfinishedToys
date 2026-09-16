const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE } = require("./harness.js");

const DE = loadDE();

function faction(partial) {
	return Object.assign({
		id: "F1",
		kind: "civilized",
		hostileTarget: false,
		leaders: []
	}, partial);
}

test("gift moves trust more than greet, scaled by value", function () {
	const state = {
		factions: [faction({})],
		logs: {
			F1: [
				{ factionId: "F1", rounds: [{ player: "gift", ai: "greet", giftValue: 100 }] },
				{ factionId: "F1", rounds: [{ player: "greet", ai: "greet" }] }
			]
		}
	};
	state.logs.F1.reverse();
	const greetOnly = DE.trustFromLog({
		factions: [faction({})],
		logs: { F1: [{ rounds: [{ player: "greet", ai: "greet" }] }] }
	}, "F1");
	const giftSmall = DE.trustFromLog({
		factions: [faction({})],
		logs: { F1: [{ rounds: [{ player: "gift", ai: "greet", giftValue: 5 }] }] }
	}, "F1");
	const giftBig = DE.trustFromLog({
		factions: [faction({})],
		logs: { F1: [{ rounds: [{ player: "gift", ai: "greet", giftValue: 100 }] }] }
	}, "F1");
	assert.ok(giftSmall.center > greetOnly.center);
	assert.ok(giftBig.center > giftSmall.center);
});

test("mixing greet then attack widens trust", function () {
	const mixed = DE.trustFromLog({
		factions: [faction({})],
		logs: {
			F1: [
				{ rounds: [{ player: "attack", ai: "attack" }] },
				{ rounds: [{ player: "greet", ai: "greet" }] }
			]
		}
	}, "F1");
	const peaceful = DE.trustFromLog({
		factions: [faction({})],
		logs: {
			F1: [
				{ rounds: [{ player: "greet", ai: "greet" }] },
				{ rounds: [{ player: "greet", ai: "greet" }] }
			]
		}
	}, "F1");
	assert.ok(mixed.width > peaceful.width);
});

test("hostile prior is lower than neutral", function () {
	const h = DE.trustFromLog({ factions: [faction({ hostileTarget: true })], logs: {} }, "F1");
	const n = DE.trustFromLog({ factions: [faction({})], logs: {} }, "F1");
	assert.ok(h.center < n.center);
});

test("fear uses present strength not logs", function () {
	const weak = [ { id: "a", type: "melee", wounded: false, dead: false } ];
	const strong = [];
	for (let i = 0; i < 8; i++) strong.push({ id: "i" + i, type: "infantry", wounded: false, dead: false });
	const f1 = DE.fearFromStrength(weak, strong, null);
	const f2 = DE.fearFromStrength(strong, weak, null);
	assert.ok(f1.center > f2.center);
});
