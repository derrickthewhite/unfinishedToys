const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE, many } = require("./harness.js");

const DE = loadDE();

function faction(partial) {
	return Object.assign({
		id: "F1",
		kind: "civilized",
		hostileTarget: false,
		leaders: []
	}, partial);
}

test("gift moves trust more than greet, scaled by value", function () {
	const state = {
		factions: [faction({})],
		logs: {
			F1: [
				{ factionId: "F1", rounds: [{ player: "gift", ai: "greet", giftValue: 100 }] },
				{ factionId: "F1", rounds: [{ player: "greet", ai: "greet" }] }
			]
		}
	};
	state.logs.F1.reverse();
	const greetOnly = DE.trustFromLog({
		factions: [faction({})],
		logs: { F1: [{ rounds: [{ player: "greet", ai: "greet" }] }] }
	}, "F1");
	const giftSmall = DE.trustFromLog({
		factions: [faction({})],
		logs: { F1: [{ rounds: [{ player: "gift", ai: "greet", giftValue: 5 }] }] }
	}, "F1");
	const giftBig = DE.trustFromLog({
		factions: [faction({})],
		logs: { F1: [{ rounds: [{ player: "gift", ai: "greet", giftValue: 100 }] }] }
	}, "F1");
	assert.ok(giftSmall.center > greetOnly.center);
	assert.ok(giftBig.center > giftSmall.center);
});

test("mixing greet then attack widens trust", function () {
	const mixed = DE.trustFromLog({
		factions: [faction({})],
		logs: {
			F1: [
				{ rounds: [{ player: "attack", ai: "attack" }] },
				{ rounds: [{ player: "greet", ai: "greet" }] }
			]
		}
	}, "F1");
	const peaceful = DE.trustFromLog({
		factions: [faction({})],
		logs: {
			F1: [
				{ rounds: [{ player: "greet", ai: "greet" }] },
				{ rounds: [{ player: "greet", ai: "greet" }] }
			]
		}
	}, "F1");
	assert.ok(mixed.width > peaceful.width);
});

test("hostile prior is lower than neutral", function () {
	const h = DE.trustFromLog({ factions: [faction({ hostileTarget: true })], logs: {} }, "F1");
	const n = DE.trustFromLog({ factions: [faction({})], logs: {} }, "F1");
	assert.ok(h.center < n.center);
});

test("encounter aftermath reports the attitude shift", function () {
	const sample = {
		before: 0.5,
		after: 0.54,
		beforeBand: "wary",
		afterBand: "wary"
	};
	assert.equal(DE.formatAttitudeShift(sample), "Attitude +4%");
	assert.match(DE.formatAttitudeShift(sample, true), /Attitude: wary 50% → wary 54% \(\+4%\)/);
	assert.equal(
		DE.formatAttitudeShift({
			before: 0.5,
			after: 0.5,
			beforeBand: "wary",
			afterBand: "wary"
		}),
		"Attitude unchanged"
	);
	assert.match(
		DE.formatAttitudeShift({
			before: 0.5,
			after: 0.5,
			beforeBand: "wary",
			afterBand: "wary"
		}, true),
		/Attitude: wary 50% \(unchanged\)/
	);
	const state = DE.newCampaign("attitude-shift");
	const fac = DE.civilizedFactions(state)[0];
	const before = DE.trustFromLog(state, fac.id).center;
	state.mission = {
		id: "m1",
		beat: 1,
		remaining: 4,
		progressed: 0,
		party: [],
		stuff: DE.emptyStuff()
	};
	const enc = {
		id: "Eatt",
		factionId: fac.id,
		kind: "small",
		leader: null,
		aiUnits: [],
		playerUnits: [],
		rounds: [{ player: "greet", ai: "greet", giftValue: 0 }],
		resolved: false,
		trustAtMeet: before
	};
	state.mission.pendingEncounter = enc;
	DE.finishEncounter(state, enc, {
		hold: { player: true, ai: false },
		notes: ["you greet"],
		battle: null,
		displayBattle: false,
		gift: null,
		trade: false
	});
	const shift = state.ui.lastResult.attitude;
	assert.ok(shift);
	assert.ok(shift.after > shift.before);
	assert.equal(DE.formatAttitudeShift(shift), "Attitude +4%");
	assert.match(DE.formatAttitudeShift(shift, true), /wary|friendly|hostile/);
	assert.ok(shift.reasons.some(function (line) { return /Greet \+4%/.test(line); }));
});

