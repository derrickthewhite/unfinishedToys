const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE, unit, many } = require("./harness.js");

const DE = loadDE();

function enc() {
	return {
		playerUnits: many("infantry", 4),
		aiUnits: many("melee", 4),
		playerStuff: { gold: 100, food: 20, weapons: [], captives: [] },
		aiStuff: { gold: 80, food: 20, weapons: ["melee"], captives: [] },
		roundIndex: 0,
		lastPair: null,
		factionId: "F1",
		rounds: []
	};
}

test("intimidate vs run holds without battle", function () {
	const state = { rng: 3 };
	const r = DE.resolveRound(state, enc(), "intimidate", "run", {});
	assert.equal(r.hold.player, true);
	assert.equal(r.battle, null);
});

test("retreat vs run: retreat holds", function () {
	const r = DE.resolveRound({ rng: 1 }, enc(), "retreat", "run", {});
	assert.equal(r.hold.player, true);
	assert.equal(r.hold.ai, false);
});

test("gift vs gift opens trade and both hold", function () {
	const r = DE.resolveRound({ rng: 1 }, enc(), "gift", "gift", {});
	assert.equal(r.trade, true);
	assert.equal(r.hold.player, true);
	assert.equal(r.hold.ai, true);
});

test("greet vs greet asks for another round", function () {
	const r = DE.resolveRound({ rng: 1 }, enc(), "greet", "greet", {});
	assert.equal(r.another, true);
	assert.equal(r.hold.player, true);
});

test("attack vs greet is a battle", function () {
	const e = enc();
	const r = DE.resolveRound({ rng: 99 }, e, "attack", "greet", {});
	assert.ok(r.battle);
	assert.ok(r.hold.player || r.hold.ai);
});

test("both run: neither holds", function () {
	const r = DE.resolveRound({ rng: 1 }, enc(), "run", "run", {});
	assert.equal(r.hold.player, false);
	assert.equal(r.hold.ai, false);
});

test("repeated intimidate vs greet holds intimidate", function () {
	const e = enc();
	e.lastPair = { player: "intimidate", ai: "greet" };
	const r = DE.resolveRound({ rng: 1 }, e, "intimidate", "greet", {});
	assert.equal(r.hold.player, true);
	assert.equal(r.another, false);
});

test("seize half gold on assault win", function () {
	const e = enc();
	e.aiUnits = many("civilian", 3);
	e.playerUnits = many("infantry", 8);
	const r = DE.resolveRound({ rng: 1 }, e, "seize", "greet", {
		playerSeize: { kind: "gold" },
		playerAction: "seize"
	});
	assert.ok(r.battle);
	if (r.battle.winner === "player") {
		assert.ok(r.seize && r.seize.kind === "gold");
	}
});
