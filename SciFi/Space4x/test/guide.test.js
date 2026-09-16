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
	"js/model/shipdesign.js",
	"js/view/guide.js"
];

function loadSpace4x() {
	const context = {
		Space4x: {},
		console: console,
		Math: Math,
		document: {
			createElement: function () { return { className: "", textContent: "", appendChild: function () {} }; }
		}
	};
	vm.createContext(context);
	for (let i = 0; i < SCRIPT_FILES.length; i++) {
		const file = SCRIPT_FILES[i];
		vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
	}
	return context.Space4x;
}

function stateOf(Space4x) {
	return { settingId: "scratch-empire" };
}

test("magazines are one shot and load 4", function () {
	const Space4x = loadSpace4x();
	const state = stateOf(Space4x);
	const ids = ["ammoChemical", "ammoFusion", "ammoGravitic", "ammoAntimatter", "ammoConversion", "ammoGremlin"];
	for (let i = 0; i < ids.length; i++) {
		const item = Space4x.spaceLoadItem(state, ids[i]);
		assert.equal(item.size, 4, ids[i] + " size");
		assert.equal(item.rounds, 1, ids[i] + " rounds");
	}
});

test("guide beams list damage, range, and specific accuracy", function () {
	const Space4x = loadSpace4x();
	const state = stateOf(Space4x);
	const laser = Space4x.spaceLoadItem(state, "lightCannon");
	assert.equal(Space4x.guideUpgradeCellValue(state, laser, "damage"), "1–5");
	assert.equal(Space4x.guideUpgradeCellValue(state, laser, "range"), "40");
	assert.equal(
		Space4x.guideBeamAccuracyLabel(state, laser),
		"50% at 0 sq, 10% at 40 sq (−1%/sq)"
	);
	const rail = Space4x.spaceLoadItem(state, "particleBeam");
	assert.equal(
		Space4x.guideBeamAccuracyLabel(state, rail),
		"50% at 0 sq, 0% at 40 sq (−1.25%/sq)"
	);
	const maser = Space4x.spaceLoadItem(state, "maserBeam");
	assert.equal(
		Space4x.guideBeamAccuracyLabel(state, maser),
		"70% at 0 sq, 32% at 38 sq (−1%/sq)"
	);
});

test("guide weapons sort by research tier, not name", function () {
	const Space4x = loadSpace4x();
	const state = stateOf(Space4x);
	const beams = Space4x.guideLoadItemsByKind(state).beam;
	const ids = beams.map(function (item) { return item.id; });
	assert.equal(ids[0], "lightCannon");
	assert.ok(ids.indexOf("maserBeam") < ids.indexOf("antimatterBeam"));
	assert.ok(ids.indexOf("lightCannon") < ids.indexOf("maserBeam"));
	const names = beams.map(function (item) { return item.name; });
	const alpha = names.slice().sort(function (a, b) { return a.localeCompare(b); });
	assert.notDeepEqual(names, alpha);
});

test("guide missiles list damage and range columns and research group, not tech name", function () {
	const Space4x = loadSpace4x();
	const state = stateOf(Space4x);
	const launcher = Space4x.spaceLoadItem(state, "fusionLauncher");
	const ammo = Space4x.spaceLoadItem(state, "ammoFusion");
	assert.equal(Space4x.guideUpgradeCellValue(state, launcher, "damage"), "20");
	assert.equal(Space4x.guideUpgradeCellValue(state, launcher, "range"), "48");
	assert.equal(Space4x.guideUpgradeCellValue(state, ammo, "damage"), "20");
	assert.equal(Space4x.guideUpgradeCellValue(state, ammo, "range"), "48");
	assert.equal(Space4x.guideUpgradeCellValue(state, launcher, "group"), "Reactors");
	assert.equal(Space4x.guideUpgradeCellValue(state, launcher, "tier"), "1");
	assert.ok(!/Fusion Warheads/.test(Space4x.guideUpgradeCellValue(state, launcher, "group")));
	assert.ok(!/Rounds/.test(Space4x.guideLoadNotesLabel(state, ammo)));
	const shieldCols = Space4x.guideUpgradeColumns("shield").map(function (c) { return c.id; });
	assert.ok(shieldCols.indexOf("facing") !== -1);
	assert.ok(shieldCols.indexOf("notes") === -1);
	const deflector = Space4x.spaceLoadItem(state, "deflector");
	assert.equal(Space4x.guideUpgradeCellValue(state, deflector, "facing"), "1");
	const bay = Space4x.spaceLoadItem(state, "fighterBay");
	assert.equal(Space4x.guideUpgradeCellValue(state, bay, "guns"), "1–3");
	assert.equal(Space4x.guideUpgradeCellValue(state, bay, "range"), "12");
	assert.equal(Space4x.guideUpgradeCellValue(state, bay, "structure"), "20");
	assert.equal(Space4x.guideUpgradeCellValue(state, bay, "group"), "Machines");
});