test("debug attitude breakdown names the actions that moved trust", function () {
	const state = {
		factions: [faction({})],
		logs: {
			F1: [
				{
					id: "E2",
					factionId: "F1",
					rounds: [{ player: "attack", ai: "attack" }],
					traded: false
				},
				{
					id: "E1",
					factionId: "F1",
					rounds: [{ player: "greet", ai: "greet" }]
				}
			]
		}
	};
	const enc = {
		id: "E2",
		factionId: "F1",
		kind: "small",
		rounds: [{ player: "attack", ai: "attack" }],
		trustAtMeet: DE.trustFromLog({
			factions: state.factions,
			logs: { F1: [state.logs.F1[1]] }
		}, "F1").center
	};
	const shift = DE.attitudeShiftFromEncounter(state, enc);
	assert.ok(shift.reasons.some(function (line) { return /Attack -12%/.test(line); }));
	assert.ok(shift.reasons.some(function (line) { return /mixed signals/.test(line); }));
	assert.equal(DE.formatAttitudeShift(shift).indexOf("hostile"), -1);
	assert.match(DE.formatAttitudeShift(shift, true), /hostile|wary|friendly/);
});

test("new campaign encounter prior matches politics attitude", function () {
	const state = DE.newCampaign("trust-politics");
	const fac = DE.civilizedFactions(state)[0];
	const pol = DE.politicsTrust(state, fac.id, "player");
	assert.ok(pol != null);
	const t = DE.trustFromLog(state, fac.id);
	const lo = Math.max(0, pol - 0.2);
	const hi = Math.min(1, pol + 0.2);
	assert.ok(Math.abs(t.center - (lo + hi) / 2) < 1e-9);
});

test("fear uses present strength not logs", function () {
	const weak = [ { id: "a", type: "melee", wounded: false, dead: false } ];
	const strong = [];
	for (let i = 0; i < 8; i++) strong.push({ id: "i" + i, type: "infantry", wounded: false, dead: false });
	const f1 = DE.fearFromStrength(weak, strong, null);
	const f2 = DE.fearFromStrength(strong, weak, null);
	assert.ok(f1.center > f2.center);
});

test("fear and trust bands cut at 0.4 and 0.6", function () {
	assert.equal(DE.fearBandName(0.399), "bold");
	assert.equal(DE.fearBandName(0.4), "uneasy");
	assert.equal(DE.fearBandName(0.599), "uneasy");
	assert.equal(DE.fearBandName(0.6), "afraid");
	assert.equal(DE.trustBandName(0.399), "hostile");
	assert.equal(DE.trustBandName(0.4), "wary");
	assert.equal(DE.trustBandName(0.599), "wary");
	assert.equal(DE.trustBandName(0.6), "friendly");
});

test("encounter stance samples F/T once and reuses them", function () {
	const state = {
		rng: 0.42,
		factions: [faction({})],
		logs: {}
	};
	const enc = {
		factionId: "F1",
		leader: { deltaFear: 0, deltaTrust: 0 },
		aiUnits: many("infantry", 4),
		playerUnits: many("infantry", 4),
		aiStuff: { gold: 20, food: 5, weapons: [] },
		playerStuff: { gold: 20, food: 5, weapons: [] },
		roundIndex: 1
	};
	const s1 = DE.ensureEncounterStance(state, enc);
	const f = s1.F;
	const t = s1.T;
	state.rng = 0.99;
	const s2 = DE.ensureEncounterStance(state, enc);
	assert.equal(s2.F, f);
	assert.equal(s2.T, t);
	assert.ok(s2.locked);
});

test("afraid×wary gifts more often than afraid×hostile", function () {
	assert.equal(DE.fearBandName(0.7), "afraid");
	assert.equal(DE.trustBandName(0.5), "wary");
	assert.equal(DE.trustBandName(0.2), "hostile");
	const waryGift = 25;
	const hostileGift = 10;
	assert.ok(waryGift > hostileGift);
});

