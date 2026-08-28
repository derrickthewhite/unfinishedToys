var Space4x = Space4x || {};

Space4x.settingOf = function (state) {
	return Space4x.SETTINGS[state.settingId];
};

Space4x.nextId = function (state, prefix) {
	state.nextId += 1;
	return prefix + state.nextId;
};

Space4x.moneyRound = function (n) {
	return Math.round((n || 0) * 10) / 10;
};

Space4x.fmtMoney = function (n) {
	const r = Space4x.moneyRound(n);
	if (!r) return "0";
	return (Math.abs(r % 1) < 1e-9) ? String(Math.round(r)) : r.toFixed(1);
};

Space4x.UNIT_ROLES = {
	popHauler: "popHauler",
	troopHauler: "troopHauler"
};

Space4x.unitRole = function (state, unit) {
	if (!unit) return null;
	if (unit.role) return unit.role;
	const def = unit.defId && Space4x.settingOf(state).builds[unit.defId];
	return def && def.role ? def.role : null;
};

Space4x.unitHasRole = function (state, unit, role) {
	if (!unit) return false;
	if (unit.role === role || unit.defId === role) return true;
	const def = unit.defId && Space4x.settingOf(state).builds[unit.defId];
	return !!(def && def.role === role);
};

Space4x.isPopHauler = function (state, unit) {
	return Space4x.unitHasRole(state, unit, Space4x.UNIT_ROLES.popHauler);
};

Space4x.isTroopHauler = function (state, unit) {
	return Space4x.unitHasRole(state, unit, Space4x.UNIT_ROLES.troopHauler);
};

Space4x.isHauler = function (state, unit) {
	return Space4x.isPopHauler(state, unit) || Space4x.isTroopHauler(state, unit);
};

Space4x.defHasEffect = function (state, defId, type) {
	const def = defId && Space4x.settingOf(state).builds[defId];
	if (!def || !def.effects) return false;
	for (let i = 0; i < def.effects.length; i++) {
		if (def.effects[i].type === type) return true;
	}
	return false;
};

Space4x.unitHasEffect = function (state, unit, type) {
	return !!(unit && Space4x.defHasEffect(state, unit.defId, type));
};

Space4x.unitCanFound = function (state, unit) {
	return Space4x.unitHasEffect(state, unit, "foundSettlement");
};

Space4x.inTransitFreighterHulls = function (state, empireId) {
	let n = 0;
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (!Space4x.isHauler(state, u)) continue;
		if (empireId && u.empireId !== empireId) continue;
		n += u.hulls || 0;
	}
	return n;
};

Space4x.empireFreighterUse = function (state, empireId) {
	const empire = Space4x.empireById(state, empireId);
	const idle = empire ? (empire.transport.freighters || 0) : 0;
	const transit = Space4x.inTransitFreighterHulls(state, empireId);
	const food = empire ? (empire._hullsUsed || 0) : 0;
	const owned = idle + transit;
	return {
		owned: owned,
		idle: idle,
		transit: transit,
		food: food,
		busy: Math.min(owned, food + transit)
	};
};

Space4x.starById = function (state, id) {
	for (let i = 0; i < state.galaxy.stars.length; i++) {
		if (state.galaxy.stars[i].id === id) return state.galaxy.stars[i];
	}
	return null;
};

Space4x.bodyById = function (state, bodyId) {
	const stars = state.galaxy.stars;
	for (let i = 0; i < stars.length; i++) {
		const bodies = stars[i].bodies;
		for (let j = 0; j < bodies.length; j++) {
			if (bodies[j].id === bodyId) return bodies[j];
		}
	}
	return null;
};

Space4x.empireById = function (state, id) {
	for (let i = 0; i < state.empires.length; i++) {
		if (state.empires[i].id === id) return state.empires[i];
	}
	return null;
};

Space4x.playerEmpire = function (state) {
	for (let i = 0; i < state.empires.length; i++) {
		if (state.empires[i].isPlayer) return state.empires[i];
	}
	return null;
};

