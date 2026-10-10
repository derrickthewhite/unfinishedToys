const test = require("node:test");
const assert = require("node:assert/strict");
const { loadDE, unit, many } = require("./harness.js");

const DE = loadDE();

test("politics seeds trust between factions and player", function () {
	const state = DE.newCampaign("politics-seed");
	assert.ok(state.politics && state.politics.trust);
	const actors = DE.politicsActors(state);
	assert.ok(actors.length >= 7);
	const a = actors.find(function (x) { return x.kind === "civilized"; });
	const b = actors.find(function (x) { return x.id !== a.id && x.kind === "civilized"; });
	assert.ok(DE.politicsTrust(state, a.id, b.id) != null);
	assert.ok(DE.politicsTrust(state, "player", a.id) != null);
});

test("politics attitudes are symmetric and flat; mark↔player is hostile", function () {
	const state = DE.newCampaign("politics-flat");
	const markId = state.hostileFactionId;
	const actors = DE.politicsActors(state);
	for (let i = 0; i < actors.length; i++) {
		for (let j = i + 1; j < actors.length; j++) {
			const a = actors[i].id;
			const b = actors[j].id;
			const ab = DE.politicsTrust(state, a, b);
			const ba = DE.politicsTrust(state, b, a);
			assert.equal(ab, ba);
			const markPlayer =
				(a === markId && b === "player") ||
				(b === markId && a === "player");
			if (markPlayer) {
				assert.equal(DE.politicsBand(ab), "hostile");
			} else if (a === "player" || b === "player") {
				assert.ok(ab >= 0.35 && ab <= 0.65);
			} else {
				assert.ok(ab >= 0.05 && ab <= 0.95);
			}
		}
	}
});

test("encounter shows symbol only; captive learns edges; loss marks stale", function () {
	const state = DE.newCampaign("politics-learn");
	const fac = DE.civilizedFactions(state)[0];
	const other = DE.civilizedFactions(state).find(function (f) { return f.id !== fac.id; });
	assert.equal(DE.politicsFactionKnown(state, fac.id), false);
	assert.equal(DE.viewPoliticsLearned(state, "player", fac.id), null);

	DE.onPoliticsEncounter(state, fac.id);
	assert.equal(DE.politicsFactionKnown(state, fac.id), true);
	assert.equal(DE.viewPoliticsLearned(state, "player", fac.id), null);

	state.player.captives = [{ id: "c1", type: "melee", factionId: fac.id }];
	DE.syncPoliticsContacts(state);
	const live = DE.viewPoliticsLearned(state, "player", fac.id);
	assert.ok(live);
	assert.equal(live.stale, false);
	assert.ok(DE.viewPoliticsLearned(state, fac.id, other.id));
	assert.equal(DE.viewPoliticsLearned(state, fac.id, other.id).stale, false);

	state.player.captives = [];
	DE.syncPoliticsContacts(state);
	const remembered = DE.viewPoliticsLearned(state, "player", fac.id);
	assert.ok(remembered);
	assert.equal(remembered.stale, true);
	assert.equal(DE.viewPoliticsLearned(state, fac.id, other.id).stale, true);
	assert.equal(DE.politicsFactionKnown(state, fac.id), true);
});

test("hireling learns edges like a captive", function () {
	const state = DE.newCampaign("politics-hire");
	const fac = DE.civilizedFactions(state)[0];
	state.player.units.push(unit("melee", {
		id: "hire1",
		factionId: "player",
		homeFactionId: fac.id
	}));
	DE.onPoliticsHire(state, fac.id);
	const entry = DE.viewPoliticsLearned(state, fac.id, "player");
	assert.ok(entry);
	assert.equal(entry.stale, false);
	assert.equal(!!state.player.politicsContacts[fac.id], true);
});

test("politics table keeps the full actor grid with unknown cells", function () {
	const state = DE.newCampaign("politics-full-grid");
	const all = DE.politicsActors(state);
	assert.equal(DE.politicsViewActors(state).length, all.length);
	assert.ok(all.length >= 7);
	let unknown = 0;
	let known = 0;
	for (let r = 0; r < all.length; r++) {
		for (let c = 0; c < all.length; c++) {
			if (r === c) continue;
			const t = DE.viewPoliticsTrust(state, all[r].id, all[c].id);
			if (t == null) unknown++;
			else known++;
		}
	}
	assert.equal(known, 0);
	assert.equal(unknown, all.length * (all.length - 1));
	const fac = DE.civilizedFactions(state)[0];
	DE.onPoliticsHire(state, fac.id);
	assert.equal(DE.politicsViewActors(state).length, all.length);
	assert.ok(DE.viewPoliticsTrust(state, "player", fac.id) != null);
});

