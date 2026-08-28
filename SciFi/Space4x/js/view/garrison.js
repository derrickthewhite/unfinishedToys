var Space4x = Space4x || {};

Space4x.TROOP_GLYPH = {
	police: { color: "#5b8def", shape: "shield" },
	militia: { color: "#8a9070", shape: "square" },
	infantry: { color: "#6b8f3d", shape: "square" },
	elites: { color: "#d4a017", shape: "star" },
	armor: { color: "#a0652a", shape: "rect" },
	mechs: { color: "#7a8a9a", shape: "hex" },
	air: { color: "#4ec4d4", shape: "tri" }
};

Space4x.makeTroopGlyph = function (defId) {
	const spec = Space4x.TROOP_GLYPH[defId] || { color: "#9aa7c2", shape: "square" };
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("class", "troop-glyph");
	svg.setAttribute("viewBox", "0 0 16 16");
	svg.setAttribute("width", "18");
	svg.setAttribute("height", "18");
	svg.setAttribute("aria-hidden", "true");
	const color = spec.color;
	if (spec.shape === "shield") {
		const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
		p.setAttribute("d", "M8 1.4 L13.2 3.4 V8.2 C13.2 11.4 10.8 13.8 8 14.6 C5.2 13.8 2.8 11.4 2.8 8.2 V3.4 Z");
		p.setAttribute("fill", color);
		svg.appendChild(p);
	} else if (spec.shape === "tri") {
		const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
		p.setAttribute("d", "M8 2.2 L14 13.4 H2 Z");
		p.setAttribute("fill", color);
		svg.appendChild(p);
	} else if (spec.shape === "rect") {
		const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		r.setAttribute("x", "1.6");
		r.setAttribute("y", "4.4");
		r.setAttribute("width", "12.8");
		r.setAttribute("height", "7.2");
		r.setAttribute("rx", "1.2");
		r.setAttribute("fill", color);
		svg.appendChild(r);
	} else if (spec.shape === "hex") {
		const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
		p.setAttribute("d", "M8 1.4 L13.4 4.4 V11.6 L8 14.6 L2.6 11.6 V4.4 Z");
		p.setAttribute("fill", color);
		svg.appendChild(p);
	} else if (spec.shape === "star") {
		const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
		p.setAttribute("d", "M8 1.6 L9.8 6.1 H14.4 L10.7 8.9 L12.4 13.4 L8 10.8 L3.6 13.4 L5.3 8.9 L1.6 6.1 H6.2 Z");
		p.setAttribute("fill", color);
		svg.appendChild(p);
	} else {
		const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		r.setAttribute("x", "2.4");
		r.setAttribute("y", "2.4");
		r.setAttribute("width", "11.2");
		r.setAttribute("height", "11.2");
		r.setAttribute("rx", "1.6");
		r.setAttribute("fill", color);
		svg.appendChild(r);
	}
	return svg;
};

Space4x.syncTroopMoveCost = function (ui, state, st) {
	if (!ui.settleTroopCost) return;
	const factor = Space4x.settingOf(state).troopMoveFreighterFactor || 1;
	const n = parseInt(ui.settleTroopCount.value, 10) || 0;
	const parsed = ui.settleTroopDef ? Space4x.parseTroopStackId(ui.settleTroopDef.value) : { defId: "", culture: null };
	const have = st ? Space4x.countTroops(st, parsed.defId, parsed.culture || undefined) : 0;
	let text = "";
	if (n > 0) text = n * factor + " freighter" + (n * factor === 1 ? "" : "s");
	if (have && n > have) text += " · only " + have + " here";
	Space4x.setText(ui.settleTroopCost, text);
};

