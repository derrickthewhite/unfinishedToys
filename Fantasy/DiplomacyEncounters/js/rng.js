var DE = DE || {};

DE.seedFromString = function (text) {
	if (!text) return (Date.now() >>> 0) || 1;
	var h = 2166136261;
	for (var i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0 || 1;
};

DE.rngNext = function (state) {
	state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
	return state.rng / 4294967296;
};

DE.rngInt = function (state, n) {
	if (n <= 0) return 0;
	return Math.floor(DE.rngNext(state) * n);
};

DE.rngRange = function (state, lo, hi) {
	return lo + DE.rngNext(state) * (hi - lo);
};

DE.rngIntRange = function (state, lo, hi) {
	return lo + DE.rngInt(state, hi - lo + 1);
};

DE.rngPick = function (state, arr) {
	if (!arr || !arr.length) return undefined;
	return arr[DE.rngInt(state, arr.length)];
};

DE.rngShuffle = function (state, arr) {
	var a = arr.slice();
	for (var i = a.length - 1; i > 0; i--) {
		var j = DE.rngInt(state, i + 1);
		var t = a[i];
		a[i] = a[j];
		a[j] = t;
	}
	return a;
};

DE.clamp = function (n, lo, hi) {
	return Math.max(lo, Math.min(hi, n));
};

DE.deepClone = function (obj) {
	return JSON.parse(JSON.stringify(obj));
};

DE.nextId = function (state, prefix) {
	state.nextId = (state.nextId || 1) + 1;
	return (prefix || "id") + state.nextId;
};
