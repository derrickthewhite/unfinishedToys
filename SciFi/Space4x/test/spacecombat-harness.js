const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

const SCRIPT_FILES = [
	"config/settings/scratch-empire.js",
	"js/rng.js",
	"js/model/effects.js",
	"js/model/culture.js",
	"js/model/planetcolor.js",
	"js/query.js",
	"js/state.js",
	"js/model/shipdesign.js",
	"js/model/beamweapons.js",
	"js/model/spacecombat.js",
	"js/view/spacecombat.js"
];

function loadSpace4xCombat() {
	const context = {
		Space4x: {},
		console: console,
		Math: Math,
		Date: Date,
		performance: { now: function () { return Date.now(); } },
		setTimeout: setTimeout,
		clearTimeout: clearTimeout,
		setInterval: setInterval,
		clearInterval: clearInterval,
		requestAnimationFrame: function (cb) {
			return setTimeout(function () { cb(Date.now()); }, 16);
		},
		cancelAnimationFrame: function (id) {
			clearTimeout(id);
		}
	};
	vm.createContext(context);
	for (let i = 0; i < SCRIPT_FILES.length; i++) {
		const file = SCRIPT_FILES[i];
		const code = fs.readFileSync(path.join(ROOT, file), "utf8");
		vm.runInContext(code, context, { filename: file });
	}
	return context.Space4x;
}

function makeShipToken(id, side, x, y, heading, opts) {
	opts = opts || {};
	return {
		id: id,
		unitId: id,
		empireId: side === "attacker" ? "e1" : "e2",
		side: side,
		kind: "ship",
		defId: "cruiser",
		name: id,
		x: x,
		y: y,
		heading: heading != null ? heading : 0,
		shields: { front: 10, right: 10, back: 10, left: 10 },
		shieldMax: 10,
		armor: 10,
		armorMax: 10,
		structure: 10,
		structureMax: 10,
		load: opts.load || [{
			id: "w0",
			itemId: "lightCannon",
			ammo: null,
			fired: false,
			launched: false
		}],
		speed: opts.speed != null ? opts.speed : 10,
		speedLeft: opts.speedLeft != null ? opts.speedLeft : (opts.speed != null ? opts.speed : 10),
		activated: !!opts.activated,
		dead: !!opts.dead
	};
}

function makeTestState(battle) {
	return {
		settingId: "scratch-empire",
		rng: 12345,
		nextId: 0,
		units: [],
		settlements: [],
		galaxy: { stars: [] },
		turnLog: [],
		turnHold: null,
		empires: [
			{ id: "e1", name: "Player", isPlayer: true, modifiers: {}, shipDesigns: {}, research: { completedTechIds: [] } },
			{ id: "e2", name: "Enemy", isPlayer: false, modifiers: {}, shipDesigns: {}, research: { completedTechIds: [] } }
		],
		turnEvents: { spaceBattles: [battle] },
		ui: {
			spaceTokenId: null,
			spaceWeaponId: null,
			selectedSpaceBattleId: battle.id,
			autoPlaying: false
		}
	};
}

function makeTestBattle(tokens, opts) {
	opts = opts || {};
	return {
		id: "sb1",
		starId: "st1",
		attackerEmpireId: "e1",
		defenderEmpireId: "e2",
		grid: { w: 120, h: 80 },
		round: opts.round != null ? opts.round : 1,
		phase: opts.phase || "attacker",
		tokens: tokens,
		log: [],
		done: false,
		winner: null,
		view: { zoom: 1, panX: 0, panY: 0 }
	};
}

module.exports = {
	loadSpace4xCombat: loadSpace4xCombat,
	makeShipToken: makeShipToken,
	makeTestState: makeTestState,
	makeTestBattle: makeTestBattle
};
