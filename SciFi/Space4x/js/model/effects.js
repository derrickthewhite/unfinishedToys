var Space4x = Space4x || {};

Space4x.jobLabel = function (state, job) {
	const spec = Space4x.settingOf(state).jobs[job];
	return spec && spec.label ? spec.label : job;
};

Space4x.eachStructureEffect = function (state, settlement, fn) {
	if (!settlement || !settlement.structures) return;
	const builds = Space4x.settingOf(state).builds;
	for (let i = 0; i < settlement.structures.length; i++) {
		const def = builds[settlement.structures[i].defId];
		if (!def || !def.effects) continue;
		for (let e = 0; e < def.effects.length; e++) {
			fn(def, def.effects[e], settlement.structures[i]);
		}
	}
};

Space4x.structureJobSlots = function (state, settlement, job) {
	let n = 0;
	Space4x.eachStructureEffect(state, settlement, function (def, fx) {
		if (fx.type === "jobSlots" && fx.job === job) n += fx.n || 0;
	});
	return n;
};

Space4x.structureCapDelta = function (state, settlement, cap) {
	let n = 0;
	Space4x.eachStructureEffect(state, settlement, function (def, fx) {
		if (fx.type === "capDelta" && fx.cap === cap) n += fx.n || 0;
	});
	return n;
};

Space4x.effectMatchesRichness = function (state, settlement, fx) {
	const need = fx && fx.richness;
	if (!need || !need.length) return true;
	if (!settlement) return true;
	const body = Space4x.bodyById(state, settlement.location.bodyId);
	const rich = Space4x.richnessOf(state, body);
	const id = rich && rich.id;
	for (let i = 0; i < need.length; i++) {
		if (need[i] === id) return true;
	}
	return false;
};

Space4x.richnessNames = function (state, ids) {
	const names = [];
	const list = ids || [];
	for (let i = 0; i < list.length; i++) names.push(Space4x.richnessLabel(state, list[i]));
	return names;
};

Space4x.structureJobYield = function (state, settlement, job) {
	let n = 0;
	Space4x.eachStructureEffect(state, settlement, function (def, fx) {
		if (fx.type !== "jobYield" || fx.job !== job) return;
		if (!Space4x.effectMatchesRichness(state, settlement, fx)) return;
		n += fx.n || 0;
	});
	return n;
};

Space4x.structureJobYieldParts = function (state, settlement, job) {
	const parts = [];
	const seen = {};
	Space4x.eachStructureEffect(state, settlement, function (def, fx) {
		if (fx.type !== "jobYield" || fx.job !== job) return;
		if (!Space4x.effectMatchesRichness(state, settlement, fx)) return;
		if (!seen[def.id]) {
			seen[def.id] = { name: def.name, n: 0 };
			parts.push(seen[def.id]);
		}
		seen[def.id].n += fx.n || 0;
	});
	return parts;
};

Space4x.structureMoneyPerPop = function (state, settlement) {
	let n = 0;
	Space4x.eachStructureEffect(state, settlement, function (def, fx) {
		if (fx.type === "moneyPerPop") n += fx.n || 0;
	});
	return n;
};

Space4x.structureSettlementLoyalty = function (state, settlement) {
	let n = 0;
	Space4x.eachStructureEffect(state, settlement, function (def, fx) {
		if (fx.type === "settlementLoyalty") n += fx.n || 0;
	});
	return n;
};

Space4x.structureCoverByJob = function (state, settlement) {
	const remaining = {};
	const byJob = {};
	Space4x.eachStructureEffect(state, settlement, function (def, fx) {
		if (fx.type !== "jobYieldCover") return;
		let left = fx.cover || 0;
		const jobs = fx.jobs || [];
		const add = fx.n || 1;
		const product = fx.product || "industry";
		for (let j = 0; j < jobs.length && left > 0; j++) {
			const job = jobs[j];
			const key = def.id + ":" + job;
			if (remaining[key] == null) remaining[key] = Space4x.countJob(settlement, job);
			const take = Math.min(remaining[key], left);
			remaining[key] -= take;
			left -= take;
			if (!take) continue;
			if (!byJob[job]) byJob[job] = { n: 0, covered: 0, product: product, sources: [] };
			byJob[job].n += take * add;
			byJob[job].covered += take;
			let found = null;
			for (let s = 0; s < byJob[job].sources.length; s++) {
				const src = byJob[job].sources[s];
				if (src.defId === def.id && src.n === add) found = src;
			}
			if (found) {
				found.covered += take;
				found.copies += 1;
			} else {
				byJob[job].sources.push({ defId: def.id, name: def.name, covered: take, n: add, copies: 1 });
			}
		}
	});
	return byJob;
};

