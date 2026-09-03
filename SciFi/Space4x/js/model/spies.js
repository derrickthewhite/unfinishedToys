var Space4x = Space4x || {};

Space4x.spySkill = function (state, empire) {
	let n = empire && empire.modifiers ? (empire.modifiers.spySkill || 0) : 0;
	if (!empire) return n;
	Space4x.eachCultureEffect(state, empire.cultureId, function (c, fx) {
		if (fx.type === "spySkill") n += fx.n || 0;
	});
	return n;
};

Space4x.empireSpies = function (empire) {
	return empire && empire.spies ? empire.spies : [];
};

Space4x.spyUpkeep = function (state, empireId) {
	const empire = Space4x.empireById(state, empireId);
	const spies = Space4x.empireSpies(empire);
	let n = 0;
	const builds = Space4x.settingOf(state).builds;
	const def = builds.spy;
	const each = def && def.upkeep ? def.upkeep : 1;
	n = spies.length * each;
	return Space4x.moneyRound(n);
};

Space4x.inContactWithEmpire = function (state, fromId, toId) {
	if (!fromId || !toId) return false;
	if (fromId === toId) return true;
	function reaches(viewerId, targetId) {
		const homes = Space4x.settlementsOf(state, targetId);
		for (let i = 0; i < homes.length; i++) {
			const star = Space4x.starById(state, homes[i].location.starId);
			if (star && Space4x.inCommsRangeOfEmpire(state, viewerId, star.x, star.y)) return true;
		}
		return false;
	}
	return reaches(fromId, toId) || reaches(toId, fromId);
};

Space4x.settlementDiscoveredBy = function (state, empireId, settlement) {
	if (!settlement) return false;
	return Space4x.starIsExplored(state, empireId, settlement.location.starId);
};

Space4x.spawnSpy = function (state, settlement) {
	const empire = Space4x.empireById(state, settlement.empireId);
	if (!empire.spies) empire.spies = [];
	empire.spies.push({
		id: Space4x.nextId(state, "y"),
		culture: Space4x.majorityCulture(state, settlement),
		post: "idle"
	});
	state.turnLog.push(settlement.name + " trained a spy.");
};

Space4x.parseSpyPost = function (id) {
	const s = String(id || "idle");
	if (s === "idle") return { kind: "idle" };
	if (s === "defend") return { kind: "defend" };
	if (s.indexOf("e:") === 0) {
		const parts = s.split(":");
		return { kind: "empire", empireId: parts[1], task: parts[2] || "loyalty" };
	}
	if (s.indexOf("s:") === 0) {
		const rest = s.slice(2);
		const i = rest.indexOf(":");
		if (i < 0) return { kind: "idle" };
		const sid = rest.slice(0, i);
		const g = rest.slice(i + 1);
		const j = g.indexOf("::");
		return {
			kind: "settlement",
			settlementId: sid,
			job: j < 0 ? g : g.slice(0, j),
			culture: j < 0 ? null : (g.slice(j + 2) || null)
		};
	}
	return { kind: "idle" };
};

Space4x.spyPostId = function (post) {
	if (!post || post.kind === "idle") return "idle";
	if (post.kind === "defend") return "defend";
	if (post.kind === "empire") return "e:" + post.empireId + ":" + post.task;
	if (post.kind === "settlement") {
		return "s:" + post.settlementId + ":" + Space4x.groupKey(post.job, post.culture);
	}
	return "idle";
};

Space4x.spyPostValid = function (state, empire, post) {
	if (!post || post.kind === "idle") return true;
	if (post.kind === "defend") return true;
	if (post.kind === "empire") {
		const other = Space4x.empireById(state, post.empireId);
		if (!other || other.id === empire.id) return false;
		if (post.task !== "loyalty" && post.task !== "tech" && post.task !== "attitude") return false;
		return Space4x.inContactWithEmpire(state, empire.id, other.id);
	}
	if (post.kind === "settlement") {
		const st = Space4x.settlementById(state, post.settlementId);
		if (!st || st.empireId === empire.id) return false;
		if (!Space4x.inContactWithEmpire(state, empire.id, st.empireId)) return false;
		if (!Space4x.settlementDiscoveredBy(state, empire.id, st)) return false;
		return true;
	}
	return false;
};

Space4x.bounceInvalidSpies = function (state, empire) {
	const spies = Space4x.empireSpies(empire);
	for (let i = 0; i < spies.length; i++) {
		const post = Space4x.parseSpyPost(spies[i].post);
		if (!Space4x.spyPostValid(state, empire, post)) spies[i].post = "idle";
	}
};

