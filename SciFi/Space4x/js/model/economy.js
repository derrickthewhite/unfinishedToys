var Space4x = Space4x || {};

Space4x.foodPerFarmer = function (state, body, empire, settlement) {
	const set = Space4x.settingOf(state);
	if (!body || body.kind !== "rocky") return 0;
	if (set.noAgriBiomes[body.biome]) return 0;
	let n = 3 + (set.foodMod[body.biome] || 0) + (empire.modifiers.foodPerFarmer || 0);
	if (settlement) n += Space4x.structureJobYield(state, settlement, "agriculture");
	return n < 0 ? 0 : n;
};

Space4x.YIELD_READERS = {
	farmerBiome: function (state, settlement, pop, empire) {
		const body = Space4x.bodyById(state, settlement.location.bodyId);
		return { food: Space4x.foodPerFarmer(state, body, empire, settlement) };
	},
	foodBase: function (state, settlement, pop, empire, spec) {
		return {
			food: spec.base + (empire.modifiers.foodPerFarmer || 0) +
				Space4x.structureJobYield(state, settlement, pop.job)
		};
	},
	industryRichness: function (state, settlement, pop, empire, spec) {
		const body = Space4x.bodyById(state, settlement.location.bodyId);
		const rich = Space4x.richnessOf(state, body);
		return {
			industry: spec.base + (empire.modifiers.industryPerPop || 0) + (rich.industryPerPop || 0) +
				Space4x.structureJobYield(state, settlement, pop.job)
		};
	},
	workerBase: function (state, settlement, pop, empire, spec) {
		const product = spec.product;
		const modKey = product === "research" ? "researchPerPop" : "industryPerPop";
		const out = { food: 0, industry: 0, research: 0 };
		out[product] = spec.base + (empire.modifiers[modKey] || 0) +
			Space4x.structureJobYield(state, settlement, pop.job);
		return out;
	}
};

Space4x.jobYield = function (state, settlement, pop, empire) {
	const set = Space4x.settingOf(state);
	const job = pop.job;
	const out = { food: 0, industry: 0, research: 0, money: 0 };
	if (job === "idle") return out;
	const spec = set.jobs[job];
	if (!spec) return out;
	out.money = (spec.money || 0) + Space4x.structureMoneyPerPop(state, settlement);
	const reader = spec.yield && Space4x.YIELD_READERS[spec.yield];
	if (reader) {
		const y = reader(state, settlement, pop, empire, spec);
		out.food += y.food || 0;
		out.industry += y.industry || 0;
		out.research += y.research || 0;
	}
	Space4x.applyCultureYield(state, settlement, pop, out);
	if (out.food < 0) out.food = 0;
	if (out.industry < 0) out.industry = 0;
	return out;
};

Space4x.produceSettlement = function (state, settlement, empire) {
	let food = 0;
	let industry = 0;
	let research = 0;
	let money = 0;
	for (let i = 0; i < settlement.pops.length; i++) {
		const y = Space4x.jobYield(state, settlement, settlement.pops[i], empire);
		food += y.food;
		industry += y.industry;
		research += y.research;
		money += y.money;
	}
	const cover = Space4x.structureCoverTotals(state, settlement);
	food += cover.food || 0;
	industry += cover.industry || 0;
	research += cover.research || 0;
	return { food: food, industry: industry, research: research, money: money };
};

