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

Space4x.pactProposalLabel = function (id) {
	if (id === "peace") return "Propose peace (end the war)";
	if (id === "trade") return "Propose mutual trade treaty";
	if (id === "research") return "Propose mutual research treaty";
	if (id === "passage") return "Propose mutual free passage";
	if (id === "stopSpies") return "Propose mutual spy ban";
	return "Propose " + Space4x.pactLabel(id);
};

Space4x.activeTreatyLabels = function (a, b) {
	const out = [];
	if (Space4x.atWar(a, b)) out.push("At war");
	else {
		for (let i = 0; i < Space4x.PACTS.length; i++) {
			const id = Space4x.PACTS[i];
			if (id === "peace") continue;
			if (Space4x.hasTreaty(a, b, id)) out.push(Space4x.pactLabel(id));
		}
		if (!out.length) out.push("No treaties");
	}
	return out;
};

Space4x.empireForeignRelations = function (state, empire) {
	const out = [];
	if (!empire || !state) return out;
	for (let i = 0; i < state.empires.length; i++) {
		const other = state.empires[i];
		if (other.id === empire.id) continue;
		const rel = Space4x.relationOf(empire, other.id);
		if (!rel || !rel.contacted) continue;
		const bits = Space4x.activeTreatyLabels(empire, other);
		out.push({
			id: other.id,
			name: other.name,
			war: Space4x.atWar(empire, other),
			text: bits.join(", ")
		});
	}
	out.sort(function (a, b) {
		if (a.war !== b.war) return a.war ? -1 : 1;
		return (a.name || "").localeCompare(b.name || "");
	});
	return out;
};

Space4x.canProposePact = function (state, a, b, id) {
	if (!a || !b || a.id === b.id) return false;
	if (id === "peace") return Space4x.atWar(a, b);
	if (Space4x.atWar(a, b)) return false;
	return !Space4x.hasTreaty(a, b, id);
};

Space4x.filterProposedPacts = function (state, from, to, pacts) {
	const out = [];
	for (let i = 0; i < (pacts || []).length; i++) {
		const id = pacts[i];
		if (Space4x.canProposePact(state, from, to, id)) out.push(id);
	}
	return out;
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
	if (!a || !b) return false;
	const bId = typeof b === "string" ? b : b.id;
	if (!bId || a.id === bId) return false;
	const rel = a.relations && a.relations[bId];
	return !!(rel && rel.war);
};

Space4x.hasTreaty = function (a, b, id) {
	if (!a || !b) return false;
	const bId = typeof b === "string" ? b : b.id;
	if (!bId || a.id === bId) return false;
	const rel = a.relations && a.relations[bId];
	return !!(rel && rel[id]);
};

Space4x.clampAttitude = function (n) {
	if (n > 100) return 100;
	if (n < -100) return -100;
	return Math.round(n);
};

Space4x.addAttitude = function (state, empire, otherId, delta) {
	const rel = Space4x.ensureRelation(empire, otherId);
	if (!rel || !delta) return;
	const other = state ? Space4x.empireById(state, otherId) : null;
	if (other && state) {
		const pct = Space4x.cultureNegotiationPct(state, other.cultureId);
		if (pct > 0) {
			if (delta > 0) delta = Math.round(delta * (1 + pct / 100));
			else if (delta < 0) delta = Math.round(delta * (1 - pct / 100));
		} else if (pct < 0) {
			const abs = -pct;
			if (delta > 0) delta = Math.round(delta * (1 - abs / 100));
			else if (delta < 0) delta = Math.round(delta * (1 + abs / 100));
		}
	}
	rel.attitude = Space4x.clampAttitude((rel.attitude || 0) + delta);
};

Space4x.attitudeMood = function (attitude) {
	const n = attitude || 0;
	if (n < -30) return "hostile";
	if (n < -5) return "cool";
	if (n < 15) return "neutral";
	if (n < 40) return "warm";
	return "friendly";
};

