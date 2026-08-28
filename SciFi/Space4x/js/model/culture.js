var Space4x = Space4x || {};

Space4x.culturesOf = function (state) {
	const id = (state && state.settingId) || (state && state.gen && state.gen.settingId);
	const set = (id && Space4x.SETTINGS[id]) || Space4x.settingOf(state);
	return (set && set.cultures) || [];
};

Space4x.cultureById = function (state, id) {
	const list = Space4x.culturesOf(state);
	if (!id) return null;
	for (let i = 0; i < list.length; i++) {
		if (list[i].id === id) return list[i];
	}
	return null;
};

Space4x.RANDOM_CULTURE = "random";

Space4x.isRandomCulture = function (id) {
	return !id || id === Space4x.RANDOM_CULTURE;
};

Space4x.defaultCultureId = function (state) {
	const list = Space4x.culturesOf(state);
	if (!list.length) return null;
	for (let i = 0; i < list.length; i++) {
		if (list[i].id === "human") return "human";
	}
	return list[0].id;
};

Space4x.usedGenCultureIds = function (gen) {
	const used = {};
	if (!gen) return used;
	if (gen.playerCultureId && !Space4x.isRandomCulture(gen.playerCultureId)) {
		used[gen.playerCultureId] = true;
	}
	const list = gen.opponents || [];
	for (let i = 0; i < list.length; i++) {
		const id = list[i].cultureId;
		if (id && !Space4x.isRandomCulture(id)) used[id] = true;
	}
	return used;
};

Space4x.cultureChoices = function (state, used) {
	const list = Space4x.culturesOf(state);
	const opts = [];
	for (let i = 0; i < list.length; i++) {
		if (used && used[list[i].id]) continue;
		opts.push(list[i].id);
	}
	if (!opts.length) {
		for (let i = 0; i < list.length; i++) opts.push(list[i].id);
	}
	return opts;
};

Space4x.pickRandomCultureId = function (state, used) {
	const opts = Space4x.cultureChoices(state, used);
	if (!opts.length) return null;
	return opts[Math.floor(Math.random() * opts.length)];
};

Space4x.rollCultureId = function (state, used) {
	const opts = Space4x.cultureChoices(state, used);
	if (!opts.length) return Space4x.defaultCultureId(state);
	return opts[Space4x.rngInt(state, opts.length)];
};

Space4x.resolveGenCultureId = function (state, id, used) {
	if (id && !Space4x.isRandomCulture(id) && Space4x.cultureById(state, id)) {
		used[id] = true;
		return id;
	}
	const pick = Space4x.rollCultureId(state, used);
	if (pick) used[pick] = true;
	return pick || Space4x.defaultCultureId(state);
};

Space4x.cultureName = function (state, id) {
	const c = Space4x.cultureById(state, id);
	return c ? c.name : (id || "");
};

Space4x.cultureArtSrc = function (state, id) {
	const c = Space4x.cultureById(state, id);
	if (!c || !c.art) return "";
	return encodeURI(c.art);
};

Space4x.eachCultureEffect = function (state, cultureId, fn) {
	const c = Space4x.cultureById(state, cultureId);
	if (!c || !c.effects) return;
	for (let i = 0; i < c.effects.length; i++) fn(c, c.effects[i]);
};

Space4x.cultureMatchesJob = function (fx, job) {
	if (fx.job && fx.job === job) return true;
	const jobs = fx.jobs || [];
	for (let i = 0; i < jobs.length; i++) {
		if (jobs[i] === job) return true;
	}
	return false;
};

Space4x.cultureMatchesBiome = function (fx, body) {
	if (!fx.biomes || !fx.biomes.length) return true;
	const biome = body && body.biome;
	for (let i = 0; i < fx.biomes.length; i++) {
		if (fx.biomes[i] === biome) return true;
	}
	return false;
};

Space4x.applyCultureYield = function (state, settlement, pop, out) {
	if (!pop || !pop.culture) return;
	const body = settlement ? Space4x.bodyById(state, settlement.location.bodyId) : null;
	const spec = Space4x.settingOf(state).jobs[pop.job];
	let moneyMult = 1;
	Space4x.eachCultureEffect(state, pop.culture, function (c, fx) {
		if (fx.type === "moneyMult") moneyMult *= fx.mult || 1;
		if (fx.type !== "jobYield" || !Space4x.cultureMatchesJob(fx, pop.job)) return;
		if (!Space4x.cultureMatchesBiome(fx, body)) return;
		const product = spec && spec.product ? spec.product : null;
		if (product && out[product] != null) out[product] += fx.n || 0;
	});
	if (moneyMult !== 1) out.money = Space4x.moneyRound(out.money * moneyMult);
};

