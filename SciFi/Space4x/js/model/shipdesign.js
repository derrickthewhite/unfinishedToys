var Space4x = Space4x || {};

// NOTE: N (hull quality) currently rescales shield/armor/structure on existing
// warships. Revisit: snapshot N at construction so old hulls keep their era.

Space4x.spaceCombatCfg = function (state) {
	const set = Space4x.settingOf(state);
	return set.spaceCombat || {};
};

Space4x.spaceLoadCatalog = function (state) {
	return Space4x.settingOf(state).spaceLoad || {};
};

Space4x.spaceLoadItem = function (state, id) {
	return Space4x.spaceLoadCatalog(state)[id] || null;
};

Space4x.hullCombatBase = function (state, defId) {
	const def = Space4x.settingOf(state).builds[defId];
	return def && def.combat && def.combat.base ? def.combat.base : 0;
};

Space4x.isCombatHull = function (state, unit) {
	if (!unit || Space4x.isHauler(state, unit)) return false;
	return Space4x.hullCombatBase(state, unit.defId) > 0;
};

Space4x.isStationHull = function (state, unitOrDefId) {
	const defId = unitOrDefId && unitOrDefId.defId ? unitOrDefId.defId : unitOrDefId;
	const def = defId && Space4x.settingOf(state).builds[defId];
	return !!(def && (def.immobile || def.station));
};

Space4x.empireHullQualityN = function (state, empire) {
	if (!empire) return 1;
	return 1 + (empire.modifiers.shipSize || 0);
};

Space4x.normalizeDesignLoadEntry = function (entry) {
	if (!entry || !entry.itemId) return null;
	let itemId = entry.itemId;
	if (itemId === "energyBolt") itemId = "muonTorpedo";
	if (itemId === "warheadTube" || itemId === "missileLauncher") itemId = "chemicalLauncher";
	if (itemId === "missileRack") itemId = "ammoFusion";
	if (itemId === "heavyWarhead") itemId = "ammoAntimatter";
	if (itemId === "capitalWarhead") itemId = "ammoGravitic";
	if (itemId === "muonAmmo") itemId = "muonTorpedo";
	return {
		itemId: itemId,
		count: Math.max(1, Math.floor(entry.count != null ? entry.count : 1))
	};
};

Space4x.migrateLegacyDesignLoad = function (load) {
	const out = [];
	const list = load || [];
	const launcherAmmo = {
		chemicalLauncher: "ammoChemical",
		fusionLauncher: "ammoFusion",
		graviticLauncher: "ammoGravitic",
		antimatterLauncher: "ammoAntimatter",
		conversionLauncher: "ammoConversion"
	};
	const has = {};
	for (let i = 0; i < list.length; i++) {
		const e = Space4x.normalizeDesignLoadEntry(list[i]);
		if (!e) continue;
		out.push(e);
		has[e.itemId] = (has[e.itemId] || 0) + e.count;
	}
	const launcherIds = Object.keys(launcherAmmo);
	for (let l = 0; l < launcherIds.length; l++) {
		const launcherId = launcherIds[l];
		const ammoId = launcherAmmo[launcherId];
		if (has[launcherId] > 0 && !has[ammoId]) {
			out.push({ itemId: ammoId, count: 1 });
			has[ammoId] = 1;
		}
	}
	return out;
};

Space4x.normalizeDesignLoad = function (design) {
	if (!design || !design.load) return;
	design.load = Space4x.migrateLegacyDesignLoad(design.load);
};

Space4x.designHost = function (state) {
	if (Space4x.isObserver(state)) {
		if (!state.observerDesigns) {
			state.observerDesigns = {
				id: Space4x.OBSERVER_ID,
				name: "Observer drafts",
				isObserverDraft: true,
				modifiers: Space4x.emptyModifiers(),
				shipDesigns: {}
			};
		}
		if (!state.observerDesigns.shipDesigns) state.observerDesigns.shipDesigns = {};
		if (!state.observerDesigns.modifiers) state.observerDesigns.modifiers = Space4x.emptyModifiers();
		return state.observerDesigns;
	}
	return Space4x.playerEmpire(state);
};

