var Space4x = Space4x || {};

Space4x.groundCombatsOf = function (state, empireId) {
	const list = state.turnEvents && state.turnEvents.groundCombats;
	if (!list) return [];
	if (!empireId) return list.slice();
	const out = [];
	for (let i = 0; i < list.length; i++) {
		if (list[i].empireId === empireId) out.push(list[i]);
	}
	return out;
};

Space4x.groundCombatById = function (state, id) {
	const list = state.turnEvents && state.turnEvents.groundCombats;
	if (!list || !id) return null;
	for (let i = 0; i < list.length; i++) {
		if (list[i].id === id) return list[i];
	}
	return null;
};

Space4x.registerGroundCombat = function (state, report) {
	if (!state.turnEvents) state.turnEvents = {};
	if (!state.turnEvents.groundCombats) state.turnEvents.groundCombats = [];
	state.turnEvents.groundCombats.push(report);
	return report;
};

Space4x.markGroundCombatSeen = function (state, combatId) {
	const c = Space4x.groundCombatById(state, combatId);
	if (c) c.seen = true;
};

Space4x.playerUnseenGroundCombats = function (state) {
	const player = Space4x.playerEmpire(state);
	if (!player || state.observerMode) return [];
	const list = Space4x.groundCombatsOf(state, player.id);
	const out = [];
	for (let i = 0; i < list.length; i++) {
		if (!list[i].seen) out.push(list[i]);
	}
	return out;
};

Space4x.summarizeTroopSide = function (state, empire, troops) {
	const groups = {};
	const stackOrder = [];
	let ts = 0;
	const list = troops || [];
	for (let i = 0; i < list.length; i++) {
		const t = list[i];
		const def = Space4x.settingOf(state).builds[t.defId];
		const name = def ? def.name : (t.defId || "Unit");
		const each = def ? Space4x.troopTs(state, empire, def, t.culture) : 0;
		const key = Space4x.troopStackId(t.defId, t.culture);
		if (!groups[key]) {
			groups[key] = {
				id: key,
				defId: t.defId,
				culture: t.culture || null,
				name: name,
				count: 0,
				tsEach: each,
				ts: 0
			};
			stackOrder.push(key);
		}
		groups[key].count += 1;
		groups[key].ts += each;
		ts += each;
	}
	const stacks = [];
	const lines = [];
	for (let g = 0; g < stackOrder.length; g++) {
		const row = groups[stackOrder[g]];
		stacks.push(row);
		lines.push(row.count + "× " + row.name + " (" + row.tsEach + " TS each, " + row.ts + " total)");
	}
	return { ts: ts, stacks: stacks, lines: lines };
};

Space4x.troopCasualtyStacks = function (state, empire, before, after) {
	const beforeIds = {};
	const afterIds = {};
	const listA = before || [];
	const listB = after || [];
	for (let i = 0; i < listA.length; i++) beforeIds[listA[i].id] = listA[i];
	for (let i = 0; i < listB.length; i++) afterIds[listB[i].id] = true;
	const dead = [];
	for (let i = 0; i < listA.length; i++) {
		if (!afterIds[listA[i].id]) dead.push(listA[i]);
	}
	if (!dead.length) return [];
	return Space4x.summarizeTroopSide(state, empire, dead).stacks;
};

Space4x.troopCasualtyLines = function (state, empire, before, after) {
	const stacks = Space4x.troopCasualtyStacks(state, empire, before, after);
	if (!stacks.length) return [];
	const lines = [];
	for (let i = 0; i < stacks.length; i++) {
		const row = stacks[i];
		lines.push(row.count + "× " + row.name + " (" + row.tsEach + " TS each, " + row.ts + " total)");
	}
	return lines;
};