Space4x.becomeEmpire = function (state, empireId) {
	const next = Space4x.empireById(state, empireId);
	if (!next) return false;
	const cur = Space4x.playerEmpire(state);
	if (cur && cur.id === next.id) return false;
	if (cur) {
		cur.isPlayer = false;
		if (!cur.aiId) cur.aiId = "dumb";
	}
	for (let i = 0; i < state.empires.length; i++) {
		if (state.empires[i].id !== next.id) state.empires[i].isPlayer = false;
	}
	next.isPlayer = true;
	const homes = Space4x.settlementsOf(state, next.id);
	state.ui.selectedSettlementId = homes[0] ? homes[0].id : null;
	state.ui.selectedStarId = homes[0] ? homes[0].location.starId : null;
	state.ui.selectedUnitId = null;
	state.ui.selectedUnitIds = [];
	state.ui.inspect = null;
	state.ui.diploRivalId = null;
	state.ui.diploDraft = null;
	state.ui.panel = "todo";
	state.ui.stage = "galaxy";
	Space4x.rebuildTodos(state);
	return true;
};

Space4x.settlementById = function (state, id) {
	for (let i = 0; i < state.settlements.length; i++) {
		if (state.settlements[i].id === id) return state.settlements[i];
	}
	return null;
};

Space4x.unitById = function (state, id) {
	for (let i = 0; i < state.units.length; i++) {
		if (state.units[i].id === id) return state.units[i];
	}
	return null;
};

Space4x.settlementsOf = function (state, empireId) {
	const out = [];
	for (let i = 0; i < state.settlements.length; i++) {
		if (state.settlements[i].empireId === empireId) out.push(state.settlements[i]);
	}
	return out;
};

Space4x.starAt = function (state, x, y) {
	const stars = state.galaxy.stars;
	for (let i = 0; i < stars.length; i++) {
		if (stars[i].x === x && stars[i].y === y) return stars[i];
	}
	return null;
};

Space4x.dist = function (ax, ay, bx, by) {
	const dx = ax - bx;
	const dy = ay - by;
	return Math.sqrt(dx * dx + dy * dy);
};

Space4x.peopleWord = function (n) {
	return n === 1 ? "person" : "people";
};

Space4x.unitsWord = function (n) {
	return n === 1 ? "unit" : "units";
};

Space4x.techsInCategory = function (state, categoryId) {
	const techs = Space4x.settingOf(state).techs;
	const out = [];
	for (let i = 0; i < techs.length; i++) {
		if (techs[i].categoryId === categoryId) out.push(techs[i]);
	}
	out.sort(function (a, b) { return a.tier - b.tier; });
	return out;
};

Space4x.countJob = function (settlement, job) {
	let n = 0;
	for (let i = 0; i < settlement.pops.length; i++) {
		if (settlement.pops[i].job === job) n += 1;
	}
	return n;
};

Space4x.countStructure = function (settlement, defId) {
	let n = 0;
	for (let i = 0; i < settlement.structures.length; i++) {
		if (settlement.structures[i].defId === defId) n += 1;
	}
	return n;
};

Space4x.agriPotential = function (state, body) {
	const set = Space4x.settingOf(state);
	if (!body || body.kind !== "rocky") return 0;
	return set.agriSlots[body.size] || 0;
};

Space4x.agriSlots = function (state, body) {
	const set = Space4x.settingOf(state);
	if (!body || body.kind !== "rocky") return 0;
	if (set.noAgriBiomes[body.biome]) return 0;
	return Space4x.agriPotential(state, body);
};

Space4x.jobCap = function (state, settlement, job) {
	const set = Space4x.settingOf(state);
	const spec = set.jobs[job];
	if (!spec || spec.cap === "uncapped") return Infinity;
	if (spec.cap === "fromBuildings") return Space4x.structureJobSlots(state, settlement, job);
	if (spec.cap === "agri") {
		const body = Space4x.bodyById(state, settlement.location.bodyId);
		return Math.max(0, Space4x.agriSlots(state, body) + Space4x.structureCapDelta(state, settlement, "agri"));
	}
	return Infinity;
};

Space4x.empireHasTech = function (empire, techId) {
	if (!empire || !techId) return false;
	const ids = empire.research.completedTechIds || [];
	for (let i = 0; i < ids.length; i++) {
		if (ids[i] === techId) return true;
	}
	return false;
};