Space4x.loadUnitSize = function (state, itemId) {
	return Space4x.loadEntrySize(state, { itemId: itemId, count: 1 });
};

Space4x.combatSpeedOf = function (state, empire, opts) {
	opts = opts || {};
	const cfg = Space4x.spaceCombatCfg(state);
	let speed = (cfg.speed || 10) + ((empire && empire.modifiers.combatSpeed) || 0);
	const hullDefId = opts.hullDefId;
	const load = opts.load;
	if (hullDefId && load) {
		const cap = Space4x.hullLoadCap(state, hullDefId);
		if (cap > 0) {
			const used = Space4x.loadListUsed(state, load);
			const empty = Math.max(0, (cap - used) / cap);
			speed = speed * (1 + empty);
		}
	}
	return speed;
};

Space4x.hullLoadCap = function (state, defId) {
	return Space4x.hullCombatBase(state, defId) * 50;
};

Space4x.loadEntrySize = function (state, entry) {
	const item = Space4x.spaceLoadItem(state, entry.itemId);
	if (!item) return 0;
	let n = item.size || 0;
	const count = Math.max(1, Math.floor(entry.count != null ? entry.count : 1));
	return n * count;
};

Space4x.isMissileLauncher = function (item) {
	return !!(item && item.kind === "missileLauncher");
};

Space4x.isMissileAmmo = function (item) {
	return !!(item && item.kind === "missileAmmo");
};

Space4x.isCombatWeaponItem = function (item) {
	if (!item) return false;
	if (item.kind === "missileAmmo" || item.kind === "shield" || item.kind === "device") return false;
	return item.kind === "beam" || item.kind === "missileLauncher" || item.kind === "fighter" || item.kind === "missile";
};

Space4x.buildMissileAmmoPool = function (state, expandedLoad) {
	const pool = {};
	const list = expandedLoad || [];
	for (let i = 0; i < list.length; i++) {
		const item = Space4x.spaceLoadItem(state, list[i].itemId);
		if (!Space4x.isMissileAmmo(item)) continue;
		const rounds = item.rounds == null ? 999999 : item.rounds;
		pool[item.id] = (pool[item.id] || 0) + rounds;
	}
	return pool;
};

Space4x.missileAmmoPriority = function () {
	return ["ammoConversion", "ammoGravitic", "ammoAntimatter", "ammoFusion", "ammoChemical"];
};

Space4x.launcherHasAmmo = function (state, pool, launcherItem) {
	if (!launcherItem || launcherItem.kind !== "missileLauncher") return false;
	if (launcherItem.unlimitedAmmo) return true;
	const ammoId = launcherItem.ammoId;
	return !!(ammoId && pool && pool[ammoId] > 0);
};

Space4x.launcherAmmoItem = function (state, pool, launcherItem) {
	if (!launcherItem || launcherItem.kind !== "missileLauncher") return null;
	if (launcherItem.unlimitedAmmo) return launcherItem;
	const ammoId = launcherItem.ammoId;
	if (!ammoId || !pool || !(pool[ammoId] > 0)) return null;
	return Space4x.spaceLoadItem(state, ammoId);
};

Space4x.consumeLauncherAmmo = function (pool, launcherItem, ammoItem) {
	if (!launcherItem || launcherItem.unlimitedAmmo) return;
	if (!pool || !ammoItem || !launcherItem.ammoId) return;
	if (pool[launcherItem.ammoId] > 0) pool[launcherItem.ammoId] -= 1;
};

Space4x.missileCombatSpeed = function (state, shooter) {
	const cfg = Space4x.spaceCombatCfg(state);
	const mult = cfg.missileSpeedMult != null ? cfg.missileSpeedMult : 2;
	const shipSpeed = shooter && shooter.speed != null ? shooter.speed : (cfg.speed || 10);
	return shipSpeed * mult;
};

