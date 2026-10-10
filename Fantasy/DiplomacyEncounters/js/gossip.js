var DE = DE || {};

DE.GOSSIP_MUTE = "Nodding and gesturing, you get along well enough.";

DE.canSpeakWithEncounter = function (state, enc) {
	if (!enc) return false;
	var fac = DE.factionById(state, enc.factionId);
	var species = fac && fac.species;
	if (!species) {
		var units = (enc.aiUnits || []).concat(enc.leader ? [enc.leader] : []);
		for (var i = 0; i < units.length; i++) {
			if (units[i] && units[i].species) {
				species = units[i].species;
				break;
			}
		}
	}
	return DE.isCivilizedLanguage(species) && DE.hasLanguage(state, species);
};

DE.gossipName = function (state, id) {
	if (id === "player") return "your expedition";
	var fac = DE.factionById(state, id);
	if (!fac) return "someone";
	if (fac.kind === "loner" || fac.monsterType) {
		return DE.SPECIES_LABELS[fac.monsterType || fac.species] || fac.name || "a loner";
	}
	return fac.name || "a faction";
};

DE.gossipBandWord = function (T) {
	var band = DE.politicsBand(T);
	if (band === "hostile") return "hostile";
	if (band === "wary") return "wary";
	if (band === "friendly") return "friendly";
	return "uncertain";
};

DE.factionFightingPower = function (state, factionId) {
	var units = [];
	if (factionId === "player") {
		if (state.mission && state.mission.party) units = state.mission.party;
		else units = (state.player && state.player.units) || [];
		return DE.rawSideStrength(DE.livingUnits(units), [], state);
	}
	var fac = DE.factionById(state, factionId);
	if (!fac) return 0;
	units = DE.livingUnits(fac.poolUnits || []).slice();
	var villages = typeof DE.villagesByFaction === "function" ? DE.villagesByFaction(state, fac.id) : [];
	for (var i = 0; i < villages.length; i++) {
		units = units.concat(DE.livingUnits(villages[i].units || []));
	}
	return DE.rawSideStrength(units, [], state);
};

DE.pickTwoGossipActors = function (state) {
	var actors = DE.politicsActors(state);
	if (!actors || actors.length < 2) return null;
	var ids = [];
	for (var i = 0; i < actors.length; i++) ids.push(actors[i].id);
	var shuffled = DE.rngShuffle(state, ids);
	return [shuffled[0], shuffled[1]];
};

DE.availableGossipKinds = function (state, enc) {
	var kinds = [];
	if (enc && enc.factionId && DE.politicsTrust(state, "player", enc.factionId) != null) kinds.push("stance");
	if (DE.politicsActors(state).length >= 2) {
		kinds.push("relation");
		kinds.push("power");
	}
	if ((DE.MONSTER_TYPES || []).length) kinds.push("monster");
	if ((DE.GOSSIP_TIPS || []).length) kinds.push("tip");
	if ((DE.GOSSIP_COLOR || []).length) kinds.push("color");
	return kinds;
};

DE.buildGossip = function (state, enc, kind) {
	if (kind === "stance") {
		var them = enc.factionId;
		var t = DE.politicsTrust(state, "player", them);
		DE.learnPoliticsGossip(state, "player", them);
		DE.learnPoliticsGossip(state, them, "player");
		return {
			kind: "stance",
			text: "Honestly? " + DE.gossipName(state, them) + " and " + DE.gossipName(state, "player") +
				" stand " + DE.gossipBandWord(t) + "."
		};
	}
	if (kind === "relation") {
		var pair = DE.pickTwoGossipActors(state);
		if (!pair) return DE.buildGossip(state, enc, "tip");
		var a = pair[0];
		var b = pair[1];
		var rel = DE.politicsTrust(state, a, b);
		DE.learnPoliticsGossip(state, a, b);
		DE.learnPoliticsGossip(state, b, a);
		return {
			kind: "relation",
			text: "They say " + DE.gossipName(state, a) + " and " + DE.gossipName(state, b) +
				" are " + DE.gossipBandWord(rel) + "."
		};
	}
	if (kind === "power") {
		var sides = DE.pickTwoGossipActors(state);
		if (!sides) return DE.buildGossip(state, enc, "tip");
		var left = sides[0];
		var right = sides[1];
		var leftP = DE.factionFightingPower(state, left);
		var rightP = DE.factionFightingPower(state, right);
		var top = Math.max(leftP, rightP, 1);
		var text;
		if (Math.abs(leftP - rightP) / top < 0.2) {
			text = "They figure " + DE.gossipName(state, left) + " and " + DE.gossipName(state, right) +
				" are evenly matched.";
		} else if (leftP > rightP) {
			text = "They figure " + DE.gossipName(state, left) + " outmatch " + DE.gossipName(state, right) + ".";
		} else {
			text = "They figure " + DE.gossipName(state, right) + " outmatch " + DE.gossipName(state, left) + ".";
		}
		return { kind: "power", text: text };
	}
	if (kind === "monster") {
		var unknown = typeof DE.unknownMonsterAdviceKeys === "function" ? DE.unknownMonsterAdviceKeys(state) : [];
		var key = unknown.length ? DE.rngPick(state, unknown) : DE.rngPick(state, DE.MONSTER_TYPES);
		if (key) DE.markMonsterKnown(state, key);
		var label = DE.SPECIES_LABELS[key] || key || "that beast";
		var smart = DE.monsterIsIntelligent(state, key);
		return {
			kind: "monster",
			text: smart
				? ("They warn you: " + label + " are intelligent.")
				: ("They warn you: " + label + " are not intelligent.")
		};
	}
	if (kind === "color") {
		var color = DE.rngPick(state, DE.GOSSIP_COLOR || []);
		return { kind: "color", text: color || DE.GOSSIP_MUTE };
	}
	var tip = DE.rngPick(state, DE.GOSSIP_TIPS || []);
	return { kind: "tip", text: tip || DE.GOSSIP_MUTE };
};

DE.rollTradeGossip = function (state, enc, forceKind) {
	if (!enc) return { kind: "mute", text: DE.GOSSIP_MUTE };
	if (enc.gossip) return enc.gossip;
	var gossip;
	if (!DE.canSpeakWithEncounter(state, enc)) {
		gossip = { kind: "mute", text: DE.GOSSIP_MUTE };
	} else {
		var kinds = DE.availableGossipKinds(state, enc);
		var kind = forceKind && kinds.indexOf(forceKind) >= 0 ? forceKind : DE.rngPick(state, kinds);
		gossip = DE.buildGossip(state, enc, kind || "tip");
	}
	enc.gossip = gossip;
	return gossip;
};