Space4x.setSpyPosts = function (state, empireId, spyIds, laneId) {
	const empire = Space4x.empireById(state, empireId);
	if (!empire) return;
	const post = Space4x.parseSpyPost(laneId);
	if (!Space4x.spyPostValid(state, empire, post)) return;
	const want = {};
	for (let i = 0; i < spyIds.length; i++) want[spyIds[i]] = true;
	const spies = Space4x.empireSpies(empire);
	const id = Space4x.spyPostId(post);
	for (let i = 0; i < spies.length; i++) {
		if (want[spies[i].id]) spies[i].post = id;
	}
};

Space4x.stealableTechs = function (state, from, to) {
	const out = [];
	if (!from || !to || !from.research) return out;
	const ids = from.research.completedTechIds || [];
	for (let i = 0; i < ids.length; i++) {
		if (Space4x.empireHasTech(to, ids[i])) continue;
		const tech = Space4x.techById(state, ids[i]);
		if (tech) out.push(tech);
	}
	return out;
};

Space4x.pickStolenTech = function (state, thief, victim) {
	const opts = Space4x.stealableTechs(state, victim, thief);
	if (!opts.length) return null;
	const saved = thief.research.savedProgress || {};
	opts.sort(function (a, b) {
		const sa = saved[a.id] || 0;
		const sb = saved[b.id] || 0;
		if (sb !== sa) return sb - sa;
		if (a.tier !== b.tier) return a.tier - b.tier;
		return (a.name || "").localeCompare(b.name || "");
	});
	return opts[0];
};

Space4x.applyStolenResearch = function (state, thief, victim, n) {
	if (!(n > 0)) return;
	const tech = Space4x.pickStolenTech(state, thief, victim);
	if (!tech) {
		state.turnLog.push(thief.name + " stole nothing from " + victim.name + " (no unknown techs).");
		return;
	}
	if (!thief.research.savedProgress) thief.research.savedProgress = {};
	thief.research.savedProgress[tech.id] = (thief.research.savedProgress[tech.id] || 0) + n;
	if (thief.research.currentProjectId === tech.id) {
		thief.research.progress += n;
		thief.research.cost = tech.cost;
		if (thief.research.progress >= tech.cost) {
			Space4x.completeTech(state, thief, tech);
			return;
		}
	}
	state.turnLog.push(thief.name + " stole " + n + " research toward " + tech.name + " from " + victim.name + ".");
};

Space4x.spyMissionLoyalty = function (state, attacker, post) {
	if (post.kind === "settlement") {
		const st = Space4x.settlementById(state, post.settlementId);
		if (!st) return 60;
		return Space4x.groupLoyalty(state, st, post.job, post.culture);
	}
	if (post.kind === "empire") {
		const homes = Space4x.settlementsOf(state, post.empireId);
		let n = 0;
		let w = 0;
		for (let i = 0; i < homes.length; i++) {
			if (!Space4x.settlementDiscoveredBy(state, attacker.id, homes[i])) continue;
			const L = Space4x.settlementLoyalty(state, homes[i]);
			const pops = homes[i].pops ? homes[i].pops.length : 0;
			n += L * pops;
			w += pops;
		}
		if (w) return Math.round(n / w);
		return 60;
	}
	return 60;
};

Space4x.lowestKnownGroup = function (state, attacker, empireId) {
	const homes = Space4x.settlementsOf(state, empireId);
	let best = null;
	for (let i = 0; i < homes.length; i++) {
		const st = homes[i];
		if (!Space4x.settlementDiscoveredBy(state, attacker.id, st)) continue;
		const groups = Space4x.loyaltyGroups(state, st);
		for (let g = 0; g < groups.length; g++) {
			const row = groups[g];
			if (!best || row.loyalty < best.loyalty || (row.loyalty === best.loyalty && row.n > best.n)) {
				best = { settlement: st, job: row.job, culture: row.culture, loyalty: row.loyalty, n: row.n };
			}
		}
	}
	return best;
};

Space4x.spyAttackHits = function (state, attacker, defender, loyalty, spies) {
	const atk = Space4x.spySkill(state, attacker);
	const def = Space4x.spySkill(state, defender);
	let n = 0;
	for (let i = 0; i < spies.length; i++) {
		const roll = 1 + Space4x.rngInt(state, 100) + atk - def;
		if (roll > loyalty) n += 1;
	}
	return n;
};