Space4x.fighterCombatSpeed = function (state, shooter, item) {
	const cfg = Space4x.spaceCombatCfg(state);
	const baseMult = cfg.fighterSpeedMult != null ? cfg.fighterSpeedMult : 1.5;
	const mult = item && item.fighterSpeedMult != null ? item.fighterSpeedMult : baseMult;
	const shipSpeed = shooter && shooter.speed != null ? shooter.speed : (cfg.speed || 10);
	return shipSpeed * mult;
};

Space4x.loadListUsed = function (state, load) {
	let n = 0;
	const list = load || [];
	for (let i = 0; i < list.length; i++) n += Space4x.loadEntrySize(state, list[i]);
	return n;
};

Space4x.designLoadUsed = function (state, design) {
	return Space4x.loadListUsed(state, design && design.load);
};

Space4x.expandDesignLoad = function (load) {
	const out = [];
	const list = load || [];
	for (let i = 0; i < list.length; i++) {
		const e = Space4x.normalizeDesignLoadEntry(list[i]);
		if (!e) continue;
		for (let c = 0; c < e.count; c++) out.push({ itemId: e.itemId });
	}
	return out;
};

Space4x.describeLoadItem = function (state, item) {
	if (!item) return "";
	const lines = [];
	lines.push(item.name + " (" + item.kind + ")");
	lines.push("Load size " + (item.size || 0));
	if (item.kind === "beam") {
		if (item.damage) lines.push("Damage " + item.damage[0] + "–" + item.damage[1]);
		if (item.range != null) lines.push("Range " + item.range);
		if (item.damageFalloff) lines.push("Half damage beyond half range");
		if (item.rangePenaltyMult && item.rangePenaltyMult !== 1) {
			const pct = Math.round((item.rangePenaltyMult - 1) * 100);
			lines.push("Range accuracy penalty +" + pct + "%");
		}
		if (item.armorDamageMult && item.armorDamageMult !== 1) {
			const pct = Math.round((item.armorDamageMult - 1) * 100);
			lines.push("+" + pct + "% damage vs armor");
		}
		if (item.phaseExploit != null) lines.push("+" + Math.round(item.phaseExploit * 100) + "% vs targets hit last turn");
		if (item.splitArmorStructure) lines.push("Splits damage between armor and structure");
		if (item.ignoreShields) lines.push("Ignores shields");
		if (item.ignoreArmor) lines.push("Bypasses armor");
		if (item.shieldDamageMult != null && item.shieldDamageMult !== 1) {
			lines.push(Math.round(item.shieldDamageMult * 100) + "% damage to shields");
		}
		if (item.knockFacing) lines.push("Knock ±" + item.knockFacing + "° facing");
		if (item.moveDebuff != null) lines.push("−" + Math.round(item.moveDebuff * 100) + "% move one turn");
		if (item.burn) lines.push("Burn (stub)");
		if (item.disable) lines.push("Disable (stub)");
	}
	if (item.kind === "missileLauncher") {
		if (item.range != null) lines.push("Range " + item.range);
		if (item.unlimitedAmmo) lines.push("Unlimited shots");
		else if (item.ammoId) lines.push("Uses " + (Space4x.spaceLoadItem(state, item.ammoId) || {}).name || item.ammoId);
	}
	if (item.kind === "missileAmmo") {
		if (item.damage != null) lines.push("Damage " + item.damage);
		if (item.rounds != null) lines.push("Rounds " + item.rounds);
		else lines.push("Rounds unlimited");
		if (item.launcherId) {
			const launcher = Space4x.spaceLoadItem(state, item.launcherId);
			if (launcher) lines.push("For " + launcher.name);
		}
	}
	if (item.kind === "missile") {
		if (item.damage != null) lines.push("Damage " + item.damage);
		if (item.ammo != null) lines.push("Ammo " + item.ammo);
		else lines.push("Ammo unlimited");
	}
	if (item.kind === "fighter") {
		if (item.fighterBeam) lines.push("Fighter guns " + item.fighterBeam[0] + "–" + item.fighterBeam[1]);
		if (item.fighterRange != null) lines.push("Fighter range " + item.fighterRange);
		if (item.fighterStructure != null) lines.push("Fighter structure " + item.fighterStructure);
		const cfg = Space4x.spaceCombatCfg(state);
		const mult = item.fighterSpeedMult != null ? item.fighterSpeedMult : (cfg.fighterSpeedMult || 1.5);
		lines.push("Fighter speed " + Math.round(mult * 100) + "% of parent ship");
	}
	if (item.kind === "shield" && item.shieldPerFacing != null) {
		lines.push("Shield +" + item.shieldPerFacing + " per facing");
	}
	if (item.attackSkill) lines.push("Attack skill +" + item.attackSkill);
	if (item.stub) lines.push("Effect stub (not fully wired)");
	if (item.summary) lines.push(item.summary);
	return lines.join("\n");
};

