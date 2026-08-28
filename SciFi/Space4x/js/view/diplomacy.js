var Space4x = Space4x || {};

Space4x.diploDraftOf = function (state) {
	if (!state.ui.diploDraft) state.ui.diploDraft = Space4x.emptyDraft();
	if (!state.ui.diploDraft.give) state.ui.diploDraft.give = [];
	if (!state.ui.diploDraft.want) state.ui.diploDraft.want = [];
	if (!state.ui.diploDraft.pacts) state.ui.diploDraft.pacts = [];
	return state.ui.diploDraft;
};

Space4x.resetDiploDraft = function (state) {
	state.ui.diploDraft = Space4x.emptyDraft();
};

Space4x.fillOptionList = function (sel, items, valueFn, labelFn, selected) {
	if (!sel) return;
	const focus = document.activeElement === sel;
	const cur = focus ? sel.value : (selected || "");
	const values = [];
	for (let i = 0; i < items.length; i++) values.push(String(valueFn(items[i])));
	let same = sel.options.length === items.length;
	if (same) {
		for (let i = 0; i < items.length; i++) {
			if (sel.options[i].value !== values[i] || sel.options[i].textContent !== labelFn(items[i])) same = false;
		}
	}
	if (!same) {
		while (sel.firstChild) sel.removeChild(sel.firstChild);
		for (let i = 0; i < items.length; i++) {
			const opt = document.createElement("option");
			opt.value = values[i];
			opt.textContent = labelFn(items[i]);
			sel.appendChild(opt);
		}
	}
	if (cur) {
		for (let i = 0; i < sel.options.length; i++) {
			if (sel.options[i].value === cur) {
				sel.value = cur;
				return;
			}
		}
	}
	if (sel.options.length) sel.value = sel.options[0].value;
};

