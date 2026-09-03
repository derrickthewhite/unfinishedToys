var Space4x = Space4x || {};

Space4x.governmentTypesOf = function (state) {
	const set = Space4x.settingOf(state);
	return (set && set.governmentTypes) || ["Republic", "Union", "Empire"];
};

Space4x.rollGovernmentType = function (state) {
	const list = Space4x.governmentTypesOf(state);
	return list[Space4x.rngInt(state, list.length)];
};

Space4x.polityNameForCulture = function (state, cultureId) {
	const culture = Space4x.cultureName(state, cultureId) || "Unknown";
	const gov = Space4x.rollGovernmentType(state);
	return culture + " " + gov;
};

Space4x.homeworldStarNamesOf = function (state, cultureId) {
	const set = Space4x.settingOf(state);
	const map = set && set.homeworldStars;
	if (!map || !cultureId) return [];
	const list = map[cultureId];
	return list ? list.slice() : [];
};

Space4x.pickHomeworldStarName = function (state, cultureId, used) {
	const names = Space4x.homeworldStarNamesOf(state, cultureId);
	for (let i = 0; i < names.length; i++) {
		if (!used[names[i]]) {
			used[names[i]] = true;
			return names[i];
		}
	}
	if (names.length) {
		const base = names[Space4x.rngInt(state, names.length)];
		let n = 2;
		while (used[base + " " + n]) n += 1;
		const pick = base + " " + n;
		used[pick] = true;
		return pick;
	}
	return null;
};