Space4x.loadItemAvailable = function (state, empire, item) {
	if (!item) return false;
	if (Space4x.isObserver(state) || (empire && empire.isObserverDraft)) return true;
	if (item.requireTechAny && item.requireTechAny.length) {
		for (let i = 0; i < item.requireTechAny.length; i++) {
			if (Space4x.empireHasTech(empire, item.requireTechAny[i])) return true;
		}
		return false;
	}
	if (!item.requireTech) return true;
	return Space4x.empireHasTech(empire, item.requireTech);
};

Space4x.availableLoadItems = function (state, empire) {
	const cat = Space4x.spaceLoadCatalog(state);
	const ids = Object.keys(cat);
	const out = [];
	for (let i = 0; i < ids.length; i++) {
		if (Space4x.loadItemAvailable(state, empire, cat[ids[i]])) out.push(cat[ids[i]]);
	}
	return out;
};

Space4x.autoDesignLoad = function (state, empire, hullDefId) {
	const cap = Space4x.hullLoadCap(state, hullDefId);
	const items = Space4x.availableLoadItems(state, empire);
	const byId = {};
	for (let i = 0; i < items.length; i++) byId[items[i].id] = items[i];
	const load = [];
	let used = 0;
	function addGroup(id, count) {
		const item = byId[id];
		if (!item) return 0;
		const unit = Space4x.loadUnitSize(state, id);
		if (!(unit > 0)) return 0;
		let n = count != null ? count : 1;
		while (n > 0 && used + unit * n > cap) n--;
		if (n <= 0) return 0;
		load.push({ itemId: id, count: n });
		used += unit * n;
		return n;
	}
	function fillItem(id) {
		const unit = Space4x.loadUnitSize(state, id);
		if (!(unit > 0) || !byId[id]) return 0;
		const n = Math.floor((cap - used) / unit);
		if (n > 0) return addGroup(id, n);
		return 0;
	}
	const shields = ["shieldX", "shieldV", "hardShield", "deflector"];
	for (let s = 0; s < shields.length; s++) {
		if (addGroup(shields[s], 1)) break;
	}
	addGroup("radioScanner", 1);
	addGroup("smartArmor", 1);
	if (hullDefId === "battleship" || hullDefId === "defenseStation") {
		const fighters = ["assaultBay", "strikeBay", "interceptorBay", "fighterBay"];
		for (let f = 0; f < fighters.length; f++) {
			if (addGroup(fighters[f], 1)) break;
		}
	}
	const missilePairs = [
		["conversionLauncher", "ammoConversion"],
		["graviticLauncher", "ammoGravitic"],
		["antimatterLauncher", "ammoAntimatter"],
		["fusionLauncher", "ammoFusion"],
		["chemicalLauncher", "ammoChemical"]
	];
	let launcherId = null;
	let ammoId = null;
	for (let m = 0; m < missilePairs.length; m++) {
		if (byId[missilePairs[m][0]] && byId[missilePairs[m][1]]) {
			launcherId = missilePairs[m][0];
			ammoId = missilePairs[m][1];
			break;
		}
	}
	if (launcherId && ammoId) {
		const launchSize = Space4x.loadUnitSize(state, launcherId);
		const ammoSize = Space4x.loadUnitSize(state, ammoId);
		const packSize = launchSize + ammoSize * 5;
		let packs = packSize > 0 ? Math.floor((cap - used) / packSize) : 0;
		if (packs < 1 && launchSize + ammoSize <= cap - used) packs = 1;
		if (packs > 0) {
			addGroup(launcherId, packs);
			addGroup(ammoId, packs * 5);
		}
		while (ammoSize > 0 && used + ammoSize <= cap) addGroup(ammoId, 1);
		while (launchSize > 0 && used + launchSize + ammoSize * 5 <= cap) {
			addGroup(launcherId, 1);
			addGroup(ammoId, 5);
		}
	} else if (byId.muonTorpedo) {
		fillItem("muonTorpedo");
	}
	const beams = [
		"mesonGun", "gravitonLance", "antimatterBeam", "novaProjector", "gravitonBeam", "gravityGun",
		"fusionBeam", "forceBolt", "graserBeam", "neutronBeam", "disintegrators", "destructors",
		"protonBeam", "phaseCutter", "plasmaBeam", "blasters", "focusedBeam", "phasers",
		"plasmaBolts", "gaussCannon", "pulseArray", "massDriver", "maserBeam", "ionBolt", "particleBeam", "lightCannon"
	];
	let beamId = null;
	for (let b = 0; b < beams.length; b++) {
		if (byId[beams[b]]) {
			beamId = beams[b];
			break;
		}
	}
	if (beamId) fillItem(beamId);
	if (ammoId) fillItem(ammoId);
	else if (byId.muonTorpedo) fillItem("muonTorpedo");
	else if (beamId) fillItem(beamId);
	if (!load.length && byId.chemicalLauncher && byId.ammoChemical) {
		addGroup("chemicalLauncher", 1);
		addGroup("ammoChemical", 5);
		fillItem("ammoChemical");
	}
	return load;
};

