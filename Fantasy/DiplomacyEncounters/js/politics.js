var DE = DE || {};

DE.politicsKey = function (fromId, toId) {
	return fromId + ">" + toId;
};

DE.politicsActors = function (state) {
	var out = [{
		id: "player",
		name: (state.player && state.player.name) || "Expedition",
		kind: "player",
		species: "human",
		colors: (state.player && state.player.colors) || ["#8a7a62", "#e8e4dc"],
		symbol: state.player && state.player.symbol
	}];
	var list = state.factions || [];
	for (var i = 0; i < list.length; i++) {
		var f = list[i];
		if (f.kind === "animal") continue;
		out.push(f);
	}
	return out;
};

DE.ensurePoliticsPlayer = function (state) {
	if (!state || !state.player) return;
	state.player.politicsKnown = state.player.politicsKnown || {};
	state.player.politicsLearned = state.player.politicsLearned || {};
	state.player.politicsContacts = state.player.politicsContacts || {};
	/* Migrate older saves that only had politicsView snapshots. */
	if (state.player.politicsView && state.player.politicsView.trust) {
		var old = state.player.politicsView.trust;
		var keys = Object.keys(old);
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			if (state.player.politicsLearned[k]) continue;
			var v = old[k];
			if (v != null && typeof v === "object") {
				state.player.politicsLearned[k] = {
					trust: v.trust,
					stale: !!v.stale
				};
			} else if (typeof v === "number") {
				state.player.politicsLearned[k] = { trust: v, stale: true };
			}
		}
	}
};

DE.seedPolitics = function (state) {
	state.politics = { trust: {} };
	var actors = DE.politicsActors(state);
	for (var i = 0; i < actors.length; i++) {
		for (var j = i + 1; j < actors.length; j++) {
			var a = actors[i];
			var b = actors[j];
			var markPlayer =
				(a.hostileTarget && b.id === "player") ||
				(b.hostileTarget && a.id === "player");
			var involvesPlayer = a.id === "player" || b.id === "player";
			var t = markPlayer
				? DE.rngRange(state, 0.05, 0.399)
				: involvesPlayer
					? DE.rngRange(state, 0.35, 0.65)
					: DE.rngRange(state, 0.05, 0.95);
			state.politics.trust[DE.politicsKey(a.id, b.id)] = t;
			state.politics.trust[DE.politicsKey(b.id, a.id)] = t;
		}
	}
	state.player.politicsKnown = {};
	state.player.politicsLearned = {};
	state.player.politicsContacts = {};
	state.player.politicsView = { trust: {}, known: {} };
};

DE.politicsTrust = function (state, fromId, toId) {
	if (!state.politics || !state.politics.trust) return null;
	var v = state.politics.trust[DE.politicsKey(fromId, toId)];
	return v == null ? null : v;
};

DE.politicsBand = function (T) {
	if (T == null) return "unknown";
	if (T < 0.4) return "hostile";
	if (T < 0.6) return "wary";
	return "friendly";
};

DE.knowPoliticsFaction = function (state, factionId) {
	if (!factionId || factionId === "player") return;
	DE.ensurePoliticsPlayer(state);
	state.player.politicsKnown[factionId] = true;
};

DE.politicsHomeId = function (unit) {
	if (!unit) return null;
	var id = unit.homeFactionId || null;
	if (!id || id === "player") return null;
	return id;
};

DE.politicsCaptiveFactionId = function (cap) {
	if (!cap) return null;
	var id = cap.factionId || cap.homeFactionId || null;
	if (!id || id === "player") return null;
	return id;
};

DE.collectPoliticsContacts = function (state) {
	var contacts = {};
	if (!state || !state.player) return contacts;
	function addUnit(u) {
		if (!u || u.dead) return;
		var id = DE.politicsHomeId(u);
		if (id) contacts[id] = true;
	}
	function addCap(c) {
		var id = DE.politicsCaptiveFactionId(c);
		if (id) contacts[id] = true;
	}
	var units = state.player.units || [];
	for (var i = 0; i < units.length; i++) addUnit(units[i]);
	var caps = state.player.captives || [];
	for (var c = 0; c < caps.length; c++) addCap(caps[c]);
	if (state.mission) {
		var party = state.mission.party || [];
		for (var p = 0; p < party.length; p++) addUnit(party[p]);
		var mCaps = (state.mission.stuff && state.mission.stuff.captives) || [];
		for (var mc = 0; mc < mCaps.length; mc++) addCap(mCaps[mc]);
		var enc = state.mission.pendingEncounter;
		if (enc) {
			var eu = enc.playerUnits || [];
			for (var e = 0; e < eu.length; e++) addUnit(eu[e]);
			var ec = (enc.playerStuff && enc.playerStuff.captives) || [];
			for (var k = 0; k < ec.length; k++) addCap(ec[k]);
		}
	}
	return contacts;
};

