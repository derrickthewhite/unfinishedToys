var Space4x = Space4x || {};

Space4x.PACTS = ["peace", "trade", "research", "passage", "stopSpies"];

Space4x.pactLabel = function (id) {
	if (id === "peace") return "Peace";
	if (id === "trade") return "Trade treaty";
	if (id === "research") return "Research treaty";
	if (id === "passage") return "Free passage";
	if (id === "stopSpies") return "Stop spying";
	return id;
};

Space4x.emptyDraft = function () {
	return { give: [], want: [], pacts: [] };
};

Space4x.empireHasDiplomacy = function (state, empire) {
	let ok = false;
	Space4x.eachEmpireTechEffect(state, empire, function (tech, fx) {
		if (fx.type === "diplomacy") ok = true;
	});
	return ok;
};

Space4x.ensureRelation = function (empire, otherId) {
	if (!empire || !otherId || empire.id === otherId) return null;
	if (!empire.relations) empire.relations = {};
	if (!empire.relations[otherId]) {
		empire.relations[otherId] = {
			war: false,
			trade: false,
			research: false,
			passage: false,
			stopSpies: false,
			attitude: 0,
			contacted: false,
			met: false
		};
	}
	return empire.relations[otherId];
};

Space4x.relationOf = function (empire, otherId) {
	return Space4x.ensureRelation(empire, otherId);
};

Space4x.atWar = function (a, b) {
	if (!a || !b || a.id === b.id) return false;
	const rel = a.relations && a.relations[b.id];
	return !!(rel && rel.war);
};

Space4x.hasTreaty = function (a, b, id) {
	if (!a || !b || a.id === b.id) return false;
	const rel = a.relations && a.relations[b.id];
	return !!(rel && rel[id]);
};

Space4x.clampAttitude = function (n) {
	if (n > 100) return 100;
	if (n < -100) return -100;
	return Math.round(n);
};

Space4x.addAttitude = function (empire, otherId, delta) {
	const rel = Space4x.ensureRelation(empire, otherId);
	if (!rel || !delta) return;
	rel.attitude = Space4x.clampAttitude((rel.attitude || 0) + delta);
};

Space4x.contactedEmpires = function (state, viewer) {
	const out = [];
	if (!viewer) return out;
	for (let i = 0; i < state.empires.length; i++) {
		const e = state.empires[i];
		if (e.id === viewer.id) continue;
		if (!Space4x.inContactWithEmpire(state, viewer.id, e.id)) continue;
		out.push(e);
	}
	out.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
	return out;
};

Space4x.phaseFirstContact = function (state) {
	const player = Space4x.playerEmpire(state);
	for (let i = 0; i < state.empires.length; i++) {
		for (let j = i + 1; j < state.empires.length; j++) {
			const a = state.empires[i];
			const b = state.empires[j];
			const ra = Space4x.ensureRelation(a, b.id);
			const rb = Space4x.ensureRelation(b, a.id);
			const now = Space4x.inContactWithEmpire(state, a.id, b.id);
			const was = !!(ra.contacted && rb.contacted);
			if (now === was) continue;
			ra.contacted = now;
			rb.contacted = now;
			if (!player || (a.id !== player.id && b.id !== player.id)) continue;
			const them = a.id === player.id ? b : a;
			const who = Space4x.cultureName(state, them.cultureId);
			const label = them.name + (who ? " (" + who + ")" : "");
			if (!now) {
				state.turnLog.push("Lost contact with " + label + ".");
				continue;
			}
			const first = !ra.met && !rb.met;
			ra.met = true;
			rb.met = true;
			if (first) state.turnLog.push("First contact with " + label + ". They welcome you.");
			else state.turnLog.push(label + " is in contact again. They welcome you.");
			if (!state.turnEvents) state.turnEvents = {};
			if (!state.turnEvents.firstContactIds) state.turnEvents.firstContactIds = [];
			if (state.turnEvents.firstContactIds.indexOf(them.id) < 0) {
				state.turnEvents.firstContactIds.push(them.id);
			}
		}
	}
};