Space4x.structureCoverTotals = function (state, settlement) {
	const byJob = Space4x.structureCoverByJob(state, settlement);
	const out = { food: 0, industry: 0, research: 0 };
	const jobs = Object.keys(byJob);
	for (let i = 0; i < jobs.length; i++) {
		const row = byJob[jobs[i]];
		out[row.product] = (out[row.product] || 0) + row.n;
	}
	return out;
};

Space4x.structureCoverFromDef = function (state, settlement, defId) {
	const copies = settlement ? Space4x.countStructure(settlement, defId) : 0;
	const byJob = {};
	let total = 0;
	if (!settlement) return { copies: copies, total: 0, byJob: byJob };
	const all = Space4x.structureCoverByJob(state, settlement);
	const jobs = Object.keys(all);
	for (let i = 0; i < jobs.length; i++) {
		const job = jobs[i];
		const sources = all[job].sources;
		for (let s = 0; s < sources.length; s++) {
			if (sources[s].defId !== defId) continue;
			if (!byJob[job]) byJob[job] = { covered: 0, n: sources[s].n, product: all[job].product };
			byJob[job].covered += sources[s].covered;
			total += sources[s].covered;
		}
	}
	return { copies: copies, total: total, byJob: byJob };
};

Space4x.buildCostMult = function (state, settlement, def) {
	if (!settlement || !def) return 1;
	let mult = 1;
	Space4x.eachStructureEffect(state, settlement, function (bdef, fx) {
		if (fx.type !== "buildCost" || fx.mult == null) return;
		const kinds = fx.kinds || [];
		let match = !kinds.length;
		for (let i = 0; i < kinds.length; i++) {
			if (kinds[i] === def.kind) match = true;
		}
		if (match) mult *= fx.mult;
	});
	return mult;
};

Space4x.buildCost = function (state, settlement, def) {
	const base = Space4x.baseDefCost(def);
	const mult = Space4x.buildCostMult(state, settlement, def);
	if (mult === 1) return base;
	return Math.max(1, Math.round(base * mult));
};

Space4x.baseDefCost = function (def) {
	return def && def.cost && def.cost.industry != null ? def.cost.industry : 0;
};

Space4x.structureName = function (state, defId) {
	const def = Space4x.settingOf(state).builds[defId];
	return def ? def.name : defId;
};

Space4x.buildsRequiring = function (state, defId) {
	const builds = Space4x.settingOf(state).builds;
	const ids = Object.keys(builds);
	const out = [];
	for (let i = 0; i < ids.length; i++) {
		if (builds[ids[i]].requireStructure === defId) out.push(builds[ids[i]]);
	}
	return out;
};

Space4x.richnessLabel = function (state, id) {
	const set = Space4x.settingOf(state);
	const lists = [];
	if (set.richness) lists.push(set.richness);
	if (set.asteroidRichness) lists.push(set.asteroidRichness);
	for (let L = 0; L < lists.length; L++) {
		for (let i = 0; i < lists[L].length; i++) {
			if (lists[L][i].id === id) return lists[L][i].name;
		}
	}
	return Space4x.titleCase(id);
};

Space4x.kindPhrase = function (kinds) {
	if (!kinds || !kinds.length) return "projects";
	if (kinds.length === 1 && kinds[0] === "unit") return "ships";
	if (kinds.length === 1 && kinds[0] === "structure") return "structures";
	if (kinds.length === 1 && kinds[0] === "troop") return "ground units";
	return kinds.join("/");
};

