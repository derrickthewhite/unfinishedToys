const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE, unit, many } = require("./harness.js");

const DE = loadDE();

test("monster group labels do not repeat species and unit name", function () {
	assert.equal(DE.groupLabel({ type: "spider", species: "spider", count: 1 }), "1 Spider");
	assert.equal(DE.groupLabel({ type: "dragon", species: "dragon", count: 2 }), "2 Dragon");
	assert.equal(DE.groupLabel({ type: "melee", species: "goblin", count: 3 }), "3 Goblins Melee");
});

test("ranger is ranged, costs 100, and is worth 10 CV", function () {
	const def = DE.unitDef("ranger");
	assert.equal(def.role, "ranged");
	assert.equal(def.flags.ranger, true);
	assert.equal(DE.unitStuffPrice("ranger"), 100);
	assert.equal(DE.unitCombatValue("ranger"), 10);
	assert.equal(DE.sideStrength(many("ranger", 1), many("melee", 1)), 10);
	assert.equal(DE.rangerMonsterCounter(), 0);
	assert.equal(DE.isRangedRole(def.role), true);
});

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

test("ooze ignores machine gun negation", function () {
	const ooze = [unit("ooze")];
	const mg = [unit("machineGunner")];
	assert.equal(DE.sideStrength(ooze, mg), 20);
	assert.equal(DE.sideStrength(many("melee", 1), mg), 0);
});

test("tunnel worm halves ranged", function () {
	const arch = many("archer", 4);
	assert.equal(DE.sideStrength(arch, [unit("tunnelWorm")]), 10);
});

test("healer is worth the most expensive ally", function () {
	const side = [unit("healer"), unit("fireMage"), unit("melee")];
	assert.equal(DE.sideStrength(side, many("melee", 1)), 45);
});

test("mind mage moves 10 CV from the enemy", function () {
	const elves = many("melee", 3).concat(many("archer", 5)).concat([unit("mindMage"), unit("earthMage"), unit("earthMage")]);
	const humans = many("infantry", 8).concat(many("machineGunner", 2));
	assert.equal(DE.rawSideStrength(elves, humans), 55);
	assert.equal(DE.rawSideStrength(humans, elves), 100);
	assert.equal(DE.sideStrength(elves, humans), 65);
	assert.equal(DE.sideStrength(humans, elves), 90);
});

test("skeletons scale against ranged enemies", function () {
	const sk = many("skeleton", 1);
	assert.equal(DE.sideStrength(sk, many("melee", 4)), 2);
	assert.equal(DE.sideStrength(sk, many("archer", 4)), 10);
});

test("machine guns do not neutralize skeletons", function () {
	const sk = many("skeleton", 3);
	const mg = [unit("machineGunner")].concat(many("infantry", 2));
	assert.equal(DE.sideStrength(sk, mg), 30);
	assert.equal(DE.sideStrength(many("melee", 3), mg), 0);
});