Space4x.outputExplain = function (state, settlement, job) {
	const empire = Space4x.empireById(state, settlement.empireId);
	const set = Space4x.settingOf(state);
	const spec = set.jobs[job];
	const n = Space4x.countJob(settlement, job);
	const lines = [];
	let amount = 0;
	if (job === "money") {
		const y = Space4x.produceSettlement(state, settlement, empire);
		const upBuild = Space4x.structureUpkeep(state, settlement);
		const upTroop = Space4x.settlementTroopUpkeep(state, settlement);
		const up = Space4x.moneyRound(upBuild + upTroop);
		amount = Space4x.moneyRound(y.money - up);
		const paid = settlement.pops.length - Space4x.countJob(settlement, "idle");
		lines.push(paid + " working " + Space4x.peopleWord(paid) + " = " + Space4x.fmtMoney(y.money) + " money");
		const extraMoney = Space4x.structureMoneyPerPop(state, settlement);
		if (extraMoney) {
			lines.push("+" + extraMoney + " money per working person from buildings");
		}
		const builds = set.builds;
		const seen = {};
		for (let i = 0; i < settlement.structures.length; i++) {
			const id = settlement.structures[i].defId;
			const def = builds[id];
			if (!def || !def.upkeep) continue;
			if (!seen[id]) seen[id] = { name: def.name, n: 0, each: def.upkeep };
			seen[id].n += 1;
		}
		const ids = Object.keys(seen);
		for (let i = 0; i < ids.length; i++) {
			const row = seen[ids[i]];
			const cost = Space4x.moneyRound(row.n * row.each);
			lines.push(row.name + (row.n > 1 ? " × " + row.n : "") + " −" + Space4x.fmtMoney(cost) + " money");
		}
		const stacks = Space4x.troopStacks(state, settlement);
		for (let i = 0; i < stacks.length; i++) {
			const row = stacks[i];
			if (!row.def.upkeep) continue;
			const cost = Space4x.moneyRound(row.n * row.def.upkeep);
			lines.push(row.def.name + (row.n > 1 ? " × " + row.n : "") + " −" + Space4x.fmtMoney(cost) + " money");
		}
		lines.push("Net " + Space4x.fmtMoney(amount) + " money");
		return { amount: amount, income: y.money, spend: up, tip: lines.join("\n") };
	}
	if (job === "idle") return { amount: 0, tip: "No output" };
	if (!spec) return { amount: 0, tip: "No output" };
	if (job === "agriculture" || job === "greenhouse") {
		const body = Space4x.bodyById(state, settlement.location.bodyId);
		const farmers = Space4x.countJob(settlement, "agriculture");
		const gh = Space4x.countJob(settlement, "greenhouse");
		const farmPer = Space4x.foodPerFarmer(state, body, empire, settlement);
		let farmFood = 0;
		let ghFood = 0;
		const cultures = {};
		for (let i = 0; i < settlement.pops.length; i++) {
			const pop = settlement.pops[i];
			if (pop.job !== "agriculture" && pop.job !== "greenhouse") continue;
			if (pop.culture) cultures[pop.culture] = true;
			const y = Space4x.jobYield(state, settlement, pop, empire);
			if (pop.job === "agriculture") farmFood += y.food;
			else ghFood += y.food;
		}
		const cultureIds = Object.keys(cultures);
		function cultureWhy(jobId, per) {
			if (cultureIds.length !== 1) return cultureIds.length > 1 ? " mixed species" : "";
			const bonus = Space4x.cultureJobBonus(state, cultureIds[0], jobId, body);
			if (!bonus) return "";
			return " +" + bonus + " " + Space4x.cultureName(state, cultureIds[0]);
		}
		if (job === "agriculture") {
			if (farmers) {
				const biome = body && body.biome ? Space4x.titleCase(body.biome) : "planet";
				const mod = (body && set.foodMod[body.biome]) || 0;
				let why = "base 3";
				if (mod) why += (mod > 0 ? " +" : " ") + mod + " " + biome;
				if (empire.modifiers.foodPerFarmer) why += " +" + empire.modifiers.foodPerFarmer + " tech";
				const parts = Space4x.structureJobYieldParts(state, settlement, "agriculture");
				for (let p = 0; p < parts.length; p++) why += " +" + parts[p].n + " " + parts[p].name;
				why += cultureWhy("agriculture", farmPer);
				lines.push(farmers + " farmer" + (farmers === 1 ? "" : "s") + " × " + (farmers ? farmFood / farmers : farmPer) + " (" + why + ") = " + farmFood);
			}
			if (gh) lines.push(gh + " greenhouse × " + (gh ? ghFood / gh : 0) + " = " + ghFood);
			if (!farmers && !gh) lines.push("No food workers");
			const sit = Space4x.foodSituation(state, settlement);
			amount = sit.produced;
			let feed = "Local " + sit.produced + " · need " + sit.need;
			if (sit.imported) feed += " · import " + sit.imported;
			if (sit.surplus) feed += " · extra " + sit.surplus;
			if (sit.deficit) feed += " · short " + sit.deficit;
			lines.push(feed);
		} else {
			amount = ghFood;
			let why = "base " + set.jobs.greenhouse.base;
			if (empire.modifiers.foodPerFarmer) why += " +" + empire.modifiers.foodPerFarmer + " tech";
			const parts = Space4x.structureJobYieldParts(state, settlement, "greenhouse");
			for (let p = 0; p < parts.length; p++) why += " +" + parts[p].n + " " + parts[p].name;
			why += cultureWhy("greenhouse");
			lines.push(gh + " greenhouse × " + (gh ? ghFood / gh : 0) + " (" + why + ") = " + amount);
		}
		return { amount: amount, tip: lines.join("\n") };
	}
	if (job === "industry") {
		const body = Space4x.bodyById(state, settlement.location.bodyId);
		const rich = Space4x.richnessOf(state, body);
		let workerOut = 0;
		const cultures = {};
		for (let i = 0; i < settlement.pops.length; i++) {
			const pop = settlement.pops[i];
			if (pop.job !== job) continue;
			if (pop.culture) cultures[pop.culture] = true;
			workerOut += Space4x.jobYield(state, settlement, pop, empire).industry;
		}
		const cultureIds = Object.keys(cultures);
		amount = workerOut;
		const perSafe = n ? workerOut / n : 0;
		let why = "base " + spec.base;
		if (rich && rich.industryPerPop) why += (rich.industryPerPop > 0 ? " +" : " ") + rich.industryPerPop + " " + rich.name;
		if (empire.modifiers.industryPerPop) why += " +" + empire.modifiers.industryPerPop + " tech";
		const parts = Space4x.structureJobYieldParts(state, settlement, job);
		for (let p = 0; p < parts.length; p++) why += " +" + parts[p].n + " " + parts[p].name;
		if (cultureIds.length === 1) {
			const bonus = Space4x.cultureJobBonus(state, cultureIds[0], job, body);
			if (bonus) why += " +" + bonus + " " + Space4x.cultureName(state, cultureIds[0]);
		} else if (cultureIds.length > 1) why += " mixed species";
		lines.push(n + " worker" + (n === 1 ? "" : "s") + " × " + perSafe + " (" + why + ") = " + amount);
		const cover = Space4x.structureCoverByJob(state, settlement)[job];
		if (cover && cover.n) {
			for (let s = 0; s < cover.sources.length; s++) {
				const src = cover.sources[s];
				const who = src.copies > 1 ? src.name + " ×" + src.copies : src.name;
				lines.push(who + ": +" + src.n + " × " + src.covered + " of these slots = +" + (src.n * src.covered));
			}
			amount += cover.n;
		}
		lines.push("Total " + amount + " industry");
		return { amount: amount, tip: lines.join("\n") };
	}
	if (job === "research") {
		const body = Space4x.bodyById(state, settlement.location.bodyId);
		let workerOut = 0;
		const cultures = {};
		for (let i = 0; i < settlement.pops.length; i++) {
			const pop = settlement.pops[i];
			if (pop.job !== job) continue;
			if (pop.culture) cultures[pop.culture] = true;
			workerOut += Space4x.jobYield(state, settlement, pop, empire).research;
		}
		const cultureIds = Object.keys(cultures);
		amount = workerOut;
		const per = n ? workerOut / n : 0;
		let why = "base " + spec.base;
		if (empire.modifiers.researchPerPop) why += " +" + empire.modifiers.researchPerPop + " tech";
		const parts = Space4x.structureJobYieldParts(state, settlement, job);
		for (let p = 0; p < parts.length; p++) why += " +" + parts[p].n + " " + parts[p].name;
		if (cultureIds.length === 1) {
			const bonus = Space4x.cultureJobBonus(state, cultureIds[0], job, body);
			if (bonus) why += " +" + bonus + " " + Space4x.cultureName(state, cultureIds[0]);
		} else if (cultureIds.length > 1) why += " mixed species";
		lines.push(n + " scientist" + (n === 1 ? "" : "s") + " × " + per + " (" + why + ") = " + amount);
		const cover = Space4x.structureCoverByJob(state, settlement)[job];
		if (cover && cover.n) {
			for (let s = 0; s < cover.sources.length; s++) {
				const src = cover.sources[s];
				const who = src.copies > 1 ? src.name + " ×" + src.copies : src.name;
				lines.push(who + ": +" + src.n + " × " + src.covered + " of these slots = +" + (src.n * src.covered));
			}
			amount += cover.n;
		}
		lines.push("Total " + amount + " research");
		return { amount: amount, tip: lines.join("\n") };
	}
	return { amount: 0, tip: "No output" };
};