Space4x.setPairFlag = function (a, b, key, value) {
	const ra = Space4x.ensureRelation(a, b.id);
	const rb = Space4x.ensureRelation(b, a.id);
	if (ra) ra[key] = !!value;
	if (rb) rb[key] = !!value;
};

Space4x.clearTreaties = function (a, b) {
	Space4x.setPairFlag(a, b, "trade", false);
	Space4x.setPairFlag(a, b, "research", false);
	Space4x.setPairFlag(a, b, "passage", false);
	Space4x.setPairFlag(a, b, "stopSpies", false);
};

Space4x.dropOffersBetween = function (state, aId, bId) {
	if (!state.offers) return;
	const keep = [];
	for (let i = 0; i < state.offers.length; i++) {
		const o = state.offers[i];
		const pair = (o.fromId === aId && o.toId === bId) || (o.fromId === bId && o.toId === aId);
		if (!pair) keep.push(o);
	}
	state.offers = keep;
};

Space4x.forgetEmpireDiplomacy = function (state, empireId) {
	if (!state.offers) state.offers = [];
	state.offers = state.offers.filter(function (o) {
		return o.fromId !== empireId && o.toId !== empireId;
	});
	for (let i = 0; i < state.empires.length; i++) {
		const e = state.empires[i];
		if (e.relations) delete e.relations[empireId];
	}
};

Space4x.offerBetween = function (state, fromId, toId) {
	const list = state.offers || [];
	for (let i = 0; i < list.length; i++) {
		if (list[i].fromId === fromId && list[i].toId === toId) return list[i];
	}
	return null;
};

Space4x.offerTo = function (state, toId, fromId) {
	const list = state.offers || [];
	for (let i = 0; i < list.length; i++) {
		if (list[i].toId === toId && (!fromId || list[i].fromId === fromId)) return list[i];
	}
	return null;
};

Space4x.spiesOnEmpire = function (state, attacker, victimId) {
	const spies = Space4x.empireSpies(attacker);
	let n = 0;
	for (let i = 0; i < spies.length; i++) {
		const post = Space4x.parseSpyPost(spies[i].post);
		if (post.kind === "empire" && post.empireId === victimId) n += 1;
		if (post.kind === "settlement") {
			const st = Space4x.settlementById(state, post.settlementId);
			if (st && st.empireId === victimId) n += 1;
		}
	}
	return n;
};

Space4x.idleSpiesOnEmpire = function (state, attacker, victimId) {
	const spies = Space4x.empireSpies(attacker);
	for (let i = 0; i < spies.length; i++) {
		const post = Space4x.parseSpyPost(spies[i].post);
		let hit = false;
		if (post.kind === "empire" && post.empireId === victimId) hit = true;
		if (post.kind === "settlement") {
			const st = Space4x.settlementById(state, post.settlementId);
			if (st && st.empireId === victimId) hit = true;
		}
		if (hit) spies[i].post = "idle";
	}
};

Space4x.declareWar = function (state, fromId, toId) {
	const a = Space4x.empireById(state, fromId);
	const b = Space4x.empireById(state, toId);
	if (!a || !b || a.id === b.id) return false;
	if (!Space4x.inContactWithEmpire(state, a.id, b.id)) return false;
	if (Space4x.atWar(a, b)) return false;
	Space4x.setPairFlag(a, b, "war", true);
	Space4x.clearTreaties(a, b);
	Space4x.dropOffersBetween(state, a.id, b.id);
	Space4x.addAttitude(a, b.id, -30);
	Space4x.addAttitude(b, a.id, -40);
	state.turnLog.push(a.name + " declared war on " + b.name + ".");
	return true;
};

Space4x.makePeace = function (state, a, b) {
	if (!Space4x.atWar(a, b)) return;
	Space4x.setPairFlag(a, b, "war", false);
	Space4x.addAttitude(a, b.id, 10);
	Space4x.addAttitude(b, a.id, 10);
	state.turnLog.push(a.name + " and " + b.name + " made peace.");
};

