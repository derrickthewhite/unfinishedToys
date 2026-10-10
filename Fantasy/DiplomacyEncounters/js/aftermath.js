var DE = DE || {};

DE.AFTERMATH_COPY_URL = "data/aftermath-copy.json";
DE.AFTERMATH_COPY = DE.AFTERMATH_COPY || null;

DE.setAftermathCopy = function (data) {
	DE.AFTERMATH_COPY = data || {};
	return DE.AFTERMATH_COPY;
};

/* Optional async reload from JSON (http(s) only). Browser play uses js/aftermath-copy.js. */
DE.loadAftermathCopy = function (url) {
	url = url || DE.AFTERMATH_COPY_URL;
	if (typeof fetch !== "function") {
		return Promise.resolve(DE.AFTERMATH_COPY || {});
	}
	return fetch(url).then(function (res) {
		if (!res.ok) throw new Error("Failed to load aftermath copy (" + res.status + ")");
		return res.json();
	}).then(function (data) {
		return DE.setAftermathCopy(data);
	});
};

DE.aftermathTemplate = function (key) {
	var table = DE.AFTERMATH_COPY;
	if (!table || !Object.keys(table).length) {
		if (typeof console !== "undefined" && console.warn) {
			console.warn("[DE] Aftermath copy table missing; key=" + key);
		}
		return key || "";
	}
	if (table[key]) return table[key];
	if (typeof console !== "undefined" && console.warn) {
		console.warn("[DE] Missing aftermath copy key: " + key);
	}
	return table.fallback_another || key || "";
};

DE.fillAftermath = function (template, vars) {
	vars = vars || {};
	return String(template || "").replace(/\{(\w+)\}/g, function (_, name) {
		return vars[name] != null ? String(vars[name]) : "";
	});
};

DE.aftermathLine = function (key, vars) {
	return DE.fillAftermath(DE.aftermathTemplate(key), vars);
};

DE.describeSeizeBrief = function (seize) {
	if (!seize || !seize.ok) return "their stores";
	if (seize.kind === "food") return (seize.amount || 0) + " food";
	if (seize.kind === "gold") return (seize.amount || 0) + " gold";
	if (seize.kind === "weapons") {
		var def = DE.unitDef(seize.type);
		return (def ? def.name : seize.type) + " weapons";
	}
	return "their stores";
};

DE.describeCaptiveBrief = function (capture) {
	if (!capture) return "captive";
	var def = DE.unitDef(capture.type);
	return def ? def.name.toLowerCase() : (capture.type || "captive");
};

DE.giftOfferBrief = function (gift, state) {
	if (!gift) return "a gift";
	var bits = DE.describeGiftContents(gift, state);
	if (bits) return bits.replace(/^\s*\(|\)\s*$/g, "") || "a gift";
	var value = DE.giftGoldEquivalent(gift);
	return value ? ("a gift worth " + value + "g") : "a gift";
};

/* outcomeKey + vars → result.notes; sets result.aftermathKey for UI gating. */
DE.applyAftermath = function (result, key, vars) {
	result.aftermathKey = key;
	result.notes = [DE.aftermathLine(key, vars || {})];
	return result;
};

DE.appendAftermath = function (result, key, vars) {
	result.notes = result.notes || [];
	result.notes.push(DE.aftermathLine(key, vars || {}));
	return result;
};

DE.isHoldGroundAftermath = function (result) {
	var key = result && result.aftermathKey;
	if (!key) return false;
	return key.indexOf("intimidate_intimidate_") === 0 ||
		key.indexOf("intimidate_open_repeat_") === 0;
};

DE.assaultSpoilKey = function (baseKey, result, winner) {
	var winAct = null;
	if (winner === "player") {
		if (result.playerAction === "seize" && result.seize && result.seize.ok) winAct = "seize";
		if (result.playerAction === "capture" && result.capture) winAct = "capture";
	} else {
		if (result.aiAction === "seize" && result.seize && result.seize.ok) winAct = "seize";
		if (result.aiAction === "capture" && result.capture) winAct = "capture";
	}
	if (!winAct) return { key: baseKey, extra: null };
	var specialized = baseKey + "_" + winAct;
	if ((DE.AFTERMATH_COPY || {})[specialized]) return { key: specialized, extra: null };
	return { key: baseKey, extra: winAct === "seize" ? "seize_detail" : "capture_detail" };
};

DE.openOpenAftermathKey = function (playerAct, aiAct) {
	var key = "open_open_" + playerAct + "_" + aiAct;
	if ((DE.AFTERMATH_COPY || {})[key]) return key;
	return "open_open_default";
};
