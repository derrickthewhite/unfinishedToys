var Space4x = Space4x || {};

Space4x.syncDesignStage = function (ui, state, cmds) {
	if (!ui.stageDesign) return;
	const host = Space4x.designHost(state);
	if (!host) return;
	Space4x.ensureEmpireDesigns(state, host);
	const hull = state.ui.designHullId || "cruiser";
	const pack = host.shipDesigns[hull];
	const design = Space4x.designById(host, hull, state.ui.designId) || Space4x.activeDesign(host, hull);
	if (design) state.ui.designId = design.id;
	const N = Space4x.empireHullQualityN(state, host);
	const cap = Space4x.hullLoadCap(state, hull);
	const used = design ? Space4x.designLoadUsed(state, design) : 0;
	const emptyPct = cap > 0 ? Math.round(100 * Math.max(0, (cap - used) / cap)) : 0;
	const speed = design
		? Space4x.combatSpeedOf(state, host, { hullDefId: hull, load: design.load })
		: Space4x.combatSpeedOf(state, host);
	const draftNote = host.isObserverDraft ? " · Observer draft (all load unlocked; not used by empires)" : "";
	if (ui.btnDesignExport) ui.btnDesignExport.hidden = !host.isObserverDraft;
	Space4x.setText(ui.designMeta,
		"N " + N + " (scales existing ships) · Load " + used + "/" + cap +
		(emptyPct ? " · underload +" + emptyPct + "% combat speed" : "") +
		" · Combat speed " + speed.toFixed(1) +
		" · Shield " + Space4x.shipLayerHp(state, host, hull, "shield") + "/facing · Armor " +
		Space4x.shipLayerHp(state, host, hull, "armor") + " · Structure " +
		Space4x.shipLayerHp(state, host, hull, "structure") +
		" · New builds use the default class; retrofit existing ships from the Yard" + draftNote
	);
	if (ui.designHullCruiser) ui.designHullCruiser.classList.toggle("is-selected", hull === "cruiser");
	if (ui.designHullBattleship) ui.designHullBattleship.classList.toggle("is-selected", hull === "battleship");
	if (ui.designHullStation) ui.designHullStation.classList.toggle("is-selected", hull === "defenseStation");
	Space4x.syncKeyedList(ui.designClassList, pack.list, function (d) { return d.id; },
		function () {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.type = "button";
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				cmds.selectDesign(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, item) {
			const btn = row.querySelector("button");
			btn.textContent = item.name + (item.id === pack.activeId ? " · default" : "");
			row.classList.toggle("is-selected", item.id === (design && design.id));
		}
	);
	if (ui.designNameInput && document.activeElement !== ui.designNameInput) {
		ui.designNameInput.value = design ? design.name : "";
	}
	const previewColor = Space4x.designPreviewColor(state, host);
	Space4x.prefetchHullShipArt(state, hull, previewColor);
	if (ui.designShipArt) ui.designShipArt._designArtKey = null;
	Space4x.drawDesignShipArt(ui.designShipArt, state, hull, design, previewColor);
	const artCount = Space4x.shipArtCount(state, hull);
	const artIdx = design ? Space4x.designArtIndex(state, hull, design) : 0;
	if (ui.designShipArtLabel) {
		ui.designShipArtLabel.textContent = artCount
			? "Silhouette " + (artIdx + 1) + " / " + artCount
			: "No silhouettes";
	}
	if (ui.btnDesignArtPrev) ui.btnDesignArtPrev.disabled = !design || artCount <= 1;
	if (ui.btnDesignArtNext) ui.btnDesignArtNext.disabled = !design || artCount <= 1;
	if (ui.designShipArt) ui.designShipArt.style.cursor = design && artCount > 1 ? "pointer" : "default";
	const load = design ? design.load.map(function (e, i) {
		return {
			id: String(i),
			index: i,
			itemId: e.itemId,
			count: e.count != null ? e.count : 1
		};
	}) : [];
	Space4x.syncKeyedList(ui.designLoadList, load, function (e) { return e.id; },
		function () {
			const li = document.createElement("li");
			li.className = "design-load-row";
			const span = document.createElement("span");
			span.className = "design-load-label";
			const controls = document.createElement("div");
			controls.className = "design-load-controls";
			function mk(label, action) {
				const b = document.createElement("button");
				b.type = "button";
				b.textContent = label;
				b.setAttribute("data-act", action);
				controls.appendChild(b);
				b.addEventListener("click", function () {
					const idx = parseInt(li.getAttribute("data-id"), 10);
					const act = b.getAttribute("data-act");
					if (act === "min") cmds.setDesignLoadCount(idx, 1);
					else if (act === "dec") cmds.adjustDesignLoadCount(idx, -1);
					else if (act === "inc") cmds.adjustDesignLoadCount(idx, 1);
					else if (act === "max") cmds.setDesignLoadCount(idx, 9999);
					else if (act === "rm") cmds.removeDesignLoad(idx);
				});
				return b;
			}
			mk("Min", "min");
			mk("−1", "dec");
			mk("+1", "inc");
			mk("Max", "max");
			mk("Remove", "rm");
			li.appendChild(span);
			li.appendChild(controls);
			return li;
		},
		function (row, item) {
			const spec = Space4x.spaceLoadItem(state, item.itemId);
			const size = Space4x.loadEntrySize(state, item);
			const unit = Space4x.loadUnitSize(state, item.itemId);
			row.querySelector(".design-load-label").textContent =
				(spec ? spec.name : item.itemId) + " ×" + item.count +
				" · " + size + " load (" + unit + " each)" +
				(spec && spec.stub ? " · stub" : "");
			row.title = Space4x.describeLoadItem(state, spec);
			const max = design ? Space4x.designGroupMaxCount(state, design, hull, item.index) : 1;
			const btns = row.querySelectorAll(".design-load-controls button");
			for (let i = 0; i < btns.length; i++) {
				const act = btns[i].getAttribute("data-act");
				if (act === "min" || act === "dec") btns[i].disabled = item.count <= 1;
				if (act === "inc" || act === "max") btns[i].disabled = item.count >= max;
			}
		}
	);
	const items = Space4x.availableLoadItems(state, host);
	Space4x.syncKeyedList(ui.designCatalog, items, function (it) { return it.id; },
		function () {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.type = "button";
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				cmds.addDesignLoad(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, item) {
			const entry = { itemId: item.id, count: 1 };
			const btn = row.querySelector("button");
			btn.textContent = item.name + " · " + Space4x.loadEntrySize(state, entry) +
				" (" + item.kind + ")";
			btn.title = Space4x.describeLoadItem(state, item);
			row.title = btn.title;
		}
	);
};
