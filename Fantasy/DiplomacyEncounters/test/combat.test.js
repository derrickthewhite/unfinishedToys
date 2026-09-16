const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE, unit, many } = require("./harness.js");

const DE = loadDE();

test("infantry outvalue equal counts of melee", function () {
	const inf = many("infantry", 5);
	const melee = many("melee", 5);
	assert.equal(DE.sideStrength(inf, melee), 50);
	assert.equal(DE.sideStrength(melee, inf), 25);
});

test("machine gunner negates melee", function () {
	const mg = [unit("machineGunner")];
	const melee = many("melee", 4);
	assert.equal(DE.sideStrength(melee, mg), 0);
	assert.equal(DE.sideStrength(mg, melee), 10);
});

test("earth mage doubles melee and beats machine gun", function () {
	const earth = [unit("earthMage")].concat(many("melee", 4));
	const mg = [unit("machineGunner")].concat(many("infantry", 2));
	const meleeStr = DE.sideStrength(earth, mg);
	assert.equal(meleeStr, 40);
	assert.ok(meleeStr > DE.sideStrength(mg, earth));
});

test("ghost wins against non-mage forces", function () {
	assert.equal(DE.ghostWins([unit("ghost")], many("infantry", 8)), true);
	assert.equal(DE.ghostWins([unit("ghost")], [unit("fireMage")]), false);
});

test("illusionist multiplies unless spider", function () {
	const side = many("melee", 4).concat([unit("illusionist")]);
	assert.equal(DE.sideStrength(side, many("archer", 2)), 30);
	assert.equal(DE.sideStrength(side, [unit("spider")]), 10);
});

test("ooze negates ranged", function () {
	const guns = many("infantry", 3);
	assert.equal(DE.sideStrength(guns, [unit("ooze")]), 0);
});

test("tunnel worm halves ranged", function () {
	const arch = many("archer", 4);
	assert.equal(DE.sideStrength(arch, [unit("tunnelWorm")]), 10);
});

test("healer is worth the most expensive ally", function () {
	const side = [unit("healer"), unit("fireMage"), unit("melee")];
	assert.equal(DE.sideStrength(side, many("melee", 1)), 45);
});

test("skeletons scale against ranged enemies", function () {
	const sk = many("skeleton", 1);
	assert.equal(DE.sideStrength(sk, many("melee", 4)), 2);
	assert.equal(DE.sideStrength(sk, many("archer", 4)), 10);
});

test("battle variance can be forced", function () {
	const state = { rng: 1, nextId: 1 };
	const a = many("infantry", 2);
	const b = many("melee", 2);
	const r = DE.resolveBattle(state, a, b, { playerVariance: 1, aiVariance: 1, forceWinner: "player", zeroCasualties: true });
	assert.equal(r.winner, "player");
	assert.equal(r.playerCasualties.length, 0);
});

test("casualties use doubled rates from the inflicting side", function () {
	const state = { rng: 1, nextId: 1 };
	const a = many("infantry", 5);
	const b = many("melee", 4);
	const r = DE.resolveBattle(state, a, b, { playerVariance: 1, aiVariance: 1, forceWinner: "player" });
	assert.equal(r.playerCasualtyRate, 0.2);
	assert.equal(r.aiCasualtyRate, 0.4);
	assert.equal(r.playerBudget, r.aiStrength * 0.2);
	assert.equal(r.aiBudget, r.playerStrength * 0.4);
});

test("wounded do not fight until healed", function () {
	const side = [unit("infantry", { wounded: true }), unit("infantry")];
	assert.equal(DE.sideStrength(side, many("melee", 1)), 10);
	DE.healSide(side.concat([unit("healer")]));
});

test("healer at end of encounter clears wounds", function () {
	const side = [unit("infantry", { wounded: true, id: "a" }), unit("healer", { id: "h" })];
	assert.equal(DE.healSide(side), 1);
	assert.equal(side[0].wounded, false);
});

test("dead standard and mage units drop weapons, monsters do not", function () {
	assert.equal(DE.unitDropsWeapon({ type: "melee" }), true);
	assert.equal(DE.unitDropsWeapon({ type: "fireMage" }), true);
	assert.equal(DE.unitDropsWeapon({ type: "dragon" }), false);
	assert.equal(DE.unitDropsWeapon({ type: "civilian" }), false);
	assert.equal(DE.unitDropsWeapon({ type: "skeleton" }), false);
	const ai = [unit("melee", { id: "m1" }), unit("dragon", { id: "d1" }), unit("illusionist", { id: "i1" })];
	const drops = DE.weaponDropsFromFates(ai, [
		{ id: "m1", type: "melee", fate: "dead" },
		{ id: "d1", type: "dragon", fate: "dead" },
		{ id: "i1", type: "illusionist", fate: "wounded" }
	]);
	assert.equal(drops.length, 1);
	assert.equal(drops[0], "melee");
});

test("unknown monsters get +50% combat value until known", function () {
	const spider = [unit("spider")];
	const fodder = many("melee", 1);
	assert.equal(DE.sideStrength(spider, fodder), 20);
	const state = { player: { knownMonsters: {} } };
	assert.equal(DE.sideStrength(spider, fodder, state), 30);
	DE.markMonsterKnown(state, "spider");
	assert.equal(DE.sideStrength(spider, fodder, state), 20);
	assert.equal(DE.sideStrength([unit("skeleton")], fodder, { player: { knownMonsters: {} } }), 3);
});