Space4x.phaseProduction = function (state) {
	for (let i = 0; i < state.empires.length; i++) {
		state.empires[i]._pendingResearch = 0;
		state.empires[i]._producedResearch = 0;
		state.empires[i]._producedMoney = 0;
	}
	for (let s = 0; s < state.settlements.length; s++) {
		const st = state.settlements[s];
		const empire = Space4x.empireById(state, st.empireId);
		const y = Space4x.produceSettlement(state, st, empire);
		st.lastFoodProduced = y.food;
		st._producedFood = y.food;
		st.industryPool += y.industry;
		empire.stockpiles.money += y.money;
		empire._producedMoney += y.money;
		empire._pendingResearch += y.research;
		empire._producedResearch += y.research;
	}
};

Space4x.defUpkeep = function (state, defId) {
	const def = Space4x.settingOf(state).builds[defId];
	return def && def.upkeep ? def.upkeep : 0;
};

Space4x.structureUpkeep = function (state, settlement) {
	let n = 0;
	if (!settlement) return 0;
	for (let i = 0; i < settlement.structures.length; i++) {
		n += Space4x.defUpkeep(state, settlement.structures[i].defId);
	}
	return n;
};

Space4x.shipUpkeep = function (state, unit) {
	if (!unit || Space4x.isHauler(state, unit)) return 0;
	const base = Space4x.defUpkeep(state, unit.defId);
	if (!base) return 0;
	if (unit.location.kind === "space") return base * 2;
	return base;
};