Space4x.categoryTierOf = function (empire, categoryId) {
	if (!empire || !empire.research || !empire.research.categoryTier) return 0;
	const n = empire.research.categoryTier[categoryId];
	return n == null ? 0 : n;
};

Space4x.empireHasWarp = function (state, empire) {
	const id = Space4x.settingOf(state).warpTechId;
	if (!id) return true;
	return Space4x.empireHasTech(empire, id);
};

Space4x.canLeaveSystem = function (state, empire, fromStarId, toStarId) {
	if (!toStarId || fromStarId === toStarId) return true;
	return Space4x.empireHasWarp(state, empire);
};

Space4x.canSettleBody = function (state, empire, body) {
	if (!body) return false;
	if (body.kind !== "rocky" && body.kind !== "asteroidBelt" && body.kind !== "gasGiant") return false;
	if (!body.settlePrerequisite) return body.kind === "rocky";
	return !!(empire && Space4x.empireHasTech(empire, body.settlePrerequisite));
};

Space4x.unitLabel = function (state, unit) {
	if (Space4x.isPopHauler(state, unit)) return "Freighter";
	if (Space4x.isTroopHauler(state, unit)) return "Troop transport";
	const def = Space4x.settingOf(state).builds[unit.defId];
	return def ? def.name : unit.defId;
};

Space4x.unitModuleNames = function (unit) {
	const mods = unit && unit.modules ? unit.modules : [];
	const names = [];
	for (let i = 0; i < mods.length; i++) names.push(mods[i].name || mods[i].id);
	return names;
};

Space4x.unitPlaceLabel = function (state, unit) {
	let cargo = "";
	if (Space4x.isPopHauler(state, unit)) {
		const n = (unit.cargoPops || []).length;
		const to = Space4x.settlementById(state, unit.destSettlementId);
		cargo = n + " " + Space4x.peopleWord(n) + (to ? " → " + to.name : "") + " — ";
	}
	if (Space4x.isTroopHauler(state, unit)) {
		const n = (unit.cargoTroops || []).length;
		const to = Space4x.settlementById(state, unit.destSettlementId);
		cargo = n + " troop" + (n === 1 ? "" : "s") + (to ? " → " + to.name : "") + " — ";
	}
	const extras = Space4x.unitModuleNames(unit);
	const extra = extras.length ? " · " + extras.join(", ") : "";
	if (unit.location.kind === "orbit") {
		const star = Space4x.starById(state, unit.location.starId);
		let text = cargo + (star ? "orbit · " + star.name : "orbit");
		if (unit.targetStarId) {
			const dest = Space4x.starById(state, unit.targetStarId);
			if (dest && dest.id !== unit.location.starId) text += " → " + dest.name;
		}
		return text + extra;
	}
	if (unit.location.kind === "settlement") {
		const st = Space4x.settlementById(state, unit.location.settlementId);
		let text = cargo + (st ? "docked · " + st.name : "docked");
		if (unit.targetStarId) {
			const dest = Space4x.starById(state, unit.targetStarId);
			if (dest) text += " → " + dest.name;
		}
		return text + extra;
	}
	return cargo + "space (" + Space4x.fmtCoord(unit.location.x) + ", " + Space4x.fmtCoord(unit.location.y) + ")" + extra;
};

Space4x.fmtPercent = function (n) {
	const r = Math.round(n * 10) / 10;
	if (Math.abs(r - Math.round(r)) < 1e-6) return String(Math.round(r));
	return r.toFixed(1);
};

Space4x.fmtCoord = function (n) {
	if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
	return (Math.round(n * 10) / 10).toFixed(1);
};

Space4x.friendlyStars = function (state, empireId) {
	const seen = {};
	const out = [];
	function addStar(sid) {
		if (!sid || seen[sid]) return;
		seen[sid] = true;
		const star = Space4x.starById(state, sid);
		if (star) out.push(star);
	}
	const list = Space4x.settlementsOf(state, empireId);
	for (let i = 0; i < list.length; i++) addStar(list[i].location.starId);
	const me = Space4x.empireById(state, empireId);
	if (!me) return out;
	for (let i = 0; i < state.empires.length; i++) {
		const other = state.empires[i];
		if (other.id === empireId) continue;
		if (!Space4x.hasTreaty(me, other, "passage")) continue;
		const homes = Space4x.settlementsOf(state, other.id);
		for (let h = 0; h < homes.length; h++) addStar(homes[h].location.starId);
	}
	return out;
};