Space4x.fillDiplomacyMessage = function (state, them, line) {
	const culture = Space4x.cultureName(state, them.cultureId) || "unknown culture";
	return String(line || "")
		.replace(/\{name\}/g, them.name)
		.replace(/\{culture\}/g, culture);
};

Space4x.diplomacyWelcomeText = function (state, them, isFirst) {
	const player = Space4x.playerEmpire(state);
	const rel = player ? Space4x.relationOf(player, them.id) : null;
	const mood = Space4x.attitudeMood(rel ? rel.attitude : 0);
	const msgs = (Space4x.settingOf(state).messages || {});
	const pools = isFirst ? msgs.diplomacyWelcome : msgs.diplomacyReturn;
	const lines = (pools && pools[mood]) || (pools && pools.neutral) || ["{name} welcomes you to negotiations."];
	const line = lines[Space4x.rngInt(state, lines.length)];
	return Space4x.fillDiplomacyMessage(state, them, line);
};

Space4x.receiveDiplomacyWelcome = function (state, player, rivalId) {
	if (!player || !rivalId) return;
	const rel = Space4x.relationOf(player, rivalId);
	if (rel) rel.welcomePending = false;
};

Space4x.markOfferSeen = function (state, offerId) {
	if (!state.offers) return;
	for (let i = 0; i < state.offers.length; i++) {
		if (state.offers[i].id === offerId) state.offers[i].attentionSeen = true;
	}
};

Space4x.dismissOfferResponse = function (state, index) {
	const responses = state.turnEvents && state.turnEvents.offerResponses;
	if (!responses || index < 0 || index >= responses.length) return;
	responses[index].seen = true;
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
			if (first) {
				const bump = Space4x.rngInt(state, 41) - 20;
				if (bump) {
					Space4x.addAttitude(state, player, them.id, bump);
					Space4x.addAttitude(state, them, player.id, bump);
				}
			}
			const welcome = Space4x.diplomacyWelcomeText(state, them, first);
			const playerRel = Space4x.relationOf(player, them.id);
			playerRel.welcomeMessage = welcome;
			playerRel.welcomePending = true;
			if (first) state.turnLog.push("First contact with " + label + ". " + welcome);
			else state.turnLog.push(label + " is in contact again. " + welcome);
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
		const o = list[i];
		if (o.pending) continue;
		if (o.toId !== toId) continue;
		if (fromId && o.fromId !== fromId) continue;
		return o;
	}
	return null;
};

Space4x.pendingOfferFrom = function (state, fromId, toId) {
	const list = state.offers || [];
	for (let i = 0; i < list.length; i++) {
		const o = list[i];
		if (!o.pending || o.fromId !== fromId || o.toId !== toId) continue;
		return o;
	}
	return null;
};

Space4x.sentOffersFrom = function (state, fromId) {
	const out = [];
	const list = state.offers || [];
	for (let i = 0; i < list.length; i++) {
		if (list[i].pending && list[i].fromId === fromId) out.push(list[i]);
	}
	return out;
};

Space4x.moneyInClauses = function (clauses) {
	let n = 0;
	for (let i = 0; i < (clauses || []).length; i++) {
		if (clauses[i].type === "money") n += clauses[i].n || 0;
	}
	return Space4x.moneyRound(n);
};

Space4x.diploDraftProbe = function (state, player, them, draft) {
	return {
		fromId: player.id,
		toId: them.id,
		give: (draft && draft.give) ? draft.give.slice() : [],
		want: (draft && draft.want) ? draft.want.slice() : [],
		pacts: Space4x.filterProposedPacts(state, player, them, (draft && draft.pacts) ? draft.pacts.slice() : [])
	};
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
	Space4x.addAttitude(state, a, b.id, -30);
	Space4x.addAttitude(state, b, a.id, -40);
	state.turnLog.push(a.name + " declared war on " + b.name + ".");
	return true;
};