Space4x.spyDefendHits = function (state, defender, missions) {
	const spies = Space4x.empireSpies(defender);
	const pool = [];
	for (let i = 0; i < spies.length; i++) {
		if (spies[i].post === "defend") pool.push(spies[i]);
	}
	if (!pool.length || !missions.length) return 0;
	let skillW = 0;
	let loyW = 0;
	let w = 0;
	for (let i = 0; i < missions.length; i++) {
		const m = missions[i];
		const n = m.spies.length;
		skillW += Space4x.spySkill(state, m.attacker) * n;
		loyW += m.loyalty * n;
		w += n;
	}
	const opp = w ? skillW / w : 0;
	const rules = Space4x.loyaltyRules(state);
	const loyalty = w ? loyW / w : ((rules && rules.base) || 80);
	const dc = 160 - loyalty;
	const skill = Space4x.spySkill(state, defender);
	let n = 0;
	for (let i = 0; i < pool.length; i++) {
		const roll = 1 + Space4x.rngInt(state, 100) + skill - opp;
		if (roll > dc) n += 1;
	}
	return n;
};

Space4x.applySpyMission = function (state, mission, net) {
	if (!(net > 0)) return;
	const post = mission.post;
	const atk = mission.attacker;
	if (post.kind === "empire" || post.kind === "settlement") {
		let defId = post.empireId;
		if (post.kind === "settlement") {
			const home = Space4x.settlementById(state, post.settlementId);
			defId = home ? home.empireId : null;
		}
		const victimEmp = Space4x.empireById(state, defId);
		if (victimEmp && post.task !== "attitude") Space4x.addAttitude(state, victimEmp, atk.id, -1);
	}
	if (post.kind === "settlement") {
		const st = Space4x.settlementById(state, post.settlementId);
		if (!st) return;
		Space4x.addGroupSpyDelta(st, post.job, post.culture, -net);
		const who = Space4x.jobLabel(state, post.job) + " " + (Space4x.cultureName(state, post.culture) || "pops");
		state.turnLog.push(atk.name + " spies cut " + who + " loyalty at " + st.name + " by " + net + ".");
		return;
	}
	if (post.kind !== "empire") return;
	const victim = Space4x.empireById(state, post.empireId);
	if (!victim) return;
	if (post.task === "tech") {
		Space4x.applyStolenResearch(state, atk, victim, net * 10);
		return;
	}
	if (post.task === "attitude") {
		Space4x.addAttitude(state, victim, atk.id, -2 * net);
		state.turnLog.push(atk.name + " spies soured " + victim.name + "'s attitude by " + (2 * net) + ".");
		return;
	}
	if (post.task === "loyalty") {
		const hit = Space4x.lowestKnownGroup(state, atk, victim.id);
		if (!hit) {
			state.turnLog.push(atk.name + " spies found no known communities on " + victim.name + ".");
			return;
		}
		Space4x.addGroupSpyDelta(hit.settlement, hit.job, hit.culture, -net);
		const who = Space4x.jobLabel(state, hit.job) + " " + (Space4x.cultureName(state, hit.culture) || "pops");
		state.turnLog.push(atk.name + " spies cut " + who + " loyalty at " + hit.settlement.name + " by " + net + ".");
	}
};

Space4x.phaseSpies = function (state) {
	Space4x.healSpyLoyalty(state);
	for (let i = 0; i < state.empires.length; i++) {
		Space4x.bounceInvalidSpies(state, state.empires[i]);
	}
	Space4x.phaseSpyTreaties(state);
	const missions = [];
	for (let i = 0; i < state.empires.length; i++) {
		const atk = state.empires[i];
		const groups = {};
		const spies = Space4x.empireSpies(atk);
		for (let s = 0; s < spies.length; s++) {
			const post = Space4x.parseSpyPost(spies[s].post);
			if (post.kind !== "settlement" && post.kind !== "empire") continue;
			const key = spies[s].post;
			if (!groups[key]) groups[key] = { attacker: atk, post: post, spies: [] };
			groups[key].spies.push(spies[s]);
		}
		const keys = Object.keys(groups);
		for (let k = 0; k < keys.length; k++) {
			const m = groups[keys[k]];
			let defId = null;
			if (m.post.kind === "empire") defId = m.post.empireId;
			if (m.post.kind === "settlement") {
				const st = Space4x.settlementById(state, m.post.settlementId);
				defId = st ? st.empireId : null;
			}
			const defender = Space4x.empireById(state, defId);
			if (!defender) continue;
			m.defender = defender;
			m.loyalty = Space4x.spyMissionLoyalty(state, atk, m.post);
			m.hits = Space4x.spyAttackHits(state, atk, defender, m.loyalty, m.spies);
			missions.push(m);
		}
	}
	const byDef = {};
	for (let i = 0; i < missions.length; i++) {
		const id = missions[i].defender.id;
		if (!byDef[id]) byDef[id] = [];
		byDef[id].push(missions[i]);
	}
	const defIds = Object.keys(byDef);
	for (let d = 0; d < defIds.length; d++) {
		const incoming = byDef[defIds[d]];
		const defender = incoming[0].defender;
		let shield = Space4x.spyDefendHits(state, defender, incoming);
		incoming.sort(function (a, b) { return b.hits - a.hits; });
		for (let i = 0; i < incoming.length; i++) {
			const blocked = Math.min(incoming[i].hits, shield);
			const net = incoming[i].hits - blocked;
			shield -= blocked;
			Space4x.applySpyMission(state, incoming[i], net);
		}
	}
};

