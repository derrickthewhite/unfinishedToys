const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const SCRIPT_FILES = [
	"config/settings/scratch-empire.js",
	"js/rng.js",
	"js/query.js",
	"js/model/effects.js",
	"js/model/culture.js",
	"js/state.js",
	"js/model/research.js",
	"js/model/shipdesign.js",
	"js/view/shipart.js",
	"js/model/beamweapons.js",
	"js/model/spacecombat.js",
	"js/model/troops.js",
	"js/model/diplomacy.js",
	"js/ai/dumb.js",
	"js/model/editor.js"
];

function loadSpace4x() {
	const context = { Space4x: {}, console: console, Math: Math };
	vm.createContext(context);
	for (let i = 0; i < SCRIPT_FILES.length; i++) {
		const file = SCRIPT_FILES[i];
		vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
	}
	return context.Space4x;
}

test("editor sandbox starts with no techs and empty modifiers", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const empire = Space4x.playerEmpire(state);
	assert.ok(Space4x.isEditor(state));
	assert.ok(empire);
	assert.equal((empire.research.completedTechIds || []).length, 0);
	assert.equal(empire.modifiers.speed, 0);
	assert.equal(Space4x.categoryTierOf(empire, "warpPhysics"), 0);
});

test("granting any tech does not rewind or advance the field", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const empire = Space4x.playerEmpire(state);
	assert.equal(Space4x.setEmpireTechOwned(state, empire, "wp3", true), true);
	assert.ok(Space4x.empireHasTech(empire, "wp3"));
	assert.equal(Space4x.categoryTierOf(empire, "warpPhysics"), 0);
	assert.equal(empire.modifiers.speed, 1);
	assert.equal(Space4x.setEmpireTechOwned(state, empire, "wp3", false), true);
	assert.equal(Space4x.empireHasTech(empire, "wp3"), false);
	assert.equal(Space4x.categoryTierOf(empire, "warpPhysics"), 0);
	assert.equal(empire.modifiers.speed, 0);
});

test("generate by research points spends up to the budget", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const empire = Space4x.playerEmpire(state);
	const result = Space4x.generateAiResearch(state, empire, { points: 150 });
	assert.ok(result.count >= 1);
	assert.ok(result.spent <= 150);
	assert.equal(empire.research.completedTechIds.length, result.count);
	const pool = Space4x.aiAvailableTechPool(state, empire);
	let minCost = Infinity;
	for (let i = 0; i < pool.length; i++) {
		if (pool[i].cost < minCost) minCost = pool[i].cost;
	}
	if (pool.length) assert.ok(result.spent + minCost > 150);
});

test("generate by tech count completes exactly N techs", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const empire = Space4x.playerEmpire(state);
	const result = Space4x.generateAiResearch(state, empire, { techCount: 3 });
	assert.equal(result.count, 3);
	assert.equal(empire.research.completedTechIds.length, 3);
});

test("generate until first tier X stops when any field completes that tier", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const empire = Space4x.playerEmpire(state);
	const result = Space4x.generateAiResearch(state, empire, { stopTier: 1 });
	assert.ok(result.count >= 1);
	assert.ok(Space4x.empireHasResearchedTier(state, empire, 1));
	const ids = empire.research.completedTechIds;
	let t1 = 0;
	let higher = 0;
	for (let i = 0; i < ids.length; i++) {
		const tech = Space4x.techById(state, ids[i]);
		if (tech.tier === 1) t1 += 1;
		if (tech.tier > 1) higher += 1;
	}
	assert.equal(t1, 1);
	assert.equal(higher, 0);
});

test("editor next-planet range rolls 2d4 and drives stuck reach", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const empire = Space4x.playerEmpire(state);
	assert.ok(state.editorNextPlanetRange >= 2 && state.editorNextPlanetRange <= 8);
	Space4x.setEditorNextPlanetRange(state, 7);
	assert.equal(state.editorNextPlanetRange, 7);
	assert.equal(Space4x.aiEditorNeedsReach(state, empire), true);
	assert.equal(Space4x.aiResearchStuck(state, empire), true);
	Space4x.completeTech(state, empire, Space4x.techById(state, "wp0"));
	assert.equal(Space4x.empireHasWarp(state, empire), true);
	assert.equal(Space4x.shipStats(state, empire).range, 5);
	assert.equal(Space4x.aiEditorNeedsReach(state, empire), true);
	Space4x.completeTech(state, empire, Space4x.techById(state, "rx0ip"));
	Space4x.completeTech(state, empire, Space4x.techById(state, "rx1"));
	assert.equal(Space4x.shipStats(state, empire).range, 7);
	assert.equal(Space4x.aiEditorNeedsReach(state, empire), false);
	Space4x.setEditorNextPlanetRange(state, 8);
	assert.equal(Space4x.aiEditorNeedsReach(state, empire), true);
	const rolled = Space4x.randomizeEditorNextPlanetRange(state);
	assert.ok(rolled >= 2 && rolled <= 8);
	assert.equal(state.editorNextPlanetRange, rolled);
});