test("weapon kit sell price depends on buyer roster", function () {
	const maker = { roster: ["melee", "archer", "civilian"] };
	const stranger = { roster: ["fireMage", "civilian"] };
	const base = DE.unitStuffPrice("melee");
	assert.equal(DE.weaponKitSellPrice("melee", maker), Math.round(base * 0.6));
	assert.equal(DE.weaponKitSellPrice("melee", stranger), Math.round(base * 1.4));
});

test("villages stock more weapon kits than field parties", function () {
	const state = DE.newCampaign("village-kits");
	const fac = DE.civilizedFactions(state)[0];
	const units = many("melee", 10);
	let villageMax = 0;
	let fieldMax = 0;
	for (let i = 0; i < 20; i++) {
		villageMax = Math.max(villageMax, DE.makePartyStuff(state, units, fac, true).weapons.length);
		fieldMax = Math.max(fieldMax, DE.makePartyStuff(state, units, fac, false).weapons.length);
	}
	assert.ok(villageMax >= 4);
	assert.ok(villageMax > fieldMax);
});

test("encounter gold food magic scale with body count", function () {
	const state = DE.newCampaign("loot-scale");
	const fac = DE.civilizedFactions(state)[0];
	const units = many("melee", 5);
	for (let i = 0; i < 30; i++) {
		const stuff = DE.makePartyStuff(state, units, fac, false);
		assert.ok(stuff.gold >= 5 && stuff.gold <= 50);
		assert.ok(stuff.food >= 15 && stuff.food <= 30);
		assert.ok(stuff.magic >= 15 && stuff.magic <= 30);
		assert.equal(stuff.food % 5, 0);
		assert.equal(stuff.magic % 5, 0);
	}
	const beast = [unit("ooze")];
	for (let j = 0; j < 20; j++) {
		const m = DE.makePartyStuff(state, beast, null, false);
		assert.ok(m.gold >= 5 && m.gold <= 50);
	}
});

test("recruit infantry and MG; foreign kits need training then equip", function () {
	const state = DE.newCampaign("equip-train");
	state.player.gold = 500;
	state.player.weapons = ["melee", "infantry"];
	const bad = DE.recruitUnit(state, "melee");
	assert.equal(bad.ok, false);
	const inf = DE.recruitUnit(state, "infantry");
	assert.equal(inf.ok, true);
	assert.equal(state.player.units[state.player.units.length - 1].type, "infantry");
	const mg = DE.recruitUnit(state, "machineGunner");
	assert.equal(mg.ok, true);
	assert.equal(state.player.units[state.player.units.length - 1].type, "machineGunner");
	const civ = DE.recruitUnit(state, "civilian");
	assert.equal(civ.ok, true);
	const civilian = state.player.units[state.player.units.length - 1];
	const noTrain = DE.equipKitOnCivilian(state, civilian.id, "melee");
	assert.equal(noTrain.ok, false);
	assert.match(noTrain.reason, /training/i);
	state.player.knownTypes.push("melee");
	const ok = DE.equipKitOnCivilian(state, civilian.id, "melee");
	assert.equal(ok.ok, true);
	assert.equal(civilian.type, "melee");
});

test("empty stretches can yield 5-20 magic", function () {
	const state = DE.newCampaign("magic-empty");
	const ids = state.player.units.map(function (u) { return u.id; });
	state.encounterWeights = { empty: 1, small: 0, medium: 0, large: 0, huge: 0, monster: 0 };
	state.villages = [];
	DE.startMission(state, { unitIds: ids.slice(0, 4), foodBuy: 40, goldTake: 20, distance: 8 });
	let found = 0;
	for (let i = 0; i < 16 && state.mission; i++) {
		const mag = state.mission.stuff.magic || 0;
		if (mag > found) {
			const gain = mag - found;
			assert.ok(gain >= 5 && gain <= 20, String(gain));
			found = mag;
		}
		if (state.ui.screen === "empty") DE.nextBeat(state);
		else break;
	}
	assert.ok(found >= 5);
});
