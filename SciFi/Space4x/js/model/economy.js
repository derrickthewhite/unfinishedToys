var Space4x = Space4x || {};

Space4x.foodPerFarmer = function (state, body, empire, settlement) {
	const set = Space4x.settingOf(state);
	if (!body || body.kind !== "rocky") return 0;
	if (set.noAgriBiomes[body.biome]) return 0;
	let n = 3 + (set.foodMod[body.biome] || 0) + (empire.modifiers.foodPerFarmer || 0);
	if (settlement) n += Space4x.structureJobYield(state, settlement, "agriculture");
	return n < 0 ? 0 : n;
};

Space4x.empireStructureBonus = function (state, empireId, type) {
	let n = 0;
	Space4x.eachEmpireStructureEffect(state, empireId, function (def, fx) {
		if (fx.type === type) n += fx.n || 0;
	});
	if (Space4x.eachActiveLendTo) {
		Space4x.eachActiveLendTo(state, empireId, function (def) {
			const fx = def.effects || [];
			for (let i = 0; i < fx.length; i++) {
				if (fx[i].type === type) n += fx[i].n || 0;
			}
		});
	}
	return n;
};

Space4x.empireToxicUpkeepExempt = function (state, empireId) {
	const empire = Space4x.empireById(state, empireId);
	let ok = false;
	Space4x.eachEmpireTechEffect(state, empire, function (tech, fx) {
		if (fx.type === "toxicUpkeepExempt") ok = true;
	});
	return ok;
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
		if (product === "research" && empire) {
			out.research += Space4x.empireStructureBonus(state, empire.id, "empireResearchPerPop");
		}
		return out;
	}
};

Space4x.jobYield = function (state, settlement, pop, empire, opts) {
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
	Space4x.applyCultureYield(state, settlement, pop, out, opts);
	if (out.food < 0) out.food = 0;
	if (out.industry < 0) out.industry = 0;
	if (out.research < 0) out.research = 0;
	return out;
};

Space4x.produceSettlement = function (state, settlement, empire) {
	let food = 0;
	let industry = 0;
	let research = 0;
	let money = 0;
	for (let i = 0; i < settlement.pops.length; i++) {
		const pop = settlement.pops[i];
		const y = Space4x.jobYield(state, settlement, pop, empire);
		food += y.food;
		industry += y.industry;
		research += y.research;
		money += y.money;
	}
	const cover = Space4x.structureCoverTotals(state, settlement);
	food += cover.food || 0;
	industry += cover.industry || 0;
	research += cover.research || 0;
	if (Space4x.settlementUnderpoliced(state, settlement)) {
		const rules = Space4x.loyaltyRules(state);
		const cut = rules && rules.policeProductionPenalty != null ? rules.policeProductionPenalty : 0.1;
		const mult = Math.max(0, 1 - cut);
		food = Math.floor(food * mult);
		industry = Math.floor(industry * mult);
		research = Math.floor(research * mult);
		money = Space4x.moneyRound(money * mult);
	}
	return { food: food, industry: industry, research: research, money: money };
};

Space4x.applyOutputTax = function (y, taxRate) {
	const out = {
		food: y.food || 0,
		industry: y.industry || 0,
		research: y.research || 0,
		money: y.money || 0,
		taxed: 0
	};
	const rate = Space4x.clampTaxRate(taxRate);
	if (!rate) return out;
	const frac = rate / 100;
	const fromInd = Space4x.moneyRound(out.industry * frac);
	const fromRes = Space4x.moneyRound(out.research * frac);
	out.industry = Space4x.moneyRound(out.industry - fromInd);
	out.research = Space4x.moneyRound(out.research - fromRes);
	out.taxed = Space4x.moneyRound(fromInd + fromRes);
	out.money = Space4x.moneyRound(out.money + out.taxed);
	return out;
};

