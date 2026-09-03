var Space4x = Space4x || {};

Space4x.troopDefs = function (state) {
	const builds = Space4x.settingOf(state).builds;
	const ids = Object.keys(builds);
	const out = [];
	for (let i = 0; i < ids.length; i++) {
		if (builds[ids[i]].kind === "troop") out.push(builds[ids[i]]);
	}
	return out;
};

Space4x.defMatchesTags = function (def, tags) {
	if (!tags || !tags.length) return true;
	const have = def && def.tags ? def.tags : [];
	for (let i = 0; i < tags.length; i++) {
		for (let j = 0; j < have.length; j++) {
			if (tags[i] === have[j]) return true;
		}
	}
	return false;
};

Space4x.troopCanInvade = function (state, troop) {
	if (!troop) return false;
	const def = Space4x.settingOf(state).builds[troop.defId];
	if (!def || def.kind !== "troop") return false;
	if (Space4x.defMatchesTags(def, ["Defensive"])) return false;
	return true;
};

Space4x.invadingTroopsFromCargo = function (state, cargo) {
	const out = [];
	const list = cargo || [];
	for (let i = 0; i < list.length; i++) {
		if (Space4x.troopCanInvade(state, list[i])) out.push(list[i]);
	}
	return out;
};

Space4x.fleetHasInvadingTroops = function (state, unit) {
	return Space4x.invadingTroopsFromCargo(state, unit && unit.cargoTroops).length > 0;
};

Space4x.eachEmpireTechEffect = function (state, empire, fn) {
	if (!empire || !empire.research) return;
	const ids = empire.research.completedTechIds || [];
	for (let i = 0; i < ids.length; i++) {
		const tech = Space4x.techById(state, ids[i]);
		if (!tech || !tech.effects) continue;
		for (let e = 0; e < tech.effects.length; e++) fn(tech, tech.effects[e]);
	}
};

Space4x.troopWeaponBonus = function (state, empire, def) {
	let best = 0;
	Space4x.eachEmpireTechEffect(state, empire, function (tech, fx) {
		if (fx.type !== "troopWeapon" || !Space4x.defMatchesTags(def, fx.tags)) return;
		if ((fx.n || 0) > best) best = fx.n || 0;
	});
	return best;
};

Space4x.troopArmorPct = function (state, empire, def) {
	let pct = 0;
	Space4x.eachEmpireTechEffect(state, empire, function (tech, fx) {
		if (fx.type !== "troopArmorPct" || !Space4x.defMatchesTags(def, fx.tags)) return;
		pct += fx.pct || 0;
	});
	return pct;
};

Space4x.troopTs = function (state, empire, def, cultureId) {
	const base = def && def.ts ? def.ts : 0;
	if (!empire) return base;
	const pct = Space4x.troopArmorPct(state, empire, def) + Space4x.cultureTroopTsPct(state, cultureId);
	return Math.round((base + Space4x.troopWeaponBonus(state, empire, def)) * (1 + pct / 100));
};

Space4x.spawnTroop = function (state, settlement, defId, silent) {
	if (!settlement.troops) settlement.troops = [];
	const def = Space4x.settingOf(state).builds[defId];
	settlement.troops.push({
		id: Space4x.nextId(state, "t"),
		defId: defId,
		culture: Space4x.majorityCulture(state, settlement)
	});
	if (!silent) state.turnLog.push(settlement.name + " completed " + (def ? def.name : defId) + ".");
};

Space4x.troopStackId = function (defId, culture) {
	return (defId || "") + "::" + (culture || "");
};

Space4x.parseTroopStackId = function (id) {
	const s = String(id || "");
	const i = s.indexOf("::");
	if (i < 0) return { defId: s, culture: null };
	return { defId: s.slice(0, i), culture: s.slice(i + 2) || null };
};

