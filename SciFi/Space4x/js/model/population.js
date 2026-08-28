var Space4x = Space4x || {};

Space4x.removePops = function (settlement, deaths) {
	let left = deaths;
	function killJob(job) {
		for (let i = settlement.pops.length - 1; i >= 0 && left > 0; i--) {
			if (settlement.pops[i].job === job) {
				settlement.pops.splice(i, 1);
				left -= 1;
			}
		}
	}
	killJob("idle");
	for (let i = settlement.pops.length - 1; i >= 0 && left > 0; i--) {
		settlement.pops.splice(i, 1);
		left -= 1;
	}
};

Space4x.popGrowthRates = function (state, empire) {
	const set = Space4x.settingOf(state);
	return {
		grow: Math.max(0, set.growthRatePercent + ((empire && empire.modifiers.growthRatePercent) || 0)),
		starve: set.starvationRatePercent || 0
	};
};

Space4x.popAccOf = function (st) {
	return (st.growthAcc || 0) - (st.starveAcc || 0);
};

Space4x.phasePopulation = function (state) {
	for (let i = 0; i < state.settlements.length; i++) {
		const st = state.settlements[i];
		const empire = Space4x.empireById(state, st.empireId);
		st.growthAcc = Space4x.popAccOf(st);
		st.starveAcc = 0;
		st.starvedThisTurn = 0;
		st.foodShort = false;
		const pops = st.pops.length;
		if (pops === 0) {
			st.growthAcc = 0;
			continue;
		}
		const present = st.foodPresent || 0;
		const fed = Math.min(present, pops);
		const unfed = Math.max(0, pops - present);
		if (unfed > 0) st.foodShort = true;
		const grow = Space4x.settlementGrowRate(state, st, empire);
		const starve = Space4x.settingOf(state).starvationRatePercent || 0;
		const net = fed * grow - unfed * starve;
		st.growthAcc += net;
		let births = 0;
		let deaths = 0;
		if (st.growthAcc >= 100) {
			births = Math.floor(st.growthAcc / 100);
			st.growthAcc -= births * 100;
		} else if (st.growthAcc <= -100) {
			deaths = Math.min(pops, Math.floor(-st.growthAcc / 100));
			st.growthAcc += deaths * 100;
		}
		if (deaths > 0) {
			Space4x.removePops(st, deaths);
			if (st.pops.length === 0) st.growthAcc = 0;
			st.lastStarveTurn = state.turn;
			st.starvedThisTurn = deaths;
			state.turnLog.push(st.name + " lost " + deaths + " " + Space4x.peopleWord(deaths) + " to starvation.");
		}
		for (let b = 0; b < births; b++) {
			const pop = Space4x.createPop(state, empire);
			st.pops.push(pop);
			Space4x.assignNewPop(state, st, pop);
		}
		if (births > 0) {
			st.lastGrowthTurn = state.turn;
			state.turnLog.push(st.name + " grew by " + births + " " + Space4x.peopleWord(births) + ".");
		}
	}
};

Space4x.turnsUntilAcc = function (acc, perTurn) {
	if (!(perTurn > 0)) return null;
	const need = 100 - (acc || 0);
	if (need <= 0) return 1;
	return Math.ceil(need / perTurn);
};

Space4x.turnsUntilPopChange = function (acc, netPer) {
	if (netPer > 0) return Space4x.turnsUntilAcc(acc, netPer);
	if (netPer < 0) {
		const need = (acc || 0) + 100;
		if (need <= 0) return 1;
		return Math.ceil(need / -netPer);
	}
	return null;
};

Space4x.settlementPopOutlook = function (state, st) {
	const empire = Space4x.empireById(state, st.empireId);
	const pops = st.pops.length;
	let present = st.lastFoodPresent || 0;
	if (state.turn <= 1 && present === 0) {
		present = Math.min(pops, Space4x.produceSettlement(state, st, empire).food);
	}
	const fed = Math.min(present, pops);
	const unfed = Math.max(0, pops - present);
	const grow = Space4x.settlementGrowRate(state, st, empire);
	const starve = Space4x.settingOf(state).starvationRatePercent || 0;
	const netPer = fed * grow - unfed * starve;
	const acc = Space4x.popAccOf(st);
	const combinedRate = pops ? netPer / pops : 0;
	let changeThisTurn = 0;
	if (netPer > 0) changeThisTurn = Math.floor((acc + netPer) / 100);
	else if (netPer < 0) changeThisTurn = Math.min(pops, Math.floor(-(acc + netPer) / 100));
	return {
		pops: pops,
		fed: fed,
		unfed: unfed,
		growRate: grow,
		starveRate: starve,
		fedContrib: fed * grow,
		unfedContrib: unfed * starve,
		netPer: netPer,
		combinedRate: combinedRate,
		changeTurns: Space4x.turnsUntilPopChange(acc, netPer),
		changeThisTurn: changeThisTurn
	};
};

Space4x.popOutlookText = function (o) {
	if (!o || o.pops === 0) return "No population.";
	const word = o.netPer < 0 ? "decline" : "growth";
	let line = Space4x.fmtPercent(Math.abs(o.combinedRate)) + "% " + word;
	line += " · " + o.fed + "/" + o.pops + " fed";
	if (o.changeThisTurn > 0) {
		line += " · " + o.changeThisTurn + " population this turn";
	} else if (o.changeTurns) {
		line += " · 1 population in " + o.changeTurns + (o.changeTurns === 1 ? " turn" : " turns");
	}
	return line;
};