Space4x.signTreaty = function (state, a, b, id) {
	if (id === "peace" || id === "war") return;
	if (Space4x.atWar(a, b)) return;
	Space4x.setPairFlag(a, b, id, true);
	if (id === "stopSpies") {
		Space4x.idleSpiesOnEmpire(state, a, b.id);
		Space4x.idleSpiesOnEmpire(state, b, a.id);
	}
	state.turnLog.push(a.name + " and " + b.name + " signed a " + Space4x.pactLabel(id).toLowerCase() + ".");
};

Space4x.producedResearch = function (state, empire) {
	if (!empire) return 0;
	let n = 0;
	const homes = Space4x.settlementsOf(state, empire.id);
	for (let i = 0; i < homes.length; i++) {
		n += Space4x.produceSettlement(state, homes[i], empire).research;
	}
	return n;
};

Space4x.producedMoney = function (state, empire) {
	if (!empire) return 0;
	let n = 0;
	const homes = Space4x.settlementsOf(state, empire.id);
	for (let i = 0; i < homes.length; i++) {
		n += Space4x.produceSettlement(state, homes[i], empire).money;
	}
	return n;
};

Space4x.researchAligned = function (you, them) {
	const pid = you && you.research ? you.research.currentProjectId : null;
	if (!pid || !them) return false;
	if (them.research && them.research.currentProjectId === pid) return true;
	return Space4x.empireHasTech(them, pid);
};

Space4x.researchTreatyPreview = function (state, empire) {
	if (!empire) return { share: 0, overlap: 0, total: 0, lines: [] };
	const own = Space4x.producedResearch(state, empire);
	let share = 0;
	let overlap = 0;
	const lines = [];
	for (let i = 0; i < state.empires.length; i++) {
		const other = state.empires[i];
		if (other.id === empire.id) continue;
		if (!Space4x.hasTreaty(empire, other, "research")) continue;
		const part = Math.floor(Space4x.producedResearch(state, other) * 0.2);
		share += part;
		if (part) lines.push(other.name + " share +" + part);
		if (Space4x.researchAligned(empire, other)) {
			const extra = Math.floor(own * 0.25);
			overlap += extra;
			if (extra) lines.push(other.name + " overlap +" + extra + " (" + (other.research.currentProjectId === empire.research.currentProjectId ? "same project" : "they already have it") + ")");
		}
	}
	return { share: share, overlap: overlap, total: share + overlap, lines: lines };
};

Space4x.tradeTreatyPreview = function (state, empire) {
	if (!empire) return { total: 0, lines: [] };
	let total = 0;
	const lines = [];
	for (let i = 0; i < state.empires.length; i++) {
		const other = state.empires[i];
		if (other.id === empire.id) continue;
		if (!Space4x.hasTreaty(empire, other, "trade")) continue;
		const n = Space4x.moneyRound(Space4x.producedMoney(state, other) * 0.2);
		total = Space4x.moneyRound(total + n);
		if (n) lines.push(other.name + " trade +" + Space4x.fmtMoney(n));
	}
	return { total: total, lines: lines };
};

Space4x.phaseDiplomacyYields = function (state) {
	for (let i = 0; i < state.empires.length; i++) {
		const empire = state.empires[i];
		const trade = Space4x.tradeTreatyPreview(state, empire);
		if (trade.total) {
			empire.stockpiles.money = Space4x.moneyRound((empire.stockpiles.money || 0) + trade.total);
			state.turnLog.push(empire.name + " gained " + Space4x.fmtMoney(trade.total) + " money from trade treaties.");
		}
		const sci = Space4x.researchTreatyPreview(state, empire);
		if (sci.total && empire.research && empire.research.currentProjectId) {
			empire._pendingResearch = (empire._pendingResearch || 0) + sci.total;
			state.turnLog.push(empire.name + " gained " + sci.total + " research from treaties.");
		} else if (sci.total) {
			state.turnLog.push(empire.name + " had no project to receive " + sci.total + " treaty research.");
		}
	}
};

