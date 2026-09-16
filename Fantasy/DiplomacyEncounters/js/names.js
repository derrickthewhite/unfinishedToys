var DE = DE || {};

DE.FACTION_PREFIX = ["Ashen", "Deep", "Gloom", "Iron", "Moss", "Night", "Pale", "Riven", "Salt", "Shard", "Sunken", "Thorn", "Umber", "Vein", "Wick"];
DE.FACTION_CORE = ["Hollow", "Crown", "Coil", "Spire", "Warren", "Cairn", "Brood", "Hand", "Gate", "Choir", "Fang", "Kiln"];
DE.LEADER_FIRST = ["Aska", "Bram", "Cira", "Drel", "Eska", "Forin", "Grel", "Haska", "Iri", "Jor", "Kess", "Lura", "Marn", "Noll", "Orin", "Pesh", "Quill", "Rook", "Sila", "Tern", "Ula", "Vesh", "Wren", "Yara", "Zel"];
DE.LEADER_SECOND = ["of the Pit", "the Quiet", "Bone-Eye", "Two-Torch", "Red-Salt", "the Bent", "Cave-Born", "of Nine Marks", "the Drowned", "Ash-Tongue", "the Long", "of the Gate"];
DE.VILLAGE_PREFIX = ["Black", "Cold", "Drip", "Echo", "Fern", "Gutter", "Hearth", "Low", "Mire", "Root", "Still", "Under"];
DE.VILLAGE_SUFFIX = ["hearth", "well", "ford", "market", "den", "stair", "bridge", "hollow", "camp", "stone"];

DE.uniqueName = function (state, parts, used) {
	used = used || {};
	var name = parts.join(" ");
	var n = 2;
	var base = name;
	while (used[name]) {
		name = base + " " + n;
		n++;
	}
	used[name] = true;
	return name;
};

DE.factionName = function (state, species, used) {
	var a = DE.rngPick(state, DE.FACTION_PREFIX);
	var b = DE.rngPick(state, DE.FACTION_CORE);
	return DE.uniqueName(state, [a, b, DE.SPECIES_LABELS[species]], used);
};

DE.leaderName = function (state, used) {
	var a = DE.rngPick(state, DE.LEADER_FIRST);
	var b = DE.rngPick(state, DE.LEADER_SECOND);
	return DE.uniqueName(state, [a, b], used);
};

DE.villageName = function (state, used) {
	var a = DE.rngPick(state, DE.VILLAGE_PREFIX);
	var b = DE.rngPick(state, DE.VILLAGE_SUFFIX);
	return DE.uniqueName(state, [a + b], used);
};