Space4x.countTroops = function (settlement, defId, culture) {
	if (!settlement || !settlement.troops) return 0;
	let n = 0;
	for (let i = 0; i < settlement.troops.length; i++) {
		const t = settlement.troops[i];
		if (defId && t.defId !== defId) continue;
		if (culture !== undefined && culture !== null && t.culture !== culture) continue;
		n += 1;
	}
	return n;
};

Space4x.troopStacks = function (state, settlement) {
	const defs = Space4x.troopDefs(state);
	const defOrder = {};
	for (let i = 0; i < defs.length; i++) defOrder[defs[i].id] = i;
	const cultures = Space4x.culturesOf(state);
	const cultureOrder = {};
	for (let i = 0; i < cultures.length; i++) cultureOrder[cultures[i].id] = i;
	const groups = {};
	const out = [];
	if (!settlement || !settlement.troops) return out;
	for (let i = 0; i < settlement.troops.length; i++) {
		const t = settlement.troops[i];
		const key = Space4x.troopStackId(t.defId, t.culture);
		if (!groups[key]) {
			const def = Space4x.settingOf(state).builds[t.defId];
			groups[key] = { id: key, defId: t.defId, culture: t.culture || null, n: 0, def: def };
			out.push(groups[key]);
		}
		groups[key].n += 1;
	}
	out.sort(function (a, b) {
		const da = defOrder[a.defId] != null ? defOrder[a.defId] : 99;
		const db = defOrder[b.defId] != null ? defOrder[b.defId] : 99;
		if (da !== db) return da - db;
		const ca = cultureOrder[a.culture] != null ? cultureOrder[a.culture] : 99;
		const cb = cultureOrder[b.culture] != null ? cultureOrder[b.culture] : 99;
		return ca - cb;
	});
	return out;
};

Space4x.settlementTroopUpkeep = function (state, settlement) {
	let n = 0;
	if (!settlement || !settlement.troops) return 0;
	for (let i = 0; i < settlement.troops.length; i++) {
		n += Space4x.defUpkeep(state, settlement.troops[i].defId);
	}
	return Space4x.moneyRound(n);
};

Space4x.troopUpkeep = function (state, empireId) {
	let n = 0;
	const homes = Space4x.settlementsOf(state, empireId);
	for (let i = 0; i < homes.length; i++) {
		n += Space4x.settlementTroopUpkeep(state, homes[i]);
	}
	const haulers = Space4x.troopHaulers(state, empireId);
	for (let h = 0; h < haulers.length; h++) {
		const cargo = haulers[h].cargoTroops || [];
		for (let i = 0; i < cargo.length; i++) {
			n += Space4x.defUpkeep(state, cargo[i].defId);
		}
	}
	return Space4x.moneyRound(n);
};

Space4x.takeTroopsForMove = function (settlement, defId, count, culture) {
	const taken = [];
	if (!settlement.troops) return taken;
	for (let i = settlement.troops.length - 1; i >= 0 && taken.length < count; i--) {
		const t = settlement.troops[i];
		if (t.defId !== defId) continue;
		if (culture && t.culture !== culture) continue;
		taken.push(settlement.troops.splice(i, 1)[0]);
	}
	return taken;
};

Space4x.takeTroopsByIds = function (settlement, ids) {
	const want = {};
	const taken = [];
	if (!settlement || !settlement.troops || !ids) return taken;
	for (let i = 0; i < ids.length; i++) want[ids[i]] = true;
	for (let i = settlement.troops.length - 1; i >= 0; i--) {
		const t = settlement.troops[i];
		if (!want[t.id]) continue;
		taken.push(settlement.troops.splice(i, 1)[0]);
	}
	return taken;
};

Space4x.orderedGarrisonTroops = function (state, settlement) {
	if (!settlement || !settlement.troops || !settlement.troops.length) return [];
	const stacks = Space4x.troopStacks(state, settlement);
	const groups = {};
	for (let i = 0; i < settlement.troops.length; i++) {
		const t = settlement.troops[i];
		const key = Space4x.troopStackId(t.defId, t.culture);
		if (!groups[key]) groups[key] = [];
		groups[key].push(t);
	}
	const out = [];
	for (let s = 0; s < stacks.length; s++) {
		const list = groups[stacks[s].id] || [];
		for (let i = 0; i < list.length; i++) out.push(list[i]);
	}
	return out;
};

