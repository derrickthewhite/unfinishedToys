var Space4x = Space4x || {};

Space4x.SAVE_SCHEMA_VERSION = 1;
Space4x.SAVE_SLOTS_KEY = "space4x-saves";
Space4x.SAVE_AUTOSAVE_KEY = "space4x-autosave";
Space4x.SAVE_SLOT_CAP = 12;
Space4x.SAVE_AUTOSAVE_EVERY = 4;

Space4x.snapshotState = function (state) {
	const copy = JSON.parse(JSON.stringify(state));
	if (copy.ui) copy.ui.autoPlaying = false;
	return copy;
};

Space4x.defaultSaveLabel = function (state) {
	const player = Space4x.playerEmpire(state);
	const homes = player ? Space4x.settlementsOf(state, player.id) : [];
	const home = homes[0] ? homes[0].name : "";
	const day = new Date().toISOString().slice(0, 10);
	const bits = ["Turn " + (state.turn || 0)];
	if (home) bits.push(home);
	bits.push(day);
	return bits.join(" · ");
};

Space4x.makeSaveEnvelope = function (state, opts) {
	opts = opts || {};
	return {
		schemaVersion: Space4x.SAVE_SCHEMA_VERSION,
		id: opts.id || ("save-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e6).toString(36)),
		label: opts.label || Space4x.defaultSaveLabel(state),
		savedAt: new Date().toISOString(),
		settingId: state.settingId,
		turn: state.turn,
		state: Space4x.snapshotState(state)
	};
};

Space4x.validateSaveEnvelope = function (envelope) {
	if (!envelope || typeof envelope !== "object") return { ok: false, reason: "Not a save file." };
	if (envelope.schemaVersion !== Space4x.SAVE_SCHEMA_VERSION) {
		return { ok: false, reason: "Unknown save version." };
	}
	if (!envelope.state || typeof envelope.state !== "object") return { ok: false, reason: "Save is missing game state." };
	const settingId = envelope.settingId || envelope.state.settingId;
	if (!settingId || !Space4x.SETTINGS[settingId]) {
		return { ok: false, reason: "Unknown game type" + (settingId ? " (" + settingId + ")" : "") + "." };
	}
	if (envelope.state.screen && envelope.state.screen !== "play") {
		return { ok: false, reason: "Save is not an in-progress game." };
	}
	return { ok: true, envelope: envelope };
};

Space4x.applySave = function (live, envelope) {
	const check = Space4x.validateSaveEnvelope(envelope);
	if (!check.ok) return check;
	const incoming = Space4x.snapshotState(envelope.state);
	incoming.screen = "play";
	if (incoming.ui) incoming.ui.autoPlaying = false;
	const oldKeys = Object.keys(live);
	for (let i = 0; i < oldKeys.length; i++) delete live[oldKeys[i]];
	const names = Object.keys(incoming);
	for (let i = 0; i < names.length; i++) live[names[i]] = incoming[names[i]];
	return { ok: true, envelope: envelope };
};

Space4x.readStorageJson = function (key) {
	try {
		if (typeof localStorage === "undefined") return null;
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch (err) {
		return null;
	}
};

Space4x.writeStorageJson = function (key, value) {
	try {
		if (typeof localStorage === "undefined") return { ok: false, reason: "Storage is not available." };
		localStorage.setItem(key, JSON.stringify(value));
		return { ok: true };
	} catch (err) {
		return { ok: false, reason: "Could not write save (storage full)." };
	}
};

Space4x.listSaveSlots = function () {
	const raw = Space4x.readStorageJson(Space4x.SAVE_SLOTS_KEY);
	return Array.isArray(raw) ? raw : [];
};

Space4x.writeSaveSlots = function (slots) {
	return Space4x.writeStorageJson(Space4x.SAVE_SLOTS_KEY, slots);
};

Space4x.readSaveSlot = function (id) {
	const slots = Space4x.listSaveSlots();
	for (let i = 0; i < slots.length; i++) {
		if (slots[i] && slots[i].id === id) return slots[i];
	}
	return null;
};

Space4x.writeSaveSlot = function (state, opts) {
	opts = opts || {};
	if (!state || state.screen !== "play") return { ok: false, reason: "Nothing to save yet." };
	const slots = Space4x.listSaveSlots();
	const label = (opts.label || Space4x.defaultSaveLabel(state)).trim();
	if (!label) return { ok: false, reason: "Save needs a name." };
	let index = -1;
	if (opts.id) {
		for (let i = 0; i < slots.length; i++) {
			if (slots[i].id === opts.id) index = i;
		}
	}
	if (index < 0) {
		for (let i = 0; i < slots.length; i++) {
			if (slots[i].label === label) index = i;
		}
	}
	if (index < 0 && slots.length >= Space4x.SAVE_SLOT_CAP) {
		return { ok: false, reason: "Too many saves (" + Space4x.SAVE_SLOT_CAP + "). Delete one first." };
	}
	const envelope = Space4x.makeSaveEnvelope(state, {
		id: index >= 0 ? slots[index].id : opts.id,
		label: label
	});
	const check = Space4x.validateSaveEnvelope(envelope);
	if (!check.ok) return check;
	if (index >= 0) slots[index] = envelope;
	else slots.unshift(envelope);
	const wrote = Space4x.writeSaveSlots(slots);
	if (!wrote.ok) return wrote;
	return { ok: true, envelope: envelope };
};

Space4x.deleteSaveSlot = function (id) {
	const slots = Space4x.listSaveSlots().filter(function (s) { return s && s.id !== id; });
	return Space4x.writeSaveSlots(slots);
};

Space4x.readAutosave = function () {
	const envelope = Space4x.readStorageJson(Space4x.SAVE_AUTOSAVE_KEY);
	const check = Space4x.validateSaveEnvelope(envelope);
	return check.ok ? check.envelope : null;
};

Space4x.writeAutosave = function (state) {
	if (!state || state.screen !== "play") return { ok: false, reason: "Nothing to save yet." };
	const envelope = Space4x.makeSaveEnvelope(state, { id: "autosave", label: Space4x.defaultSaveLabel(state) });
	const check = Space4x.validateSaveEnvelope(envelope);
	if (!check.ok) return check;
	const wrote = Space4x.writeStorageJson(Space4x.SAVE_AUTOSAVE_KEY, envelope);
	if (!wrote.ok) return wrote;
	return { ok: true, envelope: envelope };
};

Space4x.shouldAutosaveAfterTurn = function (state) {
	return !!(state && state.screen === "play" && state.turn && state.turn % Space4x.SAVE_AUTOSAVE_EVERY === 0);
};

Space4x.maybeAutosaveAfterTurn = function (state) {
	if (!Space4x.shouldAutosaveAfterTurn(state)) return { ok: false, skipped: true };
	return Space4x.writeAutosave(state);
};

Space4x.toSaveFileBlob = function (envelope) {
	return new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
};

Space4x.saveFileName = function (envelope) {
	const turn = envelope && envelope.turn != null ? envelope.turn : 0;
	return "space4x-turn-" + turn + ".json";
};

Space4x.fromSaveFileText = function (text) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (err) {
		return { ok: false, reason: "File is not valid JSON." };
	}
	return Space4x.validateSaveEnvelope(parsed);
};
