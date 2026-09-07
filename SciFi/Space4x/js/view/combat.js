var Space4x = Space4x || {};

Space4x.combatKindLabel = function (kind) {
	if (kind === "wildlife") return "Wildlife";
	if (kind === "revolt") return "Revolt";
	if (kind === "invasion") return "Invasion";
	return "Battle";
};

Space4x.playerGroundCombats = function (state) {
	const player = Space4x.playerEmpire(state);
	if (!player || state.observerMode) return Space4x.groundCombatsOf(state);
	return Space4x.groundCombatsOf(state, player.id);
};

Space4x.combatPlayerOutcome = function (state, combat) {
	const player = Space4x.playerEmpire(state);
	if (!player || state.observerMode || !combat) return null;
	const atkId = combat.attackerEmpireId;
	const defId = combat.defenderEmpireId;
	let side = null;
	if (atkId === player.id) side = "attacker";
	else if (defId === player.id) side = "defender";
	else if (combat.empireId === player.id) {
		side = combat.kind === "invasion" ? "attacker" : "defender";
	}
	if (!side || !combat.winner) return null;
	if (combat.winner === side) return "victory";
	if (combat.winner === "attacker" || combat.winner === "defender") return "defeat";
	return null;
};

Space4x.makeCombatEmblem = function () {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("class", "combat-emblem-svg");
	svg.setAttribute("viewBox", "0 0 64 64");
	svg.setAttribute("width", "56");
	svg.setAttribute("height", "56");
	svg.setAttribute("aria-hidden", "true");
	const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
	g.setAttribute("stroke", "currentColor");
	g.setAttribute("stroke-width", "3");
	g.setAttribute("stroke-linecap", "round");
	g.setAttribute("fill", "none");
	const s1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
	s1.setAttribute("x1", "12");
	s1.setAttribute("y1", "52");
	s1.setAttribute("x2", "52");
	s1.setAttribute("y2", "12");
	const s2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
	s2.setAttribute("x1", "12");
	s2.setAttribute("y1", "12");
	s2.setAttribute("x2", "52");
	s2.setAttribute("y2", "52");
	const h1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
	h1.setAttribute("x1", "18");
	h1.setAttribute("y1", "46");
	h1.setAttribute("x2", "26");
	h1.setAttribute("y2", "38");
	const h2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
	h2.setAttribute("x1", "38");
	h2.setAttribute("y1", "26");
	h2.setAttribute("x2", "46");
	h2.setAttribute("y2", "18");
	g.appendChild(s1);
	g.appendChild(s2);
	g.appendChild(h1);
	g.appendChild(h2);
	svg.appendChild(g);
	return svg;
};

Space4x.makeCombatResultIcon = function (outcome) {
	const wrap = document.createElement("div");
	wrap.className = "combat-result-glyph";
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 48 48");
	svg.setAttribute("width", "44");
	svg.setAttribute("height", "44");
	svg.setAttribute("aria-hidden", "true");
	if (outcome === "victory") {
		wrap.classList.add("is-victory");
		wrap.title = "Victory";
		const shield = document.createElementNS("http://www.w3.org/2000/svg", "path");
		shield.setAttribute("d", "M24 4 L40 10 V22 C40 32 33 39 24 44 C15 39 8 32 8 22 V10 Z");
		shield.setAttribute("fill", "currentColor");
		shield.setAttribute("opacity", "0.22");
		shield.setAttribute("stroke", "currentColor");
		shield.setAttribute("stroke-width", "2");
		const check = document.createElementNS("http://www.w3.org/2000/svg", "path");
		check.setAttribute("d", "M16 24 L22 30 L33 17");
		check.setAttribute("fill", "none");
		check.setAttribute("stroke", "currentColor");
		check.setAttribute("stroke-width", "3.5");
		check.setAttribute("stroke-linecap", "round");
		check.setAttribute("stroke-linejoin", "round");
		svg.appendChild(shield);
		svg.appendChild(check);
	} else if (outcome === "defeat") {
		wrap.classList.add("is-defeat");
		wrap.title = "Defeat";
		const shield = document.createElementNS("http://www.w3.org/2000/svg", "path");
		shield.setAttribute("d", "M24 4 L40 10 V22 C40 32 33 39 24 44 C15 39 8 32 8 22 V10 Z");
		shield.setAttribute("fill", "currentColor");
		shield.setAttribute("opacity", "0.16");
		shield.setAttribute("stroke", "currentColor");
		shield.setAttribute("stroke-width", "2");
		const x1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
		x1.setAttribute("x1", "17");
		x1.setAttribute("y1", "17");
		x1.setAttribute("x2", "31");
		x1.setAttribute("y2", "31");
		x1.setAttribute("stroke", "currentColor");
		x1.setAttribute("stroke-width", "3.5");
		x1.setAttribute("stroke-linecap", "round");
		const x2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
		x2.setAttribute("x1", "31");
		x2.setAttribute("y1", "17");
		x2.setAttribute("x2", "17");
		x2.setAttribute("y2", "31");
		x2.setAttribute("stroke", "currentColor");
		x2.setAttribute("stroke-width", "3.5");
		x2.setAttribute("stroke-linecap", "round");
		svg.appendChild(shield);
		svg.appendChild(x1);
		svg.appendChild(x2);
	}
	wrap.appendChild(svg);
	return wrap;
};