Space4x.makePeace = function (state, a, b) {
	if (!Space4x.atWar(a, b)) return;
	Space4x.setPairFlag(a, b, "war", false);
	Space4x.addAttitude(state, a, b.id, 10);
	Space4x.addAttitude(state, b, a.id, 10);
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
				Space4x.addAttitude(state, b, a.id, -15);
				state.turnLog.push(a.name + " broke the spy ban with " + b.name + ".");
			}
			if (bOnA) {
				Space4x.addAttitude(state, a, b.id, -15);
				state.turnLog.push(b.name + " broke the spy ban with " + a.name + ".");
			}
		}
	}
};

Space4x.giftableShips = function (state, empireId) {
	const out = [];
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.empireId !== empireId || Space4x.isHauler(state, u)) continue;
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
		return st ? Space4x.settlementLabel(state, st) : "a world";
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
		return (clause.n || 1) + " " + name + who + (st ? " at " + Space4x.settlementLabel(state, st) : "");
	}
	return clause.type;
};

Space4x.isRevoltJoinOffer = function (offer) {
	return !!(offer && offer.kind === "revoltJoin");
};

Space4x.packageSummary = function (state, offer) {
	if (Space4x.isRevoltJoinOffer(offer)) {
		const from = Space4x.empireById(state, offer.fromId);
		const who = from ? from.name : "A revolt";
		const n = (offer.give || []).filter(function (c) { return c.type === "settlement"; }).length;
		return who + " wishes to join you" + (n ? " (" + n + " world" + (n === 1 ? "" : "s") + ")" : "");
	}
	const bits = [];
	const pacts = offer.pacts || [];
	for (let i = 0; i < pacts.length; i++) {
		if (pacts[i] === "peace") bits.push("peace");
		else bits.push("mutual " + Space4x.pactLabel(pacts[i]).toLowerCase());
	}
	const give = offer.give || [];
	for (let i = 0; i < give.length; i++) bits.push("they give " + Space4x.clauseLabel(state, give[i]));
	const want = offer.want || [];
	for (let i = 0; i < want.length; i++) bits.push("they want " + Space4x.clauseLabel(state, want[i]));
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
		if (giver.isRevoltPolity) return true;
		return Space4x.settlementsOf(state, giver.id).length > 1;
	}
	if (clause.type === "ship") {
		const u = Space4x.unitById(state, clause.unitId);
		return !!(u && u.empireId === giver.id && !Space4x.isHauler(state, u));
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
	if (Space4x.isRevoltJoinOffer(offer)) {
		const give = offer.give || [];
		if (!give.length) return false;
		for (let i = 0; i < give.length; i++) {
			if (!Space4x.clauseValid(state, from, to, give[i])) return false;
		}
		return true;
	}
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
		state.turnLog.push(giver.name + " ceded " + Space4x.settlementLabel(state, st) + " to " + receiver.name + ".");
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
	if (Space4x.isRevoltJoinOffer(offer)) {
		return Space4x.absorbRevoltPolity(state, from, to);
	}
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
		Space4x.addAttitude(state, to, from.id, bump);
		Space4x.addAttitude(state, from, to.id, -Math.round(bump / 2));
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
		pacts: Space4x.filterProposedPacts(state, from, to, (draft && draft.pacts) ? draft.pacts.slice() : []),
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
	if (from.isPlayer && !to.isPlayer) {
		offer.pending = true;
		offer.sentTurn = state.turn;
		if (!state.offers) state.offers = [];
		state.offers.push(offer);
		state.turnLog.push(from.name + " sent an offer to " + to.name + ". Awaiting their response.");
		return { ok: true, pending: true, offer: offer };
	}
	if (!from.isPlayer && !to.isPlayer) {
		if (Space4x.aiAcceptsOffer(state, to, offer)) {
			Space4x.applyOffer(state, offer);
			state.turnLog.push(to.name + " accepted a deal from " + from.name + ".");
			return { ok: true, accepted: true, offer: offer };
		}
		Space4x.addAttitude(state, to, from.id, -3);
		state.turnLog.push(to.name + " refused a deal from " + from.name + ".");
		return { ok: true, accepted: false, offer: offer };
	}
	return { ok: false, offer: offer };
};

