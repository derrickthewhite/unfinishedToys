var Space4x = Space4x || {};

Space4x.GUIDE_LOAD_KINDS = [
	{ id: "beam", title: "Beams" },
	{ id: "missileLauncher", title: "Missile launchers" },
	{ id: "missileAmmo", title: "Missile magazines" },
	{ id: "missile", title: "Missiles" },
	{ id: "shield", title: "Shields" },
	{ id: "fighter", title: "Fighter bays" },
	{ id: "device", title: "Devices" }
];

Space4x.guideKindLabel = function (kind) {
	const map = {
		beam: "Beam",
		missileLauncher: "Launcher",
		missileAmmo: "Ammo",
		missile: "Missile",
		shield: "Shield",
		fighter: "Fighter",
		device: "Device"
	};
	return map[kind] || kind || "Item";
};

Space4x.guideTechReqLabel = function (state, def) {
	if (!def) return "—";
	if (def.requireCultureEffect) {
		const cultures = Space4x.culturesOf(state);
		const names = [];
		for (let i = 0; i < cultures.length; i++) {
			const fx = cultures[i].effects || [];
			for (let j = 0; j < fx.length; j++) {
				if (fx[j].type === def.requireCultureEffect) {
					names.push(cultures[i].name);
					break;
				}
			}
		}
		if (names.length) return names.join(" or ");
		return def.requireCultureEffect;
	}
	if (def.requireTechAny && def.requireTechAny.length) {
		const names = [];
		for (let i = 0; i < def.requireTechAny.length; i++) {
			const tech = Space4x.techById(state, def.requireTechAny[i]);
			names.push(tech ? tech.name : def.requireTechAny[i]);
		}
		return names.join(" or ");
	}
	if (def.requireTech) {
		const tech = Space4x.techById(state, def.requireTech);
		return tech ? tech.name : def.requireTech;
	}
	return "—";
};

Space4x.guideIndustryCost = function (def) {
	if (!def || !def.cost || def.cost.industry == null) return "—";
	return String(def.cost.industry);
};

Space4x.guideUnitDefs = function (state) {
	return Space4x.troopDefs(state);
};

Space4x.guideShipDefs = function (state) {
	const builds = Space4x.settingOf(state).builds;
	const ids = Object.keys(builds);
	const out = [];
	for (let i = 0; i < ids.length; i++) {
		const def = builds[ids[i]];
		if (def.kind === "unit" || (def.kind === "abstract" && def.requireCultureEffect === "spindelWeb")) {
			out.push(def);
		}
	}
	return out;
};

Space4x.guideItemTechs = function (state, def) {
	const out = [];
	if (!def) return out;
	if (def.requireTech) {
		const tech = Space4x.techById(state, def.requireTech);
		if (tech) out.push(tech);
	} else if (def.requireTechAny && def.requireTechAny.length) {
		for (let i = 0; i < def.requireTechAny.length; i++) {
			const tech = Space4x.techById(state, def.requireTechAny[i]);
			if (tech) out.push(tech);
		}
	}
	return out;
};

Space4x.guideResearchGroupLabel = function (state, def) {
	const techs = Space4x.guideItemTechs(state, def);
	if (!techs.length) return "—";
	const names = [];
	const seen = {};
	for (let i = 0; i < techs.length; i++) {
		const cat = Space4x.categoryById(state, techs[i].categoryId);
		const name = cat && cat.name ? cat.name : techs[i].categoryId;
		if (!name || seen[name]) continue;
		seen[name] = true;
		names.push(name);
	}
	return names.join(" or ") || "—";
};

Space4x.guideResearchTierLabel = function (state, def) {
	const techs = Space4x.guideItemTechs(state, def);
	if (techs.length) {
		let best = techs[0].tier;
		for (let i = 1; i < techs.length; i++) {
			if (techs[i].tier < best) best = techs[i].tier;
		}
		return best != null ? String(best) : "—";
	}
	if (def && !def.requireTech && !def.requireTechAny) return "0";
	return "—";
};