Space4x.buildGroundCombatReport = function (state, opts) {
	const atkBefore = opts.atkTroopsBefore || [];
	const defBefore = opts.defTroopsBefore || [];
	const fight = opts.fight;
	const atkAfter = fight.atkTroops || [];
	const defAfter = fight.defTroops || [];
	const atkSum = Space4x.summarizeTroopSide(state, opts.atk.empire, atkBefore);
	const defSum = Space4x.summarizeTroopSide(state, opts.def.empire, defBefore);
	const atkLostStacks = Space4x.troopCasualtyStacks(state, opts.atk.empire, atkBefore, atkAfter);
	const defLostStacks = Space4x.troopCasualtyStacks(state, opts.def.empire, defBefore, defAfter);
	const atkLost = [];
	const defLost = [];
	for (let i = 0; i < atkLostStacks.length; i++) {
		const row = atkLostStacks[i];
		atkLost.push(row.count + "× " + row.name + " (" + row.tsEach + " TS each, " + row.ts + " total)");
	}
	for (let i = 0; i < defLostStacks.length; i++) {
		const row = defLostStacks[i];
		defLost.push(row.count + "× " + row.name + " (" + row.tsEach + " TS each, " + row.ts + " total)");
	}
	const effects = (opts.effects || []).slice();
	if (opts.popsLost) {
		effects.push(opts.popsLost + " " + Space4x.peopleWord(opts.popsLost) + " lost.");
	}
	const roundLines = [];
	for (let r = 0; r < fight.rounds.length; r++) {
		const round = fight.rounds[r];
		roundLines.push("Round " + round.n + ": attacker deals " + round.atkDealt + ", defender deals " + round.defDealt +
			" → " + round.atkPool + " vs " + round.defPool + " TS remaining.");
	}
	const winnerLabel = fight.winner === "attacker" ? opts.attackerLabel : opts.defenderLabel;
	return {
		id: Space4x.nextId(state, "gc"),
		turn: state.turn + 1,
		kind: opts.kind || "battle",
		settlementId: opts.settlementId,
		settlementLabel: opts.settlementLabel,
		starId: opts.starId || null,
		bodyId: opts.bodyId || null,
		empireId: opts.empireId,
		attackerLabel: opts.attackerLabel,
		defenderLabel: opts.defenderLabel,
		attackerTs: atkSum.ts,
		defenderTs: defSum.ts,
		attackerStacks: atkSum.stacks,
		defenderStacks: defSum.stacks,
		attackerForces: atkSum.lines,
		defenderForces: defSum.lines,
		attackerLostStacks: atkLostStacks,
		defenderLostStacks: defLostStacks,
		attackerLost: atkLost,
		defenderLost: defLost,
		attackerCultureId: opts.atk.empire ? opts.atk.empire.cultureId : null,
		defenderCultureId: opts.def.empire ? opts.def.empire.cultureId : null,
		attackerEmpireId: opts.atk.empire ? opts.atk.empire.id : null,
		defenderEmpireId: opts.def.empire ? opts.def.empire.id : null,
		attackerDefId: opts.attackerDefId || null,
		rounds: roundLines,
		winner: fight.winner,
		winnerLabel: winnerLabel,
		popsLost: opts.popsLost || 0,
		effects: effects,
		summary: opts.summary || (winnerLabel + " wins at " + opts.settlementLabel + "."),
		seen: false
	};
};

Space4x.phaseGroundCombat = function (state) {
	Space4x.phaseWildlifeCombat(state);
};

