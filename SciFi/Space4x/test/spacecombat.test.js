const test = require("node:test");
const assert = require("node:assert/strict");
const {
	loadSpace4xCombat,
	makeShipToken,
	makeTestState,
	makeTestBattle
} = require("./spacecombat-harness.js");

const Space4x = loadSpace4xCombat();

function reachableKeys(state, battle, token) {
	const cells = Space4x.spaceReachableCells(state, battle, token);
	return cells.map(function (c) { return c.x + "," + c.y; }).sort();
}

test("clicking a friendly ship selects it even with no prior selection", function () {
	const atk = makeShipToken("a1", "attacker", 10, 40, 0);
	const def = makeShipToken("d1", "defender", 100, 40, Math.PI);
	const battle = makeTestBattle([atk, def], { phase: "attacker" });
	const state = makeTestState(battle);
	assert.equal(state.ui.spaceTokenId, null);

	Space4x.playerSpaceGridAct(state, battle, atk.x, atk.y);

	assert.equal(state.ui.spaceTokenId, "a1");
	assert.equal(state.ui.spaceWeaponId, null);
});

test("clicking a friendly ship selects it when the current ship is already activated", function () {
	const atk1 = makeShipToken("a1", "attacker", 10, 40, 0, { activated: true });
	const atk2 = makeShipToken("a2", "attacker", 12, 40, 0);
	const def = makeShipToken("d1", "defender", 100, 40, Math.PI);
	const battle = makeTestBattle([atk1, atk2, def], { phase: "attacker" });
	const state = makeTestState(battle);
	state.ui.spaceTokenId = "a1";

	Space4x.playerSpaceGridAct(state, battle, atk2.x, atk2.y);

	assert.equal(state.ui.spaceTokenId, "a2");
});

test("reachable cells match navigation for every highlighted cell", function () {
	const atk = makeShipToken("a1", "attacker", 20, 40, 0, { speed: 6, speedLeft: 6 });
	const def = makeShipToken("d1", "defender", 100, 40, Math.PI);
	const battle = makeTestBattle([atk, def]);
	const state = makeTestState(battle);
	const keys = reachableKeys(state, battle, atk);

	for (let i = 0; i < keys.length; i++) {
		const parts = keys[i].split(",");
		const tx = parseInt(parts[0], 10);
		const ty = parseInt(parts[1], 10);
		const probe = makeShipToken("a1", "attacker", atk.x, atk.y, atk.heading, {
			speed: atk.speed,
			speedLeft: atk.speedLeft
		});
		const ok = Space4x.spaceNavigateTokenToCell(state, battle, probe, tx, ty);
		assert.equal(ok, true, "expected navigation to " + keys[i]);
	}
});

test("endSpaceSide runs AI defender then starts the next round", function () {
	const atk = makeShipToken("a1", "attacker", 10, 40, 0);
	const def = makeShipToken("d1", "defender", 100, 40, Math.PI);
	const battle = makeTestBattle([atk, def], { phase: "attacker" });
	const state = makeTestState(battle);

	Space4x.aiPlaySide(state, battle, "attacker");
	assert.ok(atk.activated);

	Space4x.endSpaceSide(state, battle);

	assert.equal(battle.phase, "attacker");
	assert.equal(battle.round, 2);
	assert.equal(atk.activated, false);
	assert.equal(def.activated, false);
});

test("animated AI side completes and clears _aiAnim", function () {
	const atk = makeShipToken("a1", "attacker", 10, 40, 0);
	const def = makeShipToken("d1", "defender", 100, 40, Math.PI);
	const battle = makeTestBattle([atk, def], { phase: "attacker" });
	const state = makeTestState(battle);
	let done = false;

	Space4x.app = {
		ui: {},
		sync: function () {}
	};

	Space4x.runAnimatedAiSide(state, battle, "attacker", function () {
		done = true;
	});

	assert.equal(battle._aiAnim, true);

	return new Promise(function (resolve, reject) {
		const start = Date.now();
		(function wait() {
			if (done) {
				try {
					assert.equal(battle._aiAnim, false);
					assert.ok(atk.activated);
					Space4x.app = null;
					resolve();
				} catch (err) {
					Space4x.app = null;
					reject(err);
				}
				return;
			}
			if (Date.now() - start > 15000) {
				Space4x.app = null;
				reject(new Error("timed out waiting for animated AI"));
				return;
			}
			setTimeout(wait, 50);
		})();
	});
});

test("weapon range highlights include enemy cells when in range", function () {
	const atk = makeShipToken("a1", "attacker", 50, 40, 0);
	const def = makeShipToken("d1", "defender", 60, 40, Math.PI);
	const battle = makeTestBattle([atk, def]);
	const state = makeTestState(battle);
	const weapon = atk.load[0];
	const targets = Space4x.spaceWeaponTargetCells(state, battle, atk, weapon);
	const range = Space4x.spaceWeaponRangeCells(state, battle, atk, weapon);

	assert.ok(range.length > 0);
	assert.ok(targets.some(function (c) { return c.x === def.x && c.y === def.y; }));
});

test("AI moves toward an occupied enemy cell instead of stalling", function () {
	const atk = makeShipToken("a1", "attacker", 10, 40, 0);
	const def = makeShipToken("d1", "defender", 100, 40, Math.PI);
	const battle = makeTestBattle([atk, def]);
	const state = makeTestState(battle);
	const actions = Space4x.buildAiTokenActions(state, battle, atk);
	const moves = actions.filter(function (a) { return a.type === "moveTo"; });
	assert.equal(moves.length, 1);
	assert.ok(moves[0].x > atk.x);
});