Space4x.freighterUpkeep = function (state, empireId, foodHullsUsed) {
	if ((foodHullsUsed || 0) > 0) return 1;
	if (Space4x.popHaulers(state, empireId).length) return 1;
	if (Space4x.troopHaulers(state, empireId).length) return 1;
	return 0;
};

Space4x.empireUpkeep = function (state, empireId, foodHullsUsed) {
	const lines = [];
	let buildings = 0;
	const homes = Space4x.settlementsOf(state, empireId);
	for (let i = 0; i < homes.length; i++) {
		buildings += Space4x.structureUpkeep(state, homes[i]);
	}
	buildings = Space4x.moneyRound(buildings);
	if (buildings) lines.push("Buildings −" + Space4x.fmtMoney(buildings));
	const troops = Space4x.troopUpkeep(state, empireId);
	if (troops) lines.push("Troops −" + Space4x.fmtMoney(troops));
	const spies = Space4x.spyUpkeep(state, empireId);
	if (spies) lines.push("Spies −" + Space4x.fmtMoney(spies));
	let ships = 0;
	let flying = 0;
	for (let i = 0; i < state.units.length; i++) {
		const unit = state.units[i];
		if (unit.empireId !== empireId) continue;
		const cost = Space4x.shipUpkeep(state, unit);
		if (!cost) continue;
		ships += cost;
		if (unit.location.kind === "space") flying += 1;
	}
	ships = Space4x.moneyRound(ships);
	if (ships) {
		let shipLine = "Ships −" + Space4x.fmtMoney(ships);
		if (flying) shipLine += " (" + flying + " in flight, ×2)";
		lines.push(shipLine);
	}
	const freighters = Space4x.freighterUpkeep(state, empireId, foodHullsUsed || 0);
	if (freighters) lines.push("Freighters −" + Space4x.fmtMoney(freighters) + " (in use)");
	return {
		buildings: buildings,
		troops: troops,
		spies: spies,
		ships: ships,
		freighters: freighters,
		upkeep: Space4x.moneyRound(buildings + troops + spies + ships + freighters),
		lines: lines
	};
};