Space4x.phaseWildlifeCombat = function (state) {
	const rules = Space4x.planetColorRules(state).wildlife || {};
	const chance = rules.attackChance != null ? rules.attackChance : 0.1;
	const defId = rules.predatorDefId || "predator";
	const def = Space4x.settingOf(state).builds[defId];
	if (!def) return;

	for (let i = 0; i < state.settlements.length; i++) {
		const st = state.settlements[i];
		const body = Space4x.bodyById(state, st.location.bodyId);
		if (!body || !Space4x.bodyHasColor(body, "wildlife")) continue;
		if (Space4x.rngNext(state) >= chance) continue;

		const n = Space4x.unusedAgriSlots(state, st);
		if (n <= 0) continue;

		const predators = [];
		for (let p = 0; p < n; p++) {
			predators.push({ id: Space4x.nextId(state, "t"), defId: defId, culture: null });
		}
		const loyalBefore = st.troops ? st.troops.slice() : [];
		const predatorName = def ? def.name : "Predators";
		const label = Space4x.settlementLabel(state, st);
		const empire = Space4x.empireById(state, st.empireId);
		const defLabel = empire ? (empire.name + " garrison") : "Garrison";
		state.turnLog.push(predatorName + " attack " + label + " (" + n + " " + Space4x.unitsWord(n) + ").");

		let popsLost = 0;
		const effects = [];

		if (!loyalBefore.length) {
			const kill = Math.min(n, st.pops.length);
			popsLost = kill;
			if (kill > 0) {
				st.pops.splice(st.pops.length - kill, kill);
				state.turnLog.push(kill + " " + Space4x.peopleWord(kill) + " lost at " + label + ".");
			}
			const atkSum = Space4x.summarizeTroopSide(state, null, predators);
			const effects = [];
			if (popsLost) effects.push(popsLost + " " + Space4x.peopleWord(popsLost) + " lost.");
			effects.push("Settlement destroyed.");
			Space4x.registerGroundCombat(state, {
				id: Space4x.nextId(state, "gc"),
				turn: state.turn + 1,
				kind: "wildlife",
				settlementId: st.id,
				settlementLabel: label,
				starId: st.location.starId,
				bodyId: st.location.bodyId,
				empireId: st.empireId,
				attackerLabel: predatorName,
				defenderLabel: defLabel,
				attackerTs: atkSum.ts,
				defenderTs: 0,
				attackerStacks: atkSum.stacks,
				defenderStacks: [],
				attackerForces: atkSum.lines,
				defenderForces: ["No garrison"],
				attackerLostStacks: [],
				defenderLostStacks: [],
				attackerLost: [],
				defenderLost: [],
				attackerCultureId: null,
				defenderCultureId: empire ? empire.cultureId : null,
				attackerEmpireId: null,
				defenderEmpireId: empire ? empire.id : null,
				attackerDefId: defId,
				rounds: ["No garrison — predators overrun the colony."],
				winner: "attacker",
				winnerLabel: predatorName,
				popsLost: popsLost,
				effects: effects,
				settlementDestroyed: true,
				summary: predatorName + " destroyed " + label + (popsLost ? " (" + popsLost + " dead)" : "") + ".",
				seen: false
			});
			Space4x.destroySettlement(state, st.id, "wildlife overrun");
			i -= 1;
			continue;
		}

		if (Space4x.combatModel(state) !== "quick") {
			const pending = "Wildlife combat not resolved yet.";
			state.turnLog.push(pending);
			Space4x.registerGroundCombat(state, {
				id: Space4x.nextId(state, "gc"),
				turn: state.turn + 1,
				kind: "wildlife",
				settlementId: st.id,
				settlementLabel: label,
				starId: st.location.starId,
				bodyId: st.location.bodyId,
				empireId: st.empireId,
				attackerLabel: predatorName,
				defenderLabel: defLabel,
				attackerTs: Space4x.troopListTs(state, null, predators),
				defenderTs: Space4x.troopListTs(state, empire, loyalBefore),
				attackerStacks: Space4x.summarizeTroopSide(state, null, predators).stacks,
				defenderStacks: Space4x.summarizeTroopSide(state, empire, loyalBefore).stacks,
				attackerForces: Space4x.summarizeTroopSide(state, null, predators).lines,
				defenderForces: Space4x.summarizeTroopSide(state, empire, loyalBefore).lines,
				attackerLostStacks: [],
				defenderLostStacks: [],
				attackerLost: [],
				defenderLost: [],
				attackerCultureId: null,
				defenderCultureId: empire ? empire.cultureId : null,
				attackerEmpireId: null,
				defenderEmpireId: empire ? empire.id : null,
				attackerDefId: defId,
				rounds: [pending],
				winner: "defender",
				winnerLabel: defLabel,
				popsLost: 0,
				effects: [],
				summary: pending,
				seen: false
			});
			continue;
		}

		const fight = Space4x.quickCombat(state, {
			empire: null,
			troops: predators
		}, {
			empire: empire,
			troops: loyalBefore
		});
		st.troops = fight.defTroops;
		const report = Space4x.buildGroundCombatReport(state, {
			kind: "wildlife",
			settlementId: st.id,
			settlementLabel: label,
			starId: st.location.starId,
			bodyId: st.location.bodyId,
			empireId: st.empireId,
			attackerLabel: predatorName,
			defenderLabel: defLabel,
			attackerDefId: defId,
			atk: { empire: null, troops: predators },
			def: { empire: empire, troops: loyalBefore },
			atkTroopsBefore: predators,
			defTroopsBefore: loyalBefore,
			fight: fight,
			popsLost: 0,
			effects: effects
		});
		const lost = loyalBefore.length - fight.defTroops.length;
		let destroyed = false;
		if (lost > 0) {
			const lossLine = lost + " garrison " + Space4x.unitsWord(lost) + " lost to wildlife at " + label + ".";
			state.turnLog.push(lossLine);
		}
		if (fight.winner === "attacker") {
			if (!fight.defTroops.length && fight.atkTroops.length) {
				const kill = Math.min(fight.atkTroops.length, st.pops.length);
				popsLost = kill;
				if (kill > 0) {
					st.pops.splice(st.pops.length - kill, kill);
					const lossLine = kill + " " + Space4x.peopleWord(kill) + " lost after wildlife overruns " + label + ".";
					state.turnLog.push(lossLine);
					report.popsLost = kill;
					report.effects.push(kill + " " + Space4x.peopleWord(kill) + " lost after overrun.");
				}
			}
			report.winner = "attacker";
			report.winnerLabel = predatorName;
			report.summary = predatorName + " destroyed " + label + ".";
			report.effects.push("Settlement destroyed.");
			report.settlementDestroyed = true;
			Space4x.registerGroundCombat(state, report);
			Space4x.destroySettlement(state, st.id, "wildlife overrun");
			i -= 1;
		} else if (!lost && !popsLost) {
			report.effects.push("Garrison drove off the attack.");
			report.summary = defLabel + " repelled " + predatorName + " at " + label + ".";
			Space4x.registerGroundCombat(state, report);
		} else {
			report.summary = defLabel + " holds " + label + " against " + predatorName + ".";
			Space4x.registerGroundCombat(state, report);
		}
	}
};