Space4x.nearestFriendlyStar = function (state, empireId, x, y) {
	const stars = Space4x.friendlyStars(state, empireId);
	let best = null;
	let bestD = Infinity;
	for (let i = 0; i < stars.length; i++) {
		const d = Space4x.dist(x, y, stars[i].x, stars[i].y);
		if (d < bestD) {
			bestD = d;
			best = stars[i];
		}
	}
	return best;
};

Space4x.shipStats = function (state, empire) {
	const set = Space4x.settingOf(state);
	return {
		speed: set.baseline.speed + (empire.modifiers.speed || 0),
		range: set.baseline.range + (empire.modifiers.range || 0)
	};
};

Space4x.commsRangeOf = function (state, empire) {
	const stats = Space4x.shipStats(state, empire);
	return stats.range + ((empire && empire.modifiers && empire.modifiers.commsRange) || 0);
};

Space4x.inCommsRangeOfEmpire = function (state, empireId, x, y) {
	const empire = Space4x.empireById(state, empireId);
	const reach = Space4x.commsRangeOf(state, empire);
	const stars = Space4x.friendlyStars(state, empireId);
	for (let i = 0; i < stars.length; i++) {
		if (Space4x.dist(x, y, stars[i].x, stars[i].y) <= reach + 1e-9) return true;
	}
	return false;
};

Space4x.inRangeOfEmpire = function (state, empireId, x, y) {
	const empire = Space4x.empireById(state, empireId);
	const stats = Space4x.shipStats(state, empire);
	const stars = Space4x.friendlyStars(state, empireId);
	for (let i = 0; i < stars.length; i++) {
		if (Space4x.dist(x, y, stars[i].x, stars[i].y) <= stats.range + 1e-9) return true;
	}
	return false;
};

Space4x.richnessOf = function (state, body) {
	const normal = { id: "normal", name: "Normal", industryPerPop: 0 };
	if (!body || (body.kind !== "rocky" && body.kind !== "asteroidBelt")) return normal;
	const set = Space4x.settingOf(state);
	const lists = [];
	if (body.kind === "asteroidBelt" && set.asteroidRichness) lists.push(set.asteroidRichness);
	if (set.richness) lists.push(set.richness);
	const id = body.richness || "normal";
	for (let L = 0; L < lists.length; L++) {
		const list = lists[L];
		for (let i = 0; i < list.length; i++) {
			if (list[i].id === id) return list[i];
		}
	}
	return normal;
};

Space4x.shipHasLeft = function (unit) {
	return !!(unit && unit.location && unit.location.kind === "space");
};

Space4x.shipCanTakeOrders = function (state, unit) {
	return !!(unit && !Space4x.isHauler(state, unit) && !Space4x.shipHasLeft(unit));
};

Space4x.unitIsSelected = function (state, id) {
	if (state.ui.selectedUnitId === id) return true;
	const ids = state.ui.selectedUnitIds || [];
	for (let i = 0; i < ids.length; i++) {
		if (ids[i] === id) return true;
	}
	return false;
};

Space4x.addSelectedUnit = function (state, id) {
	if (!id) return;
	if (!state.ui.selectedUnitIds) state.ui.selectedUnitIds = [];
	const ids = state.ui.selectedUnitIds;
	let found = false;
	for (let i = 0; i < ids.length; i++) {
		if (ids[i] === id) found = true;
	}
	if (!found) ids.push(id);
	state.ui.selectedUnitId = id;
};

Space4x.removeSelectedUnit = function (state, id) {
	const ids = state.ui.selectedUnitIds || [];
	const keep = [];
	for (let i = 0; i < ids.length; i++) {
		if (ids[i] !== id) keep.push(ids[i]);
	}
	state.ui.selectedUnitIds = keep;
	if (state.ui.selectedUnitId === id) {
		state.ui.selectedUnitId = keep.length ? keep[keep.length - 1] : null;
	}
};

