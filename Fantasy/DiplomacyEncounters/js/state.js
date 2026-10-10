var DE = DE || {};

DE.SAVE_KEY = "diplomacyEncounters.save";
DE.SAVES_KEY = "diplomacyEncounters.saves";

DE.getStorage = function () {
	if (DE._storage) return DE._storage;
	if (typeof localStorage !== "undefined") return localStorage;
	return null;
};

DE.mergeStuffGold = function (state) {
	if (!state.mission) return state.player.gold;
	return state.player.gold + (state.mission.stuff.gold || 0);
};

DE.serializeState = function (state) {
	return JSON.stringify(state);
};

DE.cloneStateForSave = function (state) {
	var copy = JSON.parse(DE.serializeState(state));
	if (copy.ui) {
		copy.ui.menuOpen = false;
		copy.ui.menuNote = "";
		copy.ui.importText = "";
	}
	return copy;
};

DE.deserializeState = function (raw) {
	var state = typeof raw === "string" ? JSON.parse(raw) : raw;
	if (!state || !state.player || !state.factions || !state.ui) {
		throw new Error("Invalid save data");
	}
	state.ui = state.ui || DE.emptyUi();
	state.ui.menuOpen = false;
	state.ui.menuNote = "";
	state.ui.importText = "";
	state.chronicle = state.chronicle || [];
	state.logs = state.logs || {};
	state.player.knownMonsters = state.player.knownMonsters || {};
	if (state.monsterCvBump == null) state.monsterCvBump = 0;
	if (state.intelligentCvBump == null) state.intelligentCvBump = 0;
	if (typeof DE.ensureInfoState === "function") DE.ensureInfoState(state);
	DE.syncAllVillageMarches(state);
	state.usedUnitNames = state.usedUnitNames || {};
	state.villageTickPaid = state.villageTickPaid || 0;
	var facs = state.factions || [];
	for (var f = 0; f < facs.length; f++) {
		facs[f].poolUnits = facs[f].poolUnits || [];
	}
	var villages = state.villages || [];
	for (var v = 0; v < villages.length; v++) {
		var village = villages[v];
		village.units = village.units || [];
		village.weapons = village.weapons || [];
		village.captives = village.captives || [];
		if (village.gold == null) village.gold = 0;
		if (village.magic == null) village.magic = 0;
		if (village.food == null) village.food = 0;
	}
	if (state.mission) {
		state.mission.metVillageIds = state.mission.metVillageIds || [];
		if (state.mission.pendingEncounter) {
			delete state.mission.pendingEncounter.stance;
		}
	}
	state.markHostageIds = state.markHostageIds || [];
	return state;
};

DE.readSaveStore = function () {
	var storage = DE.getStorage();
	if (!storage) return {};
	DE.migrateLegacySave();
	try {
		var raw = storage.getItem(DE.SAVES_KEY);
		if (!raw) return {};
		var parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch (err) {
		return {};
	}
};

DE.writeSaveStore = function (store) {
	var storage = DE.getStorage();
	if (!storage) throw new Error("No local storage");
	storage.setItem(DE.SAVES_KEY, JSON.stringify(store));
};

DE.migrateLegacySave = function () {
	var storage = DE.getStorage();
	if (!storage) return;
	var legacy = storage.getItem(DE.SAVE_KEY);
	if (!legacy) return;
	try {
		var store = {};
		try {
			store = JSON.parse(storage.getItem(DE.SAVES_KEY) || "{}") || {};
		} catch (e) {
			store = {};
		}
		if (!store["Legacy save"]) {
			store["Legacy save"] = {
				savedAt: Date.now(),
				state: JSON.parse(legacy)
			};
			storage.setItem(DE.SAVES_KEY, JSON.stringify(store));
		}
		storage.removeItem(DE.SAVE_KEY);
	} catch (err) {
		/* leave legacy in place if migration fails */
	}
};

DE.normalizeSaveName = function (name) {
	var n = String(name || "").trim();
	if (!n) return "";
	return n.slice(0, 48);
};

DE.listLocalSaves = function () {
	var store = DE.readSaveStore();
	var names = Object.keys(store);
	names.sort(function (a, b) {
		return (store[b].savedAt || 0) - (store[a].savedAt || 0);
	});
	return names.map(function (name) {
		return {
			name: name,
			savedAt: store[name] && store[name].savedAt ? store[name].savedAt : 0
		};
	});
};

DE.hasLocalSave = function () {
	return DE.listLocalSaves().length > 0;
};

DE.saveToLocal = function (state, name) {
	if (!DE.getStorage()) return { ok: false, reason: "No local storage" };
	var saveName = DE.normalizeSaveName(name);
	if (!saveName) return { ok: false, reason: "Enter a save name" };
	try {
		var store = DE.readSaveStore();
		store[saveName] = {
			savedAt: Date.now(),
			state: DE.cloneStateForSave(state)
		};
		DE.writeSaveStore(store);
		return { ok: true, name: saveName };
	} catch (err) {
		return { ok: false, reason: String(err && err.message ? err.message : err) };
	}
};

DE.loadFromLocal = function (name) {
	if (!DE.getStorage()) return { ok: false, reason: "No local storage" };
	var saveName = DE.normalizeSaveName(name);
	if (!saveName) return { ok: false, reason: "Choose a save to load" };
	var store = DE.readSaveStore();
	var entry = store[saveName];
	if (!entry || !entry.state) return { ok: false, reason: "No save named \"" + saveName + "\"" };
	try {
		return { ok: true, state: DE.deserializeState(entry.state), name: saveName };
	} catch (err) {
		return { ok: false, reason: String(err && err.message ? err.message : err) };
	}
};

DE.deleteLocalSave = function (name) {
	if (!DE.getStorage()) return { ok: false, reason: "No local storage" };
	var saveName = DE.normalizeSaveName(name);
	if (!saveName) return { ok: false, reason: "Choose a save to delete" };
	var store = DE.readSaveStore();
	if (!store[saveName]) return { ok: false, reason: "No save named \"" + saveName + "\"" };
	delete store[saveName];
	DE.writeSaveStore(store);
	return { ok: true, name: saveName };
};

DE.formatSaveTime = function (ts) {
	if (!ts) return "";
	try {
		return new Date(ts).toLocaleString();
	} catch (err) {
		return String(ts);
	}
};

DE.exportStateText = function (state) {
	return JSON.stringify(DE.cloneStateForSave(state), null, 2);
};

DE.downloadExport = function (state, name) {
	if (typeof document === "undefined") return { ok: false, reason: "No document" };
	var text = DE.exportStateText(state);
	var blob = new Blob([text], { type: "application/json" });
	var url = URL.createObjectURL(blob);
	var a = document.createElement("a");
	a.href = url;
	var label = DE.normalizeSaveName(name) || state.seedText || "save";
	a.download = "diplomacy-encounters-" + String(label).replace(/[^\w.-]+/g, "_") + ".json";
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	return { ok: true };
};
