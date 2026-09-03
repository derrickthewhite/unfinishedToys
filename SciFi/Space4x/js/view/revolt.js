var Space4x = Space4x || {};

Space4x.playerRevoltSummaries = function (state) {
	const player = Space4x.playerEmpire(state);
	if (!player || state.observerMode) return Space4x.revoltSummariesOf(state);
	return Space4x.revoltSummariesOf(state, player.id);
};

Space4x.syncRevoltLines = function (listEl, lines, emptyText) {
	if (!listEl) return;
	const items = (lines || []).map(function (text, i) { return { id: String(i), text: text }; });
	if (!items.length && emptyText) items.push({ id: "empty", text: emptyText });
	Space4x.syncKeyedList(listEl, items, function (x) { return x.id; },
		function () {
			const li = document.createElement("li");
			li.appendChild(document.createElement("span"));
			return li;
		},
		function (row, item) {
			row.querySelector("span").textContent = item.text;
		}
	);
};

Space4x.syncRevoltStage = function (ui, state, cmds) {
	if (!ui.stageRevolt) return;
	const list = Space4x.playerRevoltSummaries(state);
	let revolt = Space4x.revoltSummaryById(state, state.ui.selectedRevoltId);
	if (!revolt && list.length) revolt = list[0];
	if (!revolt) {
		Space4x.setText(ui.revoltTitle, "Revolt summary");
		Space4x.setText(ui.revoltMeta, "No revolts this turn.");
		Space4x.setText(ui.revoltSummary, "");
		if (ui.revoltLocationLink) ui.revoltLocationLink.hidden = true;
		Space4x.syncRevoltLines(ui.revoltRebelPops, [], "None");
		Space4x.syncRevoltLines(ui.revoltLoyalPops, [], "None");
		if (ui.revoltMilitia) Space4x.setText(ui.revoltMilitia, "None raised.");
		Space4x.syncCombatUnitList(ui.revoltMilitiaUnits, state, [], "None");
		Space4x.syncCombatUnitList(ui.revoltDefectedTroops, state, [], "None");
		Space4x.syncCombatUnitList(ui.revoltLoyalTroops, state, [], "None");
		if (ui.revoltCombatLink) ui.revoltCombatLink.hidden = true;
		return;
	}
	Space4x.setText(ui.revoltTitle, "Revolt at " + (revolt.settlementLabel || "colony"));
	let meta = revolt.rebelEmpireName || "Rebels";
	if (revolt.outcome === "crushed" || revolt.outcome === "combat_crushed") meta += " · crushed";
	else meta += " · broke away";
	meta += " · turn " + revolt.turn;
	Space4x.setText(ui.revoltMeta, meta);
	Space4x.setText(ui.revoltSummary, revolt.summary || "");
	if (ui.revoltLocationLink && cmds) {
		ui.revoltLocationLink.hidden = !revolt.settlementId;
		ui.revoltLocationLink.textContent = "Go to " + (revolt.settlementLabel || "colony");
		ui.revoltLocationLink.onclick = function () {
			if (revolt.settlementId) cmds.selectSettlement(revolt.settlementId);
		};
	}
	const rebelLines = revolt.rebelPopLines && revolt.rebelPopLines.length
		? revolt.rebelPopLines.slice()
		: [];
	if (!rebelLines.length && revolt.rebelPopCount) {
		rebelLines.push(revolt.rebelPopCount + " " + Space4x.peopleWord(revolt.rebelPopCount));
	}
	Space4x.syncRevoltLines(ui.revoltRebelPops, rebelLines, "None joined the revolt.");
	const loyalLines = revolt.loyalPopLines && revolt.loyalPopLines.length
		? revolt.loyalPopLines.slice()
		: [];
	if (!loyalLines.length && revolt.loyalPopCount) {
		loyalLines.push(revolt.loyalPopCount + " " + Space4x.peopleWord(revolt.loyalPopCount));
	}
	Space4x.syncRevoltLines(ui.revoltLoyalPops, loyalLines, "None stayed loyal.");
	if (ui.revoltMilitia) {
		if (revolt.militiaSpawned > 0) {
			Space4x.setText(ui.revoltMilitia, revolt.militiaSpawned + " " +
				(revolt.militiaName || "militia") + " raised from rebel citizens.");
		} else {
			Space4x.setText(ui.revoltMilitia, "No militia raised.");
		}
	}
	Space4x.syncCombatUnitList(ui.revoltMilitiaUnits, state, revolt.militiaStacks || [], "None");
	Space4x.syncCombatUnitList(ui.revoltDefectedTroops, state, revolt.defectedStacks || [], "None defected.");
	Space4x.syncCombatUnitList(ui.revoltLoyalTroops, state, revolt.loyalTroopStacks || [], "None stayed loyal.");
	if (ui.revoltCombatLink && cmds) {
		const hasCombat = !!(revolt.combatId && Space4x.groundCombatById(state, revolt.combatId));
		ui.revoltCombatLink.hidden = !hasCombat;
		if (hasCombat) {
			ui.revoltCombatLink.textContent = "View ground combat report";
			ui.revoltCombatLink.onclick = function () {
				cmds.showCombat(revolt.combatId);
			};
		}
	}
};