Space4x.guideItemSortValue = function (state, item) {
	const techs = Space4x.guideItemTechs(state, item);
	if (techs.length && techs[0].tier != null) {
		let best = techs[0].tier;
		for (let i = 1; i < techs.length; i++) {
			if (techs[i].tier < best) best = techs[i].tier;
		}
		return best;
	}
	return Space4x.loadItemTechTier(state, item);
};

Space4x.guideLoadItemsByKind = function (state) {
	const cat = Space4x.spaceLoadCatalog(state);
	const ids = Object.keys(cat);
	const byKind = {};
	for (let i = 0; i < ids.length; i++) {
		const item = cat[ids[i]];
		const kind = item.kind || "device";
		if (!byKind[kind]) byKind[kind] = [];
		byKind[kind].push(item);
	}
	const kinds = Object.keys(byKind);
	for (let k = 0; k < kinds.length; k++) {
		byKind[kinds[k]].sort(function (a, b) {
			const ta = Space4x.guideItemSortValue(state, a);
			const tb = Space4x.guideItemSortValue(state, b);
			if (ta !== tb) return ta - tb;
			return String(a.name || a.id).localeCompare(String(b.name || b.id));
		});
	}
	return byKind;
};

Space4x.guideLoadSizeLabel = function (item) {
	if (!item) return "—";
	if (item.sizePerN) return item.sizePerN + "×N";
	if (item.size != null) return String(item.size);
	return "—";
};

Space4x.guideFmtNum = function (n) {
	if (!(n > 0 || n === 0)) return "0";
	if (n === Math.round(n)) return String(n);
	return String(Math.round(n * 100) / 100);
};

Space4x.guideDamagePairLabel = function (pair) {
	if (!pair || pair.length < 2) return "—";
	return pair[0] + "–" + pair[1];
};

Space4x.guideBeamAccuracyLabel = function (state, item) {
	if (!item || item.kind !== "beam") return "—";
	const cfg = Space4x.spaceCombatCfg(state) || {};
	const attack = (cfg.attackSkill || 100) + (item.attackSkill || 0);
	const dodge = cfg.dodgeSkill || 50;
	const per = (cfg.rangePenaltyPerSquare || 1) * (item.rangePenaltyMult != null ? item.rangePenaltyMult : 1);
	const at0 = Math.max(0, Math.min(100, attack - dodge));
	const range = item.range || 0;
	const atMax = Math.max(0, Math.min(100, Math.round(at0 - per * range)));
	return at0 + "% at 0 sq, " + atMax + "% at " + range + " sq (−" + Space4x.guideFmtNum(per) + "%/sq)";
};

Space4x.guideMissileDamageLabel = function (state, item) {
	if (!item) return "—";
	if (item.damage != null) return String(item.damage);
	if (item.builtInDamage != null) return String(item.builtInDamage);
	if (item.ammoId) {
		const ammo = Space4x.spaceLoadItem(state, item.ammoId);
		if (ammo && ammo.damage != null) return String(ammo.damage);
	}
	return "—";
};

Space4x.guideMissileRangeLabel = function (state, item) {
	if (!item) return "—";
	if (item.range != null) return String(item.range);
	if (item.launcherId) {
		const launcher = Space4x.spaceLoadItem(state, item.launcherId);
		if (launcher && launcher.range != null) return String(launcher.range);
	}
	return "—";
};

