const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE, unit } = require("./harness.js");

const DE = loadDE();

function speakState(seed) {
	const state = DE.newCampaign(seed || "gossip");
	const fac = DE.civilizedFactions(state)[0];
	DE.knowLanguage(state, fac.species);
	state.mission = {
		id: "m1",
		beat: 1,
		remaining: 4,
		progressed: 0,
		party: state.player.units.slice(0, 3),
		stuff: DE.emptyStuff()
	};
	const enc = {
		id: "Egossip",
		factionId: fac.id,
		kind: "field",
		village: false,
		leader: { name: "Speaker" },
		aiUnits: [unit("melee", { id: "g1", species: fac.species, factionId: fac.id })],
		playerUnits: state.mission.party,
		playerStuff: state.mission.stuff,
		aiStuff: { gold: 10, food: 4, magic: 0, weapons: [], captives: [] },
		rounds: []
	};
	state.mission.pendingEncounter = enc;
	return { state: state, fac: fac, enc: enc };
}

test("trade gossip is mute without a shared language", function () {
	const { state, enc } = speakState("gossip-mute");
	state.player.languages = DE.emptyLanguages();
	const g = DE.rollTradeGossip(state, enc);
	assert.equal(g.kind, "mute");
	assert.match(g.text, /nodding and gesturing/i);
});

test("stance gossip writes time-sensitive politics in parentheses", function () {
	const { state, fac, enc } = speakState("gossip-stance");
	const g = DE.rollTradeGossip(state, enc, "stance");
	assert.equal(g.kind, "stance");
	assert.match(g.text, /hostile|wary|friendly/);
	const learned = DE.viewPoliticsLearned(state, "player", fac.id);
	assert.ok(learned);
	assert.equal(learned.stale, true);
	assert.equal(DE.viewPoliticsLearned(state, fac.id, "player").stale, true);
});

test("gossip does not stale a live captive politics edge", function () {
	const { state, fac, enc } = speakState("gossip-live");
	state.player.captives = [{ id: "c1", type: "melee", factionId: fac.id, homeFactionId: fac.id }];
	DE.syncPoliticsContacts(state);
	assert.equal(DE.viewPoliticsLearned(state, "player", fac.id).stale, false);
	enc.gossip = null;
	DE.rollTradeGossip(state, enc, "stance");
	assert.equal(DE.viewPoliticsLearned(state, "player", fac.id).stale, false);
});

test("relation gossip compares two factions and learns a stale edge", function () {
	const { state, enc } = speakState("gossip-rel");
	const g = DE.rollTradeGossip(state, enc, "relation");
	assert.equal(g.kind, "relation");
	assert.match(g.text, /are (hostile|wary|friendly)/);
	const learned = state.player.politicsLearned;
	const keys = Object.keys(learned);
	assert.ok(keys.length >= 2);
	assert.ok(keys.some(function (k) { return learned[k].stale; }));
});

test("power gossip compares two factions", function () {
	const { state, enc } = speakState("gossip-power");
	const g = DE.rollTradeGossip(state, enc, "power");
	assert.equal(g.kind, "power");
	assert.ok(/outmatch|evenly matched/.test(g.text));
});

test("monster gossip marks intelligence known", function () {
	const { state, enc } = speakState("gossip-monster");
	const g = DE.rollTradeGossip(state, enc, "monster");
	assert.equal(g.kind, "monster");
	assert.match(g.text, /intelligent/);
	const known = Object.keys(state.player.knownMonsters || {});
	assert.ok(known.length >= 1);
});

test("tip and color gossip come from editable copy", function () {
	assert.ok(DE.GOSSIP_TIPS.length >= 4);
	assert.ok(DE.GOSSIP_COLOR.length >= 4);
	const { state, enc } = speakState("gossip-tip");
	const tip = DE.rollTradeGossip(state, enc, "tip");
	assert.equal(tip.kind, "tip");
	assert.ok(DE.GOSSIP_TIPS.indexOf(tip.text) >= 0);
	enc.gossip = null;
	const color = DE.rollTradeGossip(state, enc, "color");
	assert.equal(color.kind, "color");
	assert.ok(DE.GOSSIP_COLOR.indexOf(color.text) >= 0);
});

test("opening a trade-possible aftermath rolls gossip once", function () {
	const { state, enc } = speakState("gossip-finish");
	DE.finishEncounter(state, enc, {
		hold: { player: true, ai: true },
		notes: ["deal"],
		battle: null,
		gift: null,
		trade: true
	});
	assert.equal(enc.awaitingTrade, true);
	assert.ok(enc.gossip && enc.gossip.text);
	const first = enc.gossip.text;
	DE.rollTradeGossip(state, enc, "tip");
	assert.equal(enc.gossip.text, first);
});