Space4x.spyLaneLabel = function (state, viewer, lane) {
	if (lane.kind === "idle") return "Idle";
	if (lane.kind === "defend") return "Defend";
	if (lane.kind === "empire") {
		if (lane.task === "tech") return "Technology";
		if (lane.task === "attitude") return "Attitude";
		return "Loyalty";
	}
	if (lane.kind === "settlement") {
		const st = Space4x.settlementById(state, lane.settlementId);
		const job = Space4x.jobLabel(state, lane.job);
		const who = Space4x.cultureName(state, lane.culture) || "Pops";
		const L = st ? Space4x.groupLoyalty(state, st, lane.job, lane.culture) : "?";
		return job + " · " + who + " · " + L + "%";
	}
	return lane.id;
};

Space4x.groupSpyBoardItems = function (lanes) {
	const items = [];
	let buf = [];
	function flush() {
		if (!buf.length) return;
		const id = "row:" + buf.map(function (l) { return l.id; }).join("|");
		items.push({ id: id, kind: "row", lanes: buf });
		buf = [];
	}
	for (let i = 0; i < (lanes || []).length; i++) {
		const lane = lanes[i];
		if (lane.kind === "head") {
			flush();
			items.push({ id: lane.id, kind: "head", lane: lane });
			continue;
		}
		buf.push(lane);
		if (buf.length === 3) flush();
	}
	flush();
	return items;
};

Space4x.spySettlementHeadLabel = function (state, settlement) {
	if (!settlement) return "Unknown";
	const body = Space4x.bodyById(state, settlement.location.bodyId);
	const bits = [Space4x.settlementLabel(state, settlement)];
	if (body) bits.push(Space4x.bodyCaption(body, state));
	bits.push(settlement.pops.length + " " + Space4x.peopleWord(settlement.pops.length));
	const species = Space4x.settlementCultureLabel(state, settlement);
	if (species) bits.push(species);
	return bits.join(" · ");
};

Space4x.spyLanes = function (state, viewer) {
	const lanes = [
		{ id: "idle", kind: "idle" },
		{ id: "defend", kind: "defend" }
	];
	if (!viewer) return lanes;
	const rivals = [];
	for (let i = 0; i < state.empires.length; i++) {
		const e = state.empires[i];
		if (e.id === viewer.id) continue;
		if (!Space4x.inContactWithEmpire(state, viewer.id, e.id)) continue;
		rivals.push(e);
	}
	rivals.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
	for (let r = 0; r < rivals.length; r++) {
		const e = rivals[r];
			lanes.push({ id: "head-e-" + e.id, kind: "head", label: e.name, empireId: e.id });
		lanes.push({ id: "e:" + e.id + ":loyalty", kind: "empire", empireId: e.id, task: "loyalty" });
		lanes.push({ id: "e:" + e.id + ":tech", kind: "empire", empireId: e.id, task: "tech" });
		lanes.push({ id: "e:" + e.id + ":attitude", kind: "empire", empireId: e.id, task: "attitude" });
		const homes = Space4x.settlementsOf(state, e.id);
		homes.sort(function (a, b) { return (a.name || "").localeCompare(b.name || ""); });
		for (let h = 0; h < homes.length; h++) {
			const st = homes[h];
			if (!Space4x.settlementDiscoveredBy(state, viewer.id, st)) continue;
			lanes.push({
				id: "head-s-" + st.id,
				kind: "head",
				label: Space4x.spySettlementHeadLabel(state, st),
				settlementId: st.id,
				empireId: e.id
			});
			const groups = Space4x.loyaltyGroups(state, st);
			const posted = {};
			const spies = Space4x.empireSpies(viewer);
			for (let s = 0; s < spies.length; s++) {
				const p = Space4x.parseSpyPost(spies[s].post);
				if (p.kind === "settlement" && p.settlementId === st.id) {
					posted[Space4x.groupKey(p.job, p.culture)] = true;
				}
			}
			for (let g = 0; g < groups.length; g++) {
				const row = groups[g];
				lanes.push({
					id: "s:" + st.id + ":" + row.id,
					kind: "settlement",
					settlementId: st.id,
					job: row.job,
					culture: row.culture,
					n: row.n,
					loyalty: row.loyalty
				});
				delete posted[row.id];
			}
			const leftover = Object.keys(posted);
			for (let i = 0; i < leftover.length; i++) {
				const bits = leftover[i].split("::");
				lanes.push({
					id: "s:" + st.id + ":" + leftover[i],
					kind: "settlement",
					settlementId: st.id,
					job: bits[0],
					culture: bits[1] || null,
					n: 0,
					loyalty: Space4x.groupLoyalty(state, st, bits[0], bits[1] || null)
				});
			}
		}
	}
	return lanes;
};

