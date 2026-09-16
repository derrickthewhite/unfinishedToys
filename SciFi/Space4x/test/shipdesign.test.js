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

function grant(Space4x, state, empire, ids) {
	for (let i = 0; i < ids.length; i++) {
		Space4x.setEmpireTechOwned(state, empire, ids[i], true);
	}
}

function loadCount(load, itemId) {
	let n = 0;
	for (let i = 0; i < load.length; i++) {
		if (load[i].itemId === itemId) n += load[i].count || 1;
	}
	return n;
}

function loadItemIds(load) {
	const ids = [];
	for (let i = 0; i < load.length; i++) ids.push(load[i].itemId);
	return ids;
}

function kindSize(Space4x, state, empire, load, pred) {
	let n = 0;
	for (let i = 0; i < load.length; i++) {
		const item = Space4x.spaceLoadItem(state, load[i].itemId);
		if (item && pred(item)) n += Space4x.loadEntrySize(state, load[i], empire);
	}
	return n;
}

function isMissile(item) {
	return item.kind === "missileLauncher" || item.kind === "missileAmmo" || item.kind === "missile";
}

test("auto repair is unique: one per hull", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const empire = Space4x.playerEmpire(state);
	grant(Space4x, state, empire, ["ro1ar"]);
	empire.shipDesigns = {
		cruiser: {
			activeId: "d1",
			list: [{ id: "d1", hullDefId: "cruiser", load: [] }]
		}
	};
	assert.equal(Space4x.addDesignLoadItem(state, empire, "cruiser", "d1", "autoRepair"), true);
	assert.equal(Space4x.addDesignLoadItem(state, empire, "cruiser", "d1", "autoRepair"), false);
	assert.equal(Space4x.setDesignLoadCount(state, empire, "cruiser", "d1", 0, 4), true);
	assert.equal(empire.shipDesigns.cruiser.list[0].load[0].count, 1);
	const auto = Space4x.autoDesignLoad(state, empire, "cruiser");
	assert.equal(loadCount(auto, "autoRepair"), 1);
});

test("autobuild uses only the best main-sequence warhead", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const empire = Space4x.playerEmpire(state);
	grant(Space4x, state, empire, ["pp0", "rx1wh", "rx3wh", "rx5wh", "rx6wh", "ro5gw"]);
	const load = Space4x.autoDesignLoad(state, empire, "cruiser");
	const ids = loadItemIds(load);
	assert.ok(loadCount(load, "conversionLauncher") > 0);
	assert.ok(loadCount(load, "ammoConversion") > 0);
	assert.equal(loadCount(load, "chemicalLauncher"), 0);
	assert.equal(loadCount(load, "ammoChemical"), 0);
	assert.equal(loadCount(load, "fusionLauncher"), 0);
	assert.equal(loadCount(load, "ammoFusion"), 0);
	assert.equal(loadCount(load, "graviticLauncher"), 0);
	assert.equal(loadCount(load, "ammoGravitic"), 0);
	assert.equal(loadCount(load, "antimatterLauncher"), 0);
	assert.equal(loadCount(load, "ammoAntimatter"), 0);
	assert.equal(loadCount(load, "ammoGremlin"), 0);
	assert.ok(!ids.includes("ammoGremlin"));
});

test("gremlin magazines stay out of the main warhead sequence", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const empire = Space4x.playerEmpire(state);
	grant(Space4x, state, empire, ["pp0", "rx1wh", "ro5gw"]);
	const load = Space4x.autoDesignLoad(state, empire, "cruiser");
	assert.ok(loadCount(load, "fusionLauncher") > 0);
	assert.ok(loadCount(load, "ammoFusion") > 0);
	assert.equal(loadCount(load, "ammoChemical"), 0);
	assert.equal(loadCount(load, "ammoGremlin"), 0);
});

test("autobuild splits leftover load about equally between missiles and top-tier beams", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const empire = Space4x.playerEmpire(state);
	grant(Space4x, state, empire, ["pp0"]);
	const load = Space4x.autoDesignLoad(state, empire, "cruiser");
	const missiles = kindSize(Space4x, state, empire, load, isMissile);
	const beams = kindSize(Space4x, state, empire, load, function (item) { return item.kind === "beam"; });
	assert.ok(missiles > 0);
	assert.ok(beams > 0);
	const ratio = missiles / beams;
	assert.ok(ratio > 0.6 && ratio < 1.5, "missile/beam load ratio was " + ratio + " (" + missiles + "/" + beams + ")");
	assert.ok(loadCount(load, "lightCannon") > 0);
});

test("autobuild splits beams among every beam of the highest available tier", function () {
	const Space4x = loadSpace4x();
	const state = Space4x.createEditorState();
	const empire = Space4x.playerEmpire(state);
	grant(Space4x, state, empire, ["pp0", "pp8amb", "pp8gl", "pp8mg"]);
	const load = Space4x.autoDesignLoad(state, empire, "battleship");
	assert.equal(loadCount(load, "lightCannon"), 0);
	assert.ok(loadCount(load, "antimatterBeam") > 0);
	assert.ok(loadCount(load, "gravitonLance") > 0);
	assert.ok(loadCount(load, "mesonGun") > 0);
	const counts = [
		loadCount(load, "antimatterBeam"),
		loadCount(load, "gravitonLance"),
		loadCount(load, "mesonGun")
	];
	const max = Math.max.apply(null, counts);
	const min = Math.min.apply(null, counts);
	assert.ok(max - min <= 1, "beam counts were uneven: " + counts.join(","));
});
