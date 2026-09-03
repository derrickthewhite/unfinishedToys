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

Space4x.removePopsOfCulture = function (settlement, cultureId, deaths, state, empire) {
	let left = deaths;
	function matches(pop) {
		return (Space4x.popCultureId(pop, empire) || Space4x.defaultCultureId(state)) === cultureId;
	}
	function killJob(job) {
		for (let i = settlement.pops.length - 1; i >= 0 && left > 0; i--) {
			const pop = settlement.pops[i];
			if (!matches(pop)) continue;
			if (job && pop.job !== job) continue;
			settlement.pops.splice(i, 1);
			left -= 1;
		}
	}
	killJob("idle");
	for (let i = settlement.pops.length - 1; i >= 0 && left > 0; i--) {
		if (!matches(settlement.pops[i])) continue;
		settlement.pops.splice(i, 1);
		left -= 1;
	}
};

Space4x.popCultureId = function (pop, empire) {
	return (pop && pop.culture) || (empire && empire.cultureId) || null;
};

Space4x.ensureGrowthAccByCulture = function (state, st, empire) {
	if (st.growthAccByCulture) return;
	st.growthAccByCulture = {};
	const legacy = Space4x.popAccOf(st);
	if (legacy) {
		const cid = empire && empire.cultureId;
		if (cid) st.growthAccByCulture[cid] = legacy;
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
	if (st.growthAccByCulture) {
		let n = 0;
		const ids = Object.keys(st.growthAccByCulture);
		for (let i = 0; i < ids.length; i++) n += st.growthAccByCulture[ids[i]] || 0;
		return n;
	}
	return (st.growthAcc || 0) - (st.starveAcc || 0);
};

Space4x.phasePopulation = function (state) {
	for (let i = 0; i < state.settlements.length; i++) {
		const st = state.settlements[i];
		const empire = Space4x.empireById(state, st.empireId);
		Space4x.ensureGrowthAccByCulture(state, st, empire);
		st.starveAcc = 0;
		st.starvedThisTurn = 0;
		st.foodShort = false;
		const pops = st.pops.length;
		if (pops === 0) {
			st.growthAccByCulture = {};
			st.growthAcc = 0;
			continue;
		}
		const present = st.foodPresent || 0;
		const fed = Math.min(present, pops);
		const unfed = Math.max(0, pops - present);
		if (unfed > 0) st.foodShort = true;
		let fedLeft = fed;
		const acc = st.growthAccByCulture;
		let births = 0;
		let deaths = 0;
		const birthByCulture = {};
		const deathByCulture = {};
		for (let p = 0; p < st.pops.length; p++) {
			const pop = st.pops[p];
			const cid = Space4x.popCultureId(pop, empire) || Space4x.defaultCultureId(state);
			const grow = Space4x.popGrowRate(state, empire, pop);
			const starve = Space4x.popStarveRate(state, pop);
			let net = 0;
			if (fedLeft > 0) {
				net = grow;
				fedLeft -= 1;
			} else {
				net = -starve;
			}
			acc[cid] = (acc[cid] || 0) + net;
		}
		if (fed === 0) {
			const ids = Object.keys(acc);
			for (let c = 0; c < ids.length; c++) {
				if (acc[ids[c]] > 0) acc[ids[c]] = 0;
			}
		}
		const cultureIds = Object.keys(acc);
		for (let c = 0; c < cultureIds.length; c++) {
			const cid = cultureIds[c];
			let cultureBirths = 0;
			let cultureDeaths = 0;
			while (acc[cid] >= 100) {
				cultureBirths += 1;
				acc[cid] -= 100;
			}
			while (acc[cid] <= -100) {
				const left = st.pops.filter(function (pop) {
					return (Space4x.popCultureId(pop, empire) || Space4x.defaultCultureId(state)) === cid;
				}).length;
				if (!left) {
					acc[cid] = 0;
					break;
				}
				cultureDeaths += 1;
				acc[cid] += 100;
			}
			if (cultureBirths) {
				birthByCulture[cid] = cultureBirths;
				births += cultureBirths;
			}
			if (cultureDeaths) {
				deathByCulture[cid] = cultureDeaths;
				deaths += cultureDeaths;
			}
		}
		if (deaths > 0) {
			const deadIds = Object.keys(deathByCulture);
			for (let d = 0; d < deadIds.length; d++) {
				Space4x.removePopsOfCulture(st, deadIds[d], deathByCulture[deadIds[d]], state, empire);
			}
			if (st.pops.length === 0) st.growthAccByCulture = {};
			st.lastStarveTurn = state.turn;
			st.starvedThisTurn = deaths;
			state.turnLog.push(st.name + " lost " + deaths + " " + Space4x.peopleWord(deaths) + " to starvation.");
		}
		const birthIds = Object.keys(birthByCulture);
		for (let b = 0; b < birthIds.length; b++) {
			const cid = birthIds[b];
			const n = birthByCulture[cid];
			for (let k = 0; k < n; k++) {
				const pop = Space4x.createPop(state, empire, cid);
				st.pops.push(pop);
				Space4x.assignNewPop(state, st, pop);
			}
			const who = Space4x.cultureName(state, cid) || "colonists";
			state.turnLog.push(st.name + " grew by " + n + " " + who + " (" + n + " " + Space4x.peopleWord(n) + ").");
		}
		if (births > 0) st.lastGrowthTurn = state.turn;
		st.growthAcc = Space4x.popAccOf(st);
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

Space4x.culturePopOutlook = function (state, st, empire, cultureId, fedLeftRef) {
	const pops = st.pops || [];
	let count = 0;
	let fed = 0;
	let unfed = 0;
	let growSum = 0;
	let starveSum = 0;
	for (let i = 0; i < pops.length; i++) {
		const pop = pops[i];
		if ((Space4x.popCultureId(pop, empire) || Space4x.defaultCultureId(state)) !== cultureId) continue;
		count += 1;
		const grow = Space4x.popGrowRate(state, empire, pop);
		const starve = Space4x.popStarveRate(state, pop);
		growSum += grow;
		starveSum += starve;
		if (fedLeftRef.left > 0) {
			fed += 1;
			fedLeftRef.left -= 1;
		} else {
			unfed += 1;
		}
	}
	const growRate = count ? growSum / count : 0;
	const starveRate = count ? starveSum / count : 0;
	const fedContrib = fed * growRate;
	const unfedContrib = unfed * starveRate;
	const netPer = fedContrib - unfedContrib;
	Space4x.ensureGrowthAccByCulture(state, st, empire);
	const acc = (st.growthAccByCulture && st.growthAccByCulture[cultureId]) || 0;
	const combinedRate = count ? netPer / count : 0;
	let changeThisTurn = 0;
	if (netPer > 0) changeThisTurn = Math.floor((acc + netPer) / 100);
	else if (netPer < 0) changeThisTurn = Math.min(count, Math.floor(-(acc + netPer) / 100));
	return {
		cultureId: cultureId,
		pops: count,
		fed: fed,
		unfed: unfed,
		growRate: growRate,
		starveRate: starveRate,
		fedContrib: fedContrib,
		unfedContrib: unfedContrib,
		netPer: netPer,
		combinedRate: combinedRate,
		acc: acc,
		changeTurns: Space4x.turnsUntilPopChange(acc, netPer),
		changeThisTurn: changeThisTurn
	};
};

Space4x.settlementPopOutlook = function (state, st) {
	const empire = Space4x.empireById(state, st.empireId);
	const pops = st.pops.length;
	const sit = Space4x.foodSituation(state, st);
	const present = sit.present;
	const fed = sit.fed;
	const fedLeftRef = { left: fed };
	const cultures = {};
	for (let i = 0; i < (st.pops || []).length; i++) {
		const cid = Space4x.popCultureId(st.pops[i], empire) || Space4x.defaultCultureId(state);
		cultures[cid] = true;
	}
	const cultureIds = Object.keys(cultures);
	const rows = [];
	for (let i = 0; i < cultureIds.length; i++) {
		rows.push(Space4x.culturePopOutlook(state, st, empire, cultureIds[i], fedLeftRef));
	}
	rows.sort(function (a, b) { return b.pops - a.pops; });
	let netPer = 0;
	let acc = 0;
	for (let i = 0; i < rows.length; i++) {
		netPer += rows[i].netPer;
		acc += rows[i].acc;
	}
	const combinedRate = pops ? netPer / pops : 0;
	let changeThisTurn = 0;
	if (netPer > 0) changeThisTurn = Math.floor((acc + netPer) / 100);
	else if (netPer < 0) changeThisTurn = Math.min(pops, Math.floor(-(acc + netPer) / 100));
	return {
		pops: pops,
		fed: fed,
		unfed: Math.max(0, pops - present),
		produced: sit.produced,
		need: sit.need,
		imported: sit.imported,
		surplus: sit.surplus,
		growRate: rows.length === 1 ? rows[0].growRate : 0,
		starveRate: rows.length === 1 ? rows[0].starveRate : 0,
		fedContrib: rows.reduce(function (n, r) { return n + r.fedContrib; }, 0),
		unfedContrib: rows.reduce(function (n, r) { return n + r.unfedContrib; }, 0),
		netPer: netPer,
		combinedRate: combinedRate,
		changeTurns: Space4x.turnsUntilPopChange(acc, netPer),
		changeThisTurn: changeThisTurn,
		cultures: rows
	};
};

Space4x.popOutlookFoodLine = function (o) {
	if (!o || !o.pops) return "";
	let line = "Food " + o.produced + "/" + o.need + " produced";
	line += " · " + o.fed + "/" + o.pops + " fed";
	if (o.imported > 0) line += " · " + o.imported + " imported";
	if (o.surplus > 0) line += " · " + o.surplus + " surplus";
	return line;
};

Space4x.popOutlookText = function (o, state) {
	if (!o || o.pops === 0) return "No population.";
	const foodLine = Space4x.popOutlookFoodLine(o);
	if (o.cultures && o.cultures.length > 1) {
		const parts = [];
		for (let i = 0; i < o.cultures.length; i++) {
			const row = o.cultures[i];
			if (!row.pops) continue;
			const name = Space4x.cultureName(state, row.cultureId) || row.cultureId;
			const word = row.netPer < 0 ? "decline" : "growth";
			parts.push(row.pops + " " + name + ": " + Space4x.fmtPercent(Math.abs(row.combinedRate)) + "% " + word);
		}
		let line = parts.join(" · ");
		line += " · " + foodLine;
		if (o.changeThisTurn > 0) {
			line += " · " + o.changeThisTurn + " population this turn";
		} else if (o.changeTurns) {
			line += " · 1 population in " + o.changeTurns + (o.changeTurns === 1 ? " turn" : " turns");
		}
		return line;
	}
	const word = o.netPer < 0 ? "decline" : "growth";
	let line = Space4x.fmtPercent(Math.abs(o.combinedRate)) + "% " + word;
	line += " · " + foodLine;
	if (o.changeThisTurn > 0) {
		line += " · " + o.changeThisTurn + " population this turn";
	} else if (o.changeTurns) {
		line += " · 1 population in " + o.changeTurns + (o.changeTurns === 1 ? " turn" : " turns");
	}
	return line;
};

Space4x.popOutlookTip = function (o, state) {
	if (!o || o.pops === 0) return "";
	const lines = [Space4x.popOutlookFoodLine(o)];
	if (o.cultures && o.cultures.length > 1) {
		for (let i = 0; i < o.cultures.length; i++) {
			const row = o.cultures[i];
			if (!row.pops) continue;
			const name = Space4x.cultureName(state, row.cultureId) || row.cultureId;
			let bit = name + ": " + row.fed + " fed +" + Space4x.fmtPercent(row.fedContrib) + "%";
			if (row.unfed) bit += ", " + row.unfed + " short −" + Space4x.fmtPercent(row.unfedContrib) + "%";
			lines.push(bit);
		}
		return lines.join("\n");
	}
	if (o.fed > 0 && o.unfed > 0) {
		lines.push(o.fed + " fed +" + Space4x.fmtPercent(o.fedContrib) +
			"% · " + o.unfed + " short −" + Space4x.fmtPercent(o.unfedContrib) + "%");
	}
	return lines.join("\n");
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
		if (!Space4x.isPopHauler(state, u)) continue;
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
		defId: Space4x.UNIT_ROLES.popHauler,
		role: Space4x.UNIT_ROLES.popHauler,
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
	if (!unit || !Space4x.isPopHauler(state, unit)) return;
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
	if (!unit || !Space4x.isPopHauler(state, unit)) return;
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