Space4x.guideLoadNotesLabel = function (state, item) {
	if (!item) return "";
	const bits = [];
	if (item.kind === "beam") {
		if (item.damageFalloff) bits.push("Half damage beyond half range");
		if (item.armorDamageMult && item.armorDamageMult !== 1) {
			bits.push("+" + Math.round((item.armorDamageMult - 1) * 100) + "% vs armor");
		}
		if (item.shieldDamageMult != null && item.shieldDamageMult !== 1) {
			bits.push(Math.round(item.shieldDamageMult * 100) + "% vs shields");
		}
		if (item.splitArmorStructure) bits.push("Splits armor/structure");
		if (item.ignoreShields) bits.push("Ignores shields");
		if (item.ignoreArmor) bits.push("Bypasses armor");
		if (item.phaseExploit != null) bits.push("+" + Math.round(item.phaseExploit * 100) + "% vs last-turn hits");
		if (item.knockFacing) bits.push("Knock ±" + item.knockFacing + "°");
		if (item.moveDebuff != null) bits.push("−" + Math.round(item.moveDebuff * 100) + "% move one turn");
		if (item.disable) bits.push("Disable (stub)");
		if (item.burn) bits.push("Burn (stub)");
	} else if (item.kind === "missileLauncher") {
		if (item.unlimitedAmmo) bits.push("Unlimited ammo");
		else if (item.ammoId) {
			const ammo = Space4x.spaceLoadItem(state, item.ammoId);
			bits.push("Uses " + (ammo ? ammo.name : item.ammoId));
		}
		if (item.stub) bits.push("Stub");
	} else if (item.kind === "missileAmmo" || item.kind === "missile") {
		if (item.launcherId) {
			const launcher = Space4x.spaceLoadItem(state, item.launcherId);
			if (launcher) bits.push("For " + launcher.name);
		}
		if (item.stub) bits.push("Stub");
	} else if (item.kind === "fighter") {
		const cfg = Space4x.spaceCombatCfg(state);
		const mult = item.fighterSpeedMult != null ? item.fighterSpeedMult : (cfg.fighterSpeedMult || 1.5);
		bits.push(Math.round(mult * 100) + "% parent speed");
	} else if (item.kind === "device") {
		if (item.armorPct) bits.push("Armor +" + item.armorPct + "%");
		if (item.attackSkill) bits.push("Attack +" + item.attackSkill);
		if (item.uniqueLoad) bits.push("Fit once");
		if (item.stub) bits.push("Stub");
	}
	if (item.kind !== "shield" && item.summary) {
		let extra = String(item.summary);
		for (let i = 0; i < bits.length; i++) {
			if (extra.indexOf(bits[i]) !== -1) extra = extra.split(bits[i]).join("");
		}
		extra = extra.replace(/\s+/g, " ").replace(/^[\s.,;:·\-]+|[\s.,;:·\-]+$/g, "");
		if (extra) bits.push(extra);
	}
	const seen = {};
	const out = [];
	for (let i = 0; i < bits.length; i++) {
		if (!bits[i] || seen[bits[i]]) continue;
		seen[bits[i]] = true;
		out.push(bits[i]);
	}
	return out.join(" · ");
};