Space4x.launchTroopHauler = function (state, from, to, taken, opts) {
	opts = opts || {};
	if (!from || !taken || !taken.length) return false;
	const empire = Space4x.empireById(state, from.empireId);
	if (!empire) return false;
	const factor = Space4x.settingOf(state).troopMoveFreighterFactor || 1;
	const hulls = taken.length * factor;
	if (hulls > empire.transport.freighters) return false;
	empire.transport.freighters -= hulls;
	const star = Space4x.starById(state, from.location.starId);
	const unit = {
		id: Space4x.nextId(state, "u"),
		defId: Space4x.UNIT_ROLES.troopHauler,
		role: Space4x.UNIT_ROLES.troopHauler,
		empireId: from.empireId,
		location: {
			kind: "orbit",
			x: star.x,
			y: star.y,
			starId: star.id,
			settlementId: null
		},
		cargoTroops: taken,
		originSettlementId: from.id,
		hulls: hulls
	};
	if (opts.fleetMode) {
		unit.fleetMode = true;
		unit.targetStarId = null;
		unit.destSettlementId = null;
		state.units.push(unit);
		state.turnLog.push(Space4x.troopCargoLabel(state, taken) + " sent to fleet at " + from.name + ".");
		return true;
	}
	if (!to || from.id === to.id || from.empireId !== to.empireId) return false;
	if (!Space4x.canLeaveSystem(state, empire, from.location.starId, to.location.starId)) return false;
	const destStar = Space4x.starById(state, to.location.starId);
	unit.targetStarId = destStar.id;
	unit.destSettlementId = to.id;
	state.units.push(unit);
	state.turnLog.push(Space4x.troopCargoLabel(state, taken) + " boarded freighters at " + from.name + " bound for " + to.name + ".");
	return true;
};

Space4x.troopHaulers = function (state, empireId) {
	const out = [];
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (!Space4x.isTroopHauler(state, u)) continue;
		if (empireId && u.empireId !== empireId) continue;
		out.push(u);
	}
	return out;
};

Space4x.troopCargoLabel = function (state, troops) {
	const builds = Space4x.settingOf(state).builds;
	const counts = {};
	const order = [];
	for (let i = 0; i < troops.length; i++) {
		const key = Space4x.troopStackId(troops[i].defId, troops[i].culture);
		if (!counts[key]) {
			counts[key] = { n: 0, defId: troops[i].defId, culture: troops[i].culture };
			order.push(key);
		}
		counts[key].n += 1;
	}
	const bits = [];
	for (let i = 0; i < order.length; i++) {
		const row = counts[order[i]];
		const def = builds[row.defId];
		let name = def ? def.name : row.defId;
		if (row.culture) name += " " + Space4x.cultureName(state, row.culture);
		bits.push(row.n + " " + name);
	}
	return bits.join(", ");
};

Space4x.queueTroopMove = function (state, fromId, toId, defId, count, culture) {
	const from = Space4x.settlementById(state, fromId);
	const to = Space4x.settlementById(state, toId);
	if (!from || !to || from.id === to.id || from.empireId !== to.empireId) return false;
	const def = Space4x.settingOf(state).builds[defId];
	if (!def || def.kind !== "troop") return false;
	let n = Math.floor(count);
	if (!(n > 0)) return false;
	n = Math.min(n, Space4x.countTroops(from, defId, culture || undefined));
	if (n <= 0) return false;
	const empire = Space4x.empireById(state, from.empireId);
	if (!Space4x.canLeaveSystem(state, empire, from.location.starId, to.location.starId)) return false;
	const factor = Space4x.settingOf(state).troopMoveFreighterFactor || 1;
	n = Math.min(n, Math.floor(empire.transport.freighters / factor));
	if (n <= 0) return false;
	const taken = Space4x.takeTroopsForMove(from, defId, n, culture);
	if (!taken.length) return false;
	return Space4x.launchTroopHauler(state, from, to, taken, {});
};