Space4x.cultureGrowthBase = function (state, pop) {
	const set = Space4x.settingOf(state);
	let base = set.growthRatePercent || 0;
	if (!pop || !pop.culture) return base;
	Space4x.eachCultureEffect(state, pop.culture, function (c, fx) {
		if (fx.type === "growthBase" && fx.n != null) base = fx.n;
	});
	return base;
};

Space4x.popGrowRate = function (state, empire, pop) {
	const tech = (empire && empire.modifiers && empire.modifiers.growthRatePercent) || 0;
	return Math.max(0, Space4x.cultureGrowthBase(state, pop) + tech);
};

Space4x.settlementGrowRate = function (state, settlement, empire) {
	const pops = settlement && settlement.pops ? settlement.pops : [];
	if (!pops.length) return Space4x.popGrowRate(state, empire, { culture: empire && empire.cultureId });
	let n = 0;
	for (let i = 0; i < pops.length; i++) n += Space4x.popGrowRate(state, empire, pops[i]);
	return n / pops.length;
};

Space4x.cultureTroopTsPct = function (state, cultureId) {
	let pct = 0;
	Space4x.eachCultureEffect(state, cultureId, function (c, fx) {
		if (fx.type === "troopTsPct") pct += fx.pct || 0;
	});
	return pct;
};

Space4x.cultureJobBonus = function (state, cultureId, job, body) {
	let n = 0;
	Space4x.eachCultureEffect(state, cultureId, function (c, fx) {
		if (fx.type !== "jobYield" || !Space4x.cultureMatchesJob(fx, job)) return;
		if (!Space4x.cultureMatchesBiome(fx, body)) return;
		n += fx.n || 0;
	});
	return n;
};

Space4x.majorityCulture = function (state, settlement) {
	const empire = settlement ? Space4x.empireById(state, settlement.empireId) : null;
	const fallback = empire ? empire.cultureId : null;
	if (!settlement) return fallback;
	const counts = {};
	let bestN = 0;
	const pops = settlement.pops || [];
	for (let i = 0; i < pops.length; i++) {
		const id = pops[i].culture;
		if (!id) continue;
		counts[id] = (counts[id] || 0) + 1;
		if (counts[id] > bestN) bestN = counts[id];
	}
	if (!bestN) return fallback;
	const tied = [];
	const ids = Object.keys(counts);
	for (let i = 0; i < ids.length; i++) {
		if (counts[ids[i]] === bestN) tied.push(ids[i]);
	}
	if (tied.length === 1) return tied[0];
	if (fallback) {
		for (let i = 0; i < tied.length; i++) {
			if (tied[i] === fallback) return fallback;
		}
	}
	const list = Space4x.culturesOf(state);
	for (let i = 0; i < list.length; i++) {
		for (let t = 0; t < tied.length; t++) {
			if (list[i].id === tied[t]) return tied[t];
		}
	}
	return tied[0];
};

Space4x.settlementCultureLabel = function (state, settlement) {
	const majority = Space4x.majorityCulture(state, settlement);
	const name = Space4x.cultureName(state, majority);
	if (!name) return "";
	const pops = settlement && settlement.pops ? settlement.pops : [];
	for (let i = 0; i < pops.length; i++) {
		if (pops[i].culture && pops[i].culture !== majority) return name + " majority";
	}
	return name;
};

Space4x.nextUnusedCultureId = function (state, gen) {
	const opts = Space4x.cultureChoices(state, Space4x.usedGenCultureIds(gen));
	if (opts.length) return opts[0];
	return Space4x.defaultCultureId(state);
};

Space4x.cultureSummary = function (c) {
	return c && c.summary ? c.summary : "No special bonus yet.";
};

Space4x.cultureBlurb = function (state, cultureId) {
	if (Space4x.isRandomCulture(cultureId)) {
		return {
			id: Space4x.RANDOM_CULTURE,
			name: "Random",
			art: false,
			text: "A species is chosen when the game starts. Already-picked species are skipped when possible."
		};
	}
	const c = Space4x.cultureById(state, cultureId);
	if (!c) {
		return { id: cultureId, name: "Species", art: false, text: "" };
	}
	return {
		id: c.id,
		name: c.name,
		art: true,
		text: Space4x.cultureSummary(c)
	};
};

Space4x.fillCultureSelect = function (sel, state, selected) {
	const list = Space4x.culturesOf(state);
	Space4x.syncKeyedList(sel, list, function (c) { return c.id; },
		function () { return document.createElement("option"); },
		function (opt, c) {
			opt.value = c.id;
			opt.textContent = c.name;
		}
	);
	if (selected) sel.value = selected;
};

Space4x.setCultureImg = function (img, state, cultureId) {
	if (!img) return;
	const src = Space4x.cultureArtSrc(state, cultureId);
	const name = Space4x.cultureName(state, cultureId);
	if (src) {
		if (img.getAttribute("src") !== src) img.src = src;
		img.hidden = false;
	} else {
		img.removeAttribute("src");
		img.hidden = true;
	}
	img.alt = name;
};