Space4x.setCombatSideIcon = function (node, state, combat, side) {
	if (!node) return;
	while (node.firstChild) node.removeChild(node.firstChild);
	const cultureId = side === "attacker" ? combat.attackerCultureId : combat.defenderCultureId;
	const defId = side === "attacker" ? combat.attackerDefId : combat.defenderDefId;
	if (cultureId) {
		const img = document.createElement("img");
		img.className = "combat-side-art troop-badge-art";
		img.alt = "";
		Space4x.setCultureImg(img, state, cultureId);
		node.appendChild(img);
	} else if (defId && Space4x.troopIsWildlife(state, defId)) {
		node.appendChild(Space4x.makeWildlifeMark());
	} else if (defId) {
		const glyph = Space4x.makeTroopGlyph(state, defId);
		glyph.classList.add("combat-side-glyph");
		node.appendChild(glyph);
	} else {
		const mark = document.createElement("span");
		mark.className = "combat-side-mark";
		mark.textContent = side === "attacker" ? "!" : "★";
		node.appendChild(mark);
	}
};

Space4x.combatStacksFromReport = function (combat, side, kind) {
	const key = side + (kind === "lost" ? "LostStacks" : "Stacks");
	if (combat[key] && combat[key].length) return combat[key];
	const lines = combat[side + (kind === "lost" ? "Lost" : "Forces")] || [];
	if (!lines.length) return [];
	return lines.map(function (text, i) {
		return { id: "line-" + i, name: text, count: 0, tsEach: 0, ts: 0, defId: null, culture: null, text: text };
	});
};

Space4x.makeCombatUnitRow = function (state, stack, lost) {
	const li = document.createElement("li");
	li.className = "combat-unit-row" + (lost ? " is-lost" : "");
	if (stack.text) {
		const text = document.createElement("span");
		text.className = "combat-unit-fallback";
		text.textContent = stack.text;
		li.appendChild(text);
		return li;
	}
	const line = document.createElement("div");
	line.className = "garrison-btn combat-troop-line";
	const title = (stack.level ? stack.name + " " + stack.level : (stack.name || stack.defId || "Unit")) +
		(stack.culture ? " · " + (Space4x.cultureName(state, stack.culture) || stack.culture) : "") +
		" · " + stack.tsEach + " TS each · " + stack.ts + " total";
	line.appendChild(Space4x.makeTroopBadgeRow(state, {
		defId: stack.defId,
		culture: stack.culture,
		name: stack.name,
		count: stack.count,
		title: title,
		extraClass: "garrison-btn-inner"
	}));
	li.appendChild(line);
	const meta = document.createElement("span");
	meta.className = "combat-unit-meta muted";
	meta.textContent = stack.tsEach + " TS each · " + stack.ts + " total";
	li.appendChild(meta);
	return li;
};

Space4x.syncCombatUnitList = function (listEl, state, stacks, emptyText, lost) {
	if (!listEl) return;
	listEl.classList.toggle("is-empty", !stacks.length);
	while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
	if (!stacks.length) {
		const empty = document.createElement("li");
		empty.className = "combat-empty-line muted";
		empty.textContent = emptyText || "None";
		listEl.appendChild(empty);
		return;
	}
	for (let i = 0; i < stacks.length; i++) {
		listEl.appendChild(Space4x.makeCombatUnitRow(state, stacks[i], lost));
	}
};