Space4x.pruneShipSelection = function (state) {
	const player = Space4x.playerEmpire(state);
	const keep = [];
	const ids = state.ui.selectedUnitIds || [];
	for (let i = 0; i < ids.length; i++) {
		const unit = Space4x.unitById(state, ids[i]);
		if (!unit) continue;
		if (player && unit.empireId !== player.id) continue;
		keep.push(unit.id);
	}
	state.ui.selectedUnitIds = keep;
	const cur = Space4x.unitById(state, state.ui.selectedUnitId);
	if (!cur) state.ui.selectedUnitId = keep.length ? keep[keep.length - 1] : null;
};

Space4x.clearSelectedUnits = function (state) {
	state.ui.selectedUnitIds = [];
	state.ui.selectedUnitId = null;
};

Space4x.orderableSelectedIds = function (state) {
	Space4x.pruneShipSelection(state);
	const ids = state.ui.selectedUnitIds || [];
	const out = [];
	for (let i = 0; i < ids.length; i++) {
		const unit = Space4x.unitById(state, ids[i]);
		if (unit && Space4x.shipCanTakeOrders(state, unit)) out.push(unit.id);
	}
	return out;
};

Space4x.selectedUnits = function (state) {
	Space4x.pruneShipSelection(state);
	const seen = {};
	const out = [];
	function add(id) {
		if (!id || seen[id]) return;
		const unit = Space4x.unitById(state, id);
		if (!unit) return;
		seen[id] = true;
		out.push(unit);
	}
	const ids = state.ui.selectedUnitIds || [];
	for (let i = 0; i < ids.length; i++) add(ids[i]);
	add(state.ui.selectedUnitId);
	return out;
};

Space4x.emptyLegalBodies = function (state, star, empireId) {
	const empire = empireId ? Space4x.empireById(state, empireId) : null;
	const out = [];
	for (let i = 0; i < star.bodies.length; i++) {
		const body = star.bodies[i];
		if (!Space4x.canSettleBody(state, empire, body)) continue;
		let taken = false;
		for (let j = 0; j < state.settlements.length; j++) {
			if (state.settlements[j].location.bodyId === body.id) taken = true;
		}
		if (!taken) out.push(body);
	}
	return out;
};

Space4x.eachEmpireStructureEffect = function (state, empireId, fn) {
	const homes = Space4x.settlementsOf(state, empireId);
	for (let i = 0; i < homes.length; i++) {
		Space4x.eachStructureEffect(state, homes[i], fn);
	}
};

Space4x.empireHasGalaxyScan = function (state, empireId) {
	let found = false;
	Space4x.eachEmpireStructureEffect(state, empireId, function (def, fx) {
		if (fx.type === "galaxyScan") found = true;
	});
	return found;
};

Space4x.starIsExplored = function (state, empireId, starId) {
	if (!state.hideUnvisitedSystems) return true;
	if (Space4x.empireHasGalaxyScan(state, empireId)) return true;
	const empire = Space4x.empireById(state, empireId);
	if (!empire) return false;
	const ids = empire.exploredStarIds || [];
	for (let i = 0; i < ids.length; i++) {
		if (ids[i] === starId) return true;
	}
	return false;
};

Space4x.markStarExplored = function (state, empireId, starId) {
	if (!empireId || !starId) return;
	const empire = Space4x.empireById(state, empireId);
	if (!empire) return;
	if (!empire.exploredStarIds) empire.exploredStarIds = [];
	for (let i = 0; i < empire.exploredStarIds.length; i++) {
		if (empire.exploredStarIds[i] === starId) return;
	}
	empire.exploredStarIds.push(starId);
};

Space4x.settlementOnBody = function (state, bodyId) {
	for (let i = 0; i < state.settlements.length; i++) {
		if (state.settlements[i].location.bodyId === bodyId) return state.settlements[i];
	}
	return null;
};

Space4x.unitsInOrbit = function (state, starId) {
	const out = [];
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.location.kind === "orbit" && u.location.starId === starId) out.push(u);
	}
	return out;
};

