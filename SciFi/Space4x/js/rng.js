var Space4x = Space4x || {};

Space4x.rngNext = function (state) {
	state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
	return state.rng / 4294967296;
};

Space4x.rngInt = function (state, n) {
	return Math.floor(Space4x.rngNext(state) * n);
};

Space4x.rngDie = function (state, sides) {
	return 1 + Space4x.rngInt(state, sides);
};

Space4x.seedFromString = function (text) {
	if (!text) return (Date.now() >>> 0) || 1;
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0 || 1;
};

Space4x.roll3d4minus5 = function (state) {
	const a = 1 + Space4x.rngInt(state, 4);
	const b = 1 + Space4x.rngInt(state, 4);
	const c = 1 + Space4x.rngInt(state, 4);
	return Math.max(0, a + b + c - 5);
};