/* Copy every ground-truth edge that touches factionId into the player's learned store. */
DE.learnPoliticsEdgesForFaction = function (state, factionId) {
	if (!factionId || factionId === "player") return;
	DE.ensurePoliticsPlayer(state);
	DE.knowPoliticsFaction(state, factionId);
	var actors = DE.politicsActors(state);
	for (var i = 0; i < actors.length; i++) {
		var other = actors[i].id;
		if (other === factionId) continue;
		var ab = DE.politicsTrust(state, factionId, other);
		var ba = DE.politicsTrust(state, other, factionId);
		if (ab != null) {
			state.player.politicsLearned[DE.politicsKey(factionId, other)] = {
				trust: ab,
				stale: false
			};
		}
		if (ba != null) {
			state.player.politicsLearned[DE.politicsKey(other, factionId)] = {
				trust: ba,
				stale: false
			};
		}
	}
};

DE.stalePoliticsEdgesForFaction = function (state, factionId, activeContacts) {
	DE.ensurePoliticsPlayer(state);
	activeContacts = activeContacts || {};
	var learned = state.player.politicsLearned;
	var keys = Object.keys(learned);
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var parts = key.split(">");
		if (parts.length !== 2) continue;
		if (parts[0] !== factionId && parts[1] !== factionId) continue;
		var other = parts[0] === factionId ? parts[1] : parts[0];
		if (other !== "player" && activeContacts[other]) continue;
		learned[key].stale = true;
	}
};

DE.syncPoliticsContacts = function (state) {
	if (!state || !state.player) return;
	DE.ensurePoliticsPlayer(state);
	var next = DE.collectPoliticsContacts(state);
	var prev = state.player.politicsContacts || {};
	var id;
	for (id in next) {
		if (next.hasOwnProperty(id) && !prev[id]) {
			DE.learnPoliticsEdgesForFaction(state, id);
		}
	}
	for (id in prev) {
		if (prev.hasOwnProperty(id) && !next[id]) {
			DE.stalePoliticsEdgesForFaction(state, id, next);
		}
	}
	state.player.politicsContacts = next;
};

DE.onPoliticsEncounter = function (state, factionId) {
	DE.knowPoliticsFaction(state, factionId);
};

DE.onPoliticsHire = function (state, factionId) {
	DE.knowPoliticsFaction(state, factionId);
	DE.learnPoliticsEdgesForFaction(state, factionId);
	DE.syncPoliticsContacts(state);
};

DE.onPoliticsCapture = function (state, factionId) {
	DE.knowPoliticsFaction(state, factionId);
	DE.learnPoliticsEdgesForFaction(state, factionId);
	DE.syncPoliticsContacts(state);
};

DE.learnPoliticsGossip = function (state, fromId, toId) {
	if (!state || !fromId || !toId || fromId === toId) return;
	DE.ensurePoliticsPlayer(state);
	if (fromId !== "player") DE.knowPoliticsFaction(state, fromId);
	if (toId !== "player") DE.knowPoliticsFaction(state, toId);
	var t = DE.politicsTrust(state, fromId, toId);
	if (t == null) return;
	var key = DE.politicsKey(fromId, toId);
	var existing = state.player.politicsLearned[key];
	if (existing && !existing.stale) {
		existing.trust = t;
		return;
	}
	state.player.politicsLearned[key] = { trust: t, stale: true };
};

DE.viewPoliticsLearned = function (state, fromId, toId) {
	DE.ensurePoliticsPlayer(state);
	var entry = state.player.politicsLearned[DE.politicsKey(fromId, toId)];
	if (!entry || entry.trust == null) return null;
	return entry;
};

DE.viewPoliticsTrust = function (state, fromId, toId) {
	var entry = DE.viewPoliticsLearned(state, fromId, toId);
	return entry ? entry.trust : null;
};

DE.politicsFactionKnown = function (state, factionId) {
	if (!factionId || factionId === "player") return true;
	DE.ensurePoliticsPlayer(state);
	return !!state.player.politicsKnown[factionId];
};

DE.politicsViewActors = function (state) {
	return DE.politicsActors(state);
};