test("bold×hostile weights seize highest", function () {
	const state = {
		rng: 0.1,
		factions: [faction({})],
		logs: { F1: [{ rounds: [{ player: "attack", ai: "attack" }] }] }
	};
	const enc = {
		factionId: "F1",
		leader: { deltaFear: 0, deltaTrust: 0 },
		aiUnits: many("infantry", 10),
		playerUnits: many("melee", 1),
		aiStuff: { gold: 40, food: 10, weapons: [] },
		playerStuff: { gold: 40, food: 10, weapons: [] },
		roundIndex: 1,
		stance: {
			locked: true,
			F: 0.2,
			T: 0.2,
			fear: { own: 100, enemy: 10, lo: 0.1, hi: 0.3, width: 0.2, center: 0.2 },
			trust: { center: 0.2, width: 0.2, lo: 0.1, hi: 0.3 },
			fearLo: 0.1,
			fearHi: 0.3,
			trustLo: 0.1,
			trustHi: 0.3,
			trustCenter: 0.2,
			leaderDeltaFear: 0,
			leaderDeltaTrust: 0,
			beast: false
		}
	};
	const pick = DE.chooseAiAction(state, enc);
	assert.equal(pick.debug.band, "bold × hostile");
	assert.equal(pick.debug.weights.seize, 45);
	assert.ok(pick.debug.weights.seize > pick.debug.weights.attack);
	assert.ok(pick.debug.weights.attack > pick.debug.weights.capture);
});

test("same-faction hireling counts friendly; one is +5%, two are +10%", function () {
	const state = {
		politics: { trust: {} },
		factions: [faction({ id: "F1" })]
	};
	const one = DE.computePartyTrustModifier(state, "F1", [
		{ id: "h1", homeFactionId: "F1", type: "melee" }
	], []);
	assert.equal(one.hireFriendly, 1);
	assert.equal(one.hireling, 0.05);
	assert.equal(one.total, 0.05);

	const two = DE.computePartyTrustModifier(state, "F1", [
		{ id: "h1", homeFactionId: "F1", type: "melee" },
		{ id: "h2", homeFactionId: "F1", type: "melee" }
	], []);
	assert.equal(two.hireFriendly, 2);
	assert.equal(two.hireling, 0.1);
	assert.equal(two.total, 0.1);
});

test("hostile hirelings subtract trust; captives flip the sign", function () {
	const state = {
		politics: {
			trust: {
				"F2>F1": 0.2,
				"F1>F2": 0.2,
				"F3>F1": 0.8,
				"F1>F3": 0.8
			}
		},
		factions: [faction({ id: "F1" }), faction({ id: "F2" }), faction({ id: "F3" })]
	};
	const hireHostile = DE.computePartyTrustModifier(state, "F1", [
		{ id: "h1", homeFactionId: "F2", type: "melee" }
	], []);
	assert.equal(hireHostile.hireHostile, 1);
	assert.equal(hireHostile.hireling, -0.05);

	const capFriendly = DE.computePartyTrustModifier(state, "F1", [], [
		{ id: "c1", homeFactionId: "F3", type: "melee" }
	]);
	assert.equal(capFriendly.capFriendly, 1);
	assert.equal(capFriendly.captive, -0.05);

	const capHostile = DE.computePartyTrustModifier(state, "F1", [], [
		{ id: "c1", homeFactionId: "F2", type: "melee" },
		{ id: "c2", homeFactionId: "F2", type: "melee" }
	]);
	assert.equal(capHostile.capHostile, 2);
	assert.equal(capHostile.captive, 0.1);
});

test("party trust shifts the locked encounter trust center", function () {
	const state = DE.newCampaign("party-trust-stance");
	const fac = DE.civilizedFactions(state)[0];
	const base = DE.trustFromLog(state, fac.id).center;
	const enc = {
		factionId: fac.id,
		leader: { deltaTrust: 0, deltaFear: 0 },
		playerUnits: [
			{ id: "h1", homeFactionId: fac.id, factionId: "player", type: "melee", species: fac.species },
			{ id: "h2", homeFactionId: fac.id, factionId: "player", type: "melee", species: fac.species }
		],
		playerStuff: { captives: [] },
		aiUnits: many("melee", 2),
		roundIndex: 0
	};
	const stance = DE.ensureEncounterStance(state, enc);
	assert.ok(stance.partyTrust);
	assert.equal(stance.partyTrust.total, 0.1);
	assert.ok(Math.abs(stance.trustCenter - DE.clamp(base + 0.1, 0, 1)) < 0.0001);
});
