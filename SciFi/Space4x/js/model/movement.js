var Space4x = Space4x || {};

Space4x.enterOrbit = function (unit, star) {
	unit.location.kind = "orbit";
	unit.location.starId = star.id;
	unit.location.x = star.x;
	unit.location.y = star.y;
	unit.location.settlementId = null;
	unit.targetStarId = null;
};

Space4x.stepToward = function (state, unit, tx, ty, speed, requireRange) {
	const x0 = unit.location.x;
	const y0 = unit.location.y;
	const total = Space4x.dist(x0, y0, tx, ty);
	if (total <= 1e-9) {
		unit.location.kind = "space";
		unit.location.x = tx;
		unit.location.y = ty;
		unit.location.starId = null;
		unit.location.settlementId = null;
		return;
	}
	const ux = (tx - x0) / total;
	const uy = (ty - y0) / total;
	let dist = Math.min(speed, total);
	if (requireRange) {
		let lo = 0;
		let hi = dist;
		if (!Space4x.inRangeOfEmpire(state, unit.empireId, x0 + ux * hi, y0 + uy * hi)) {
			for (let i = 0; i < 18; i++) {
				const mid = (lo + hi) / 2;
				if (Space4x.inRangeOfEmpire(state, unit.empireId, x0 + ux * mid, y0 + uy * mid)) lo = mid;
				else hi = mid;
			}
			dist = lo;
		}
	}
	unit.location.kind = "space";
	unit.location.x = x0 + ux * dist;
	unit.location.y = y0 + uy * dist;
	unit.location.starId = null;
	unit.location.settlementId = null;
};

Space4x.canReachThisTurn = function (state, unit, tx, ty, speed, requireRange) {
	const d = Space4x.dist(unit.location.x, unit.location.y, tx, ty);
	if (d > speed + 1e-9) return false;
	if (requireRange && !Space4x.inRangeOfEmpireAtCell(state, unit.empireId, tx, ty)) return false;
	return true;
};

Space4x.phaseMovement = function (state) {
	for (let i = 0; i < state.units.length; i++) state.units[i].arrivedThisTurn = false;
	const ids = [];
	for (let i = 0; i < state.units.length; i++) ids.push(state.units[i].id);
	for (let i = 0; i < ids.length; i++) {
		const unit = Space4x.unitById(state, ids[i]);
		if (!unit) continue;
		if (unit.location && unit.location.kind === "refit") continue;
		if (Space4x.isStationHull(state, unit)) {
			unit.targetStarId = null;
			continue;
		}
		const empire = Space4x.empireById(state, unit.empireId);
		const stats = Space4x.shipStats(state, empire);
		const pos = Space4x.unitRangePos(unit);
		const home = Space4x.nearestFriendlyStar(state, unit.empireId, pos.x, pos.y);
		if (!home) continue;
		const inRange = Space4x.inRangeOfEmpire(state, unit.empireId, pos.x, pos.y);
		if (!inRange) {
			unit.walkingHome = true;
			const already = unit.location.kind === "orbit" && unit.location.starId === home.id;
			if (Space4x.canReachThisTurn(state, unit, home.x, home.y, stats.speed, false)) {
				Space4x.arriveAtStar(state, unit, home, already);
			} else {
				Space4x.stepToward(state, unit, home.x, home.y, stats.speed, false);
			}
			continue;
		}
		unit.walkingHome = false;
		if (!unit.targetStarId) continue;
		if (unit.location.kind === "orbit" && unit.location.starId === unit.targetStarId) {
			Space4x.arriveAtStar(state, unit, Space4x.starById(state, unit.targetStarId), true);
			continue;
		}
		const dest = Space4x.starById(state, unit.targetStarId);
		if (!dest) continue;
		if (!Space4x.canLeaveSystem(state, empire, Space4x.unitStarId(state, unit), dest.id)) {
			unit.targetStarId = null;
			continue;
		}
		const already = unit.location.kind === "orbit" && unit.location.starId === dest.id;
		if (Space4x.canReachThisTurn(state, unit, dest.x, dest.y, stats.speed, true)) {
			Space4x.arriveAtStar(state, unit, dest, already);
		} else {
			Space4x.stepToward(state, unit, dest.x, dest.y, stats.speed, true);
		}
	}

	const foundIds = [];
	for (let i = 0; i < state.units.length; i++) foundIds.push(state.units[i].id);
	for (let i = 0; i < foundIds.length; i++) {
		const unit = Space4x.unitById(state, foundIds[i]);
		if (!unit || !Space4x.unitCanFound(state, unit)) continue;
		const empire = Space4x.empireById(state, unit.empireId);
		if (empire.isPlayer) continue;
		if (unit.location.kind !== "orbit") continue;
		const star = Space4x.starById(state, unit.location.starId);
		if (!star) continue;
		const bodies = Space4x.emptyLegalBodies(state, star, unit.empireId);
		if (bodies.length) Space4x.foundSettlement(state, unit.id, bodies[0].id);
	}
};

Space4x.arriveAtStar = function (state, unit, star, already) {
	if (!star) return;
	Space4x.enterOrbit(unit, star);
	Space4x.markStarExplored(state, unit.empireId, star.id);
	const empire = Space4x.empireById(state, unit.empireId);
	if (!already && empire && empire.isPlayer && state.turnEvents) {
		state.turnEvents.playerShipArrived = true;
		if (Space4x.unitCanFound(state, unit)) {
			if (!state.turnEvents.arrivedColonyIds) state.turnEvents.arrivedColonyIds = [];
			state.turnEvents.arrivedColonyIds.push(unit.id);
		}
	}
	if (!already) unit.arrivedThisTurn = true;
	if (Space4x.isPopHauler(state, unit)) Space4x.unloadPopHauler(state, unit);
	if (Space4x.isTroopHauler(state, unit) && !unit.fleetMode) Space4x.unloadTroopHauler(state, unit);
	if (Space4x.isTroopHauler(state, unit) && unit.fleetMode && !(unit.cargoTroops || []).length) {
		Space4x.finishTroopFleet(state, unit);
	}
};

Space4x.setShipTarget = function (state, unitId, starId) {
	const unit = Space4x.unitById(state, unitId);
	if (!unit || !starId) return false;
	if (!Space4x.shipCanTakeOrders(state, unit)) return false;
	const dest = Space4x.starById(state, starId);
	if (!dest) return false;
	if (Space4x.unitStarId(state, unit) === dest.id) return false;
	const empire = Space4x.empireById(state, unit.empireId);
	if (!Space4x.canLeaveSystem(state, empire, Space4x.unitStarId(state, unit), dest.id)) return false;
	if (!Space4x.inRangeOfEmpireAtCell(state, unit.empireId, dest.x, dest.y)) return false;
	unit.targetStarId = starId;
	if (unit.location.kind === "settlement") {
		unit.location.kind = "orbit";
		unit.location.settlementId = null;
	}
	return true;
};

Space4x.clearShipTarget = function (state, unitId) {
	const unit = Space4x.unitById(state, unitId);
	if (!unit || !Space4x.shipCanTakeOrders(state, unit)) return false;
	if (!unit.targetStarId) return false;
	unit.targetStarId = null;
	return true;
};