Space4x.unitsDockedAt = function (state, settlementId) {
	const out = [];
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.location.kind === "settlement" && u.location.settlementId === settlementId) out.push(u);
	}
	return out;
};

Space4x.foundingShipsAtStar = function (state, empireId, starId) {
	const out = [];
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.empireId !== empireId || !Space4x.unitCanFound(state, u)) continue;
		if (u.location.kind === "orbit" && u.location.starId === starId) {
			out.push(u);
			continue;
		}
		if (u.location.kind === "settlement") {
			const st = Space4x.settlementById(state, u.location.settlementId);
			if (st && st.location.starId === starId) out.push(u);
		}
	}
	return out;
};

Space4x.unitStarId = function (state, unit) {
	if (!unit) return null;
	if (unit.location.kind === "orbit") return unit.location.starId;
	if (unit.location.kind === "settlement") {
		const st = Space4x.settlementById(state, unit.location.settlementId);
		return st ? st.location.starId : unit.location.starId;
	}
	return null;
};

Space4x.shipsAtStar = function (state, starId) {
	const out = Space4x.unitsInOrbit(state, starId).slice();
	for (let i = 0; i < state.settlements.length; i++) {
		const st = state.settlements[i];
		if (st.location.starId !== starId) continue;
		const docked = Space4x.unitsDockedAt(state, st.id);
		for (let j = 0; j < docked.length; j++) out.push(docked[j]);
	}
	return out;
};

Space4x.unitVisibleTo = function (state, viewerId, unit) {
	if (!unit || !viewerId) return false;
	if (unit.empireId === viewerId) return true;
	if (Space4x.empireHasGalaxyScan(state, viewerId)) return true;
	const starId = Space4x.unitStarId(state, unit);
	if (starId && Space4x.starIsExplored(state, viewerId, starId)) return true;
	return Space4x.inRangeOfEmpire(state, viewerId, unit.location.x, unit.location.y);
};

Space4x.starHasEmpireSettlement = function (state, starId, empireId) {
	for (let i = 0; i < state.settlements.length; i++) {
		const st = state.settlements[i];
		if (st.location.starId === starId && st.empireId === empireId) return true;
	}
	return false;
};

Space4x.techById = function (state, id) {
	const techs = Space4x.settingOf(state).techs;
	for (let i = 0; i < techs.length; i++) {
		if (techs[i].id === id) return techs[i];
	}
	return null;
};

Space4x.availableTechs = function (state, empire, categoryId) {
	const tier = Space4x.categoryTierOf(empire, categoryId);
	const techs = Space4x.settingOf(state).techs;
	const out = [];
	for (let i = 0; i < techs.length; i++) {
		const tech = techs[i];
		if (tech.categoryId !== categoryId || tech.tier !== tier) continue;
		if (Space4x.empireHasTech(empire, tech.id)) continue;
		out.push(tech);
	}
	return out;
};

Space4x.availableTech = function (state, empire, categoryId) {
	const list = Space4x.availableTechs(state, empire, categoryId);
	return list.length ? list[0] : null;
};

Space4x.techTiersInCategory = function (state, categoryId) {
	const techs = Space4x.techsInCategory(state, categoryId);
	const order = [];
	const map = {};
	for (let i = 0; i < techs.length; i++) {
		const t = techs[i];
		if (!map[t.tier]) {
			map[t.tier] = { id: "T" + t.tier, tier: t.tier, techs: [] };
			order.push(map[t.tier]);
		}
		map[t.tier].techs.push(t);
	}
	return order;
};

Space4x.minTechTier = function (state) {
	const techs = Space4x.settingOf(state).techs;
	let min = 0;
	let any = false;
	for (let i = 0; i < techs.length; i++) {
		if (!any || techs[i].tier < min) {
			min = techs[i].tier;
			any = true;
		}
	}
	return min;
};

Space4x.maxTechTier = function (state) {
	const techs = Space4x.settingOf(state).techs;
	let max = 0;
	for (let i = 0; i < techs.length; i++) {
		if (techs[i].tier > max) max = techs[i].tier;
	}
	return max;
};