Space4x.syncGarrison = function (ui, state, cmds, st, mine) {
	if (!ui.settleGarrison) return;
	const stacks = st ? Space4x.troopStacks(state, st) : [];
	if (ui.settleGarrisonEmpty) ui.settleGarrisonEmpty.hidden = stacks.length > 0;
	const inspect = state.ui.inspect;
	Space4x.syncKeyedList(ui.settleGarrison, stacks, function (s) { return s.id; },
		function (item) {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "garrison-btn";
			const glyph = Space4x.makeTroopGlyph(item.defId);
			glyph.setAttribute("data-def", item.defId);
			const art = document.createElement("img");
			art.className = "garrison-art";
			art.alt = "";
			const name = document.createElement("span");
			name.className = "garrison-name";
			const count = document.createElement("span");
			count.className = "garrison-count";
			btn.appendChild(glyph);
			btn.appendChild(art);
			btn.appendChild(name);
			btn.appendChild(count);
			li.appendChild(btn);
			btn.addEventListener("click", function () {
				const parsed = Space4x.parseTroopStackId(li.getAttribute("data-id"));
				cmds.inspectBuild("troop", parsed.defId, null, parsed.culture);
			});
			return li;
		},
		function (row, item) {
			const btn = row.querySelector("button");
			const old = row.querySelector(".troop-glyph");
			if (old && old.getAttribute("data-def") !== item.defId) {
				const next = Space4x.makeTroopGlyph(item.defId);
				next.setAttribute("data-def", item.defId);
				btn.replaceChild(next, old);
			} else if (old) {
				old.setAttribute("data-def", item.defId);
			}
			const art = row.querySelector(".garrison-art");
			if (art) Space4x.setCultureImg(art, state, item.culture);
			const species = item.culture ? Space4x.cultureName(state, item.culture) : "";
			row.querySelector(".garrison-name").textContent = item.def.name + (species ? " · " + species : "");
			row.querySelector(".garrison-count").textContent = "×" + item.n;
			const tags = (item.def.tags || []).join(", ");
			const empire = st ? Space4x.empireById(state, st.empireId) : null;
			const ts = Space4x.troopTs(state, empire, item.def, item.culture);
			let loy = "";
			if (st && Space4x.loyaltyRules(state)) {
				const range = Space4x.stackUnitLoyalty(state, st, item.defId, item.culture);
				if (range.n) {
					loy = range.min === range.max ? " · " + range.min + "% loyal" : " · " + range.min + "–" + range.max + "% loyal";
				}
			}
			btn.title = item.def.name + (species ? " · " + species : "") + " · TS " + ts + (tags ? " · " + tags : "") + loy;
			const sameTroop = inspect && inspect.defId === item.defId &&
				(inspect.kind === "catalog" || (inspect.kind === "troop" && (inspect.culture || "") === (item.culture || "")));
			row.classList.toggle("is-inspect", !!sameTroop);
		}
	);

	const player = Space4x.playerEmpire(state);
	const homes = player ? Space4x.settlementsOf(state, player.id) : [];
	const dests = [];
	if (st && mine) {
		for (let i = 0; i < homes.length; i++) {
			if (homes[i].id !== st.id) dests.push(homes[i]);
		}
	}
	if (ui.settleTroopMove) ui.settleTroopMove.hidden = !mine || !stacks.length || dests.length < 1;
	const focus = document.activeElement;
	if (ui.settleTroopDef) {
		Space4x.syncKeyedList(ui.settleTroopDef, stacks, function (s) { return s.id; },
			function () { return document.createElement("option"); },
			function (opt, item) {
				opt.value = item.id;
				const species = item.culture ? " " + Space4x.cultureName(state, item.culture) : "";
				opt.textContent = item.def.name + species + " (" + item.n + ")";
			}
		);
	}
	if (ui.settleTroopTo) {
		Space4x.syncKeyedList(ui.settleTroopTo, dests, function (s) { return s.id; },
			function () { return document.createElement("option"); },
			function (opt, home) {
				opt.value = home.id;
				opt.textContent = home.name;
			}
		);
	}
	if (ui.btnSettleTroopMove) {
		ui.btnSettleTroopMove.disabled = !mine || !stacks.length || dests.length < 1;
	}
	if (ui.settleTroopCount && focus !== ui.settleTroopCount) {
		const parsed = ui.settleTroopDef ? Space4x.parseTroopStackId(ui.settleTroopDef.value) : { defId: "", culture: null };
		const have = st ? Space4x.countTroops(st, parsed.defId, parsed.culture || undefined) : 0;
		const cur = parseInt(ui.settleTroopCount.value, 10) || 1;
		if (have && cur > have) ui.settleTroopCount.value = String(have);
		if (!ui.settleTroopCount.value) ui.settleTroopCount.value = "1";
	}
	Space4x.syncTroopMoveCost(ui, state, st);
	if (ui.btnSettleTroopMove) {
		const dest = ui.settleTroopTo ? Space4x.settlementById(state, ui.settleTroopTo.value) : null;
		const warpOk = !st || !dest || Space4x.canLeaveSystem(state, player, st.location.starId, dest.location.starId);
		if (!warpOk) {
			ui.btnSettleTroopMove.disabled = true;
			if (ui.settleTroopCost) Space4x.setText(ui.settleTroopCost, "Needs Warp Drive to move between stars");
		}
	}

	const transit = [];
	if (st) {
		const haulers = Space4x.troopHaulers(state, st.empireId);
		for (let i = 0; i < haulers.length; i++) {
			const u = haulers[i];
			if (u.originSettlementId === st.id || u.destSettlementId === st.id) transit.push(u);
		}
	}
	if (ui.settleTroopMovesEmpty) ui.settleTroopMovesEmpty.hidden = !mine || transit.length > 0 || (!stacks.length && !transit.length);
	if (ui.settleTroopMoves) {
		ui.settleTroopMoves.hidden = !mine;
		Space4x.syncKeyedList(ui.settleTroopMoves, transit, function (u) { return u.id; },
			function () {
				const li = document.createElement("li");
				const span = document.createElement("span");
				const rm = document.createElement("button");
				rm.type = "button";
				rm.textContent = "Cancel";
				li.appendChild(span);
				li.appendChild(rm);
				rm.addEventListener("click", function () {
					cmds.cancelPopMove(li.getAttribute("data-id"));
				});
				return li;
			},
			function (row, unit) {
				const from = Space4x.settlementById(state, unit.originSettlementId);
				const to = Space4x.settlementById(state, unit.destSettlementId);
				const cargo = unit.cargoTroops || [];
				row.querySelector("span").textContent =
					Space4x.troopCargoLabel(state, cargo) +
					" · " + (from ? from.name : "?") + " → " + (to ? to.name : "?") +
					" · " + (unit.hulls || cargo.length) + " freighter" + ((unit.hulls || cargo.length) === 1 ? "" : "s");
				row.querySelector("button").disabled = !mine;
			}
		);
	}
};