Space4x.defaultDesignName = function (state, hullDefId, n) {
	const def = Space4x.settingOf(state).builds[hullDefId];
	return (def ? def.name : hullDefId) + " " + Space4x.toRoman(n);
};

Space4x.pickDesignArtIndex = function (state, empire, hullDefId, sequentialIndex) {
	const count = Space4x.shipArtCount(state, hullDefId);
	if (!(count > 0)) return 0;
	if (empire && !empire.isPlayer) return Space4x.rngInt(state, count);
	const n = sequentialIndex != null ? sequentialIndex : 0;
	return ((n % count) + count) % count;
};

Space4x.ensureEmpireDesigns = function (state, empire) {
	if (!empire) return;
	if (!empire.shipDesigns) empire.shipDesigns = {};
	const hulls = ["cruiser", "battleship", "defenseStation"];
	for (let i = 0; i < hulls.length; i++) {
		const hull = hulls[i];
		let pack = empire.shipDesigns[hull];
		if (!pack || !pack.list || !pack.list.length) {
			const design = {
				id: Space4x.nextId(state, "d"),
				name: Space4x.defaultDesignName(state, hull, 1),
				hullDefId: hull,
				load: Space4x.autoDesignLoad(state, empire, hull)
			};
			Space4x.syncDesignShipArt(state, hull, design, Space4x.pickDesignArtIndex(state, empire, hull, 0));
			pack = { activeId: design.id, list: [design] };
			empire.shipDesigns[hull] = pack;
		}
		if (!pack.activeId) pack.activeId = pack.list[0].id;
		for (let d = 0; d < pack.list.length; d++) {
			Space4x.normalizeDesignLoad(pack.list[d]);
			if (pack.list[d].artIndex == null && !empire.isPlayer) {
				Space4x.syncDesignShipArt(state, hull, pack.list[d],
					Space4x.pickDesignArtIndex(state, empire, hull, d));
			}
		}
		Space4x.syncPackShipArt(state, hull, pack);
	}
};