Space4x.syncCombatPanel = function (ui, state, cmds) {
	if (!ui.combatList) return;
	const ground = Space4x.playerGroundCombats(state);
	const space = Space4x.playerSpaceBattles(state);
	const list = [];
	for (let i = 0; i < space.length; i++) {
		list.push({ id: "space:" + space[i].id, kind: "space", battle: space[i] });
	}
	for (let i = 0; i < ground.length; i++) {
		list.push({ id: "ground:" + ground[i].id, kind: "ground", combat: ground[i] });
	}
	if (ui.combatEmpty) ui.combatEmpty.hidden = list.length > 0;
	let selectedId = null;
	if (state.ui.selectedSpaceBattleId) selectedId = "space:" + state.ui.selectedSpaceBattleId;
	else if (state.ui.selectedCombatId) selectedId = "ground:" + state.ui.selectedCombatId;
	if (!selectedId && list.length) selectedId = list[0].id;
	Space4x.syncKeyedList(ui.combatList, list, function (c) { return c.id; },
		function () {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.type = "button";
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				const raw = li.getAttribute("data-id");
				if (raw.indexOf("space:") === 0) cmds.showSpaceCombat(raw.slice(6));
				else cmds.selectCombat(raw.slice(7));
			});
			return li;
		},
		function (row, entry) {
			let label = "";
			if (entry.kind === "space") {
				const b = entry.battle;
				const star = Space4x.starById(state, b.starId);
				label = (b.done ? "Space" : "Live space") + " · " + (star ? star.name : "Star");
				if (!b.seen) label = "• " + label;
				if (b.done) {
					const player = Space4x.playerEmpire(state);
					if (player && b.winner === "attacker" && b.attackerEmpireId === player.id) label = "✓ " + label;
					else if (player && b.winner === "defender" && b.defenderEmpireId === player.id) label = "✓ " + label;
					else if (player && ((b.winner === "attacker" && b.defenderEmpireId === player.id) ||
						(b.winner === "defender" && b.attackerEmpireId === player.id))) label = "✕ " + label;
				}
			} else {
				const combat = entry.combat;
				const kind = Space4x.combatKindLabel(combat.kind);
				const outcome = Space4x.combatPlayerOutcome(state, combat);
				label = kind + " · " + (combat.settlementLabel || "Colony");
				if (!combat.seen) label = "• " + label;
				if (outcome === "victory") label = "✓ " + label;
				else if (outcome === "defeat") label = "✕ " + label;
			}
			row.querySelector("button").textContent = label;
			row.classList.toggle("is-selected", entry.id === selectedId);
		}
	);
};