Space4x.phaseSpyTreaties = function (state) {
	for (let i = 0; i < state.empires.length; i++) {
		const a = state.empires[i];
		for (let j = i + 1; j < state.empires.length; j++) {
			const b = state.empires[j];
			if (!Space4x.hasTreaty(a, b, "stopSpies")) continue;
			const aOnB = Space4x.spiesOnEmpire(state, a, b.id);
			const bOnA = Space4x.spiesOnEmpire(state, b, a.id);
			if (!aOnB && !bOnA) continue;
			Space4x.setPairFlag(a, b, "stopSpies", false);
			if (aOnB) {
				Space4x.addAttitude(b, a.id, -15);
				state.turnLog.push(a.name + " broke the spy ban with " + b.name + ".");
			}
			if (bOnA) {
				Space4x.addAttitude(a, b.id, -15);
				state.turnLog.push(b.name + " broke the spy ban with " + a.name + ".");
			}
		}
	}
};

Space4x.giftableShips = function (state, empireId) {
	const out = [];
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.empireId !== empireId || Space4x.isHauler(u)) continue;
		out.push(u);
	}
	return out;
};

Space4x.largestSettlement = function (state, empireId) {
	const homes = Space4x.settlementsOf(state, empireId);
	let best = null;
	for (let i = 0; i < homes.length; i++) {
		if (!best || homes[i].pops.length > best.pops.length) best = homes[i];
	}
	return best;
};

Space4x.clauseLabel = function (state, clause) {
	if (!clause) return "";
	if (clause.type === "money") return Space4x.fmtMoney(clause.n) + " money";
	if (clause.type === "settlement") {
		const st = Space4x.settlementById(state, clause.settlementId);
		return st ? st.name : "a world";
	}
	if (clause.type === "ship") {
		const u = Space4x.unitById(state, clause.unitId);
		return u ? Space4x.unitLabel(state, u) : "a ship";
	}
	if (clause.type === "troops") {
		const def = Space4x.settingOf(state).builds[clause.defId];
		const name = def ? def.name : clause.defId;
		const who = clause.culture ? " " + Space4x.cultureName(state, clause.culture) : "";
		const st = Space4x.settlementById(state, clause.settlementId);
		return (clause.n || 1) + " " + name + who + (st ? " at " + st.name : "");
	}
	return clause.type;
};

Space4x.packageSummary = function (state, offer) {
	const bits = [];
	const pacts = offer.pacts || [];
	for (let i = 0; i < pacts.length; i++) bits.push(Space4x.pactLabel(pacts[i]));
	const give = offer.give || [];
	for (let i = 0; i < give.length; i++) bits.push("gives " + Space4x.clauseLabel(state, give[i]));
	const want = offer.want || [];
	for (let i = 0; i < want.length; i++) bits.push("wants " + Space4x.clauseLabel(state, want[i]));
	return bits.length ? bits.join("; ") : "an empty deal";
};

Space4x.clauseValid = function (state, giver, receiver, clause) {
	if (!giver || !receiver || !clause) return false;
	if (clause.type === "money") {
		const n = Space4x.moneyRound(clause.n);
		return n > 0 && Space4x.moneyRound(giver.stockpiles.money || 0) >= n;
	}
	if (clause.type === "settlement") {
		const st = Space4x.settlementById(state, clause.settlementId);
		if (!st || st.empireId !== giver.id) return false;
		return Space4x.settlementsOf(state, giver.id).length > 1;
	}
	if (clause.type === "ship") {
		const u = Space4x.unitById(state, clause.unitId);
		return !!(u && u.empireId === giver.id && !Space4x.isHauler(u));
	}
	if (clause.type === "troops") {
		const st = Space4x.settlementById(state, clause.settlementId);
		if (!st || st.empireId !== giver.id) return false;
		if (!Space4x.largestSettlement(state, receiver.id)) return false;
		return Space4x.countTroops(st, clause.defId, clause.culture) >= (clause.n || 0) && (clause.n || 0) > 0;
	}
	return false;
};