Space4x.describeEffect = function (state, fx) {
	const n = fx.n;
	if (fx.type === "speed") return "+" + n + " ship speed";
	if (fx.type === "range") return "+" + n + " ship range from friendly colonies";
	if (fx.type === "commsRange") return "+" + n + " contact range beyond ship range";
	if (fx.type === "industryPerPop") return "+" + n + " industry per industry worker";
	if (fx.type === "researchPerPop") return "+" + n + " research per scientist";
	if (fx.type === "foodPerFarmer") return "+" + n + " food per farmer";
	if (fx.type === "growthRatePercent") return "+" + n + "% population growth";
	if (fx.type === "loyalty") return "+" + n + " population loyalty";
	if (fx.type === "spySkill") return "+" + n + " spy skill";
	if (fx.type === "militiaAsPolice") {
		const who = fx.defId ? Space4x.structureName(state, fx.defId) : "some troops";
		return who + " count as police for settlement loyalty.";
	}
	if (fx.type === "unitLoyalty") {
		const who = fx.defId ? Space4x.structureName(state, fx.defId) : "unit";
		const sign = (fx.n || 0) > 0 ? "+" : "";
		return sign + (fx.n || 0) + " " + who + " loyalty";
	}
	if (fx.type === "weapon") return "+" + n + " weapons (combat not in this slice)";
	if (fx.type === "shield") return "+" + n + " shields (combat not in this slice)";
	if (fx.type === "armor") return "+" + n + " armor (combat not in this slice)";
	if (fx.type === "shipSize") return "+" + n + " ship size (not used yet)";
	if (fx.type === "unlockBuild") {
		let name = fx.id || "a building";
		if (state && fx.id) {
			const def = Space4x.settingOf(state).builds[fx.id];
			if (def) name = def.name;
		}
		return "Unlocks " + name + ".";
	}
	if (fx.type === "unlockSettle") {
		if (fx.kind === "asteroidBelt") return "Allows founding settlements on asteroid belts.";
		if (fx.kind === "gasGiant") return "Allows founding settlements on gas giants.";
		return "Allows founding on " + (fx.kind || "new worlds") + ".";
	}
	if (fx.type === "stub" || fx.type === "stubUnit" || fx.type === "unitBonus") {
		return "No mechanical effect in this slice yet.";
	}
	if (fx.type === "warpDrive") return "Ships may leave their star.";
	if (fx.type === "diplomacy") return "Talk to other empires in contact range. Unlocks the Diplomacy screen.";
	if (fx.type === "shipModule") {
		const names = { radioScanner: "a Radio Scanner", autoRepair: "Auto Repair" };
		return "Fits " + (names[fx.id] || fx.id || "a module") + " on every ship. No effect yet.";
	}
	if (fx.type === "afterdrive") return "Combat speed option. Not used on the map yet.";
	if (fx.type === "troopArmorPct") {
		const who = fx.tags && fx.tags.length ? fx.tags.join("/") : "all troops";
		return "+" + (fx.pct || 0) + "% troop strength (" + who + ")";
	}
	if (fx.type === "troopWeapon") {
		const who = fx.tags && fx.tags.length ? fx.tags.join("/") : "all troops";
		return "+" + (fx.n || 0) + " troop strength (" + who + "). Weapons do not stack; use the best.";
	}
	if (fx.type === "jobSlots") {
		return "+" + n + " " + Space4x.jobLabel(state, fx.job) + " job slot" + (n === 1 ? "" : "s");
	}
	if (fx.type === "capDelta") {
		const cap = fx.cap === "agri" ? "agriculture" : fx.cap;
		const sign = n > 0 ? "+" : "";
		return sign + n + " " + cap + " slot" + (Math.abs(n) === 1 ? "" : "s");
	}
	if (fx.type === "jobYield") {
		const spec = Space4x.settingOf(state).jobs[fx.job];
		const product = spec && spec.product ? spec.product : "output";
		let text = "+" + n + " " + product + " per " + Space4x.jobLabel(state, fx.job) + " worker here";
		if (fx.richness && fx.richness.length) {
			text += " (" + Space4x.richnessNames(state, fx.richness).join(" or ") + ")";
		}
		return text;
	}
	if (fx.type === "moneyPerPop") return "+" + n + " money per working person here";
	if (fx.type === "settlementLoyalty") {
		const sign = n > 0 ? "+" : "";
		return sign + n + " settlement loyalty";
	}
	if (fx.type === "unitLoyaltyCover") {
		const cover = fx.cover || 0;
		return "+" + (fx.n || 0) + " unit loyalty to " + cover + " garrison unit" + (cover === 1 ? "" : "s");
	}
	if (fx.type === "jobYieldCover") {
		const labels = [];
		const jobs = fx.jobs || [];
		for (let i = 0; i < jobs.length; i++) labels.push(Space4x.jobLabel(state, jobs[i]));
		const cover = fx.cover || 0;
		const slotWord = cover === 1 ? " slot" : " slots";
		return "+" + (fx.n || 1) + " " + (fx.product || "industry") + " to " + cover + " " + labels.join(" or ") + slotWord;
	}
	if (fx.type === "buildCost") {
		const pct = Math.round((1 - fx.mult) * 100);
		const who = Space4x.kindPhrase(fx.kinds);
		if (pct > 0) return "−" + pct + "% cost for " + who + " here";
		if (pct < 0) return "+" + (-pct) + "% cost for " + who + " here";
		return "Cost ×" + fx.mult + " for " + who + " here";
	}
	if (fx.type === "grantFreighters") return "Adds " + n + " freighter" + (n === 1 ? "" : "s") + " to the empire pool";
	if (fx.type === "foundSettlement") return "Founds a settlement on a legal empty world";
	if (fx.type === "galaxyScan") return "Reveals every planet and ship";
	if (fx.type === "combatStub") return "Combat is a stub in this slice";
	return fx.type + " +" + n;
};