Space4x.empireMoneyForecast = function (state, empireId) {
	const empire = Space4x.empireById(state, empireId);
	const homes = Space4x.settlementsOf(state, empireId);
	let income = 0;
	for (let i = 0; i < homes.length; i++) {
		income += Space4x.produceSettlement(state, homes[i], empire).money;
	}
	const preview = Space4x.previewEmpireFood(state, empireId);
	const up = Space4x.empireUpkeep(state, empireId, preview.hullsUsed || 0);
	const trade = Space4x.tradeTreatyPreview ? Space4x.tradeTreatyPreview(state, empire) : { total: 0, lines: [] };
	const lines = up.lines.slice();
	for (let i = 0; i < (trade.lines || []).length; i++) lines.push(trade.lines[i]);
	return {
		income: income,
		trade: trade.total,
		buildings: up.buildings,
		ships: up.ships,
		freighters: up.freighters,
		upkeep: up.upkeep,
		net: Space4x.moneyRound(income + (trade.total || 0) - up.upkeep),
		stockpile: empire ? empire.stockpiles.money : 0,
		lines: lines
	};
};

Space4x.phaseUpkeep = function (state) {
	for (let i = 0; i < state.empires.length; i++) {
		const empire = state.empires[i];
		const up = Space4x.empireUpkeep(state, empire.id, empire._hullsUsed || 0);
		if (!up.upkeep) continue;
		empire.stockpiles.money = Space4x.moneyRound(empire.stockpiles.money - up.upkeep);
		state.turnLog.push(empire.name + " paid " + Space4x.fmtMoney(up.upkeep) + " money in upkeep.");
	}
};

Space4x.jobValue = function (y) {
	return y.food + y.industry + y.research + y.money;
};

Space4x.assignNewPop = function (state, settlement, pop) {
	const empire = Space4x.empireById(state, settlement.empireId);
	const set = Space4x.settingOf(state);
	const y = Space4x.produceSettlement(state, settlement, empire);
	const needFood = y.food < settlement.pops.length * set.foodPerPop;
	if (needFood && Space4x.countJob(settlement, "agriculture") < Space4x.jobCap(state, settlement, "agriculture")) {
		pop.job = "agriculture";
		return;
	}
	if (needFood && Space4x.countJob(settlement, "greenhouse") < Space4x.jobCap(state, settlement, "greenhouse")) {
		pop.job = "greenhouse";
		return;
	}
	const order = set.jobOrder || Object.keys(set.jobs);
	const options = [];
	for (let i = 0; i < order.length; i++) {
		if (order[i] !== "idle") options.push(order[i]);
	}
	let best = "industry";
	let bestV = -1;
	for (let i = 0; i < options.length; i++) {
		const job = options[i];
		const cap = Space4x.jobCap(state, settlement, job);
		if (Space4x.countJob(settlement, job) >= cap) continue;
		pop.job = job;
		const v = Space4x.jobValue(Space4x.jobYield(state, settlement, pop, empire));
		if (v > bestV) {
			bestV = v;
			best = job;
		}
	}
	pop.job = bestV < 0 ? "idle" : best;
};