Space4x.packageValid = function (state, from, to, offer) {
	if (!from || !to || !offer) return false;
	if (!Space4x.inContactWithEmpire(state, from.id, to.id)) return false;
	if (!Space4x.empireHasDiplomacy(state, from) || !Space4x.empireHasDiplomacy(state, to)) return false;
	const pacts = offer.pacts || [];
	const give = offer.give || [];
	const want = offer.want || [];
	if (!pacts.length && !give.length && !want.length) return false;
	let peace = false;
	for (let i = 0; i < pacts.length; i++) {
		if (Space4x.PACTS.indexOf(pacts[i]) < 0) return false;
		if (pacts[i] === "peace") peace = true;
	}
	if (Space4x.atWar(from, to)) {
		if (!peace) return false;
	} else if (peace) return false;
	for (let i = 0; i < give.length; i++) {
		if (!Space4x.clauseValid(state, from, to, give[i])) return false;
	}
	for (let i = 0; i < want.length; i++) {
		if (!Space4x.clauseValid(state, to, from, want[i])) return false;
	}
	return true;
};

Space4x.transferSettlement = function (state, settlement, toEmpire) {
	if (!settlement || !toEmpire) return;
	settlement.empireId = toEmpire.id;
	Space4x.markStarExplored(state, toEmpire.id, settlement.location.starId);
	for (let i = 0; i < state.empires.length; i++) {
		Space4x.bounceInvalidSpies(state, state.empires[i]);
	}
};

Space4x.transferShip = function (state, unit, toEmpire) {
	if (!unit || !toEmpire) return;
	unit.empireId = toEmpire.id;
	unit.targetStarId = null;
	Space4x.fitShipModules(state, toEmpire);
};

Space4x.transferTroops = function (state, clause, toEmpire) {
	const from = Space4x.settlementById(state, clause.settlementId);
	const dest = Space4x.largestSettlement(state, toEmpire.id);
	if (!from || !dest) return;
	const taken = Space4x.takeTroopsForMove(from, clause.defId, clause.n, clause.culture);
	if (!dest.troops) dest.troops = [];
	for (let i = 0; i < taken.length; i++) dest.troops.push(taken[i]);
};

Space4x.applyClause = function (state, giver, receiver, clause) {
	if (clause.type === "money") {
		const n = Space4x.moneyRound(clause.n);
		giver.stockpiles.money = Space4x.moneyRound((giver.stockpiles.money || 0) - n);
		receiver.stockpiles.money = Space4x.moneyRound((receiver.stockpiles.money || 0) + n);
		state.turnLog.push(giver.name + " transferred " + Space4x.fmtMoney(n) + " money to " + receiver.name + ".");
		return;
	}
	if (clause.type === "settlement") {
		const st = Space4x.settlementById(state, clause.settlementId);
		if (!st) return;
		Space4x.transferSettlement(state, st, receiver);
		state.turnLog.push(giver.name + " ceded " + st.name + " to " + receiver.name + ".");
		return;
	}
	if (clause.type === "ship") {
		const u = Space4x.unitById(state, clause.unitId);
		if (!u) return;
		const name = Space4x.unitLabel(state, u);
		Space4x.transferShip(state, u, receiver);
		state.turnLog.push(giver.name + " transferred " + name + " to " + receiver.name + ".");
		return;
	}
	if (clause.type === "troops") {
		Space4x.transferTroops(state, clause, receiver);
		state.turnLog.push(giver.name + " transferred " + Space4x.clauseLabel(state, clause) + " to " + receiver.name + ".");
	}
};