test("path toward occupied cell still yields a closer square", function () {
	const atk = makeShipToken("a1", "attacker", 10, 40, 0, { speed: 6, speedLeft: 6 });
	const def = makeShipToken("d1", "defender", 100, 40, Math.PI);
	const battle = makeTestBattle([atk, def]);
	const state = makeTestState(battle);
	assert.equal(Space4x.spacePathToCell(state, battle, atk, def.x, def.y), null);
	const startDist = Space4x.euclid(atk.x, atk.y, def.x, def.y);
	const path = Space4x.spacePathTowardCell(state, battle, atk, def.x, def.y);
	assert.ok(path && path.length);
	for (let i = 0; i < path.length; i++) {
		assert.equal(Space4x.spaceApplyAction(state, battle, atk, path[i]), true);
	}
	assert.ok(Space4x.euclid(atk.x, atk.y, def.x, def.y) < startDist);
});

test("AI only queues in-range weapon fire", function () {
	const atk = makeShipToken("a1", "attacker", 10, 40, 0);
	const def = makeShipToken("d1", "defender", 100, 40, Math.PI);
	const battle = makeTestBattle([atk, def]);
	const state = makeTestState(battle);
	const actions = Space4x.buildAiTokenActions(state, battle, atk);
	const fires = actions.filter(function (a) {
		return a.type === "fireBeam" || a.type === "fireMissile";
	});
	assert.equal(fires.length, 0);
});

test("weapon groups collapse identical loadouts", function () {
	const atk = makeShipToken("a1", "attacker", 10, 40, 0, {
		load: [
			{ id: "w0", itemId: "lightCannon", fired: false, launched: false },
			{ id: "w1", itemId: "lightCannon", fired: false, launched: false },
			{ id: "w2", itemId: "lightCannon", fired: true, launched: false }
		]
	});
	const battle = makeTestBattle([atk, makeShipToken("d1", "defender", 100, 40, Math.PI)]);
	const state = makeTestState(battle);
	const groups = Space4x.spaceWeaponGroups(state, atk.load);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].weapons.length, 3);
	assert.equal(groups[0].ready.length, 2);
	assert.match(Space4x.spaceWeaponGroupLabel(state, groups[0]), /3/);
});

test("firing a weapon group rolls each ready weapon separately", function () {
	const atk = makeShipToken("a1", "attacker", 50, 40, 0, {
		load: [
			{ id: "w0", itemId: "lightCannon", fired: false, launched: false },
			{ id: "w1", itemId: "lightCannon", fired: false, launched: false }
		]
	});
	const def = makeShipToken("d1", "defender", 55, 40, Math.PI);
	def.shields = { front: 100, right: 100, back: 100, left: 100 };
	const battle = makeTestBattle([atk, def]);
	const state = makeTestState(battle);
	state.ui.spaceWeaponId = "lightCannon";
	Space4x.playerSpaceFireGroup(state, battle, atk, "lightCannon", def);
	assert.equal(atk.load[0].fired, true);
	assert.equal(atk.load[1].fired, true);
});

test("animated AI ends after a killing beam shot", function () {
	const atk = makeShipToken("a1", "attacker", 50, 40, 0);
	const def = makeShipToken("d1", "defender", 58, 40, Math.PI, {
		load: [{ id: "w0", itemId: "lightCannon", fired: false, launched: false }]
	});
	def.shields = { front: 0, right: 0, back: 0, left: 0 };
	def.shieldMax = 0;
	def.armor = 0;
	def.armorMax = 0;
	def.structure = 1;
	def.structureMax = 1;
	const battle = makeTestBattle([atk, def], { phase: "attacker" });
	const state = makeTestState(battle);
	state.rng = 1;
	let done = false;

	Space4x.app = { ui: {}, sync: function () {} };
	Space4x.runAnimatedAiSide(state, battle, "attacker", function () {
		done = true;
	});

	return new Promise(function (resolve, reject) {
		const start = Date.now();
		(function wait() {
			if (done) {
				try {
					assert.equal(battle.done, true);
					assert.ok(def.dead);
					assert.equal(battle._aiAnim, false);
					Space4x.app = null;
					resolve();
				} catch (err) {
					Space4x.app = null;
					reject(err);
				}
				return;
			}
			if (Date.now() - start > 15000) {
				Space4x.app = null;
				reject(new Error("timed out waiting for killing shot"));
				return;
			}
			setTimeout(wait, 50);
		})();
	});
});

test("queued AI callbacks run after the current animation", function () {
	const atk = makeShipToken("a1", "attacker", 10, 40, 0);
	const def = makeShipToken("d1", "defender", 100, 40, Math.PI);
	const battle = makeTestBattle([atk, def], { phase: "attacker" });
	const state = makeTestState(battle);
	let first = false;
	let second = false;

	Space4x.app = { ui: {}, sync: function () {} };
	Space4x.runAnimatedAiSide(state, battle, "attacker", function () {
		first = true;
	});
	Space4x.runAnimatedAiSide(state, battle, "attacker", function () {
		second = true;
	});
	assert.equal(battle._aiAnim, true);

	return new Promise(function (resolve, reject) {
		const start = Date.now();
		(function wait() {
			if (first && second) {
				Space4x.app = null;
				resolve();
				return;
			}
			if (Date.now() - start > 20000) {
				Space4x.app = null;
				reject(new Error("timed out waiting for queued AI callbacks"));
				return;
			}
			setTimeout(wait, 50);
		})();
	});
});