Space4x.designById = function (empire, hullDefId, designId) {
	const pack = empire && empire.shipDesigns && empire.shipDesigns[hullDefId];
	if (!pack) return null;
	for (let i = 0; i < pack.list.length; i++) {
		if (pack.list[i].id === designId) return pack.list[i];
	}
	return null;
};

Space4x.activeDesign = function (empire, hullDefId) {
	const pack = empire && empire.shipDesigns && empire.shipDesigns[hullDefId];
	if (!pack) return null;
	return Space4x.designById(empire, hullDefId, pack.activeId) || pack.list[0] || null;
};

Space4x.snapshotCombatFit = function (state, empire, hullDefId, design) {
	const src = design || Space4x.activeDesign(empire, hullDefId);
	const idx = src
		? (src.artIndex != null ? src.artIndex : Space4x.designIndexInPack(empire, hullDefId, src))
		: 0;
	if (src) Space4x.syncDesignShipArt(state, hullDefId, src, idx);
	return {
		designId: src ? src.id : null,
		designName: src ? src.name : "Stock",
		shipArt: Space4x.designShipArtPath(state, hullDefId, src),
		load: src && src.load ? Space4x.expandDesignLoad(src.load) : []
	};
};

Space4x.autoUpdateDesign = function (state, empire, hullDefId) {
	Space4x.ensureEmpireDesigns(state, empire);
	const design = Space4x.activeDesign(empire, hullDefId);
	if (!design) return false;
	design.load = Space4x.autoDesignLoad(state, empire, hullDefId);
	return true;
};

Space4x.addNamedDesign = function (state, empire, hullDefId) {
	Space4x.ensureEmpireDesigns(state, empire);
	const cfg = Space4x.spaceCombatCfg(state);
	const cap = cfg.maxDesignsPerHull || 6;
	const pack = empire.shipDesigns[hullDefId];
	if (pack.list.length >= cap) return null;
	const design = {
		id: Space4x.nextId(state, "d"),
		name: Space4x.defaultDesignName(state, hullDefId, pack.list.length + 1),
		hullDefId: hullDefId,
		load: Space4x.autoDesignLoad(state, empire, hullDefId)
	};
	Space4x.syncDesignShipArt(state, hullDefId, design,
		Space4x.pickDesignArtIndex(state, empire, hullDefId, pack.list.length));
	pack.list.push(design);
	pack.activeId = design.id;
	return design;
};

Space4x.setDesignArtIndex = function (state, empire, hullDefId, designId, artIndex) {
	const design = Space4x.designById(empire, hullDefId, designId);
	const count = Space4x.shipArtCount(state, hullDefId);
	if (!design || !count) return false;
	const idx = ((Math.floor(artIndex) % count) + count) % count;
	Space4x.syncDesignShipArt(state, hullDefId, design, idx);
	Space4x.refreshUnitsCombatFitForDesign(state, empire, hullDefId, designId);
	return true;
};

Space4x.cycleDesignArtIndex = function (state, empire, hullDefId, designId, delta) {
	const design = Space4x.designById(empire, hullDefId, designId);
	if (!design) return false;
	const cur = Space4x.designArtIndex(state, hullDefId, design);
	return Space4x.setDesignArtIndex(state, empire, hullDefId, designId, cur + delta);
};

Space4x.refreshUnitsCombatFitForDesign = function (state, empire, hullDefId, designId) {
	const design = Space4x.designById(empire, hullDefId, designId);
	if (!design || !state.units) return;
	const fit = Space4x.snapshotCombatFit(state, empire, hullDefId, design);
	for (let i = 0; i < state.units.length; i++) {
		const u = state.units[i];
		if (!u || u.empireId !== empire.id || u.defId !== hullDefId || !u.combatFit) continue;
		if (u.combatFit.designId === designId) u.combatFit.shipArt = fit.shipArt;
	}
};

Space4x.setActiveDesign = function (empire, hullDefId, designId) {
	const pack = empire && empire.shipDesigns && empire.shipDesigns[hullDefId];
	if (!pack || !Space4x.designById(empire, hullDefId, designId)) return false;
	pack.activeId = designId;
	return true;
};