Space4x.syncDiplomacyStage = function (ui, state, cmds) {
	if (!ui.stageDiplomacy) return;
	const player = Space4x.playerEmpire(state);
	if (!player) return;
	const canTalk = Space4x.empireHasDiplomacy(state, player);
	const rivals = Space4x.contactedEmpires(state, player);
	if (ui.diploGate) {
		if (!canTalk) {
			Space4x.setText(ui.diploGate, "Research Exotranslation to talk. You can still declare war on empires in range.");
		} else if (!rivals.length) {
			Space4x.setText(ui.diploGate, "No empires in ship range yet.");
		} else {
			Space4x.setText(ui.diploGate, "Contacted empires. War is instant. Everything else is an offer they can refuse.");
		}
	}
	let selectedId = state.ui.diploRivalId;
	let selected = null;
	for (let i = 0; i < rivals.length; i++) {
		if (rivals[i].id === selectedId) selected = rivals[i];
	}
	if (!selected && rivals[0]) {
		selected = rivals[0];
		state.ui.diploRivalId = selected.id;
		Space4x.resetDiploDraft(state);
	}
	if (!rivals.length) {
		state.ui.diploRivalId = null;
		selected = null;
	}

	Space4x.syncKeyedList(ui.diploRivals, rivals, function (e) { return e.id; },
		function () {
			const li = document.createElement("li");
			li.className = "diplo-rival";
			const btn = document.createElement("button");
			btn.type = "button";
			const img = document.createElement("img");
			img.alt = "";
			const name = document.createElement("span");
			name.className = "diplo-rival-name";
			const rel = document.createElement("span");
			rel.className = "diplo-rival-rel muted";
			btn.appendChild(img);
			btn.appendChild(name);
			btn.appendChild(rel);
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				cmds.selectDiploRival(li.getAttribute("data-id"));
			});
			return li;
		},
		function (row, e) {
			Space4x.setCultureImg(row.querySelector("img"), state, e.cultureId);
			row.querySelector(".diplo-rival-name").textContent = e.name;
			const war = Space4x.atWar(player, e);
			row.querySelector(".diplo-rival-rel").textContent = war ? "War" : "Peace";
			row.classList.toggle("is-war", war);
			row.classList.toggle("is-selected", selected && selected.id === e.id);
		}
	);

	if (ui.diploDetail) ui.diploDetail.hidden = !selected;
	if (!selected) return;

	Space4x.setCultureImg(ui.diploRivalArt, state, selected.cultureId);
	Space4x.setText(ui.diploRivalName, selected.name);
	const who = Space4x.cultureName(state, selected.cultureId);
	const war = Space4x.atWar(player, selected);
	let meta = (who ? who + " · " : "") + (war ? "At war" : "At peace");
	const homes = Space4x.settlementsOf(state, selected.id);
	let known = 0;
	for (let i = 0; i < homes.length; i++) {
		if (Space4x.settlementDiscoveredBy(state, player.id, homes[i])) known += 1;
	}
	meta += " · " + known + " known world" + (known === 1 ? "" : "s");
	Space4x.setText(ui.diploRivalMeta, meta);

	const bits = [];
	if (Space4x.hasTreaty(player, selected, "trade")) bits.push("Trade");
	if (Space4x.hasTreaty(player, selected, "research")) bits.push("Research");
	if (Space4x.hasTreaty(player, selected, "passage")) bits.push("Free passage (shared bases)");
	if (Space4x.hasTreaty(player, selected, "stopSpies")) bits.push("Spy ban");
	if (Space4x.hasTreaty(player, selected, "research")) {
		const tech = selected.research && selected.research.currentProjectId ?
			Space4x.techById(state, selected.research.currentProjectId) : null;
		if (tech) bits.push("They are researching " + tech.name);
		else bits.push("They have no project");
		if (Space4x.researchAligned(player, selected)) bits.push("Your project is aligned");
	}
	Space4x.setText(ui.diploTreaties, bits.length ? bits.join(" · ") : "No treaties.");

	const inbox = Space4x.offerTo(state, player.id, selected.id);
	if (ui.diploInbox) ui.diploInbox.hidden = !inbox;
	if (inbox) {
		Space4x.setText(ui.diploInboxText, selected.name + " offers " + Space4x.packageSummary(state, inbox) + ".");
	}

	if (ui.btnDiploWar) {
		ui.btnDiploWar.hidden = war;
		ui.btnDiploWar.disabled = war;
	}

	const draft = Space4x.diploDraftOf(state);
	const pactItems = (draft.pacts || []).map(function (id, i) {
		return { id: id, i: i };
	});
	Space4x.syncKeyedList(ui.diploPacts, pactItems, function (p) { return "pact-" + p.i; },
		function () {
			const li = document.createElement("li");
			const text = document.createElement("span");
			const rm = document.createElement("button");
			rm.type = "button";
			rm.textContent = "×";
			li.appendChild(text);
			li.appendChild(rm);
			rm.addEventListener("click", function () {
				cmds.diploRemovePact(parseInt(li.getAttribute("data-index"), 10));
			});
			return li;
		},
		function (row, item) {
			row.setAttribute("data-index", String(item.i));
			row.querySelector("span").textContent = Space4x.pactLabel(item.id);
		}
	);

	function syncClauses(root, list, side) {
		const rows = [];
		for (let i = 0; i < list.length; i++) {
			rows.push({ id: side + "-" + i, i: i, clause: list[i] });
		}
		Space4x.syncKeyedList(root, rows, function (row) { return row.id; },
			function () {
				const li = document.createElement("li");
				const text = document.createElement("span");
				const rm = document.createElement("button");
				rm.type = "button";
				rm.textContent = "×";
				li.appendChild(text);
				li.appendChild(rm);
				rm.addEventListener("click", function () {
					cmds.diploRemoveClause(li.getAttribute("data-side"), parseInt(li.getAttribute("data-index"), 10));
				});
				return li;
			},
			function (row, item) {
				row.setAttribute("data-side", side);
				row.setAttribute("data-index", String(item.i));
				row.querySelector("span").textContent = Space4x.clauseLabel(state, item.clause);
			}
		);
	}
	syncClauses(ui.diploGive, draft.give || [], "give");
	syncClauses(ui.diploWant, draft.want || [], "want");

	const myWorlds = Space4x.settlementsOf(state, player.id);
	const theirWorlds = Space4x.settlementsOf(state, selected.id);
	const giveWorlds = myWorlds.length > 1 ? myWorlds : [];
	const wantWorlds = [];
	for (let i = 0; i < theirWorlds.length; i++) {
		if (Space4x.settlementDiscoveredBy(state, player.id, theirWorlds[i]) && theirWorlds.length > 1) {
			wantWorlds.push(theirWorlds[i]);
		}
	}
	Space4x.fillOptionList(ui.diploGiveWorld, giveWorlds, function (s) { return s.id; }, function (s) { return s.name; });
	Space4x.fillOptionList(ui.diploWantWorld, wantWorlds, function (s) { return s.id; }, function (s) { return s.name; });

	const myShips = Space4x.giftableShips(state, player.id);
	const theirShips = [];
	const rawShips = Space4x.giftableShips(state, selected.id);
	for (let i = 0; i < rawShips.length; i++) {
		const starId = Space4x.unitStarId(state, rawShips[i]);
		if (starId && Space4x.starIsExplored(state, player.id, starId)) theirShips.push(rawShips[i]);
	}
	Space4x.fillOptionList(ui.diploGiveShip, myShips, function (u) { return u.id; }, function (u) {
		return Space4x.unitLabel(state, u) + " — " + Space4x.unitPlaceLabel(state, u);
	});
	Space4x.fillOptionList(ui.diploWantShip, theirShips, function (u) { return u.id; }, function (u) {
		return Space4x.unitLabel(state, u) + " — " + Space4x.unitPlaceLabel(state, u);
	});

	function troopChoices(empireId, onlyDiscovered) {
		const homes = Space4x.settlementsOf(state, empireId);
		const out = [];
		for (let i = 0; i < homes.length; i++) {
			if (onlyDiscovered && !Space4x.settlementDiscoveredBy(state, player.id, homes[i])) continue;
			const stacks = Space4x.troopStacks(state, homes[i]);
			for (let s = 0; s < stacks.length; s++) {
				out.push({
					id: homes[i].id + "::" + stacks[s].id,
					settlementId: homes[i].id,
					defId: stacks[s].defId,
					culture: stacks[s].culture,
					n: stacks[s].n,
					label: homes[i].name + " · " + (stacks[s].def ? stacks[s].def.name : stacks[s].defId) +
						(stacks[s].culture ? " " + Space4x.cultureName(state, stacks[s].culture) : "") +
						" × " + stacks[s].n
				});
			}
		}
		return out;
	}
	const myTroops = troopChoices(player.id, false);
	const theirTroops = troopChoices(selected.id, true);
	Space4x.fillOptionList(ui.diploGiveTroop, myTroops, function (t) { return t.id; }, function (t) { return t.label; });
	Space4x.fillOptionList(ui.diploWantTroop, theirTroops, function (t) { return t.id; }, function (t) { return t.label; });

	const themTalk = Space4x.empireHasDiplomacy(state, selected);
	const probe = {
		fromId: player.id,
		toId: selected.id,
		give: draft.give || [],
		want: draft.want || [],
		pacts: draft.pacts || []
	};
	const canSend = canTalk && themTalk && Space4x.packageValid(state, player, selected, probe);
	if (ui.btnDiploSend) {
		ui.btnDiploSend.disabled = !canSend;
		if (!canTalk) Space4x.setText(ui.btnDiploSend, "Needs Exotranslation");
		else if (!themTalk) Space4x.setText(ui.btnDiploSend, "They cannot talk yet");
		else if (!canSend) Space4x.setText(ui.btnDiploSend, "Offer is not valid");
		else Space4x.setText(ui.btnDiploSend, "Send offer");
	}
	if (ui.diploDeal) ui.diploDeal.hidden = !selected;

	if (ui.btnDiploPactPeace) ui.btnDiploPactPeace.disabled = !war;
	if (ui.btnDiploPactTrade) ui.btnDiploPactTrade.disabled = war && draft.pacts.indexOf("peace") < 0;
	if (ui.btnDiploPactResearch) ui.btnDiploPactResearch.disabled = war && draft.pacts.indexOf("peace") < 0;
	if (ui.btnDiploPactPassage) ui.btnDiploPactPassage.disabled = war && draft.pacts.indexOf("peace") < 0;
	if (ui.btnDiploPactSpies) ui.btnDiploPactSpies.disabled = war && draft.pacts.indexOf("peace") < 0;
};