Space4x.settlementYield = function (state, settlement, empire) {
	return Space4x.applyOutputTax(Space4x.produceSettlement(state, settlement, empire), Space4x.empireTaxRate(empire));
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
		const previewDef = Space4x.settlementPreviewBuildDef(state, settlement);
		const yieldOpts = { buildDef: previewDef };
		let workerOut = 0;
		const cultures = {};
		for (let i = 0; i < settlement.pops.length; i++) {
			const pop = settlement.pops[i];
			if (pop.job !== job) continue;
			if (pop.culture) cultures[pop.culture] = true;
			workerOut += Space4x.jobYield(state, settlement, pop, empire, yieldOpts).industry;
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
		const knackBits = Space4x.industryKnackExplainBits(state, settlement, previewDef);
		for (let k = 0; k < knackBits.length; k++) why += " · " + knackBits[k];
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
		const knackBits = Space4x.researchKnackExplainBits(state, settlement);
		for (let k = 0; k < knackBits.length; k++) why += " · " + knackBits[k];
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
		state.empires[i]._taxedOutput = 0;
	}
	for (let s = 0; s < state.settlements.length; s++) {
		const st = state.settlements[s];
		const empire = Space4x.empireById(state, st.empireId);
		const y = Space4x.settlementYield(state, st, empire);
		st.lastFoodProduced = y.food;
		st._producedFood = y.food;
		st.industryPool = Space4x.moneyRound((st.industryPool || 0) + y.industry);
		empire.stockpiles.money = Space4x.moneyRound((empire.stockpiles.money || 0) + y.money);
		empire._producedMoney = Space4x.moneyRound((empire._producedMoney || 0) + y.money);
		empire._pendingResearch = Space4x.moneyRound((empire._pendingResearch || 0) + y.research);
		empire._producedResearch = Space4x.moneyRound((empire._producedResearch || 0) + y.research);
		if (y.taxed) empire._taxedOutput = Space4x.moneyRound((empire._taxedOutput || 0) + y.taxed);
		const colorMoney = Space4x.settlementColorMoney(state, st);
		if (colorMoney) {
			empire.stockpiles.money = Space4x.moneyRound(empire.stockpiles.money + colorMoney);
			empire._producedMoney = Space4x.moneyRound(empire._producedMoney + colorMoney);
		}
		const colorResearch = Space4x.settlementColorResearch(state, st);
		if (colorResearch) {
			empire._pendingResearch = Space4x.moneyRound(empire._pendingResearch + colorResearch);
			empire._producedResearch = Space4x.moneyRound(empire._producedResearch + colorResearch);
		}
	}
	for (let i = 0; i < state.empires.length; i++) {
		const empire = state.empires[i];
		const shipTechBonus = Space4x.empireShipTechResearchBonus(state, empire);
		if (shipTechBonus) {
			empire._pendingResearch += shipTechBonus;
			empire._producedResearch += shipTechBonus;
		}
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
	const body = Space4x.bodyById(state, settlement.location.bodyId);
	if (body && body.biome === "toxic" && !Space4x.empireToxicUpkeepExempt(state, settlement.empireId)) n *= 1.5;
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
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.empireId !== empireId) continue;
		if (!Space4x.isHauler(state, u)) continue;
		if (Space4x.isSpindelHauler(state, u)) continue;
		return 1;
	}
	return 0;
};

Space4x.spindelNavigatorUpkeep = function (state, empireId) {
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.empireId !== empireId) continue;
		if (Space4x.isSpindelHauler(state, u)) return 1;
	}
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
	const navigators = Space4x.spindelNavigatorUpkeep(state, empireId);
	if (navigators) lines.push("Spindel Navigators −" + Space4x.fmtMoney(navigators) + " (in use)");
	return {
		buildings: buildings,
		troops: troops,
		spies: spies,
		ships: ships,
		freighters: freighters,
		navigators: navigators,
		upkeep: Space4x.moneyRound(buildings + troops + spies + ships + freighters + navigators),
		lines: lines
	};
};

