var Space4x = Space4x || {};

Space4x.techStatus = function (empire, tech) {
	if (Space4x.empireHasTech(empire, tech.id)) return "done";
	const tier = Space4x.categoryTierOf(empire, tech.categoryId);
	if (tech.tier < tier) return "skipped";
	if (tech.tier === tier) {
		if (empire.research.currentProjectId === tech.id) return "current";
		return "available";
	}
	return "locked";
};

Space4x.fillTechDetail = function (ui, state, player, tech, catObj) {
	if (!tech) {
		Space4x.setText(ui.researchDetailName, catObj ? catObj.name : "Research");
		Space4x.setText(ui.researchDetailMeta, "This field is finished.");
		Space4x.setText(ui.researchDetailSummary, "");
		Space4x.syncKeyedList(ui.researchDetailEffects, [], function () { return ""; }, function () { return document.createElement("li"); }, function () {});
		if (ui.researchDetailBlurb) ui.researchDetailBlurb.hidden = true;
		ui.btnResearchSelect.disabled = true;
		Space4x.setText(ui.btnResearchSelect, "Nothing left here");
		return;
	}
	const status = Space4x.techStatus(player, tech);
	const opts = Space4x.availableTechs(state, player, tech.categoryId);
	Space4x.setText(ui.researchDetailName, tech.name);
	let meta = (catObj ? catObj.name : "") + " · tier " + tech.tier + " · cost " + tech.cost + " · " + status;
	if (status === "available" && opts.length > 1) meta += " · " + opts.length + " choices at this tier";
	Space4x.setText(ui.researchDetailMeta, meta);
	Space4x.setText(ui.researchDetailSummary, tech.summary || "");
	if (ui.researchDetailSummary) ui.researchDetailSummary.hidden = !tech.summary;
	const fxItems = [];
	for (let i = 0; i < tech.effects.length; i++) {
		fxItems.push({ id: tech.effects[i].type + "-" + i, fx: tech.effects[i] });
	}
	Space4x.syncKeyedList(ui.researchDetailEffects, fxItems, function (item) { return item.id; },
		function () {
			const li = document.createElement("li");
			li.appendChild(document.createElement("span"));
			return li;
		},
		function (row, item) {
			row.querySelector("span").textContent = Space4x.describeEffect(state, item.fx);
		}
	);
	if (ui.researchDetailBlurb) {
		ui.researchDetailBlurb.hidden = !(tech.summary || fxItems.length);
	}
	if (ui.researchDetailEffects) ui.researchDetailEffects.hidden = !fxItems.length;
	if (status === "current") {
		ui.btnResearchSelect.disabled = true;
		Space4x.setText(ui.btnResearchSelect, "Current project");
	} else if (status === "available") {
		ui.btnResearchSelect.disabled = false;
		Space4x.setText(ui.btnResearchSelect, "Research this");
	} else if (status === "done") {
		ui.btnResearchSelect.disabled = true;
		Space4x.setText(ui.btnResearchSelect, "Already finished");
	} else if (status === "skipped") {
		ui.btnResearchSelect.disabled = true;
		Space4x.setText(ui.btnResearchSelect, "Not taken this run");
	} else {
		ui.btnResearchSelect.disabled = true;
		Space4x.setText(ui.btnResearchSelect, "Locked — finish this field's earlier tier first");
	}
};