Space4x.queueTroopMoveByIds = function (state, fromId, toId, troopIds) {
	const from = Space4x.settlementById(state, fromId);
	const to = Space4x.settlementById(state, toId);
	if (!from || !to || from.id === to.id || from.empireId !== to.empireId) return false;
	if (!troopIds || !troopIds.length) return false;
	const empire = Space4x.empireById(state, from.empireId);
	if (!Space4x.canLeaveSystem(state, empire, from.location.starId, to.location.starId)) return false;
	const taken = Space4x.takeTroopsByIds(from, troopIds);
	if (!taken.length) return false;
	return Space4x.launchTroopHauler(state, from, to, taken, {});
};

Space4x.finishTroopFleet = function (state, unit) {
	if (!unit) return;
	const empire = Space4x.empireById(state, unit.empireId);
	if (empire) empire.transport.freighters += unit.hulls || 0;
	state.units = state.units.filter(function (u) { return u.id !== unit.id; });
};

Space4x.queueTroopFleet = function (state, fromId, defId, count, culture) {
	const from = Space4x.settlementById(state, fromId);
	if (!from) return false;
	const def = Space4x.settingOf(state).builds[defId];
	if (!def || def.kind !== "troop") return false;
	let n = Math.floor(count);
	if (!(n > 0)) return false;
	n = Math.min(n, Space4x.countTroops(from, defId, culture || undefined));
	if (n <= 0) return false;
	const empire = Space4x.empireById(state, from.empireId);
	const factor = Space4x.settingOf(state).troopMoveFreighterFactor || 1;
	n = Math.min(n, Math.floor(empire.transport.freighters / factor));
	if (n <= 0) return false;
	const taken = Space4x.takeTroopsForMove(from, defId, n, culture);
	if (!taken.length) return false;
	return Space4x.launchTroopHauler(state, from, null, taken, { fleetMode: true });
};

Space4x.queueTroopFleetByIds = function (state, fromId, troopIds) {
	const from = Space4x.settlementById(state, fromId);
	if (!from || !troopIds || !troopIds.length) return false;
	const empire = Space4x.empireById(state, from.empireId);
	const factor = Space4x.settingOf(state).troopMoveFreighterFactor || 1;
	const max = Math.floor(empire.transport.freighters / factor);
	if (max <= 0) return false;
	const ids = troopIds.length > max ? troopIds.slice(0, max) : troopIds;
	const taken = Space4x.takeTroopsByIds(from, ids);
	if (!taken.length) return false;
	return Space4x.launchTroopHauler(state, from, null, taken, { fleetMode: true });
};

Space4x.pendingInvasionFleets = function (state, empireId) {
	const reserved = {};
	const list = state.pendingInvasions;
	if (!list) return reserved;
	for (let i = 0; i < list.length; i++) {
		const o = list[i];
		if (empireId && o.attackerEmpireId !== empireId) continue;
		const ids = o.fleetIds || [];
		for (let f = 0; f < ids.length; f++) reserved[ids[f]] = true;
	}
	return reserved;
};

Space4x.hasPendingInvasion = function (state, settlementId) {
	const list = state.pendingInvasions;
	if (!list || !settlementId) return false;
	for (let i = 0; i < list.length; i++) {
		if (list[i].settlementId === settlementId) return true;
	}
	return false;
};