Space4x.clauseValue = function (state, clause) {
	if (!clause) return 0;
	if (clause.type === "money") return clause.n || 0;
	if (clause.type === "settlement") {
		const st = Space4x.settlementById(state, clause.settlementId);
		return st ? 50 + st.pops.length * 8 : 40;
	}
	if (clause.type === "ship") {
		const u = Space4x.unitById(state, clause.unitId);
		const def = u ? Space4x.settingOf(state).builds[u.defId] : null;
		return def && def.cost && def.cost.industry ? def.cost.industry * 0.4 : 20;
	}
	if (clause.type === "troops") {
		const def = Space4x.settingOf(state).builds[clause.defId];
		const each = def && def.cost && def.cost.industry ? def.cost.industry : 10;
		return (clause.n || 0) * each * 0.5;
	}
	return 0;
};

Space4x.sortClauses = function (list) {
	const order = { money: 0, troops: 1, ship: 2, settlement: 3 };
	return (list || []).slice().sort(function (a, b) {
		return (order[a.type] != null ? order[a.type] : 9) - (order[b.type] != null ? order[b.type] : 9);
	});
};

Space4x.applyOffer = function (state, offer) {
	const from = Space4x.empireById(state, offer.fromId);
	const to = Space4x.empireById(state, offer.toId);
	if (!Space4x.packageValid(state, from, to, offer)) return false;
	const pacts = offer.pacts || [];
	for (let i = 0; i < pacts.length; i++) {
		if (pacts[i] === "peace") Space4x.makePeace(state, from, to);
	}
	for (let i = 0; i < pacts.length; i++) {
		if (pacts[i] !== "peace") Space4x.signTreaty(state, from, to, pacts[i]);
	}
	const give = Space4x.sortClauses(offer.give);
	for (let i = 0; i < give.length; i++) Space4x.applyClause(state, from, to, give[i]);
	const want = Space4x.sortClauses(offer.want);
	for (let i = 0; i < want.length; i++) Space4x.applyClause(state, to, from, want[i]);
	let netTo = 0;
	for (let i = 0; i < give.length; i++) netTo += Space4x.clauseValue(state, give[i]);
	for (let i = 0; i < want.length; i++) netTo -= Space4x.clauseValue(state, want[i]);
	const bump = Math.max(-20, Math.min(25, Math.round(netTo / 20)));
	if (bump) {
		Space4x.addAttitude(to, from.id, bump);
		Space4x.addAttitude(from, to.id, -Math.round(bump / 2));
	}
	return true;
};

Space4x.removeOffer = function (state, offerId) {
	if (!state.offers) return;
	state.offers = state.offers.filter(function (o) { return o.id !== offerId; });
};

Space4x.submitOffer = function (state, fromId, toId, draft) {
	const from = Space4x.empireById(state, fromId);
	const to = Space4x.empireById(state, toId);
	const offer = {
		id: Space4x.nextId(state, "d"),
		fromId: fromId,
		toId: toId,
		give: (draft && draft.give) ? draft.give.slice() : [],
		want: (draft && draft.want) ? draft.want.slice() : [],
		pacts: (draft && draft.pacts) ? draft.pacts.slice() : [],
		turn: state.turn
	};
	if (!Space4x.packageValid(state, from, to, offer)) return { ok: false, offer: offer };
	Space4x.dropOffersBetween(state, fromId, toId);
	if (to.isPlayer) {
		if (!state.offers) state.offers = [];
		state.offers.push(offer);
		state.turnLog.push(from.name + " sent an offer to " + to.name + ".");
		return { ok: true, pending: true, offer: offer };
	}
	if (!from.isPlayer && !to.isPlayer) {
		if (Space4x.aiAcceptsOffer(state, to, offer)) {
			Space4x.applyOffer(state, offer);
			state.turnLog.push(to.name + " accepted a deal from " + from.name + ".");
			return { ok: true, accepted: true, offer: offer };
		}
		Space4x.addAttitude(to, from.id, -3);
		state.turnLog.push(to.name + " refused a deal from " + from.name + ".");
		return { ok: true, accepted: false, offer: offer };
	}
	if (Space4x.aiAcceptsOffer(state, to, offer)) {
		Space4x.applyOffer(state, offer);
		state.turnLog.push(to.name + " accepted the offer.");
		return { ok: true, accepted: true, offer: offer };
	}
	Space4x.addAttitude(to, from.id, -3);
	state.turnLog.push(to.name + " refused the offer.");
	return { ok: true, accepted: false, offer: offer };
};