test("aiPickRandomTech weights categories evenly, not techs", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	state.rng = 1;
	const empire = Space4x.playerEmpire(state);
	const pool = [
		{ id: "a1", categoryId: "fat" },
		{ id: "a2", categoryId: "fat" },
		{ id: "a3", categoryId: "fat" },
		{ id: "b1", categoryId: "thin" }
	];
	const counts = { fat: 0, thin: 0 };
	for (let i = 0; i < 400; i++) {
		const pick = Space4x.aiPickRandomTech(state, empire, pool);
		counts[pick.categoryId] += 1;
	}
	assert.ok(counts.fat > 150 && counts.fat < 250, "fat=" + counts.fat);
	assert.ok(counts.thin > 150 && counts.thin < 250, "thin=" + counts.thin);
});

test("editor fleets start a sandbox battle from designs and cancel without map side effects", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const sandbox = Space4x.playerEmpire(state);
	Space4x.ensureEmpireDesigns(state, sandbox);
	const cruiser = Space4x.activeDesign(sandbox, "cruiser");
	assert.ok(cruiser);
	Space4x.addEditorFleetShip(state, "attacker", "cruiser", cruiser.id, 2);
	Space4x.addEditorFleetShip(state, "defender", "cruiser", cruiser.id, 1);
	assert.equal(Space4x.editorFleetShipCount(state, "attacker"), 2);
	assert.equal(Space4x.editorFleetShipCount(state, "defender"), 1);
	const unitsBefore = (state.units || []).length;
	const result = Space4x.startEditorSpaceBattle(state);
	assert.equal(result.ok, true);
	assert.ok(result.battle);
	assert.equal(result.battle.starId, "editor");
	assert.equal(result.battle.attackerEmpireId, sandbox.id);
	assert.equal(state.turnHold, null);
	assert.equal(state.winnerEmpireId, null);
	assert.equal((state.units || []).length, unitsBefore);
	const ships = result.battle.tokens.filter(function (t) { return t.kind === "ship"; });
	assert.equal(ships.length, 3);
	const atk = ships.filter(function (t) { return t.side === "attacker"; });
	assert.equal(atk.length, 2);
	assert.equal(atk[0].designId, cruiser.id);
	assert.deepEqual(atk[0].empireId, sandbox.id);
	const fit = Space4x.snapshotCombatFit(state, sandbox, "cruiser", cruiser);
	assert.ok(fit.load.length);
	assert.ok(atk[0].load.length);
	assert.ok(Space4x.editorLiveBattle(state));
	Space4x.cancelEditorSpaceBattle(state);
	assert.equal(Space4x.editorLiveBattle(state), null);
	assert.equal(Space4x.playerOpenSpaceBattles(state).length, 0);
	assert.equal((state.units || []).length, unitsBefore);
	assert.equal(state.turnHold, null);
	assert.equal(state.winnerEmpireId, null);
});

test("sanitizeEditorCombatState drops a leftover fight and returns to Fleets", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const sandbox = Space4x.playerEmpire(state);
	Space4x.ensureEmpireDesigns(state, sandbox);
	const cruiser = Space4x.activeDesign(sandbox, "cruiser");
	Space4x.addEditorFleetShip(state, "attacker", "cruiser", cruiser.id, 1);
	Space4x.addEditorFleetShip(state, "defender", "cruiser", cruiser.id, 1);
	const result = Space4x.startEditorSpaceBattle(state);
	state.ui.stage = "spaceCombat";
	state.ui.selectedSpaceBattleId = result.battle.id;
	Space4x.sanitizeEditorCombatState(state);
	assert.equal(state.ui.stage, "editorCombat");
	assert.equal(state.ui.selectedSpaceBattleId, null);
	assert.equal(Space4x.editorLiveBattle(state), null);
	assert.equal(state.turnHold, null);
});