Space4x.renameDesign = function (empire, hullDefId, designId, name) {
	const design = Space4x.designById(empire, hullDefId, designId);
	if (!design) return false;
	const text = String(name || "").trim();
	if (!text) return false;
	design.name = text.slice(0, 32);
	return true;
};

Space4x.addDesignLoadItem = function (state, empire, hullDefId, designId, itemId) {
	const design = Space4x.designById(empire, hullDefId, designId);
	const item = Space4x.spaceLoadItem(state, itemId);
	if (!design || !item || !Space4x.loadItemAvailable(state, empire, item)) return false;
	Space4x.normalizeDesignLoad(design);
	const cap = Space4x.hullLoadCap(state, hullDefId);
	const entry = { itemId: itemId, count: 1 };
	if (Space4x.designLoadUsed(state, design) + Space4x.loadEntrySize(state, entry) > cap) return false;
	design.load.push(entry);
	return true;
};

Space4x.removeDesignLoadAt = function (empire, hullDefId, designId, index) {
	const design = Space4x.designById(empire, hullDefId, designId);
	if (!design || index < 0 || index >= design.load.length) return false;
	design.load.splice(index, 1);
	return true;
};

Space4x.designGroupMaxCount = function (state, design, hullDefId, index) {
	const entry = design && design.load ? design.load[index] : null;
	if (!entry) return 1;
	const unit = Space4x.loadUnitSize(state, entry.itemId);
	if (!(unit > 0)) return 1;
	const cap = Space4x.hullLoadCap(state, hullDefId);
	const others = Space4x.designLoadUsed(state, design) - Space4x.loadEntrySize(state, entry);
	return Math.max(1, Math.floor((cap - others) / unit));
};

Space4x.setDesignLoadCount = function (state, empire, hullDefId, designId, index, count) {
	const design = Space4x.designById(empire, hullDefId, designId);
	if (!design || index < 0 || index >= design.load.length) return false;
	Space4x.normalizeDesignLoad(design);
	const max = Space4x.designGroupMaxCount(state, design, hullDefId, index);
	const n = Math.max(1, Math.min(max, Math.floor(count)));
	design.load[index].count = n;
	return true;
};

Space4x.adjustDesignLoadCount = function (state, empire, hullDefId, designId, index, delta) {
	const design = Space4x.designById(empire, hullDefId, designId);
	if (!design || index < 0 || index >= design.load.length) return false;
	Space4x.normalizeDesignLoad(design);
	const cur = design.load[index].count || 1;
	return Space4x.setDesignLoadCount(state, empire, hullDefId, designId, index, cur + delta);
};

Space4x.shieldPerFacingFromLoad = function (state, empire, load) {
	const N = Space4x.empireHullQualityN(state, empire);
	let n = 0;
	const list = load || [];
	for (let i = 0; i < list.length; i++) {
		const item = Space4x.spaceLoadItem(state, list[i].itemId);
		const count = Math.max(1, Math.floor(list[i].count != null ? list[i].count : 1));
		if (item && item.kind === "shield") n += (item.shieldPerFacing || 0) * count;
	}
	return Math.max(0, n * N + ((empire && empire.modifiers.shield) || 0));
};

Space4x.shipLayerHp = function (state, empire, hullDefId, layer, load) {
	const B = Space4x.hullCombatBase(state, hullDefId);
	const N = Space4x.empireHullQualityN(state, empire);
	if (layer === "shield") {
		if (load) return Space4x.shieldPerFacingFromLoad(state, empire, load);
		const design = Space4x.activeDesign(empire, hullDefId);
		return Space4x.shieldPerFacingFromLoad(state, empire, design && design.load);
	}
	if (layer === "armor") return Math.max(0, B * 50 * (N + ((empire && empire.modifiers.armor) || 0)));
	if (layer === "structure") return Math.max(0, B * 50 * (N + ((empire && empire.modifiers.structure) || 0)));
	return 0;
};