Space4x.popOutlookTip = function (o) {
	if (!o || o.pops === 0 || !(o.fed > 0 && o.unfed > 0)) return "";
	return o.fed + " fed +" + Space4x.fmtPercent(o.fedContrib) +
		"% · " + o.unfed + " short −" + Space4x.fmtPercent(o.unfedContrib) + "%";
};

Space4x.takePopsForMove = function (settlement, count) {
	const taken = [];
	function takeJob(job) {
		for (let i = settlement.pops.length - 1; i >= 0 && taken.length < count; i--) {
			if (settlement.pops[i].job === job) taken.push(settlement.pops.splice(i, 1)[0]);
		}
	}
	takeJob("idle");
	takeJob("industry");
	takeJob("roboIndustry");
	takeJob("research");
	for (let i = settlement.pops.length - 1; i >= 0 && taken.length < count; i--) {
		const job = settlement.pops[i].job;
		if (job === "agriculture" || job === "greenhouse") continue;
		taken.push(settlement.pops.splice(i, 1)[0]);
	}
	takeJob("greenhouse");
	takeJob("agriculture");
	return taken;
};

Space4x.popHaulers = function (state, empireId) {
	const out = [];
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.defId !== "popHauler") continue;
		if (empireId && u.empireId !== empireId) continue;
		out.push(u);
	}
	return out;
};

Space4x.popsInTransitTo = function (state, settlementId) {
	let n = 0;
	const list = Space4x.popHaulers(state);
	for (let i = 0; i < list.length; i++) {
		if (list[i].destSettlementId === settlementId) n += (list[i].cargoPops || []).length;
	}
	return n;
};

Space4x.popsInTransitFrom = function (state, settlementId) {
	let n = 0;
	const list = Space4x.popHaulers(state);
	for (let i = 0; i < list.length; i++) {
		if (list[i].originSettlementId === settlementId) n += (list[i].cargoPops || []).length;
	}
	return n;
};

Space4x.queuePopMove = function (state, fromId, toId, count) {
	const from = Space4x.settlementById(state, fromId);
	const to = Space4x.settlementById(state, toId);
	if (!from || !to || from.id === to.id || from.empireId !== to.empireId) return false;
	let n = Math.floor(count);
	if (!(n > 0)) return false;
	n = Math.min(n, from.pops.length);
	if (n <= 0) return false;
	const empire = Space4x.empireById(state, from.empireId);
	if (!Space4x.canLeaveSystem(state, empire, from.location.starId, to.location.starId)) return false;
	const factor = Space4x.settingOf(state).popMoveFreighterFactor || 5;
	n = Math.min(n, Math.floor(empire.transport.freighters / factor));
	if (n <= 0) return false;
	const hulls = n * factor;
	const taken = Space4x.takePopsForMove(from, n);
	if (!taken.length) return false;
	for (let t = 0; t < taken.length; t++) taken[t].job = "idle";
	empire.transport.freighters -= hulls;
	const star = Space4x.starById(state, from.location.starId);
	const destStar = Space4x.starById(state, to.location.starId);
	state.units.push({
		id: Space4x.nextId(state, "u"),
		defId: "popHauler",
		empireId: from.empireId,
		location: {
			kind: "orbit",
			x: star.x,
			y: star.y,
			starId: star.id,
			settlementId: null
		},
		targetStarId: destStar.id,
		cargoPops: taken,
		destSettlementId: to.id,
		originSettlementId: from.id,
		hulls: hulls
	});
	state.turnLog.push(taken.length + " " + Space4x.peopleWord(taken.length) + " boarded freighters at " + from.name + " bound for " + to.name + ".");
	return true;
};

Space4x.unloadPopHauler = function (state, unit) {
	if (!unit || unit.defId !== "popHauler") return;
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
	const cargo = unit.cargoPops || [];
	for (let i = 0; i < cargo.length; i++) {
		cargo[i].job = "idle";
		dest.pops.push(cargo[i]);
		Space4x.assignNewPop(state, dest, cargo[i]);
	}
	const empire = Space4x.empireById(state, unit.empireId);
	empire.transport.freighters += unit.hulls || 0;
	state.units = state.units.filter(function (u) { return u.id !== unit.id; });
	if (cargo.length) {
		state.turnLog.push(cargo.length + " " + Space4x.peopleWord(cargo.length) + " arrived at " + dest.name + ".");
	}
};

Space4x.cancelPopMove = function (state, unitId) {
	const unit = Space4x.unitById(state, unitId);
	if (!unit || unit.defId !== "popHauler") return;
	const origin = Space4x.settlementById(state, unit.originSettlementId);
	if (origin) {
		unit.destSettlementId = origin.id;
		const star = Space4x.starById(state, origin.location.starId);
		if (star) {
			if (unit.location.kind === "orbit" && unit.location.starId === star.id) {
				Space4x.unloadPopHauler(state, unit);
				return;
			}
			unit.targetStarId = star.id;
		}
	}
};

Space4x.removeListedPops = function (settlement, pops) {
	if (!settlement || !pops || !pops.length) return 0;
	const kill = {};
	for (let i = 0; i < pops.length; i++) {
		if (pops[i] && pops[i].id) kill[pops[i].id] = true;
	}
	const keep = [];
	let dead = 0;
	const list = settlement.pops || [];
	for (let i = 0; i < list.length; i++) {
		if (kill[list[i].id]) dead += 1;
		else keep.push(list[i]);
	}
	settlement.pops = keep;
	return dead;
};