Space4x.GUIDE_UPGRADE_COLUMNS = {
	beam: [
		{ id: "name", title: "Name" },
		{ id: "size", title: "Size", num: true },
		{ id: "damage", title: "Damage", num: true },
		{ id: "range", title: "Range", num: true },
		{ id: "accuracy", title: "Accuracy" },
		{ id: "group", title: "Group" },
		{ id: "tier", title: "Tier", num: true },
		{ id: "notes", title: "Notes" }
	],
	missileLauncher: [
		{ id: "name", title: "Name" },
		{ id: "size", title: "Size", num: true },
		{ id: "damage", title: "Damage", num: true },
		{ id: "range", title: "Range", num: true },
		{ id: "group", title: "Group" },
		{ id: "tier", title: "Tier", num: true },
		{ id: "notes", title: "Notes" }
	],
	missileAmmo: [
		{ id: "name", title: "Name" },
		{ id: "size", title: "Size", num: true },
		{ id: "damage", title: "Damage", num: true },
		{ id: "range", title: "Range", num: true },
		{ id: "group", title: "Group" },
		{ id: "tier", title: "Tier", num: true },
		{ id: "notes", title: "Notes" }
	],
	missile: [
		{ id: "name", title: "Name" },
		{ id: "size", title: "Size", num: true },
		{ id: "damage", title: "Damage", num: true },
		{ id: "range", title: "Range", num: true },
		{ id: "group", title: "Group" },
		{ id: "tier", title: "Tier", num: true },
		{ id: "notes", title: "Notes" }
	],
	shield: [
		{ id: "name", title: "Name" },
		{ id: "size", title: "Size", num: true },
		{ id: "facing", title: "Per facing", num: true },
		{ id: "group", title: "Group" },
		{ id: "tier", title: "Tier", num: true }
	],
	fighter: [
		{ id: "name", title: "Name" },
		{ id: "size", title: "Size", num: true },
		{ id: "guns", title: "Guns", num: true },
		{ id: "range", title: "Range", num: true },
		{ id: "structure", title: "Structure", num: true },
		{ id: "group", title: "Group" },
		{ id: "tier", title: "Tier", num: true },
		{ id: "notes", title: "Notes" }
	],
	device: [
		{ id: "name", title: "Name" },
		{ id: "size", title: "Size", num: true },
		{ id: "group", title: "Group" },
		{ id: "tier", title: "Tier", num: true },
		{ id: "notes", title: "Notes" }
	]
};

Space4x.guideUpgradeColumns = function (kind) {
	return Space4x.GUIDE_UPGRADE_COLUMNS[kind] || [
		{ id: "name", title: "Name" },
		{ id: "size", title: "Size", num: true },
		{ id: "group", title: "Group" },
		{ id: "tier", title: "Tier", num: true },
		{ id: "notes", title: "Notes" }
	];
};

Space4x.guideUpgradeCellValue = function (state, item, colId) {
	if (colId === "name") return item.name || item.id;
	if (colId === "size") return Space4x.guideLoadSizeLabel(item);
	if (colId === "damage") {
		if (item.kind === "beam") return Space4x.guideDamagePairLabel(item.damage);
		return Space4x.guideMissileDamageLabel(state, item);
	}
	if (colId === "range") {
		if (item.kind === "beam") return item.range != null ? String(item.range) : "—";
		if (item.kind === "fighter") return item.fighterRange != null ? String(item.fighterRange) : "—";
		return Space4x.guideMissileRangeLabel(state, item);
	}
	if (colId === "accuracy") return Space4x.guideBeamAccuracyLabel(state, item);
	if (colId === "facing") return item.shieldPerFacing != null ? String(item.shieldPerFacing) : "—";
	if (colId === "guns") return Space4x.guideDamagePairLabel(item.fighterBeam);
	if (colId === "structure") return item.fighterStructure != null ? String(item.fighterStructure) : "—";
	if (colId === "group") return Space4x.guideResearchGroupLabel(state, item);
	if (colId === "tier") return Space4x.guideResearchTierLabel(state, item);
	if (colId === "notes") return Space4x.guideLoadNotesLabel(state, item) || "—";
	return "—";
};

Space4x.makeGuideKindBadge = function (kind) {
	const span = document.createElement("span");
	span.className = "guide-kind-badge guide-kind-" + (kind || "device");
	span.textContent = Space4x.guideKindLabel(kind);
	return span;
};

Space4x.makeGuideShipIcon = function (state, defId) {
	const path = Space4x.hullShipArtPath(state, defId) ||
		(Space4x.HULL_SHIP_ART_FALLBACK && Space4x.HULL_SHIP_ART_FALLBACK[defId]) ||
		null;
	if (!path) {
		const empty = document.createElement("span");
		empty.className = "guide-ship-missing";
		empty.textContent = "—";
		return empty;
	}
	return Space4x.makeTintedBadgeIcon(path, Space4x.OBSERVER_SHIP_COLOR, 36, 28, "guide-ship-icon");
};