Space4x.gatherInvasionForce = function (state, unitIdOrIds, settlementId) {
	const ids = Array.isArray(unitIdOrIds) ? unitIdOrIds : [unitIdOrIds];
	const st = Space4x.settlementById(state, settlementId);
	if (!st || !ids.length) return null;
	const fleets = [];
	const attackers = [];
	let atkEmpire = null;
	for (let i = 0; i < ids.length; i++) {
		const unit = Space4x.unitById(state, ids[i]);
		if (!unit || !unit.fleetMode) return null;
		if (!atkEmpire) atkEmpire = Space4x.empireById(state, unit.empireId);
		if (!atkEmpire || unit.empireId !== atkEmpire.id) return null;
		const defEmpire = Space4x.empireById(state, st.empireId);
		if (!defEmpire || atkEmpire.id === defEmpire.id) return null;
		if (!Space4x.atWar(atkEmpire, defEmpire.id)) return null;
		if (unit.location.kind !== "orbit" || unit.location.starId !== st.location.starId) return null;
		const cargo = unit.cargoTroops || [];
		const invading = Space4x.invadingTroopsFromCargo(state, cargo);
		if (!invading.length) return null;
		fleets.push(unit);
		for (let c = 0; c < invading.length; c++) attackers.push(invading[c]);
	}
	if (!fleets.length || !attackers.length) return null;
	return {
		fleets: fleets,
		fleetIds: fleets.map(function (u) { return u.id; }),
		attackers: attackers,
		atkEmpire: atkEmpire,
		st: st,
		defEmpire: Space4x.empireById(state, st.empireId)
	};
};

Space4x.finishInvasionFleets = function (state, fleets, landedIds) {
	const landed = {};
	const list = landedIds || [];
	for (let i = 0; i < list.length; i++) landed[list[i]] = true;
	for (let f = 0; f < fleets.length; f++) {
		const fleet = fleets[f];
		const cargo = fleet.cargoTroops || [];
		const left = [];
		for (let c = 0; c < cargo.length; c++) {
			if (!landed[cargo[c].id]) left.push(cargo[c]);
		}
		fleet.cargoTroops = left;
		if (!left.length) Space4x.finishTroopFleet(state, fleet);
	}
};

Space4x.queueInvasion = function (state, unitIdOrIds, settlementId) {
	if (!state.pendingInvasions) state.pendingInvasions = [];
	if (Space4x.hasPendingInvasion(state, settlementId)) return false;
	const force = Space4x.gatherInvasionForce(state, unitIdOrIds, settlementId);
	if (!force) return false;
	const reserved = Space4x.pendingInvasionFleets(state, force.atkEmpire.id);
	for (let i = 0; i < force.fleetIds.length; i++) {
		if (reserved[force.fleetIds[i]]) return false;
	}
	state.pendingInvasions.push({
		id: Space4x.nextId(state, "inv"),
		settlementId: settlementId,
		fleetIds: force.fleetIds.slice(),
		attackerEmpireId: force.atkEmpire.id
	});
	const label = Space4x.settlementLabel(state, force.st);
	state.turnLog.push(force.atkEmpire.name + " invasion of " + label + " ordered (resolves end of turn).");
	return true;
};

Space4x.phasePendingInvasions = function (state) {
	if (!state.pendingInvasions || !state.pendingInvasions.length) return;
	const orders = state.pendingInvasions.slice();
	state.pendingInvasions = [];
	for (let i = 0; i < orders.length; i++) {
		const order = orders[i];
		const st = Space4x.settlementById(state, order.settlementId);
		const label = st ? Space4x.settlementLabel(state, st) : "target";
		if (!Space4x.resolveInvasion(state, order.fleetIds, order.settlementId)) {
			state.turnLog.push("Invasion of " + label + " cancelled.");
		}
	}
};

