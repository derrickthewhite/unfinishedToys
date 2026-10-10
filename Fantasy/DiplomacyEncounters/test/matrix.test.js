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

test("greet vs greet opens trade and both hold", function () {
	const r = DE.resolveRound({ rng: 1 }, enc(), "greet", "greet", {});
	assert.equal(r.trade, true);
	assert.equal(r.another, false);
	assert.equal(r.hold.player, true);
	assert.equal(r.hold.ai, true);
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

test("seizing a kit does not also salvage that kit as loot", function () {
	const target = unit("melee", { id: "seize-me", equippedWeapons: true });
	const e = {
		playerUnits: many("infantry", 10),
		aiUnits: [target].concat(many("civilian", 4)),
		playerStuff: { gold: 10, food: 0, weapons: [], captives: [] },
		aiStuff: { gold: 0, food: 0, weapons: [], captives: [] },
		roundIndex: 1,
		lastPair: null,
		factionId: "F1",
		rounds: []
	};
	const r = DE.resolveRound({ rng: 1 }, e, "seize", "greet", {
		playerSeize: { kind: "weapons", type: "melee", unitId: "seize-me", equipped: true },
		playerAction: "seize"
	});
	assert.equal(r.battle.winner, "player");
	assert.ok(r.seize && r.seize.kind === "weapons");
	DE.lootBattleWeapons(e, r);
	const meleeKits = (e.playerStuff.weapons || []).filter(function (w) { return w === "melee"; });
	assert.equal(meleeKits.length, 1);
});

test("capture marks the target captured, not wounded, and skips kit loot", function () {
	const target = unit("melee", { id: "cap-me", equippedWeapons: true, factionId: "F1", homeFactionId: "F1" });
	target.wounded = true;
	const e = {
		playerUnits: many("infantry", 10),
		aiUnits: [target].concat(many("civilian", 4)),
		playerStuff: { gold: 10, food: 0, weapons: [], captives: [] },
		aiStuff: { gold: 0, food: 0, weapons: [], captives: [] },
		roundIndex: 1,
		lastPair: null,
		factionId: "F1",
		rounds: []
	};
	const state = { rng: 1, player: { politicsKnown: {}, politicsLearned: {}, politicsContacts: {} }, politics: { trust: {} } };
	const r = DE.resolveRound(state, e, "capture", "greet", {
		playerCaptureId: "cap-me",
		playerAction: "capture"
	});
	assert.equal(r.battle.winner, "player");
	assert.ok(r.capture);
	assert.equal(r.capture.id, "cap-me");
	assert.equal(r.capture.wounded, false);
	assert.equal(r.capture.dead, true);
	const fate = (r.battle.aiCasualties || []).find(function (c) { return c.id === "cap-me"; });
	assert.ok(fate);
	assert.equal(fate.fate, "captured");
	DE.lootBattleWeapons(e, r);
	assert.equal((e.playerStuff.weapons || []).filter(function (w) { return w === "melee"; }).length, 0);
	assert.equal((e.playerStuff.captives || []).length, 1);
});

test("weapon drops skip seized or captured unit ids", function () {
	const ai = [unit("melee", { id: "m1" }), unit("archer", { id: "a1" })];
	const drops = DE.weaponDropsFromFates(ai, [
		{ id: "m1", type: "melee", fate: "dead" },
		{ id: "a1", type: "archer", fate: "dead" }
	], { m1: true });
	assert.equal(drops.length, 1);
	assert.equal(drops[0], "archer");
	assert.equal(DE.weaponDropsFromFates(ai, [
		{ id: "m1", type: "melee", fate: "captured" }
	]).length, 0);
});

test("aftermath copy comes from JSON keys", function () {
	assert.ok(DE.AFTERMATH_COPY.open_open_greet_greet);
	const r = DE.resolveRound({ rng: 1 }, enc(), "greet", "greet", {});
	assert.equal(r.aftermathKey, "open_open_greet_greet");
	assert.match(r.notes.join(" "), /Tension eases/i);
	assert.doesNotMatch(r.notes.join(" "), /trade can begin/i);
});

test("intimidate vs run uses drive-off language not hold ground", function () {
	const r = DE.resolveRound({ rng: 3 }, enc(), "intimidate", "run", {});
	assert.equal(r.aftermathKey, "intimidate_retreat_you");
	assert.match(r.notes.join(" "), /retreat|unchallenged/i);
	assert.doesNotMatch(r.notes.join(" "), /hold the ground/i);
});

test("intimidate vs intimidate stalemate may say hold ground only on decisive outcomes", function () {
	const e = enc();
	/* Force stalemate band with a high roll via seeded rng walk — use display/fight keys when decisive. */
	const fight = DE.resolveRound({ rng: 1 }, e, "intimidate", "intimidate", {});
	assert.ok(fight.aftermathKey.indexOf("intimidate_intimidate_") === 0);
	if (fight.aftermathKey.indexOf("stalemate") < 0) {
		assert.match(fight.notes.join(" "), /hold the ground/i);
		assert.equal(DE.isHoldGroundAftermath(fight), true);
	}
});

test("occupy is assault-class and defend is intimidate-class", function () {
	assert.equal(DE.actionClass("occupy"), "assault");
	assert.equal(DE.actionClass("defend"), "intimidate");
	assert.equal(DE.actionAvailable({ village: true }, "occupy", "player"), true);
	assert.equal(DE.actionAvailable({ village: true }, "defend", "player"), false);
	assert.equal(DE.actionAvailable({ village: true }, "defend", "ai"), true);
	assert.equal(DE.actionAvailable({ campRaid: true }, "defend", "player"), true);
	assert.equal(DE.actionAvailable({ campRaid: true }, "occupy", "ai"), true);
	assert.equal(DE.actionAvailable({ campRaid: true }, "occupy", "player"), false);
});

test("defend vs run holds like intimidate", function () {
	const r = DE.resolveRound({ rng: 3 }, enc(), "defend", "run", {});
	assert.equal(r.hold.player, true);
	assert.equal(r.battle, null);
});

test("occupy hold takes site captives and stuff", function () {
	const e = enc();
	e.village = true;
	e.aiUnits = many("civilian", 3);
	e.playerUnits = many("infantry", 8);
	e.aiStuff.captives = [{ id: "h1", type: "infantry", markHostage: true }];
	e.aiStuff.gold = 80;
	const r = DE.resolveRound({ rng: 1 }, e, "occupy", "greet", {});
	assert.ok(r.battle);
	if (r.battle.winner === "player") {
		assert.ok(e.playerStuff.captives.some(function (c) { return c.id === "h1"; }));
		assert.equal(e.aiStuff.gold, 0);
		assert.ok(r.occupy);
	}
});