Space4x.empireMoneyForecast = function (state, empireId) {
	const empire = Space4x.empireById(state, empireId);
	const homes = Space4x.settlementsOf(state, empireId);
	let income = 0;
	let taxed = 0;
	for (let i = 0; i < homes.length; i++) {
		const y = Space4x.settlementYield(state, homes[i], empire);
		income += y.money;
		taxed += y.taxed || 0;
	}
	income = Space4x.moneyRound(income);
	taxed = Space4x.moneyRound(taxed);
	const preview = Space4x.previewEmpireFood(state, empireId);
	const up = Space4x.empireUpkeep(state, empireId, preview.hullsUsed || 0);
	const trade = Space4x.tradeTreatyPreview ? Space4x.tradeTreatyPreview(state, empire) : { total: 0, lines: [] };
	const lines = up.lines.slice();
	const taxRate = Space4x.empireTaxRate(empire);
	if (taxRate) lines.unshift("Tax " + taxRate + "% +" + Space4x.fmtMoney(taxed));
	for (let i = 0; i < (trade.lines || []).length; i++) lines.push(trade.lines[i]);
	return {
		income: income,
		taxed: taxed,
		taxRate: taxRate,
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

Space4x.empireShouldHaltMilitarySpend = function (state, empire) {
	if (!empire || empire.dormant) return false;
	const f = Space4x.empireMoneyForecast(state, empire.id);
	const money = f.stockpile || 0;
	if (money <= 0) return true;
	const limit = Space4x.empireDebtLimit(state, empire.id);
	return money + (f.net || 0) <= -limit;
};

Space4x.bankruptcyShipDist = function (state, unit) {
	const pos = Space4x.unitRangePos(unit);
	const home = Space4x.nearestFriendlyStar(state, unit.empireId, pos.x, pos.y);
	if (!home) return Infinity;
	const w = Space4x.cellWorldPos(home.x, home.y);
	return Space4x.dist(pos.x, pos.y, w.x, w.y);
};

Space4x.bankruptcyCanScrapShip = function (state, unit) {
	if (!unit || Space4x.isHauler(state, unit) || unit.fleetMode) return false;
	if (unit.location && unit.location.kind === "refit") return false;
	if ((unit.cargoPops || []).length) return false;
	return Space4x.shipUpkeep(state, unit) > 0 || Space4x.shipScrapValue(state, unit) > 0;
};

Space4x.pickBankruptcyShip = function (state, empireId) {
	let best = null;
	let bestStation = 0;
	let bestDist = Infinity;
	for (let i = 0; i < state.units.length; i++) {
		const unit = state.units[i];
		if (unit.empireId !== empireId) continue;
		if (!Space4x.bankruptcyCanScrapShip(state, unit)) continue;
		const station = Space4x.isStationHull(state, unit) ? 1 : 0;
		const dist = Space4x.bankruptcyShipDist(state, unit);
		if (!best || station < bestStation || (station === bestStation && dist < bestDist)) {
			best = unit;
			bestStation = station;
			bestDist = dist;
		}
	}
	return best;
};

Space4x.pickBankruptcyBuilding = function (state, empireId) {
	const homes = Space4x.settlementsOf(state, empireId);
	let best = null;
	let bestUpkeep = -1;
	let bestCost = -1;
	for (let h = 0; h < homes.length; h++) {
		const st = homes[h];
		const list = st.structures || [];
		for (let i = 0; i < list.length; i++) {
			const def = Space4x.settingOf(state).builds[list[i].defId];
			if (!def || def.unique || def.uniqueEmpire) continue;
			if (def.id === "spaceDock") continue;
			const upkeep = Space4x.defUpkeep(state, def.id);
			const cost = Space4x.baseDefCost(def);
			if (upkeep <= 0 && cost <= 0) continue;
			if (upkeep > bestUpkeep || (upkeep === bestUpkeep && cost > bestCost)) {
				best = { settlement: st, index: i, name: def.name, upkeep: upkeep };
				bestUpkeep = upkeep;
				bestCost = cost;
			}
		}
	}
	return best;
};

Space4x.empireTroopTs = function (state, empireId) {
	const empire = Space4x.empireById(state, empireId);
	let n = 0;
	const homes = Space4x.settlementsOf(state, empireId);
	for (let i = 0; i < homes.length; i++) {
		n += Space4x.troopListTs(state, empire, homes[i].troops);
	}
	const haulers = Space4x.troopHaulers(state, empireId);
	for (let h = 0; h < haulers.length; h++) {
		n += Space4x.troopListTs(state, empire, haulers[h].cargoTroops);
	}
	return n;
};

Space4x.bankruptcyTroopRequired = function (state, settlement, troop) {
	if (!settlement || !troop) return false;
	const empire = Space4x.empireById(state, settlement.empireId);
	const def = Space4x.settingOf(state).builds[troop.defId];
	if (!Space4x.troopCountsAsPolice(state, empire, def)) return false;
	return Space4x.countPolice(state, settlement) <= Space4x.policeNeed(state, settlement);
};

Space4x.pickBankruptcyTroop = function (state, empireId) {
	const reserved = Space4x.pendingInvasionFleets(state, empireId);
	let best = null;
	let bestUpkeep = -1;
	function consider(row) {
		const defId = row.troop && row.troop.defId;
		const upkeep = Space4x.defUpkeep(state, defId);
		if (!upkeep) return;
		if (row.settlement && Space4x.bankruptcyTroopRequired(state, row.settlement, row.troop)) return;
		if (!best || upkeep > bestUpkeep) {
			best = row;
			bestUpkeep = upkeep;
		}
	}
	const homes = Space4x.settlementsOf(state, empireId);
	for (let h = 0; h < homes.length; h++) {
		const st = homes[h];
		const troops = st.troops || [];
		for (let i = 0; i < troops.length; i++) {
			consider({ troop: troops[i], settlement: st, index: i });
		}
	}
	const haulers = Space4x.troopHaulers(state, empireId);
	for (let u = 0; u < haulers.length; u++) {
		const unit = haulers[u];
		if (reserved[unit.id]) continue;
		const cargo = unit.cargoTroops || [];
		for (let i = 0; i < cargo.length; i++) {
			consider({ troop: cargo[i], unit: unit, index: i });
		}
	}
	return best;
};

Space4x.disbandBankruptcyTroop = function (state, pick) {
	if (!pick || !pick.troop) return pick.troop;
	if (pick.settlement) {
		pick.settlement.troops.splice(pick.index, 1);
		return pick.troop;
	}
	if (pick.unit) {
		pick.unit.cargoTroops.splice(pick.index, 1);
		if (!(pick.unit.cargoTroops || []).length) Space4x.finishTroopFleet(state, pick.unit);
		return pick.troop;
	}
	return pick.troop;
};

Space4x.resolveEmpireBankruptcy = function (state, empire) {
	if (!empire || empire.dormant || !Space4x.empireIsBankrupt(state, empire)) return;
	const limit = Space4x.empireDebtLimit(state, empire.id);
	let ships = 0;
	let shipCash = 0;
	let buildings = 0;
	let buildingCash = 0;
	let troops = 0;
	let steps = 0;
	while (Space4x.empireIsBankrupt(state, empire) && steps < 200) {
		const ship = Space4x.pickBankruptcyShip(state, empire.id);
		if (!ship) break;
		steps += 1;
		shipCash = Space4x.moneyRound(shipCash + Space4x.scrapUnitForCash(state, ship));
		ships += 1;
	}
	const startTs = Space4x.empireTroopTs(state, empire.id);
	const tsCap = startTs / 2;
	let goneTs = 0;
	while (Space4x.empireIsBankrupt(state, empire) && Space4x.empireMoneyForecast(state, empire.id).net < 0 &&
		goneTs < tsCap && steps < 200) {
		steps += 1;
		const pick = Space4x.pickBankruptcyTroop(state, empire.id);
		if (!pick) break;
		const def = Space4x.settingOf(state).builds[pick.troop.defId];
		goneTs += Space4x.troopTs(state, empire, def, pick.troop.culture);
		Space4x.disbandBankruptcyTroop(state, pick);
		troops += 1;
	}
	while (Space4x.empireIsBankrupt(state, empire) && steps < 200) {
		const bld = Space4x.pickBankruptcyBuilding(state, empire.id);
		if (!bld) break;
		steps += 1;
		buildingCash = Space4x.moneyRound(buildingCash + Space4x.scrapStructureForCash(state, bld.settlement, bld.index));
		buildings += 1;
	}
	if (ships || buildings || troops) {
		const bits = [];
		if (troops) bits.push("disbanded " + troops + " " + Space4x.unitsWord(troops));
		if (ships) bits.push("scrapped " + ships + " ship" + (ships === 1 ? "" : "s") + " (+" + Space4x.fmtMoney(shipCash) + ")");
		if (buildings) bits.push("scrapped " + buildings + " building" + (buildings === 1 ? "" : "s") + " (+" + Space4x.fmtMoney(buildingCash) + ")");
		state.turnLog.push(empire.name + " bankruptcy (−" + Space4x.fmtMoney(limit) + " limit): " + bits.join(", ") + ".");
	}
};

Space4x.phaseBankruptcy = function (state) {
	for (let i = 0; i < state.empires.length; i++) {
		Space4x.resolveEmpireBankruptcy(state, state.empires[i]);
	}
};

Space4x.jobValue = function (y) {
	return y.food + y.industry + y.research + y.money;
};

Space4x.assignNewPop = function (state, settlement, pop) {
	const empire = Space4x.empireById(state, settlement.empireId);
	const set = Space4x.settingOf(state);
	const y = Space4x.produceSettlement(state, settlement, empire);
	const foodNeed = settlement.pops.length * (set.foodPerPop || 1);
	const needMoreFood = y.food < foodNeed;
	if (needMoreFood && Space4x.countJob(settlement, "agriculture") < Space4x.jobCap(state, settlement, "agriculture")) {
		pop.job = "agriculture";
		return;
	}
	if (needMoreFood && Space4x.countJob(settlement, "greenhouse") < Space4x.jobCap(state, settlement, "greenhouse")) {
		pop.job = "greenhouse";
		return;
	}
	const carefulFood = empire && empire.isPlayer;
	const order = set.jobOrder || Object.keys(set.jobs);
	const options = [];
	for (let i = 0; i < order.length; i++) {
		if (order[i] !== "idle") options.push(order[i]);
	}
	let best = "industry";
	let bestV = -1;
	for (let i = 0; i < options.length; i++) {
		const job = options[i];
		if (job === "research" && !Space4x.popCanResearch(pop)) continue;
		if (carefulFood && !needMoreFood && (job === "agriculture" || job === "greenhouse")) continue;
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
	if (job === "research" && !Space4x.popCanResearch(pop)) return false;
	if (pop.job === job) return true;
	const cap = Space4x.jobCap(state, settlement, job);
	const filling = job !== "idle" && cap !== Infinity &&
		Space4x.countJob(settlement, job) >= cap;
	if (filling) return false;
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
	for (let p = 0; p < pops.length; p++) {
		if (pops[p].job === "research" && !Space4x.popCanResearch(pops[p])) pops[p].job = "industry";
	}
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
					if (job === "agriculture") {
						const ghCap = Space4x.jobCap(state, settlement, "greenhouse");
						if (ghCap !== Infinity && Space4x.countJob(settlement, "greenhouse") < ghCap) {
							settlement.pops[i].job = "greenhouse";
							break;
						}
					}
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