Space4x.resolveInvasion = function (state, unitIdOrIds, settlementId) {
	const force = Space4x.gatherInvasionForce(state, unitIdOrIds, settlementId);
	if (!force) return false;
	const fleets = force.fleets;
	const attackers = force.attackers;
	const atkEmpire = force.atkEmpire;
	const st = force.st;
	const defEmpire = force.defEmpire;
	const attackerIds = attackers.map(function (t) { return t.id; });

	const label = Space4x.settlementLabel(state, st);
	const loyalBefore = st.troops ? st.troops.slice() : [];

	if (!loyalBefore.length) {
		Space4x.transferSettlement(state, st, atkEmpire);
		st.troops = attackers.slice();
		Space4x.applyOccupationChange(state, st, atkEmpire, defEmpire);
		Space4x.finishInvasionFleets(state, fleets, attackerIds);
		const atkSum = Space4x.summarizeTroopSide(state, atkEmpire, attackers);
		const summary = atkEmpire.name + " captures " + label + " without resistance.";
		Space4x.registerGroundCombat(state, {
			id: Space4x.nextId(state, "gc"),
			turn: state.turn + 1,
			kind: "invasion",
			settlementId: st.id,
			settlementLabel: label,
			starId: st.location.starId,
			bodyId: st.location.bodyId,
			empireId: atkEmpire.id,
			attackerLabel: atkEmpire.name + " invasion force",
			defenderLabel: defEmpire.name + " garrison",
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
			attackerCultureId: atkEmpire.cultureId,
			defenderCultureId: defEmpire.cultureId,
			attackerEmpireId: atkEmpire.id,
			defenderEmpireId: defEmpire.id,
			attackerDefId: null,
			rounds: ["No garrison — invasion succeeds without resistance."],
			winner: "attacker",
			winnerLabel: atkEmpire.name + " invasion force",
			popsLost: 0,
			effects: ["Settlement changes hands."],
			summary: summary,
			seen: false
		});
		state.turnLog.push(summary);
		return true;
	}

	if (Space4x.combatModel(state) !== "quick") {
		state.turnLog.push("Invasion combat not resolved yet at " + label + ".");
		return false;
	}

	const fight = Space4x.quickCombat(state, {
		empire: atkEmpire,
		troops: attackers
	}, {
		empire: defEmpire,
		troops: loyalBefore
	});
	const report = Space4x.buildGroundCombatReport(state, {
		kind: "invasion",
		settlementId: st.id,
		settlementLabel: label,
		starId: st.location.starId,
		bodyId: st.location.bodyId,
		empireId: atkEmpire.id,
		attackerLabel: atkEmpire.name + " invasion force",
		defenderLabel: defEmpire.name + " garrison",
		atk: { empire: atkEmpire, troops: attackers },
		def: { empire: defEmpire, troops: loyalBefore },
		atkTroopsBefore: attackers,
		defTroopsBefore: loyalBefore,
		fight: fight,
		popsLost: 0,
		effects: []
	});

	const survivors = fight.atkTroops;
	st.troops = fight.defTroops;
	const survivorIds = survivors.map(function (t) { return t.id; });

	if (fight.winner === "attacker" && survivors.length) {
		Space4x.transferSettlement(state, st, atkEmpire);
		st.troops = survivors.slice();
		Space4x.applyOccupationChange(state, st, atkEmpire, defEmpire);
		Space4x.finishInvasionFleets(state, fleets, survivorIds);
		report.summary = atkEmpire.name + " captures " + label + ".";
		report.effects.push("Settlement changes hands.");
		Space4x.registerGroundCombat(state, report);
		state.turnLog.push(report.summary);
	} else if (!survivors.length) {
		report.summary = "Invasion repelled at " + label + ".";
		Space4x.registerGroundCombat(state, report);
		Space4x.finishInvasionFleets(state, fleets, attackerIds);
		state.turnLog.push(report.summary);
	} else {
		const alive = {};
		for (let i = 0; i < survivors.length; i++) alive[survivors[i].id] = true;
		for (let f = 0; f < fleets.length; f++) {
			const cargo = fleets[f].cargoTroops || [];
			const kept = [];
			for (let c = 0; c < cargo.length; c++) {
				const t = cargo[c];
				if (!Space4x.troopCanInvade(state, t) || alive[t.id]) kept.push(t);
			}
			fleets[f].cargoTroops = kept;
		}
		report.summary = "Invasion stalled at " + label + ".";
		Space4x.registerGroundCombat(state, report);
		state.turnLog.push(report.summary);
	}
	return true;
};

