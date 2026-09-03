var Space4x = Space4x || {};

Space4x.SAVE_SCHEMA_VERSION = 1;
Space4x.SAVE_SLOTS_KEY = "space4x-saves";
Space4x.SAVE_AUTOSAVE_KEY = "space4x-autosave";
Space4x.SAVE_CHECKPOINT_KEY = "space4x-autosave-checkpoint";
Space4x.SAVE_SLOT_CAP = 12;
Space4x.SAVE_AUTOSAVE_EVERY = 4;

Space4x.snapshotState = function (state) {
	const copy = JSON.parse(JSON.stringify(state));
	if (copy.ui) {
		copy.ui.autoPlaying = false;
		copy.ui.spaceCombatAuto = false;
		const d = Space4x.emptyUiInteraction();
		const keys = Object.keys(d);
		for (let i = 0; i < keys.length; i++) copy.ui[keys[i]] = d[keys[i]];
	}
	return copy;
};

Space4x.defaultSaveLabel = function (state) {
	const player = Space4x.playerEmpire(state);
	const homes = player ? Space4x.settlementsOf(state, player.id) : [];
	const home = homes[0] ? Space4x.settlementLabel(state, homes[0]) : "";
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
	if (incoming.ui) {
		incoming.ui.autoPlaying = false;
		incoming.ui.spaceCombatAuto = false;
	}
	const oldKeys = Object.keys(live);
	for (let i = 0; i < oldKeys.length; i++) delete live[oldKeys[i]];
	const names = Object.keys(incoming);
	for (let i = 0; i < names.length; i++) live[names[i]] = incoming[names[i]];
	Space4x.ensureUiInteraction(live);
	Space4x.migrateState(live);
	return { ok: true, envelope: envelope };
};

Space4x.migrateState = function (state) {
	if (!state) return;
	if (state.galaxy && Space4x.ensureGalaxyBgSeed) Space4x.ensureGalaxyBgSeed(state);
	if (state.turnEvents && state.turnEvents.spaceBattles && Space4x.ensureAllCombatBgSeeds) {
		Space4x.ensureAllCombatBgSeeds(state);
	} else if (state.turnEvents && state.turnEvents.spaceBattles && Space4x.ensureCombatBgSeed) {
		for (let i = 0; i < state.turnEvents.spaceBattles.length; i++) {
			Space4x.ensureCombatBgSeed(state, state.turnEvents.spaceBattles[i]);
		}
	}
	if (state.empires) {
		Space4x.ensureEmpireColors(state);
		for (let e = 0; e < state.empires.length; e++) {
			Space4x.ensureEmpireDesigns(state, state.empires[e]);
			if (state.empires[e].modifiers && state.empires[e].modifiers.combatSpeed == null) {
				state.empires[e].modifiers.combatSpeed = 0;
			}
			if (state.empires[e].modifiers) {
				const m = state.empires[e].modifiers;
				if (m.structure == null) m.structure = 0;
				if (m.fighterDamage == null) m.fighterDamage = 0;
				if (m.fighterRange == null) m.fighterRange = 0;
				if (m.fighterStructure == null) m.fighterStructure = 0;
			}
			if (Space4x.ensureEmpireDesigns) Space4x.ensureEmpireDesigns(state, state.empires[e]);
		}
	}
	if (!state.settlements) return;
	if (state.turnHold == null) state.turnHold = null;
	if (state.turnHold === "afterSpace" && Space4x.playerOpenSpaceBattles &&
		!Space4x.playerOpenSpaceBattles(state).length) {
		state.turnHold = null;
	}
	if (state.ui) {
		if (state.ui.designHullId == null) state.ui.designHullId = "cruiser";
		if (state.ui.selectedSpaceBattleId === undefined) state.ui.selectedSpaceBattleId = null;
		if (state.ui.spaceEnemyTokenId === undefined) state.ui.spaceEnemyTokenId = null;
	}
	for (let i = 0; i < state.settlements.length; i++) {
		const st = state.settlements[i];
		const pops = st.pops || [];
		for (let p = 0; p < pops.length; p++) {
			if (pops[p].noResearch) delete pops[p].noResearch;
		}
		if (!st.growthAccByCulture && (st.growthAcc || st.starveAcc)) {
			const empire = Space4x.empireById(state, st.empireId);
			st.growthAccByCulture = {};
			const cid = empire && empire.cultureId;
			if (cid) st.growthAccByCulture[cid] = (st.growthAcc || 0) - (st.starveAcc || 0);
		}
	}
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

Space4x.readAutosave = function (key) {
	const envelope = Space4x.readStorageJson(key || Space4x.SAVE_AUTOSAVE_KEY);
	const check = Space4x.validateSaveEnvelope(envelope);
	return check.ok ? check.envelope : null;
};

Space4x.writeAutosave = function (state, opts) {
	opts = opts || {};
	if (!state || state.screen !== "play") return { ok: false, reason: "Nothing to save yet." };
	const key = opts.key || Space4x.SAVE_AUTOSAVE_KEY;
	const id = opts.id || "autosave";
	const label = opts.label || ("Autosave · " + Space4x.defaultSaveLabel(state));
	const envelope = Space4x.makeSaveEnvelope(state, { id: id, label: label });
	const check = Space4x.validateSaveEnvelope(envelope);
	if (!check.ok) return check;
	const wrote = Space4x.writeStorageJson(key, envelope);
	if (!wrote.ok) return wrote;
	return { ok: true, envelope: envelope };
};

Space4x.listAutosaves = function () {
	const out = [];
	const latest = Space4x.readAutosave();
	const checkpoint = Space4x.readAutosave(Space4x.SAVE_CHECKPOINT_KEY);
	if (latest) out.push(latest);
	if (checkpoint) out.push(checkpoint);
	return out;
};

Space4x.maybeAutosaveAfterTurn = function (state) {
	if (!state || state.screen !== "play") return { ok: false, skipped: true };
	const latest = Space4x.writeAutosave(state);
	if (state.turn % Space4x.SAVE_AUTOSAVE_EVERY === 0) {
		Space4x.writeAutosave(state, {
			key: Space4x.SAVE_CHECKPOINT_KEY,
			id: "autosave-checkpoint",
			label: "Checkpoint · " + Space4x.defaultSaveLabel(state)
		});
	}
	return latest;
};

Space4x.toSaveFileBlob = function (envelope) {
	return new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
};

Space4x.saveFileName = function (envelope) {
	const turn = envelope && envelope.turn != null ? envelope.turn : 0;
	return "space4x-turn-" + turn + ".json";
};

Space4x.snapshotFileName = function (envelope) {
	const turn = envelope && envelope.turn != null ? envelope.turn : 0;
	return "space4x-snapshot-turn-" + turn + ".json";
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