Space4x.syncCombatStage = function (ui, state, cmds) {
	if (!ui.combatDetail) return;
	const list = Space4x.playerGroundCombats(state);
	let combat = Space4x.groundCombatById(state, state.ui.selectedCombatId);
	if (!combat && list.length) combat = list[0];
	const outcome = combat ? Space4x.combatPlayerOutcome(state, combat) : null;
	if (ui.combatResultIcon) {
		ui.combatResultIcon.hidden = !outcome;
		ui.combatResultIcon.classList.toggle("is-victory", outcome === "victory");
		ui.combatResultIcon.classList.toggle("is-defeat", outcome === "defeat");
		if (outcome) {
			while (ui.combatResultIcon.firstChild) ui.combatResultIcon.removeChild(ui.combatResultIcon.firstChild);
			ui.combatResultIcon.appendChild(Space4x.makeCombatResultIcon(outcome));
		}
	}
	if (ui.combatEmblem) {
		while (ui.combatEmblem.firstChild) ui.combatEmblem.removeChild(ui.combatEmblem.firstChild);
		ui.combatEmblem.appendChild(Space4x.makeCombatEmblem());
	}
	if (!combat) {
		Space4x.setText(ui.combatTitle, "Ground combat");
		Space4x.setText(ui.combatMeta, "No combats this turn.");
		if (ui.combatSummary) Space4x.setText(ui.combatSummary, "");
		if (ui.combatLocationLink) ui.combatLocationLink.hidden = true;
		if (ui.combatRevoltLink) ui.combatRevoltLink.hidden = true;
		if (ui.combatLocationLine) ui.combatLocationLine.hidden = true;
		if (ui.combatBattlefield) ui.combatBattlefield.hidden = true;
		Space4x.syncCombatUnitList(ui.combatAttackerForces, state, [], "None");
		Space4x.syncCombatUnitList(ui.combatDefenderForces, state, [], "None");
		Space4x.syncCombatUnitList(ui.combatAttackerLost, state, [], "None", true);
		Space4x.syncCombatUnitList(ui.combatDefenderLost, state, [], "None", true);
		Space4x.syncCombatRoundsTable(ui, state, []);
		Space4x.syncCombatLines(ui.combatEffects, []);
		return;
	}
	if (ui.combatBattlefield) ui.combatBattlefield.hidden = false;
	const kind = Space4x.combatKindLabel(combat.kind);
	Space4x.setText(ui.combatTitle, kind + " at " + (combat.settlementLabel || "colony"));
	if (ui.combatLocationLink && cmds) {
		const label = combat.settlementLabel || "battle site";
		const st = combat.settlementId ? Space4x.settlementById(state, combat.settlementId) : null;
		const canGo = !!(st || combat.starId);
		ui.combatLocationLink.hidden = !canGo;
		ui.combatLocationLink.textContent = st ? ("Go to " + label) : ("Go to " + label + " system");
		ui.combatLocationLink.onclick = function () {
			cmds.goToCombatLocation(combat.id);
		};
	}
	if (ui.combatRevoltLink && cmds) {
		const revolt = Space4x.revoltSummaryForCombat(state, combat.id);
		ui.combatRevoltLink.hidden = !revolt;
		if (revolt) {
			ui.combatRevoltLink.textContent = "View revolt summary";
			ui.combatRevoltLink.onclick = function () {
				cmds.showRevolt(revolt.id);
			};
		}
	}
	if (ui.combatLocationLine) {
		const hasLoc = ui.combatLocationLink && !ui.combatLocationLink.hidden;
		const hasRevolt = ui.combatRevoltLink && !ui.combatRevoltLink.hidden;
		ui.combatLocationLine.hidden = !(hasLoc || hasRevolt);
	}
	let resultLine = combat.winnerLabel || combat.winner || "";
	if (outcome === "victory") resultLine = "You win";
	else if (outcome === "defeat") resultLine = "You lose";
	Space4x.setText(ui.combatMeta, "Turn " + combat.turn + " · " + resultLine + " · " +
		combat.attackerTs + " TS vs " + combat.defenderTs + " TS");
	Space4x.setText(ui.combatSummary, combat.summary || "");
	if (ui.combatAttackerHead) Space4x.setText(ui.combatAttackerHead, combat.attackerLabel);
	if (ui.combatDefenderHead) Space4x.setText(ui.combatDefenderHead, combat.defenderLabel);
	if (ui.combatAttackerTs) Space4x.setText(ui.combatAttackerTs, combat.attackerTs + " TS");
	if (ui.combatDefenderTs) Space4x.setText(ui.combatDefenderTs, combat.defenderTs + " TS");
	Space4x.setCombatSideIcon(ui.combatAttackerIcon, state, combat, "attacker");
	Space4x.setCombatSideIcon(ui.combatDefenderIcon, state, combat, "defender");
	const atkStacks = Space4x.combatStacksFromReport(combat, "attacker", "forces");
	const defStacks = Space4x.combatStacksFromReport(combat, "defender", "forces");
	let defEmpty = "None";
	if ((combat.defenderForces || []).indexOf("No garrison") >= 0) defEmpty = "No garrison";
	Space4x.syncCombatUnitList(ui.combatAttackerForces, state, atkStacks, "None");
	Space4x.syncCombatUnitList(ui.combatDefenderForces, state, defStacks, defEmpty);
	Space4x.syncCombatUnitList(ui.combatAttackerLost, state, Space4x.combatStacksFromReport(combat, "attacker", "lost"), "None", true);
	Space4x.syncCombatUnitList(ui.combatDefenderLost, state, Space4x.combatStacksFromReport(combat, "defender", "lost"), "None", true);
	Space4x.syncCombatRoundsTable(ui, state, combat.rounds || []);
	Space4x.syncCombatLines(ui.combatEffects, combat.effects || [], "No other effects.");
};

Space4x.combatDamageIconDefId = function (tag) {
	if (tag === "General" || tag === "Infantry") return "infantry";
	if (tag === "Air") return "air";
	if (tag === "Armor") return "armor";
	return null;
};

Space4x.normalizeCombatRound = function (round, index) {
	if (round == null) return { id: "note-" + index, note: "" };
	if (typeof round === "string") return { id: "note-" + index, note: round };
	if (round.note) return { id: "note-" + index, note: round.note };
	const n = round.n != null ? round.n : index + 1;
	return {
		id: "r-" + n,
		n: n,
		atkTs: round.atkTs != null ? round.atkTs : round.atkPool,
		defTs: round.defTs != null ? round.defTs : round.defPool,
		atkDealt: round.atkDealt || 0,
		defDealt: round.defDealt || 0,
		atkCategories: round.atkCategories || [],
		defCategories: round.defCategories || []
	};
};