Space4x.effectText = function (fx, state) {
	return Space4x.describeEffect(state, fx);
};

Space4x.structureEffectText = function (state, def, fx) {
	return Space4x.describeEffect(state, fx);
};

Space4x.pushStructureInspectStats = function (state, settlement, def, stats) {
	const fxs = def.effects || [];
	for (let i = 0; i < fxs.length; i++) {
		const fx = fxs[i];
		stats.push(Space4x.structureEffectText(state, def, fx));
		if (!settlement) continue;
		if (fx.type === "jobSlots") {
			const spec = Space4x.settingOf(state).jobs[fx.job];
			if (spec && spec.base && spec.product) {
				stats.push(Space4x.jobLabel(state, fx.job) + " worker base output: " + spec.base + " " + spec.product);
			}
			stats.push("Slots now: " + Space4x.structureJobSlots(state, settlement, fx.job));
		}
		if (fx.type === "jobYield") {
			if (Space4x.effectMatchesRichness(state, settlement, fx)) {
				const n = Space4x.countJob(settlement, fx.job);
				const each = fx.n || 0;
				const copies = Math.max(Space4x.countStructure(settlement, def.id), 1);
				stats.push("Now: " + n + " " + Space4x.jobLabel(state, fx.job) + " × +" + each + " = +" + (n * each * copies));
			}
		}
		if (fx.type === "moneyPerPop") {
			const paid = settlement.pops.length - Space4x.countJob(settlement, "idle");
			const each = fx.n || 0;
			stats.push("Now: " + paid + " working × +" + each + " = +" + Space4x.fmtMoney(paid * each));
		}
		if (fx.type === "unitLoyaltyCover" && Space4x.unitCoverFromDef) {
			const c = Space4x.unitCoverFromDef(state, settlement, def.id);
			stats.push("Now: " + c.copies + " covering " + c.covered + " of " + c.garrison + " unit" + (c.garrison === 1 ? "" : "s"));
		}
		if (fx.type === "jobYieldCover") {
			const c = Space4x.structureCoverFromDef(state, settlement, def.id);
			const bits = [];
			const jobs = fx.jobs || [];
			for (let j = 0; j < jobs.length; j++) {
				const row = c.byJob[jobs[j]];
				bits.push(Space4x.jobLabel(state, jobs[j]) + " " + (row ? row.covered : 0));
			}
			stats.push("Now: " + c.copies + " covering " + c.total + " slot" + (c.total === 1 ? "" : "s") + (bits.length ? " (" + bits.join(", ") + ")" : ""));
		}
		if (fx.type === "capDelta" && fx.cap === "agri" && Space4x.countStructure(settlement, def.id)) {
			stats.push("Agriculture slots now: " + Space4x.jobCap(state, settlement, "agriculture"));
		}
	}
	if (settlement) {
		let gated = false;
		let gatedHit = false;
		for (let i = 0; i < fxs.length; i++) {
			const fx = fxs[i];
			if (fx.type !== "jobYield" || !fx.richness || !fx.richness.length) continue;
			gated = true;
			if (Space4x.effectMatchesRichness(state, settlement, fx)) gatedHit = true;
		}
		if (gated && !gatedHit && Space4x.countStructure(settlement, def.id)) {
			stats.push("Now: no bonus on this world");
		}
	}
	const neededBy = Space4x.buildsRequiring(state, def.id);
	if (neededBy.length) {
		let allUnit = true;
		for (let i = 0; i < neededBy.length; i++) {
			if (neededBy[i].kind !== "unit") allUnit = false;
		}
		stats.push(allUnit ? "Required to build ships here" : "Required here to queue some projects");
	}
};
