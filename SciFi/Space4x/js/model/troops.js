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

Space4x.troopHaulers = function (state, empireId) {
	const out = [];
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.defId !== "troopHauler") continue;
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
	const hulls = n * factor;
	const taken = Space4x.takeTroopsForMove(from, defId, n, culture);
	if (!taken.length) return false;
	empire.transport.freighters -= hulls;
	const star = Space4x.starById(state, from.location.starId);
	const destStar = Space4x.starById(state, to.location.starId);
	state.units.push({
		id: Space4x.nextId(state, "u"),
		defId: "troopHauler",
		empireId: from.empireId,
		location: {
			kind: "orbit",
			x: star.x,
			y: star.y,
			starId: star.id,
			settlementId: null
		},
		targetStarId: destStar.id,
		cargoTroops: taken,
		destSettlementId: to.id,
		originSettlementId: from.id,
		hulls: hulls
	});
	state.turnLog.push(Space4x.troopCargoLabel(state, taken) + " boarded freighters at " + from.name + " bound for " + to.name + ".");
	return true;
};

Space4x.unloadTroopHauler = function (state, unit) {
	if (!unit || unit.defId !== "troopHauler") return;
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
	if (!unit || unit.defId !== "troopHauler") return;
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
	if (unit.defId === "popHauler") Space4x.cancelPopMove(state, unitId);
	if (unit.defId === "troopHauler") Space4x.cancelTroopMove(state, unitId);
};