Space4x.syncGuideSpeciesTable = function (tbody, state) {
	if (!tbody) return;
	const list = Space4x.culturesOf(state);
	Space4x.syncKeyedList(tbody, list, function (c) { return c.id; },
		function () {
			const tr = document.createElement("tr");
			const tdArt = document.createElement("td");
			tdArt.className = "guide-cell-art";
			const img = document.createElement("img");
			img.className = "guide-species-art";
			img.alt = "";
			tdArt.appendChild(img);
			const tdName = document.createElement("td");
			tdName.className = "guide-cell-name";
			const tdBonuses = document.createElement("td");
			tdBonuses.className = "guide-cell-bonuses";
			const tdBlurb = document.createElement("td");
			tdBlurb.className = "guide-cell-blurb";
			tr.appendChild(tdArt);
			tr.appendChild(tdName);
			tr.appendChild(tdBonuses);
			tr.appendChild(tdBlurb);
			return tr;
		},
		function (row, c) {
			const img = row.querySelector(".guide-species-art");
			Space4x.setCultureImg(img, state, c.id);
			row.querySelector(".guide-cell-name").textContent = c.name;
			const bonuses = Space4x.cultureBonusLines(state, c);
			row.querySelector(".guide-cell-bonuses").textContent = bonuses.length
				? bonuses.join("; ")
				: "—";
			row.querySelector(".guide-cell-blurb").textContent = c.blurb || "";
		}
	);
};

Space4x.syncGuideUnitsTable = function (tbody, state) {
	if (!tbody) return;
	const list = Space4x.guideUnitDefs(state);
	Space4x.syncKeyedList(tbody, list, function (d) { return d.id; },
		function () {
			const tr = document.createElement("tr");
			const cells = ["badge", "name", "tags", "ts", "cost", "upkeep", "tech", "notes"];
			for (let i = 0; i < cells.length; i++) {
				const td = document.createElement("td");
				td.className = "guide-cell-" + cells[i];
				tr.appendChild(td);
			}
			return tr;
		},
		function (row, def) {
			const badgeCell = row.querySelector(".guide-cell-badge");
			badgeCell.textContent = "";
			badgeCell.appendChild(Space4x.makeTroopBadgeRow(state, {
				defId: def.id,
				iconsOnly: true,
				extraClass: "guide-troop-badge"
			}));
			row.querySelector(".guide-cell-name").textContent = Space4x.troopDisplayName(def);
			row.querySelector(".guide-cell-tags").textContent = (def.tags || []).join(", ") || "—";
			row.querySelector(".guide-cell-ts").textContent = def.ts != null ? String(def.ts) : "—";
			row.querySelector(".guide-cell-cost").textContent = Space4x.guideIndustryCost(def);
			row.querySelector(".guide-cell-upkeep").textContent = def.upkeep != null ? String(def.upkeep) : "—";
			row.querySelector(".guide-cell-tech").textContent = Space4x.guideTechReqLabel(state, def);
			const notes = [];
			if (def.npc) notes.push("Not buildable");
			if (def.invadePastShips) notes.push("Invade past ships");
			if (def.summary) notes.push(def.summary);
			row.querySelector(".guide-cell-notes").textContent = notes.join(" · ") || "—";
		}
	);
};

Space4x.syncGuideShipsTable = function (tbody, state) {
	if (!tbody) return;
	const list = Space4x.guideShipDefs(state);
	Space4x.syncKeyedList(tbody, list, function (d) { return d.id; },
		function () {
			const tr = document.createElement("tr");
			const cells = ["icon", "name", "cost", "upkeep", "load", "tech", "summary"];
			for (let i = 0; i < cells.length; i++) {
				const td = document.createElement("td");
				td.className = "guide-cell-" + cells[i];
				tr.appendChild(td);
			}
			return tr;
		},
		function (row, def) {
			const iconCell = row.querySelector(".guide-cell-icon");
			iconCell.textContent = "";
			iconCell.appendChild(Space4x.makeGuideShipIcon(state, def.id));
			row.querySelector(".guide-cell-name").textContent = def.name;
			row.querySelector(".guide-cell-cost").textContent = Space4x.guideIndustryCost(def);
			row.querySelector(".guide-cell-upkeep").textContent = def.upkeep != null ? String(def.upkeep) : "—";
			const load = Space4x.hullLoadCap(state, def.id, null);
			row.querySelector(".guide-cell-load").textContent = load > 0 ? String(load) : "—";
			row.querySelector(".guide-cell-tech").textContent = Space4x.guideTechReqLabel(state, def);
			row.querySelector(".guide-cell-summary").textContent = def.summary || "—";
		}
	);
};

