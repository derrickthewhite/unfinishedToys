var Space4x = Space4x || {};

Space4x.hideRefitModal = function (ui) {
	if (!ui || !ui.refitModal) return;
	ui.refitModal.hidden = true;
};

Space4x.showRefitModal = function (ui, state, cmds) {
	if (!ui || !ui.refitModal) return;
	if (!state.ui.refit) state.ui.refit = { unitId: null, designId: null };
	ui.refitModal.hidden = false;
	Space4x.syncRefitModal(ui, state, cmds);
};

Space4x.syncRefitModal = function (ui, state, cmds) {
	if (!ui || !ui.refitModal || ui.refitModal.hidden) return;
	const player = Space4x.playerEmpire(state);
	const st = Space4x.settlementById(state, state.ui.selectedSettlementId);
	if (!player || !st || st.empireId !== player.id) {
		Space4x.hideRefitModal(ui);
		return;
	}
	if (!state.ui.refit) state.ui.refit = { unitId: null, designId: null };
	const sel = state.ui.refit;
	const ships = Space4x.orbitShipsForRefit(state, st.id, player.id);
	if (sel.unitId) {
		let still = false;
		for (let i = 0; i < ships.length; i++) if (ships[i].id === sel.unitId) still = true;
		if (!still) {
			sel.unitId = null;
			sel.designId = null;
		}
	}
	const unit = sel.unitId ? Space4x.unitById(state, sel.unitId) : null;
	Space4x.ensureEmpireDesigns(state, player);
	const designs = unit && Space4x.canRefitShip(state, unit)
		? ((player.shipDesigns[unit.defId] && player.shipDesigns[unit.defId].list) || [])
		: [];
	if (sel.designId) {
		let ok = false;
		for (let i = 0; i < designs.length; i++) if (designs[i].id === sel.designId) ok = true;
		if (!ok) sel.designId = designs[0] ? designs[0].id : null;
	} else if (designs[0]) {
		sel.designId = designs[0].id;
	}
	if (ui.refitShipEmpty) ui.refitShipEmpty.hidden = ships.length > 0;
	if (ui.refitDesignEmpty) {
		ui.refitDesignEmpty.hidden = designs.length > 0;
		if (!unit) ui.refitDesignEmpty.textContent = "Select a ship on the right.";
		else if (!Space4x.canRefitShip(state, unit)) ui.refitDesignEmpty.textContent = "This hull cannot be refit (scrap only).";
		else ui.refitDesignEmpty.textContent = "No designs for this hull.";
	}
	Space4x.syncKeyedList(ui.refitShipList, ships, function (u) { return u.id; },
		function () {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.type = "button";
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				cmds.selectRefitShip(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, ship) {
			const btn = row.querySelector("button");
			const def = Space4x.settingOf(state).builds[ship.defId];
			let label = Space4x.unitLabel(state, ship);
			if (def) label += " · " + def.name;
			if (ship.combatFit && ship.combatFit.designName) label += " · " + ship.combatFit.designName;
			btn.textContent = label;
			row.classList.toggle("is-selected", ship.id === sel.unitId);
		}
	);
	Space4x.syncKeyedList(ui.refitDesignList, designs, function (d) { return d.id; },
		function () {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.type = "button";
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				cmds.selectRefitDesign(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, design) {
			const btn = row.querySelector("button");
			const cost = unit ? Space4x.refitCostForHull(state, st, unit.defId) : 0;
			btn.textContent = design.name + " · refit " + cost;
			row.classList.toggle("is-selected", design.id === sel.designId);
		}
	);
	const canBuild = !!(unit && Space4x.canRefitShip(state, unit) && sel.designId);
	const canScrap = !!unit;
	if (ui.btnRefitBuild) ui.btnRefitBuild.disabled = !canBuild;
	if (ui.btnRefitScrap) {
		ui.btnRefitScrap.disabled = !canScrap;
		if (unit) {
			ui.btnRefitScrap.textContent = "Scrap (+" + Space4x.fmtMoney(Space4x.shipScrapValue(state, unit)) + ")";
		} else {
			ui.btnRefitScrap.textContent = "Scrap";
		}
	}
};