Space4x.spyCountAtSettlement = function (empire, settlementId) {
	let n = 0;
	const spies = Space4x.empireSpies(empire);
	for (let i = 0; i < spies.length; i++) {
		const post = Space4x.parseSpyPost(spies[i].post);
		if (post.kind === "settlement" && post.settlementId === settlementId) n += 1;
	}
	return n;
};

Space4x.removeSpyAtSettlement = function (empire, settlementId) {
	const spies = Space4x.empireSpies(empire);
	for (let i = 0; i < spies.length; i++) {
		const post = Space4x.parseSpyPost(spies[i].post);
		if (post.kind === "settlement" && post.settlementId === settlementId) {
			spies.splice(i, 1);
			return true;
		}
	}
	return false;
};

Space4x.inciteRevoltCost = function (state, settlement) {
	const rules = Space4x.revoltRules(state);
	const per = rules && rules.inciteCostPerPop != null ? rules.inciteCostPerPop : 5;
	const pops = settlement && settlement.pops ? settlement.pops.length : 0;
	return Space4x.moneyRound(per * pops);
};

Space4x.inciteRevoltTargets = function (state, empire) {
	const out = [];
	if (!empire) return out;
	const seen = {};
	const spies = Space4x.empireSpies(empire);
	for (let i = 0; i < spies.length; i++) {
		const post = Space4x.parseSpyPost(spies[i].post);
		if (post.kind !== "settlement" || !post.settlementId || seen[post.settlementId]) continue;
		const st = Space4x.settlementById(state, post.settlementId);
		if (!st || st.empireId === empire.id) continue;
		if (!Space4x.inContactWithEmpire(state, empire.id, st.empireId)) continue;
		if (!Space4x.settlementDiscoveredBy(state, empire.id, st)) continue;
		seen[post.settlementId] = true;
		out.push(st);
	}
	out.sort(function (a, b) {
		return Space4x.settlementLabel(state, a).localeCompare(Space4x.settlementLabel(state, b));
	});
	return out;
};

Space4x.inciteRevolt = function (state, empireId, settlementId) {
	const empire = Space4x.empireById(state, empireId);
	const settlement = Space4x.settlementById(state, settlementId);
	if (!empire || !settlement) return { ok: false, reason: "Invalid target." };
	if (settlement.empireId === empireId) return { ok: false, reason: "Cannot incite your own world." };
	if (!Space4x.spyCountAtSettlement(empire, settlementId)) {
		return { ok: false, reason: "Post a spy on that world first." };
	}
	const cost = Space4x.inciteRevoltCost(state, settlement);
	const wallet = Space4x.moneyRound(empire.stockpiles.money || 0);
	if (wallet < cost) return { ok: false, reason: "Need " + Space4x.fmtMoney(cost) + "." };
	empire.stockpiles.money = Space4x.moneyRound(wallet - cost);
	if (!Space4x.removeSpyAtSettlement(empire, settlementId)) {
		return { ok: false, reason: "No spy found at that world." };
	}
	const owner = Space4x.empireById(state, settlement.empireId);
	state.turnLog.push(empire.name + " incites revolt at " + Space4x.settlementLabel(state, settlement) +
		(owner ? " (" + owner.name + ")" : "") + " for " + Space4x.fmtMoney(cost) + ".");
	const rebel = Space4x.resolveRevolt(state, settlement, { sponsorEmpireId: empireId });
	if (rebel) {
		state.turnLog.push(rebel.name + " favors " + empire.name + " (+10 attitude).");
	}
	return { ok: true, rebel: rebel || null };
};