Space4x.syncGuideUpgradeTables = function (root, state) {
	if (!root) return;
	const byKind = Space4x.guideLoadItemsByKind(state);
	const sections = Space4x.GUIDE_LOAD_KINDS.slice();
	const known = {};
	for (let i = 0; i < sections.length; i++) known[sections[i].id] = true;
	const extra = Object.keys(byKind);
	for (let e = 0; e < extra.length; e++) {
		if (!known[extra[e]]) sections.push({ id: extra[e], title: Space4x.guideKindLabel(extra[e]) });
	}
	const present = [];
	for (let s = 0; s < sections.length; s++) {
		const kind = sections[s].id;
		const items = byKind[kind];
		if (!items || !items.length) continue;
		present.push({ id: kind, title: sections[s].title, items: items });
	}
	Space4x.syncKeyedList(root, present, function (sec) { return sec.id; },
		function (sec) {
			const wrap = document.createElement("div");
			wrap.className = "guide-upgrade-block";
			const h = document.createElement("h4");
			h.className = "guide-upgrade-title";
			wrap.appendChild(h);
			const tableWrap = document.createElement("div");
			tableWrap.className = "guide-table-wrap";
			const table = document.createElement("table");
			table.className = "guide-table";
			const thead = document.createElement("thead");
			thead.appendChild(document.createElement("tr"));
			table.appendChild(thead);
			const tbody = document.createElement("tbody");
			tbody.className = "guide-upgrade-body";
			table.appendChild(tbody);
			tableWrap.appendChild(table);
			wrap.appendChild(tableWrap);
			return wrap;
		},
		function (wrap, sec) {
			wrap.querySelector(".guide-upgrade-title").textContent = sec.title;
			const cols = Space4x.guideUpgradeColumns(sec.id);
			const headRow = wrap.querySelector("thead tr");
			headRow.textContent = "";
			for (let c = 0; c < cols.length; c++) {
				const th = document.createElement("th");
				th.textContent = cols[c].title;
				headRow.appendChild(th);
			}
			const tbody = wrap.querySelector(".guide-upgrade-body");
			Space4x.syncKeyedList(tbody, sec.items, function (item) { return item.id; },
				function () {
					const tr = document.createElement("tr");
					for (let i = 0; i < cols.length; i++) {
						const td = document.createElement("td");
						td.className = "guide-cell-" + cols[i].id;
						if (cols[i].num) td.classList.add("guide-num");
						tr.appendChild(td);
					}
					return tr;
				},
				function (row, item) {
					for (let i = 0; i < cols.length; i++) {
						const cell = row.querySelector(".guide-cell-" + cols[i].id);
						if (cell) cell.textContent = Space4x.guideUpgradeCellValue(state, item, cols[i].id);
					}
					row.title = Space4x.describeLoadItem(state, item);
				}
			);
		}
	);
};

Space4x.syncGuideStage = function (ui, state) {
	if (!ui.stageGuide || state.ui.stage !== "guide") return;
	Space4x.syncGuideSpeciesTable(ui.guideSpeciesBody, state);
	Space4x.syncGuideUnitsTable(ui.guideUnitsBody, state);
	Space4x.syncGuideShipsTable(ui.guideShipsBody, state);
	Space4x.syncGuideUpgradeTables(ui.guideUpgradeTables, state);
};