Space4x.acceptOffer = function (state, offerId, empireId) {
	const list = state.offers || [];
	let offer = null;
	for (let i = 0; i < list.length; i++) if (list[i].id === offerId) offer = list[i];
	if (!offer || offer.toId !== empireId || offer.pending) return false;
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
	if (!offer || offer.toId !== empireId || offer.pending) return false;
	const from = Space4x.empireById(state, offer.fromId);
	const to = Space4x.empireById(state, offer.toId);
	if (from && to) Space4x.addAttitude(state, from, to.id, -3);
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
		if (state.units[i].empireId === empire.id && !Space4x.isHauler(state, state.units[i])) n += 12;
	}
	n += (empire.stockpiles.money || 0) / 20;
	n += ((empire.research && empire.research.completedTechIds) || []).length * 4;
	return n;
};

Space4x.aiCfg = function (state) {
	const set = Space4x.settingOf(state);
	return (set && set.ai) || {};
};

Space4x.empireIndustryOutput = function (state, empire) {
	if (!empire) return 0;
	let n = 0;
	const homes = Space4x.settlementsOf(state, empire.id);
	for (let i = 0; i < homes.length; i++) {
		n += Space4x.produceSettlement(state, homes[i], empire).industry || 0;
	}
	return n;
};

Space4x.unitFleetLoad = function (state, unit) {
	if (!unit || !Space4x.isCombatHull(state, unit)) return 0;
	if (unit.combatFit && unit.combatFit.load) {
		return Space4x.loadListUsed(state, unit.combatFit.load);
	}
	const empire = Space4x.empireById(state, unit.empireId);
	Space4x.ensureEmpireDesigns(state, empire);
	const design = Space4x.activeDesign(empire, unit.defId);
	if (design) return Space4x.designLoadUsed(state, design);
	return Space4x.hullLoadCap(state, unit.defId) * 0.5;
};

Space4x.empireFleetLoad = function (state, empire) {
	if (!empire) return 0;
	let n = 0;
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (u.empireId !== empire.id) continue;
		n += Space4x.unitFleetLoad(state, u);
	}
	return n;
};

Space4x.empireUpgradeFactor = function (state, empire) {
	if (!empire) return 1;
	const N = Space4x.empireHullQualityN(state, empire);
	const m = empire.modifiers || {};
	return Math.max(0.5, N +
		(m.weapon || 0) * 0.15 +
		(m.armor || 0) * 0.1 +
		(m.structure || 0) * 0.1 +
		(m.shield || 0) * 0.05);
};

Space4x.empireRawStrength = function (state, empire) {
	if (!empire) return 0;
	const cfg = Space4x.aiCfg(state);
	const horizon = cfg.threatHorizon != null ? cfg.threatHorizon : 5;
	const load = Space4x.empireFleetLoad(state, empire) + Space4x.empireIndustryOutput(state, empire) * horizon;
	return load * Space4x.empireUpgradeFactor(state, empire);
};

Space4x.sharedWarEmpires = function (state, a, b) {
	const out = [];
	if (!a || !b) return out;
	for (let i = 0; i < state.empires.length; i++) {
		const e = state.empires[i];
		if (e.id === a.id || e.id === b.id) continue;
		if (Space4x.atWar(a, e.id) && Space4x.atWar(b, e.id)) out.push(e);
	}
	return out;
};

