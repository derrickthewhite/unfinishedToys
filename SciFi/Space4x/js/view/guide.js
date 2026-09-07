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

Space4x.guideLoadStatsLabel = function (state, item) {
	if (!item) return "";
	const bits = [];
	if (item.kind === "beam") {
		if (item.damage) bits.push("Dmg " + item.damage[0] + "–" + item.damage[1]);
		if (item.range != null) bits.push("Rng " + item.range);
	} else if (item.kind === "missileLauncher") {
		if (item.range != null) bits.push("Rng " + item.range);
		if (item.unlimitedAmmo) bits.push("Unlimited ammo");
		else if (item.ammoId) {
			const ammo = Space4x.spaceLoadItem(state, item.ammoId);
			bits.push("Ammo " + (ammo ? ammo.name : item.ammoId));
		}
	} else if (item.kind === "missileAmmo" || item.kind === "missile") {
		if (item.damage != null) bits.push("Dmg " + item.damage);
		if (item.rounds != null) bits.push("Rounds " + item.rounds);
		else if (item.ammo != null) bits.push("Ammo " + item.ammo);
	} else if (item.kind === "shield" && item.shieldPerFacing != null) {
		bits.push("+" + item.shieldPerFacing + "/facing");
	} else if (item.kind === "fighter") {
		if (item.fighterBeam) bits.push("Guns " + item.fighterBeam[0] + "–" + item.fighterBeam[1]);
		if (item.fighterRange != null) bits.push("Rng " + item.fighterRange);
	} else if (item.kind === "device") {
		if (item.armorPct) bits.push("Armor +" + item.armorPct + "%");
		if (item.attackSkill) bits.push("Attack +" + item.attackSkill);
		if (item.uniqueLoad) bits.push("Fit once");
		if (item.stub) bits.push("Stub");
	}
	if (item.summary) bits.push(item.summary);
	return bits.join(" · ");
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
			thead.innerHTML = "<tr><th>Kind</th><th>Name</th><th>Size</th><th>Stats</th><th>Tech</th></tr>";
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
			const tbody = wrap.querySelector(".guide-upgrade-body");
			Space4x.syncKeyedList(tbody, sec.items, function (item) { return item.id; },
				function () {
					const tr = document.createElement("tr");
					const cells = ["kind", "name", "size", "stats", "tech"];
					for (let i = 0; i < cells.length; i++) {
						const td = document.createElement("td");
						td.className = "guide-cell-" + cells[i];
						tr.appendChild(td);
					}
					return tr;
				},
				function (row, item) {
					const kindCell = row.querySelector(".guide-cell-kind");
					kindCell.textContent = "";
					kindCell.appendChild(Space4x.makeGuideKindBadge(item.kind));
					row.querySelector(".guide-cell-name").textContent = item.name;
					row.querySelector(".guide-cell-size").textContent = Space4x.guideLoadSizeLabel(item);
					row.querySelector(".guide-cell-stats").textContent = Space4x.guideLoadStatsLabel(state, item) || "—";
					row.querySelector(".guide-cell-tech").textContent = Space4x.guideTechReqLabel(state, item);
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
