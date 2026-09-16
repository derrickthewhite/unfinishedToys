var DE = DE || {};

DE.ensureLog = function (state, factionId) {
	if (!state.logs) state.logs = {};
	if (!state.logs[factionId]) state.logs[factionId] = [];
	return state.logs[factionId];
};

DE.appendLog = function (state, entry) {
	if (!entry || !entry.factionId) return;
	var log = DE.ensureLog(state, entry.factionId);
	log.unshift(entry);
};

DE.searchLog = function (state, factionId, query, filter) {
	var log = DE.ensureLog(state, factionId);
	var q = (query || "").toLowerCase().trim();
	var out = [];
	for (var i = 0; i < log.length; i++) {
		var e = log[i];
		if (filter === "fought" && !e.battle) continue;
		if (filter === "gifted" && !e.gifted) continue;
		if (filter === "traded" && !e.traded) continue;
		if (filter === "village" && !e.village) continue;
		if (filter === "field" && e.village) continue;
		if (q) {
			var blob = [
				e.leaderName || "",
				e.summary || "",
				e.outcome || "",
				e.kind || "",
				(e.rounds || []).map(function (r) { return (r.player || "") + " " + (r.ai || ""); }).join(" ")
			].join(" ").toLowerCase();
			if (blob.indexOf(q) < 0) continue;
		}
		out.push(e);
	}
	return out;
};

DE.describeLogEntry = function (entry) {
	var bits = [];
	if (entry.village) bits.push("Village " + (entry.villageName || ""));
	else bits.push(entry.kind === "loner" ? "Loner" : "Field");
	if (entry.leaderName) bits.push(entry.leaderName);
	if (entry.rounds && entry.rounds.length) {
		bits.push(entry.rounds.map(function (r) {
			return DE.ACTION_LABELS[r.player] + " / " + DE.ACTION_LABELS[r.ai];
		}).join(" → "));
	}
	if (entry.battle) {
		bits.push(entry.displayBattle ? "display clash" : ("battle, " + (entry.winner === "player" ? "you won" : "they won")));
	}
	if (entry.playerHeld && entry.aiHeld) bits.push("both held");
	else if (entry.playerHeld) bits.push("you held");
	else if (entry.aiHeld) bits.push("they held");
	else bits.push("neither held");
	return bits.join(" · ");
};