test("skeleton portraits use undead art", function () {
	assert.equal(DE.portraitSpecies("goblin", "skeleton"), "undead");
	assert.equal(DE.portraitSpecies("elf", "ghost"), "ghost");
	assert.equal(DE.portraitSpecies("goblin", "melee"), "goblin");
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

test("a second wound kills", function () {
	const already = unit("melee", { wounded: true, id: "w1" });
	assert.equal(DE.applyCasualtyFate({ rng: 1 }, already, true), "dead");
	assert.equal(already.dead, true);
	assert.equal(already.wounded, false);
	const healthy = [unit("melee", { wounded: true, id: "w2" }), unit("melee", { id: "h2" })];
	const hit = DE.pickCasualties({ rng: 1 }, healthy, 5);
	assert.equal(hit.units.length, 1);
	assert.ok(hit.units[0] === healthy[0] || hit.units[0] === healthy[1]);
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
	const state = { player: { knownMonsters: {} }, monsterCvBump: 0, intelligentCvBump: 0 };
	assert.equal(DE.sideStrength(spider, fodder, state), 30);
	DE.markMonsterKnown(state, "spider");
	assert.equal(DE.sideStrength(spider, fodder, state), 20);
	assert.equal(DE.sideStrength([unit("skeleton")], fodder, { player: { knownMonsters: {} }, monsterCvBump: 0 }), 3);
});

function playerCvState(extras) {
	extras = extras || {};
	return {
		monsterCvBump: extras.monsterCvBump != null ? extras.monsterCvBump : 0,
		intelligentCvBump: extras.intelligentCvBump != null ? extras.intelligentCvBump : 0,
		factions: extras.factions || [],
		player: {
			id: "player",
			kind: "player",
			knownMonsters: extras.knownMonsters || {},
			facedTypes: extras.facedTypes || {}
		}
	};
}

function pu(type, extras) {
	extras = extras || {};
	if (!extras.factionId) extras.factionId = "player";
	return unit(type, extras);
}

function eu(type, extras) {
	extras = extras || {};
	if (!extras.factionId) extras.factionId = "them";
	return unit(type, extras);
}

test("monster CV bumps skip undead, apply once to animals, stack for intelligent loners", function () {
	const legal = [5, 10, 15, 20];
	const campaign = DE.newCampaign("cv-bumps");
	assert.ok(legal.indexOf(campaign.monsterCvBump) >= 0);
	assert.ok(legal.indexOf(campaign.intelligentCvBump) >= 0);

	const state = playerCvState({
		monsterCvBump: 10,
		intelligentCvBump: 15,
		factions: [{ kind: "loner", monsterType: "dragon" }]
	});
	const fodder = [eu("melee")];
	assert.equal(DE.monsterTrueWorthBonus(state, "undead"), 0);
	assert.equal(DE.monsterTrueWorthBonus(state, "spider"), 10);
	assert.equal(DE.monsterTrueWorthBonus(state, "dragon"), 25);
	assert.equal(DE.unitContribution(unit("skeleton"), [unit("skeleton")], fodder, state, { skipUnknownMonsterBonus: true }), 2);
	assert.equal(DE.sideStrength([unit("skeleton")], fodder, state), 3);
	assert.equal(DE.unitContribution(unit("spider"), [unit("spider")], fodder, state, { skipUnknownMonsterBonus: true }), 30);
	assert.equal(DE.unitContribution(unit("dragon"), [unit("dragon")], fodder, state, { skipUnknownMonsterBonus: true }), 75);
});

test("true unknown-monster bonus still applies on top of campaign bumps", function () {
	const state = playerCvState({ monsterCvBump: 10 });
	const spider = [unit("spider")];
	const fodder = many("melee", 1);
	assert.equal(DE.sideStrength(spider, fodder, state), 45);
	DE.markMonsterKnown(state, "spider");
	assert.equal(DE.sideStrength(spider, fodder, state), 30);
});

test("unknown unit estimates: special 15, monster 60, small 5", function () {
	assert.equal(DE.unknownUnitEstimate(DE.unitDef("fireMage")), 15);
	assert.equal(DE.unknownUnitEstimate(DE.unitDef("illusionist")), 15);
	assert.equal(DE.unknownUnitEstimate(DE.unitDef("ranger")), 15);
	assert.equal(DE.unknownUnitEstimate(DE.unitDef("dragon")), 60);
	assert.equal(DE.unknownUnitEstimate(DE.unitDef("skeleton")), 60);
	assert.equal(DE.unknownUnitEstimate(DE.unitDef("melee")), 5);
	assert.equal(DE.unknownUnitEstimate(DE.unitDef("infantry")), 5);
	assert.equal(DE.unknownUnitEstimate(DE.unitDef("civilian")), 0);
});

test("perceived CV estimates unknown enemies and ignores their specials", function () {
	const state = playerCvState();
	const observer = state.player;
	const own = [pu("infantry")];
	const melee = [eu("melee")];
	const mage = [eu("fireMage")];
	const ranger = [eu("ranger")];
	const beast = [eu("ooze")];
	assert.equal(DE.perceivedUnitContribution(melee[0], melee, own, state, observer, own), 5);
	assert.equal(DE.perceivedUnitContribution(mage[0], mage, own, state, observer, own), 15);
	assert.equal(DE.perceivedUnitContribution(ranger[0], ranger, own, state, observer, own), 15);
	assert.equal(DE.perceivedUnitContribution(beast[0], beast, own, state, observer, own), 60);
	assert.equal(DE.sideStrength(own, beast, state), 0);
	assert.equal(DE.perceivedSideStrength(own, beast, state, observer, own), 10);

	const illusions = [eu("melee"), eu("illusionist")];
	assert.equal(DE.sideStrength(illusions, own), 7.5);
	assert.equal(DE.perceivedSideStrength(illusions, own, state, observer, own), 20);

	const ghost = [eu("ghost")];
	assert.equal(DE.ghostWins(ghost, own), true);
	assert.equal(DE.perceivedGhostWins(ghost, own, state, observer, own), false);
	const fear = DE.perceivedFearFromStrength(own, ghost, null, state, observer);
	assert.equal(fear.uncertainOwn, false);
	assert.equal(fear.uncertainEnemy, true);
	assert.ok(fear.own > 0);
});

test("known perceived CV matches true CV, including bumps", function () {
	const state = playerCvState({
		monsterCvBump: 10,
		knownMonsters: { spider: { intelligent: false } },
		facedTypes: { melee: true, fireMage: true, infantry: true }
	});
	const observer = state.player;
	const own = [pu("infantry")];
	const enemy = [eu("spider"), eu("melee")];
	assert.equal(DE.sideStrength(enemy, own, state), 35);
	assert.equal(DE.perceivedSideStrength(enemy, own, state, observer, own), 35);
	assert.equal(DE.sideStrength(own, enemy, state), 10);
	assert.equal(DE.perceivedSideStrength(own, enemy, state, observer, own), 10);
});

test("unknown spider does not cancel a known illusionist in perceived CV", function () {
	const state = playerCvState();
	const observer = state.player;
	const own = [pu("infantry"), pu("illusionist")];
	const enemy = [eu("spider")];
	assert.equal(DE.sideStrength(own, enemy, state), 10);
	assert.equal(DE.perceivedSideStrength(own, enemy, state, observer, own), 15);
});

test("AI observer estimates unknown human types", function () {
	const state = playerCvState();
	const faction = { id: "gob", knownHumanTypes: DE.emptyHumanIntel() };
	const theirs = [unit("melee", { factionId: "gob" })];
	const yours = [unit("infantry", { factionId: "player" }), unit("machineGunner", { factionId: "player" })];
	assert.equal(DE.sideStrength(yours, theirs, state), 20);
	assert.equal(DE.perceivedSideStrength(yours, theirs, state, faction, theirs), 10);
	faction.knownHumanTypes = DE.fullHumanIntel();
	assert.equal(DE.perceivedSideStrength(yours, theirs, state, faction, theirs), 20);
});

test("perceived CV labels append +?? when a side is foggy", function () {
	const state = playerCvState();
	const own = [pu("infantry")];
	const enemy = [eu("melee"), eu("fireMage")];
	const fear = DE.perceivedFearFromStrength(own, enemy, null, state, state.player);
	assert.equal(fear.uncertainOwn, false);
	assert.equal(fear.uncertainEnemy, true);
	assert.equal(DE.formatPerceivedCv(fear.own, fear.uncertainOwn), String(Math.round(fear.own)));
	assert.equal(DE.formatPerceivedCv(fear.enemy, fear.uncertainEnemy), Math.round(fear.enemy) + " +??");
	state.player.facedTypes = { melee: true, fireMage: true };
	const clear = DE.perceivedFearFromStrength(own, enemy, null, state, state.player);
	assert.equal(clear.uncertainEnemy, false);
	assert.equal(DE.formatPerceivedCv(clear.enemy, clear.uncertainEnemy).indexOf("??"), -1);
});

test("perceived fear keeps monster swing width", function () {
	const state = playerCvState();
	const own = [pu("infantry")];
	const enemy = [eu("dragon")];
	const fear = DE.perceivedFearFromStrength(own, enemy, null, state, state.player);
	assert.equal(DE.fearWidthFromUnits(own, enemy), 0.3);
	assert.ok(fear.width <= 0.3);
	assert.equal(fear.uncertainEnemy, true);
});

test("civilians are CV 2 vs assault and site bonus is +50%", function () {
	const civs = many("civilian", 3);
	const inf = many("infantry", 2);
	assert.equal(DE.sideStrength(civs, inf), 0);
	assert.equal(DE.sideStrength(civs, inf, {}, { civiliansFight: true }), 6);
	assert.equal(DE.sideStrength(inf, civs), 20);
	assert.equal(DE.sideStrength(inf, civs, {}, { siteBonus: true }), 30);
	assert.equal(DE.sideStrength(inf.concat(civs), civs, {}, { civiliansFight: true, siteBonus: true }), 39);
});

test("civilians skip casualties unless the opponent assaulted", function () {
	const units = many("civilian", 4).concat(many("melee", 1));
	const skipped = DE.pickCasualties({ rng: 1 }, units, 100, [], { skipCivilians: true });
	assert.equal(skipped.units.length, 1);
	assert.equal(skipped.units[0].type, "melee");
	const hit = DE.pickCasualties({ rng: 1 }, units, 100, [], { skipCivilians: false });
	assert.ok(hit.units.some(function (u) { return u.type === "civilian"; }));
});

test("village garrison civilians fight when the visitor assaults", function () {
	const enc = { village: true };
	const p = DE.combatSideOpts(enc, "occupy", "defend", "player");
	const a = DE.combatSideOpts(enc, "occupy", "defend", "ai");
	assert.equal(p.civiliansFight, false);
	assert.equal(p.siteBonus, false);
	assert.equal(a.civiliansFight, true);
	assert.equal(a.siteBonus, true);
	const raid = DE.combatSideOpts({ campRaid: true }, "defend", "occupy", "player");
	assert.equal(raid.civiliansFight, true);
	assert.equal(raid.siteBonus, true);
});