Space4x.acceptOffer = function (state, offerId, empireId) {
	const list = state.offers || [];
	let offer = null;
	for (let i = 0; i < list.length; i++) if (list[i].id === offerId) offer = list[i];
	if (!offer || offer.toId !== empireId) return false;
	const from = Space4x.empireById(state, offer.fromId);
	const to = Space4x.empireById(state, offer.toId);
	if (!Space4x.packageValid(state, from, to, offer)) {
		Space4x.removeOffer(state, offerId);
		state.turnLog.push("The offer from " + (from ? from.name : "a rival") + " is no longer valid.");
		return false;
	}
	Space4x.applyOffer(state, offer);
	Space4x.removeOffer(state, offerId);
	state.turnLog.push(to.name + " accepted the offer from " + from.name + ".");
	return true;
};

Space4x.refuseOffer = function (state, offerId, empireId) {
	const list = state.offers || [];
	let offer = null;
	for (let i = 0; i < list.length; i++) if (list[i].id === offerId) offer = list[i];
	if (!offer || offer.toId !== empireId) return false;
	const from = Space4x.empireById(state, offer.fromId);
	const to = Space4x.empireById(state, offer.toId);
	if (from && to) Space4x.addAttitude(from, to.id, -3);
	Space4x.removeOffer(state, offerId);
	state.turnLog.push((to ? to.name : "Someone") + " refused an offer from " + (from ? from.name : "a rival") + ".");
	return true;
};

Space4x.empirePower = function (state, empire) {
	if (!empire) return 0;
	let n = 0;
	const homes = Space4x.settlementsOf(state, empire.id);
	for (let i = 0; i < homes.length; i++) n += 8 + homes[i].pops.length;
	for (let i = 0; i < state.units.length; i++) {
		if (state.units[i].empireId === empire.id && !Space4x.isHauler(state.units[i])) n += 12;
	}
	n += (empire.stockpiles.money || 0) / 20;
	n += ((empire.research && empire.research.completedTechIds) || []).length * 4;
	return n;
};

Space4x.aiPactScore = function (state, me, them, pact) {
	if (pact === "peace") {
		const mine = Space4x.empirePower(state, me);
		const theirs = Space4x.empirePower(state, them);
		if (mine < theirs * 0.85) return 28;
		if (mine > theirs * 1.15) return -12;
		return 8;
	}
	if (pact === "trade") {
		const mine = Space4x.producedMoney(state, me);
		const theirs = Space4x.producedMoney(state, them);
		let score = 12 + (theirs - mine) * 0.2 * 6;
		if (mine > theirs * 1.3) score -= 22;
		return score;
	}
	if (pact === "research") {
		const mine = Space4x.producedResearch(state, me);
		const theirs = Space4x.producedResearch(state, them);
		let score = 12 + (theirs - mine) * 0.2 * 4;
		if (mine > theirs * 1.4) score -= 25;
		const myTechs = ((me.research && me.research.completedTechIds) || []).length;
		const theirTechs = ((them.research && them.research.completedTechIds) || []).length;
		if (myTechs > theirTechs + 1) score -= 10;
		return score;
	}
	if (pact === "passage") return 4;
	if (pact === "stopSpies") {
		const theySpy = Space4x.spiesOnEmpire(state, them, me.id);
		const iSpy = Space4x.spiesOnEmpire(state, me, them.id);
		return (theySpy ? 10 : 0) - (iSpy ? 6 : 0) + 2;
	}
	return 0;
};