Space4x.empireEffectiveStrength = function (state, empire, versusId) {
	if (!empire) return 0;
	const cfg = Space4x.aiCfg(state);
	const otherCommit = cfg.otherWarCommit != null ? cfg.otherWarCommit : 0.4;
	const sharedCommit = cfg.sharedWarCommit != null ? cfg.sharedWarCommit : 0.25;
	let s = Space4x.empireRawStrength(state, empire);
	const versus = versusId ? Space4x.empireById(state, versusId) : null;
	for (let i = 0; i < state.empires.length; i++) {
		const e = state.empires[i];
		if (e.id === empire.id) continue;
		if (versusId && e.id === versusId) continue;
		if (!Space4x.atWar(empire, e.id)) continue;
		const raw = Space4x.empireRawStrength(state, e);
		s -= raw * otherCommit;
		if (versus && Space4x.atWar(versus, e.id)) s -= raw * sharedCommit;
	}
	return Math.max(0, s);
};

Space4x.threatAssessment = function (state, viewer, target) {
	const out = {
		horizon: (Space4x.aiCfg(state).threatHorizon != null ? Space4x.aiCfg(state).threatHorizon : 5),
		viewerLoad: 0,
		targetLoad: 0,
		viewerIndustry: 0,
		targetIndustry: 0,
		viewerUpgrade: 1,
		targetUpgrade: 1,
		viewerRaw: 0,
		targetRaw: 0,
		viewerEffective: 0,
		targetEffective: 0,
		ratio: 1,
		sharedWars: 0
	};
	if (!viewer || !target) return out;
	out.viewerLoad = Space4x.empireFleetLoad(state, viewer);
	out.targetLoad = Space4x.empireFleetLoad(state, target);
	out.viewerIndustry = Space4x.empireIndustryOutput(state, viewer);
	out.targetIndustry = Space4x.empireIndustryOutput(state, target);
	out.viewerUpgrade = Space4x.empireUpgradeFactor(state, viewer);
	out.targetUpgrade = Space4x.empireUpgradeFactor(state, target);
	out.viewerRaw = Space4x.empireRawStrength(state, viewer);
	out.targetRaw = Space4x.empireRawStrength(state, target);
	out.viewerEffective = Space4x.empireEffectiveStrength(state, viewer, target.id);
	out.targetEffective = Space4x.empireEffectiveStrength(state, target, viewer.id);
	out.ratio = out.targetEffective > 0 ? out.viewerEffective / out.targetEffective : (out.viewerEffective > 0 ? 99 : 1);
	out.sharedWars = Space4x.sharedWarEmpires(state, viewer, target).length;
	return out;
};

Space4x.formatThreatNumber = function (n) {
	const v = Math.round(n || 0);
	if (v >= 10000) return Math.round(v / 1000) + "k";
	return String(v);
};