Space4x.makeCombatDamageCats = function (state, categories) {
	const wrap = document.createElement("div");
	wrap.className = "combat-dmg-cats";
	const list = categories || [];
	let shown = 0;
	for (let i = 0; i < list.length; i++) {
		const cat = list[i];
		if (!cat || !(cat.damage > 0)) continue;
		shown += 1;
		const chip = document.createElement("span");
		const tag = cat.tag || "General";
		chip.className = "combat-dmg-cat is-" + String(tag).toLowerCase();
		chip.title = tag + " damage";
		const iconId = Space4x.combatDamageIconDefId(tag);
		if (iconId && state) {
			const icon = Space4x.makeTroopGlyph(state, iconId);
			icon.classList.add("combat-dmg-cat-icon");
			icon.width = 16;
			icon.height = 16;
			chip.appendChild(icon);
		}
		const label = document.createElement("span");
		label.className = "combat-dmg-cat-label";
		label.textContent = tag;
		chip.appendChild(label);
		const value = document.createElement("span");
		value.className = "combat-dmg-cat-value";
		value.textContent = String(cat.damage);
		chip.appendChild(value);
		wrap.appendChild(chip);
	}
	if (!shown) {
		const empty = document.createElement("span");
		empty.className = "muted";
		empty.textContent = "—";
		wrap.appendChild(empty);
	}
	return wrap;
};

Space4x.syncCombatRoundsTable = function (ui, state, rounds) {
	const tbody = ui.combatRounds;
	if (!tbody) return;
	const items = (rounds || []).map(function (round, i) {
		return Space4x.normalizeCombatRound(round, i);
	});
	if (ui.combatRoundsEmpty) ui.combatRoundsEmpty.hidden = items.length > 0;
	const tableWrap = tbody.closest ? tbody.closest(".combat-rounds-table-wrap") : null;
	if (tableWrap) tableWrap.hidden = items.length === 0;
	Space4x.syncKeyedList(tbody, items, function (r) { return r.id; },
		function (item) {
			const tr = document.createElement("tr");
			if (item.note) {
				const td = document.createElement("td");
				td.colSpan = 7;
				td.className = "combat-round-note";
				tr.appendChild(td);
				return tr;
			}
			const cells = [
				"num", "atk-ts", "atk-cats", "atk-total", "def-total", "def-cats", "def-ts"
			];
			for (let i = 0; i < cells.length; i++) {
				const td = document.createElement("td");
				td.className = "combat-cell-" + cells[i];
				tr.appendChild(td);
			}
			return tr;
		},
		function (row, item) {
			if (item.note) {
				const td = row.querySelector("td");
				if (td) td.textContent = item.note;
				return;
			}
			row.querySelector(".combat-cell-num").textContent = "";
			const num = document.createElement("span");
			num.className = "combat-round-num";
			num.textContent = String(item.n);
			row.querySelector(".combat-cell-num").appendChild(num);

			const atkTs = row.querySelector(".combat-cell-atk-ts");
			atkTs.textContent = "";
			const atkTsSpan = document.createElement("span");
			atkTsSpan.className = "combat-round-ts";
			atkTsSpan.textContent = item.atkTs != null ? String(item.atkTs) : "—";
			atkTs.appendChild(atkTsSpan);

			const atkCats = row.querySelector(".combat-cell-atk-cats");
			atkCats.textContent = "";
			atkCats.appendChild(Space4x.makeCombatDamageCats(state, item.atkCategories));

			const atkTotal = row.querySelector(".combat-cell-atk-total");
			atkTotal.textContent = "";
			const atkTot = document.createElement("span");
			atkTot.className = "combat-round-total is-atk";
			atkTot.textContent = String(item.atkDealt || 0);
			atkTotal.appendChild(atkTot);

			const defTotal = row.querySelector(".combat-cell-def-total");
			defTotal.textContent = "";
			const defTot = document.createElement("span");
			defTot.className = "combat-round-total is-def";
			defTot.textContent = String(item.defDealt || 0);
			defTotal.appendChild(defTot);

			const defCats = row.querySelector(".combat-cell-def-cats");
			defCats.textContent = "";
			defCats.appendChild(Space4x.makeCombatDamageCats(state, item.defCategories));

			const defTs = row.querySelector(".combat-cell-def-ts");
			defTs.textContent = "";
			const defTsSpan = document.createElement("span");
			defTsSpan.className = "combat-round-ts";
			defTsSpan.textContent = item.defTs != null ? String(item.defTs) : "—";
			defTs.appendChild(defTsSpan);
		}
	);
};

Space4x.syncCombatLines = function (listEl, lines, emptyText) {
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