Space4x.setPopJob = function (state, settlement, popId, job) {
	const spec = Space4x.settingOf(state).jobs[job];
	if (!spec) return false;
	let pop = null;
	for (let i = 0; i < settlement.pops.length; i++) {
		if (settlement.pops[i].id === popId) pop = settlement.pops[i];
	}
	if (!pop) return false;
	if (pop.job === job) return true;
	const cap = Space4x.jobCap(state, settlement, job);
	if (job !== "idle" && cap !== Infinity && Space4x.countJob(settlement, job) >= cap) return false;
	pop.job = job;
	return true;
};

Space4x.setPopJobs = function (state, settlement, popIds, job) {
	if (!popIds) return;
	for (let i = 0; i < popIds.length; i++) {
		Space4x.setPopJob(state, settlement, popIds[i], job);
	}
};

Space4x.visibleJobs = function (state, settlement) {
	const set = Space4x.settingOf(state);
	const order = set.jobOrder || Object.keys(set.jobs);
	const out = [];
	for (let i = 0; i < order.length; i++) {
		const id = order[i];
		const spec = set.jobs[id];
		if (!spec) continue;
		const cap = Space4x.jobCap(state, settlement, id);
		if (id !== "idle" && cap === 0) continue;
		out.push({
			id: id,
			label: spec.label || id,
			cap: cap,
			count: Space4x.countJob(settlement, id)
		});
	}
	return out;
};

Space4x.seedHomeJobs = function (state, settlement) {
	const empire = Space4x.empireById(state, settlement.empireId);
	const set = Space4x.settingOf(state);
	const body = Space4x.bodyById(state, settlement.location.bodyId);
	const pops = settlement.pops;
	for (let i = 0; i < pops.length; i++) pops[i].job = "idle";
	const need = pops.length * (set.foodPerPop || 1);
	const per = Space4x.foodPerFarmer(state, body, empire, settlement);
	const agriCap = Space4x.jobCap(state, settlement, "agriculture");
	let farmers = 0;
	if (per > 0) farmers = Math.ceil(need / per);
	if (farmers > agriCap) farmers = agriCap;
	if (farmers > pops.length) farmers = pops.length;
	let rest = pops.length - farmers;
	let industry = Math.ceil(rest / 2);
	let research = rest - industry;
	let i = 0;
	for (; i < farmers; i++) pops[i].job = "agriculture";
	for (let n = 0; n < industry && i < pops.length; n++, i++) pops[i].job = "industry";
	for (let n = 0; n < research && i < pops.length; n++, i++) pops[i].job = "research";
};

Space4x.enforceJobCaps = function (state, settlement) {
	const set = Space4x.settingOf(state);
	const order = set.jobOrder || Object.keys(set.jobs);
	for (let j = 0; j < order.length; j++) {
		const job = order[j];
		if (job === "idle") continue;
		const cap = Space4x.jobCap(state, settlement, job);
		if (cap === Infinity) continue;
		while (Space4x.countJob(settlement, job) > cap) {
			for (let i = settlement.pops.length - 1; i >= 0; i--) {
				if (settlement.pops[i].job === job) {
					settlement.pops[i].job = "idle";
					break;
				}
			}
		}
	}
};

Space4x.autoAssignJobs = function (state, empireId) {
	const list = Space4x.settlementsOf(state, empireId);
	for (let i = 0; i < list.length; i++) {
		const st = list[i];
		for (let p = 0; p < st.pops.length; p++) {
			if (st.pops[p].job === "idle") Space4x.assignNewPop(state, st, st.pops[p]);
		}
	}
};
