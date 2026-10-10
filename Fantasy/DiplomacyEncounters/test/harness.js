const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

const SCRIPT_FILES = [
	"js/rng.js",
	"js/library.js",
	"js/names.js",
	"js/unit-names.js",
	"js/combat.js",
	"js/log.js",
	"js/trade.js",
	"js/info.js",
	"js/worldgen.js",
	"js/state.js",
	"js/ai.js",
	"js/politics.js",
	"js/aftermath.js",
	"js/aftermath-copy.js",
	"js/gossip-copy.js",
	"js/gossip.js",
	"js/encounter.js",
	"js/mission.js"
];

function loadDE() {
	const context = {
		DE: {},
		console: console,
		Math: Math,
		Date: Date
	};
	vm.createContext(context);
	for (let i = 0; i < SCRIPT_FILES.length; i++) {
		const file = SCRIPT_FILES[i];
		const code = fs.readFileSync(path.join(ROOT, file), "utf8");
		vm.runInContext(code, context, { filename: file });
	}
	return context.DE;
}

function unit(type, extras) {
	extras = extras || {};
	return {
		id: extras.id || type + Math.random().toString(16).slice(2),
		type: type,
		species: extras.species || "human",
		factionId: extras.factionId || "x",
		homeFactionId: extras.homeFactionId || null,
		wounded: !!extras.wounded,
		dead: !!extras.dead,
		equippedWeapons: extras.equippedWeapons !== false,
		foreignWeapons: !!extras.foreignWeapons,
		hirable: !!extras.hirable
	};
}

function many(type, n) {
	const a = [];
	for (let i = 0; i < n; i++) a.push(unit(type, { id: type + i }));
	return a;
}

module.exports = { loadDE, unit, many };