Space4x.aiPactScore = function (state, me, them, pact) {
	if (pact === "peace") {
		const threat = Space4x.threatAssessment(state, me, them);
		if (threat.ratio < 0.7) return 22;
		if (threat.ratio > 1.15) return -18;
		return 2;
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
	return Space4x.aiScoreOffer(state, me, offer) >= Space4x.aiOfferThreshold(state, me, them);
};

Space4x.aiOfferThreshold = function (state, me, them) {
	const rel = Space4x.relationOf(me, them.id);
	const attitude = rel ? rel.attitude || 0 : 0;
	return 10 - attitude * 0.25;
};

Space4x.balanceDiploDraft = function (state, player, them, draft) {
	const probe = Space4x.diploDraftProbe(state, player, them, draft);
	if (!Space4x.packageValid(state, player, them, probe)) {
		return { ok: false, message: "This offer is not valid as written." };
	}
	const need = Space4x.aiOfferThreshold(state, them, player);
	let score = Space4x.aiScoreOffer(state, them, probe);
	if (score >= need) {
		return {
			ok: true,
			balanced: true,
			message: "They would likely accept this as written.",
			score: score,
			need: need
		};
	}
	const deficit = need - score;
	const bump = Math.max(1, Math.ceil(deficit / 0.35));
	const committed = Space4x.moneyInClauses(draft.give);
	const wallet = Space4x.moneyRound((player.stockpiles.money || 0) - committed);
	if (bump <= wallet) {
		if (!draft.give) draft.give = [];
		let merged = false;
		for (let i = 0; i < draft.give.length; i++) {
			if (draft.give[i].type !== "money") continue;
			draft.give[i].n = Space4x.moneyRound((draft.give[i].n || 0) + bump);
			merged = true;
			break;
		}
		if (!merged) draft.give.push({ type: "money", n: bump });
		return {
			ok: true,
			balanced: true,
			message: "Added " + Space4x.fmtMoney(bump) + " to sweeten the deal.",
			addedMoney: bump,
			score: score,
			need: need
		};
	}
	return {
		ok: false,
		message: "Nothing will make this work — they want far more than you can afford to offer.",
		score: score,
		need: need
	};
};

Space4x.phaseResolvePendingOffers = function (state) {
	if (!state.offers || !state.offers.length) return;
	const player = Space4x.playerEmpire(state);
	const keep = [];
	for (let i = 0; i < state.offers.length; i++) {
		const offer = state.offers[i];
		if (!offer.pending) {
			keep.push(offer);
			continue;
		}
		if (state.turn <= offer.sentTurn) {
			keep.push(offer);
			continue;
		}
		const from = Space4x.empireById(state, offer.fromId);
		const to = Space4x.empireById(state, offer.toId);
		if (!from || !to || to.isPlayer) {
			keep.push(offer);
			continue;
		}
		let accepted = false;
		if (Space4x.packageValid(state, from, to, offer) && Space4x.aiAcceptsOffer(state, to, offer)) {
			Space4x.applyOffer(state, offer);
			state.turnLog.push(to.name + " accepted your offer.");
			accepted = true;
		} else {
			Space4x.addAttitude(state, to, from.id, -3);
			state.turnLog.push(to.name + " refused your offer.");
		}
		if (player && from.id === player.id) {
			if (!state.turnEvents) state.turnEvents = {};
			if (!state.turnEvents.offerResponses) state.turnEvents.offerResponses = [];
			state.turnEvents.offerResponses.push({
				rivalId: to.id,
				accepted: accepted,
				text: to.name + (accepted ? " accepted" : " refused") + " your offer: " + Space4x.packageSummary(state, offer) + "."
			});
		}
	}
	state.offers = keep;
};

Space4x.aiWantsWar = function (state, me, them) {
	if (Space4x.atWar(me, them)) return false;
	if (!Space4x.inContactWithEmpire(state, me.id, them.id)) return false;
	const cfg = Space4x.aiCfg(state);
	const rel = Space4x.relationOf(me, them.id);
	const attitude = rel ? rel.attitude || 0 : 0;
	const warAtt = cfg.warAttitude != null ? cfg.warAttitude : -25;
	if (attitude > warAtt) return false;
	const threat = Space4x.threatAssessment(state, me, them);
	const need = cfg.warStrengthRatio != null ? cfg.warStrengthRatio : 1.05;
	return threat.ratio >= need;
};

Space4x.aiWantsPeace = function (state, me, them) {
	if (!Space4x.atWar(me, them)) return false;
	const cfg = Space4x.aiCfg(state);
	const rel = Space4x.relationOf(me, them.id);
	const attitude = rel ? rel.attitude || 0 : 0;
	const peaceAtt = cfg.peaceAttitude != null ? cfg.peaceAttitude : 10;
	const threat = Space4x.threatAssessment(state, me, them);
	const weak = cfg.peaceStrengthRatio != null ? cfg.peaceStrengthRatio : 0.7;
	if (attitude >= peaceAtt && threat.ratio < 1.1) return true;
	return threat.ratio < weak;
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
			if (Space4x.canProposePact(state, empire, them, "trade") && Space4x.aiPactScore(state, empire, them, "trade") >= 4) {
				draft.pacts.push("trade");
			}
			if (Space4x.canProposePact(state, empire, them, "research") && Space4x.aiPactScore(state, empire, them, "research") >= 4) {
				draft.pacts.push("research");
			}
		}
		draft.pacts = Space4x.filterProposedPacts(state, empire, them, draft.pacts);
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