Space4x.aiScoreOffer = function (state, me, offer) {
	const them = Space4x.empireById(state, offer.fromId === me.id ? offer.toId : offer.fromId);
	if (!them) return -999;
	const rel = Space4x.relationOf(me, them.id);
	const attitude = rel ? rel.attitude || 0 : 0;
	let score = attitude * 0.4;
	const incoming = offer.fromId === them.id ? (offer.give || []) : (offer.want || []);
	const outgoing = offer.fromId === them.id ? (offer.want || []) : (offer.give || []);
	for (let i = 0; i < incoming.length; i++) score += Space4x.clauseValue(state, incoming[i]) * 0.35;
	for (let i = 0; i < outgoing.length; i++) score -= Space4x.clauseValue(state, outgoing[i]) * 0.45;
	const pacts = offer.pacts || [];
	for (let i = 0; i < pacts.length; i++) score += Space4x.aiPactScore(state, me, them, pacts[i]);
	return score;
};

Space4x.aiAcceptsOffer = function (state, me, offer) {
	const them = Space4x.empireById(state, offer.fromId);
	if (!Space4x.packageValid(state, them, me, offer)) return false;
	const rel = Space4x.relationOf(me, them.id);
	const attitude = rel ? rel.attitude || 0 : 0;
	const need = 10 - attitude * 0.25;
	return Space4x.aiScoreOffer(state, me, offer) >= need;
};

Space4x.aiWantsWar = function (state, me, them) {
	if (Space4x.atWar(me, them)) return false;
	if (!Space4x.inContactWithEmpire(state, me.id, them.id)) return false;
	const rel = Space4x.relationOf(me, them.id);
	const attitude = rel ? rel.attitude || 0 : 0;
	if (attitude > -45) return false;
	return Space4x.empirePower(state, me) > Space4x.empirePower(state, them) * 1.15;
};

Space4x.aiWantsPeace = function (state, me, them) {
	if (!Space4x.atWar(me, them)) return false;
	const rel = Space4x.relationOf(me, them.id);
	const attitude = rel ? rel.attitude || 0 : 0;
	if (attitude >= -15) return true;
	return Space4x.empirePower(state, me) < Space4x.empirePower(state, them) * 0.85;
};

Space4x.dumbDiplomacy = function (state, empire) {
	if (!empire || empire.isPlayer) return;
	const rivals = Space4x.contactedEmpires(state, empire);
	for (let i = 0; i < rivals.length; i++) {
		const them = rivals[i];
		if (Space4x.aiWantsWar(state, empire, them)) {
			Space4x.declareWar(state, empire.id, them.id);
			continue;
		}
		if (!Space4x.empireHasDiplomacy(state, empire)) continue;
		if (!Space4x.empireHasDiplomacy(state, them)) continue;
		if (Space4x.offerBetween(state, empire.id, them.id) || Space4x.offerBetween(state, them.id, empire.id)) continue;
		const draft = Space4x.emptyDraft();
		if (Space4x.aiWantsPeace(state, empire, them)) draft.pacts.push("peace");
		if (!Space4x.atWar(empire, them) || draft.pacts.indexOf("peace") >= 0) {
			if (!Space4x.hasTreaty(empire, them, "trade") && Space4x.aiPactScore(state, empire, them, "trade") >= 4) {
				draft.pacts.push("trade");
			}
			if (!Space4x.hasTreaty(empire, them, "research") && Space4x.aiPactScore(state, empire, them, "research") >= 4) {
				draft.pacts.push("research");
			}
		}
		if (!draft.pacts.length) continue;
		const probe = {
			fromId: empire.id,
			toId: them.id,
			give: [],
			want: [],
			pacts: draft.pacts.slice()
		};
		if (!them.isPlayer && !Space4x.aiAcceptsOffer(state, them, probe) && draft.pacts.indexOf("peace") < 0) continue;
		Space4x.submitOffer(state, empire.id, them.id, draft);
	}
};
