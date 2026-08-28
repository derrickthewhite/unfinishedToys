var Space4x = Space4x || {};

Space4x.allocateCeilTrim = function (entries, total) {
	const W = entries.reduce(function (s, e) { return s + e.weight; }, 0);
	if (total <= 0 || W <= 0) {
		for (let z = 0; z < entries.length; z++) entries[z].allot = 0;
		return;
	}
	for (let i = 0; i < entries.length; i++) {
		entries[i].allot = Math.ceil(total * entries[i].weight / W);
	}
	let sum = entries.reduce(function (s, e) { return s + e.allot; }, 0);
	while (sum > total) {
		let best = -1;
		for (let i = 0; i < entries.length; i++) {
			const e = entries[i];
			if (e.allot <= 0) continue;
			if (best < 0) { best = i; continue; }
			const b = entries[best];
			if (e.allot > b.allot || (e.allot === b.allot && (e.weight > b.weight || (e.weight === b.weight && e.id > b.id)))) {
				best = i;
			}
		}
		if (best < 0) break;
		entries[best].allot -= 1;
		sum -= 1;
	}
};

Space4x.pullSurplus = function (pools, amount) {
	let left = amount;
	const ids = Object.keys(pools);
	ids.sort(function (a, b) { return (pools[b] || 0) - (pools[a] || 0); });
	for (let i = 0; i < ids.length && left > 0; i++) {
		const take = Math.min(pools[ids[i]] || 0, left);
		pools[ids[i]] = (pools[ids[i]] || 0) - take;
		left -= take;
	}
	return amount - left;
};

Space4x.eatLocal = function (settlements, demandOf, pools, present) {
	for (let i = 0; i < settlements.length; i++) {
		const st = settlements[i];
		const d = demandOf(st);
		const local = Math.min(d, pools[st.id] || 0);
		pools[st.id] = (pools[st.id] || 0) - local;
		present[st.id] += local;
	}
};

Space4x.shipDemand = function (settlements, demandOf, pools, present, hulls) {
	const entries = [];
	let remainingDemand = 0;
	for (let i = 0; i < settlements.length; i++) {
		const st = settlements[i];
		const d = demandOf(st);
		const need = d - (present[st.id] || 0);
		if (need > 0) {
			entries.push({ id: st.id, weight: need, allot: 0 });
			remainingDemand += need;
		}
	}
	let surplus = 0;
	for (let k in pools) if (Object.prototype.hasOwnProperty.call(pools, k)) surplus += pools[k];
	const F = Math.min(remainingDemand, surplus, hulls.n);
	Space4x.allocateCeilTrim(entries, F);
	let shipped = 0;
	for (let i = 0; i < entries.length; i++) {
		const got = Space4x.pullSurplus(pools, entries[i].allot);
		present[entries[i].id] += got;
		shipped += got;
	}
	hulls.n -= shipped;
};

Space4x.feedZeroColonies = function (settlements, pools, present, hulls) {
	const zeros = [];
	for (let i = 0; i < settlements.length; i++) {
		const st = settlements[i];
		if (st.pops.length > 0 && (present[st.id] || 0) === 0) zeros.push(st);
	}
	zeros.sort(function (a, b) {
		if (a.pops.length !== b.pops.length) return a.pops.length - b.pops.length;
		return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
	});
	for (let i = 0; i < zeros.length; i++) {
		if (hulls.n < 1) break;
		const got = Space4x.pullSurplus(pools, 1);
		if (!got) break;
		present[zeros[i].id] += got;
		hulls.n -= got;
	}
};

Space4x.foodClasses = function () {
	function farmers(st) { return Space4x.countJob(st, "agriculture"); }
	function class2(st) {
		if (farmers(st) <= 0) return 0;
		return Math.max(0, st.pops.length - farmers(st));
	}
	function class3(st) {
		if (farmers(st) > 0) return 0;
		return st.pops.length;
	}
	return { farmers: farmers, class2: class2, class3: class3 };
};

Space4x.allocateEmpireFood = function (list, pools, present, hulls) {
	const cls = Space4x.foodClasses();
	Space4x.eatLocal(list, cls.farmers, pools, present);
	Space4x.eatLocal(list, cls.class3, pools, present);
	Space4x.feedZeroColonies(list, pools, present, hulls);
	Space4x.shipDemand(list, cls.farmers, pools, present, hulls);
	Space4x.eatLocal(list, cls.class2, pools, present);
	Space4x.shipDemand(list, cls.class2, pools, present, hulls);
	Space4x.shipDemand(list, cls.class3, pools, present, hulls);
};

Space4x.phaseTransport = function (state) {
	let hullsUsed = 0;
	for (let e = 0; e < state.empires.length; e++) {
		const empire = state.empires[e];
		const list = Space4x.settlementsOf(state, empire.id);
		const pools = {};
		const present = {};
		const hulls = { n: empire.transport.freighters };
		const startHulls = hulls.n;
		for (let i = 0; i < list.length; i++) {
			pools[list[i].id] = list[i]._producedFood || 0;
			present[list[i].id] = 0;
		}
		Space4x.allocateEmpireFood(list, pools, present, hulls);
		for (let i = 0; i < list.length; i++) {
			list[i].lastFoodPresent = present[list[i].id];
			list[i].foodPresent = present[list[i].id];
		}
		hullsUsed += startHulls - hulls.n;
		empire._hullsUsed = startHulls - hulls.n;
	}
	state._hullsUsed = hullsUsed;
};

Space4x.previewEmpireFood = function (state, empireId) {
	const empire = Space4x.empireById(state, empireId);
	const list = Space4x.settlementsOf(state, empireId);
	const pools = {};
	const present = {};
	const produced = {};
	const hulls = { n: empire ? empire.transport.freighters : 0 };
	const startHulls = hulls.n;
	for (let i = 0; i < list.length; i++) {
		const st = list[i];
		const y = Space4x.produceSettlement(state, st, empire);
		pools[st.id] = y.food;
		produced[st.id] = y.food;
		present[st.id] = 0;
	}
	Space4x.allocateEmpireFood(list, pools, present, hulls);
	return { produced: produced, present: present, hullsUsed: startHulls - hulls.n };
};

Space4x.foodSituation = function (state, settlement) {
	const set = Space4x.settingOf(state);
	const need = settlement.pops.length * (set.foodPerPop || 1);
	const preview = Space4x.previewEmpireFood(state, settlement.empireId);
	const produced = preview.produced[settlement.id] || 0;
	const present = preview.present[settlement.id] || 0;
	const imported = Math.max(0, present - produced);
	return {
		produced: produced,
		present: present,
		imported: imported,
		need: need,
		deficit: Math.max(0, need - present),
		surplus: Math.max(0, produced - need)
	};
};