Space4x.invadeSettlement = function (state, unitIdOrIds, settlementId) {
	return Space4x.resolveInvasion(state, unitIdOrIds, settlementId);
};

Space4x.unloadTroopFleet = function (state, unitId, settlementId) {
	const unit = Space4x.unitById(state, unitId);
	const st = Space4x.settlementById(state, settlementId);
	if (!unit || !st || !unit.fleetMode) return false;
	if (unit.empireId !== st.empireId) return false;
	if (unit.location.kind !== "orbit" || unit.location.starId !== st.location.starId) return false;
	const cargo = unit.cargoTroops || [];
	if (!cargo.length) return false;
	if (!st.troops) st.troops = [];
	for (let i = 0; i < cargo.length; i++) st.troops.push(cargo[i]);
	state.turnLog.push(Space4x.troopCargoLabel(state, cargo) + " unloaded at " + Space4x.settlementLabel(state, st) + ".");
	unit.cargoTroops = [];
	Space4x.finishTroopFleet(state, unit);
	return true;
};

Space4x.unloadTroopHauler = function (state, unit) {
	if (!unit || !Space4x.isTroopHauler(state, unit)) return;
	const starId = unit.location.starId;
	let dest = Space4x.settlementById(state, unit.destSettlementId);
	if (!dest || dest.location.starId !== starId) dest = Space4x.settlementById(state, unit.originSettlementId);
	if (!dest || dest.location.starId !== starId) {
		dest = null;
		const homes = Space4x.settlementsOf(state, unit.empireId);
		for (let i = 0; i < homes.length; i++) {
			if (homes[i].location.starId === starId) dest = homes[i];
		}
	}
	if (!dest) return;
	if (!dest.troops) dest.troops = [];
	const cargo = unit.cargoTroops || [];
	for (let i = 0; i < cargo.length; i++) dest.troops.push(cargo[i]);
	const empire = Space4x.empireById(state, unit.empireId);
	empire.transport.freighters += unit.hulls || 0;
	state.units = state.units.filter(function (u) { return u.id !== unit.id; });
	if (cargo.length) {
		state.turnLog.push(Space4x.troopCargoLabel(state, cargo) + " arrived at " + dest.name + ".");
	}
};

Space4x.cancelTroopMove = function (state, unitId) {
	const unit = Space4x.unitById(state, unitId);
	if (!unit || !Space4x.isTroopHauler(state, unit)) return;
	if (unit.fleetMode) {
		const origin = Space4x.settlementById(state, unit.originSettlementId);
		const cargo = unit.cargoTroops || [];
		if (origin) {
			if (!origin.troops) origin.troops = [];
			for (let i = 0; i < cargo.length; i++) origin.troops.push(cargo[i]);
			if (cargo.length) {
				state.turnLog.push(Space4x.troopCargoLabel(state, cargo) + " recalled to " + origin.name + ".");
			}
		}
		Space4x.finishTroopFleet(state, unit);
		return;
	}
	const origin = Space4x.settlementById(state, unit.originSettlementId);
	if (origin) {
		unit.destSettlementId = origin.id;
		const star = Space4x.starById(state, origin.location.starId);
		if (star) {
			if (unit.location.kind === "orbit" && unit.location.starId === star.id) {
				Space4x.unloadTroopHauler(state, unit);
				return;
			}
			unit.targetStarId = star.id;
		}
	}
};

Space4x.cancelHauler = function (state, unitId) {
	const unit = Space4x.unitById(state, unitId);
	if (!unit) return;
	if (Space4x.isPopHauler(state, unit)) Space4x.cancelPopMove(state, unitId);
	if (Space4x.isTroopHauler(state, unit)) Space4x.cancelTroopMove(state, unitId);
};
