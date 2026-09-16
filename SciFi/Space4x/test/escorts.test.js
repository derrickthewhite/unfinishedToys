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
	"js/model/shipdesign.js",
	"js/model/troops.js",
	"js/model/diplomacy.js",
	"js/model/movement.js",
	"js/model/spacecombat.js"
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

function troop(id, defId) {
	return { id: id, defId: defId, culture: "human" };
}

function makeState(Space4x) {
	return {
		settingId: "scratch-empire",
		rng: 1,
		nextId: 10,
		turnLog: [],
		turnEvents: { spaceBattles: [], spaceLosses: [] },
		galaxy: {
			stars: [
				{ id: "st1", name: "Home", x: 0, y: 0 },
				{ id: "st2", name: "Away", x: 8, y: 0 }
			]
		},
		settlements: [{
			id: "s1",
			name: "Homeworld",
			empireId: "e1",
			location: { starId: "st1", x: 0, y: 0 }
		}, {
			id: "s2",
			name: "Colony",
			empireId: "e1",
			location: { starId: "st2", x: 8, y: 0 }
		}],
		empires: [
			{
				id: "e1",
				name: "Player",
				isPlayer: true,
				modifiers: {},
				relations: { e2: { war: true } },
				transport: { freighters: 0, spindelNavigators: 0 }
			},
			{
				id: "e2",
				name: "Enemy",
				isPlayer: false,
				modifiers: {},
				relations: { e1: { war: true } }
			}
		],
		units: [],
		ui: { selectedUnitId: null, selectedUnitIds: [] }
	};
}

test("troop fleet cap is 5, or 10 when more than 20 troops are present", function () {
	const Space4x = loadSpace4x();
	assert.equal(Space4x.troopFleetSizeCap(8), 5);
	assert.equal(Space4x.troopFleetSizeCap(20), 5);
	assert.equal(Space4x.troopFleetSizeCap(21), 10);
});

test("orbiting troop fleets split by type into cap-sized ships", function () {
	const Space4x = loadSpace4x();
	const state = makeState(Space4x);
	const cargo = [];
	for (let i = 0; i < 6; i++) cargo.push(troop("inf" + i, "infantry"));
	for (let i = 0; i < 2; i++) cargo.push(troop("arm" + i, "armor"));
	state.units.push({
		id: "u1",
		defId: Space4x.UNIT_ROLES.troopHauler,
		role: Space4x.UNIT_ROLES.troopHauler,
		empireId: "e1",
		fleetMode: true,
		hulls: 8,
		location: { kind: "orbit", starId: "st1", x: 0, y: 0, settlementId: null },
		cargoTroops: cargo
	});
	Space4x.regroupOrbitTroopFleets(state, "e1", "st1");
	const fleets = Space4x.troopFleetsAtStar(state, "e1", "st1");
	assert.equal(fleets.length, 3);
	const sizes = [];
	for (let i = 0; i < fleets.length; i++) sizes.push((fleets[i].cargoTroops || []).length);
	sizes.sort(function (a, b) { return a - b; });
	assert.equal(sizes.join(","), "1,2,5");
	fleets.forEach(function (u) {
		const first = u.cargoTroops[0].defId;
		for (let i = 1; i < u.cargoTroops.length; i++) {
			assert.equal(u.cargoTroops[i].defId, first);
		}
		assert.ok(u.cargoTroops.length <= 5);
	});
});

test("unscreened arrivals are destroyed and recorded as combat", function () {
	const Space4x = loadSpace4x();
	const state = makeState(Space4x);
	state.units.push({
		id: "scout1",
		defId: "scout",
		empireId: "e1",
		arrivedThisTurn: true,
		location: { kind: "orbit", starId: "st1", x: 0, y: 0 }
	});
	state.units.push({
		id: "cruiser1",
		defId: "cruiser",
		empireId: "e2",
		location: { kind: "orbit", starId: "st1", x: 0, y: 0 }
	});
	Space4x.snapshotEscortCover(state);
	Space4x.phaseUnarmedSweep(state);
	assert.equal(Space4x.unitById(state, "scout1"), null);
	assert.ok(state.turnEvents.spaceBattles.length >= 1);
	assert.equal(state.turnEvents.spaceBattles[0].unarmedKind, "destroyed");
	assert.match(state.turnEvents.spaceBattles[0].summary, /destroyed/);
});

test("unscreened ships already in orbit retreat when an enemy fleet arrives", function () {
	const Space4x = loadSpace4x();
	const state = makeState(Space4x);
	state.units.push({
		id: "col1",
		defId: "colonyShip",
		empireId: "e1",
		arrivedThisTurn: false,
		location: { kind: "orbit", starId: "st1", x: 0, y: 0 }
	});
	state.units.push({
		id: "cruiser1",
		defId: "cruiser",
		empireId: "e2",
		arrivedThisTurn: true,
		location: { kind: "orbit", starId: "st1", x: 0, y: 0 }
	});
	Space4x.snapshotEscortCover(state);
	Space4x.phaseUnarmedSweep(state);
	const col = Space4x.unitById(state, "col1");
	assert.ok(col);
	assert.equal(col.location.starId === "st1" && col.location.kind === "orbit", false);
	assert.ok(state.turnEvents.spaceLosses.length >= 1);
	assert.match(state.turnEvents.spaceLosses[0].text, /retreated/);
});