Space4x.syncResearchStage = function (ui, state, cmds) {
	const player = Space4x.playerEmpire(state);
	if (!player) return;
	if (!player.research.currentProjectId) {
		Space4x.setText(ui.researchCurrent, "No project selected.");
		if (ui.researchCurrent) ui.researchCurrent.title = "";
	} else {
		const cur = Space4x.techById(state, player.research.currentProjectId);
		const pct = cur && cur.cost ? Math.floor(100 * player.research.progress / cur.cost) : 0;
		let line = "Current: " + cur.name + " — " + player.research.progress + " / " + cur.cost + " (" + pct + "%)";
		const sci = Space4x.researchTreatyPreview(state, player);
		if (sci.total) line += " · treaties +" + sci.total + "/turn";
		if (sci.overlap) line += " (aligned)";
		Space4x.setText(ui.researchCurrent, line);
		if (ui.researchCurrent) ui.researchCurrent.title = sci.lines.join("\n");
	}
	const cats = Space4x.settingOf(state).categories;
	let selected = state.ui.selectedCategoryId;
	if (!selected) {
		if (player.research.currentProjectId) {
			const cur = Space4x.techById(state, player.research.currentProjectId);
			if (cur) selected = cur.categoryId;
		}
		if (!selected && cats[0]) selected = cats[0].id;
	}
	Space4x.syncKeyedList(ui.researchCatList, cats, function (c) { return c.id; },
		function () {
			const li = document.createElement("li");
			li.className = "research-cat";
			const name = document.createElement("div");
			name.className = "research-cat-name";
			const next = document.createElement("div");
			next.className = "research-cat-next muted";
			li.appendChild(name);
			li.appendChild(next);
			li.addEventListener("click", function () {
				cmds.selectCategory(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, cat) {
			const opts = Space4x.availableTechs(state, player, cat.id);
			row.querySelector(".research-cat-name").textContent = cat.name;
			let next = "Complete";
			if (opts.length === 1) {
				next = opts[0].name + " (" + opts[0].cost + ")";
				if (player.research.currentProjectId === opts[0].id) next = "Researching — " + next;
			} else if (opts.length > 1) {
				const names = [];
				let researching = false;
				for (let i = 0; i < opts.length; i++) {
					names.push(opts[i].name);
					if (player.research.currentProjectId === opts[i].id) researching = true;
				}
				next = "T" + opts[0].tier + " · " + opts.length + " choices (" + opts[0].cost + ")";
				if (researching) next = "Researching — " + next;
			}
			row.querySelector(".research-cat-next").textContent = next;
			let currentHere = false;
			for (let i = 0; i < opts.length; i++) {
				if (player.research.currentProjectId === opts[i].id) currentHere = true;
			}
			row.classList.toggle("is-current", currentHere);
			row.classList.toggle("is-selected", cat.id === selected);
		}
	);

	const fieldTiers = selected ? Space4x.techTiersInCategory(state, selected) : [];
	let preview = state.ui.previewTechId ? Space4x.techById(state, state.ui.previewTechId) : null;
	if (preview && preview.categoryId !== selected) preview = null;
	if (!preview) {
		const avail = Space4x.availableTechs(state, player, selected);
		preview = avail[0] || null;
		if (!preview && fieldTiers.length) {
			const last = fieldTiers[fieldTiers.length - 1];
			preview = last.techs[last.techs.length - 1];
		}
	} else {
		const st = Space4x.techStatus(player, preview);
		if (st === "done" || st === "skipped") {
			const avail = Space4x.availableTechs(state, player, selected);
			if (avail[0]) preview = avail[0];
		}
	}
	const catObj = (function () {
		for (let i = 0; i < cats.length; i++) if (cats[i].id === selected) return cats[i];
		return null;
	}());
	Space4x.syncKeyedList(ui.researchLadder, fieldTiers, function (t) { return t.id; },
		function () {
			const box = document.createElement("div");
			box.className = "research-tier";
			const lab = document.createElement("div");
			lab.className = "research-tier-label";
			const opts = document.createElement("div");
			opts.className = "research-tier-opts";
			box.appendChild(lab);
			box.appendChild(opts);
			return box;
		},
		function (row, group) {
			row.querySelector(".research-tier-label").textContent = "T" + group.tier;
			Space4x.syncKeyedList(row.querySelector(".research-tier-opts"), group.techs, function (t) { return t.id; },
				function () {
					const btn = document.createElement("button");
					btn.type = "button";
					btn.className = "research-node";
					const name = document.createElement("div");
					name.className = "research-node-name";
					btn.appendChild(name);
					btn.addEventListener("click", function () {
						cmds.previewTech(btn.getAttribute("data-id"));
					});
					btn.addEventListener("dblclick", function () {
						cmds.setResearch(btn.getAttribute("data-id"));
					});
					return btn;
				},
				function (btn, tech) {
					const status = Space4x.techStatus(player, tech);
					btn.querySelector(".research-node-name").textContent = tech.name;
					btn.className = "research-node is-" + status;
					btn.classList.toggle("is-preview", preview && preview.id === tech.id);
				}
			);
		}
	);
	Space4x.fillTechDetail(ui, state, player, preview, catObj);

	const minTier = Space4x.minTechTier(state);
	const maxTier = Space4x.maxTechTier(state);
	const overview = [];
	for (let c = 0; c < cats.length; c++) {
		const groups = Space4x.techTiersInCategory(state, cats[c].id);
		const byTier = {};
		for (let g = 0; g < groups.length; g++) byTier[groups[g].tier] = groups[g].techs;
		const cols = [];
		for (let t = minTier; t <= maxTier; t++) {
			cols.push({ id: cats[c].id + "-T" + t, tier: t, techs: byTier[t] || [] });
		}
		overview.push({ id: cats[c].id, cat: cats[c], cols: cols });
	}
	Space4x.syncKeyedList(ui.researchOverview, overview, function (row) { return row.id; },
		function () {
			const tr = document.createElement("div");
			tr.className = "research-ov-row";
			const lab = document.createElement("div");
			lab.className = "research-ov-label";
			tr.appendChild(lab);
			const cells = document.createElement("div");
			cells.className = "research-ov-tiers";
			tr.appendChild(cells);
			return tr;
		},
		function (row, item) {
			row.querySelector(".research-ov-label").textContent = item.cat.name;
			Space4x.syncKeyedList(row.querySelector(".research-ov-tiers"), item.cols, function (col) { return col.id; },
				function () {
					const col = document.createElement("div");
					col.className = "research-ov-tier";
					return col;
				},
				function (colEl, col) {
					Space4x.syncKeyedList(colEl, col.techs, function (t) { return t.id; },
						function () {
							const btn = document.createElement("button");
							btn.type = "button";
							btn.className = "research-ov-cell";
							btn.addEventListener("click", function () {
								cmds.previewTech(btn.getAttribute("data-id"));
							});
							btn.addEventListener("dblclick", function () {
								cmds.setResearch(btn.getAttribute("data-id"));
							});
							return btn;
						},
						function (cell, tech) {
							const status = Space4x.techStatus(player, tech);
							cell.textContent = tech.name;
							cell.title = tech.name + " · tier " + tech.tier + " · " + status;
							cell.className = "research-ov-cell is-" + status;
							cell.classList.toggle("is-preview", preview && preview.id === tech.id);
						}
					);
				}
			);
		}
	);
};
