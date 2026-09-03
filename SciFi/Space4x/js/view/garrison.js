var Space4x = Space4x || {};

Space4x.troopGlyphSpec = function (state, defId) {
	const def = Space4x.settingOf(state).builds[defId];
	if (def && def.glyph) return def.glyph;
	return { asset: "assets/troops/_fallback.svg" };
};

Space4x.TROOP_GLYPH_FALLBACK = "assets/troops/_fallback.svg";

Space4x.troopGlyphAsset = function (state, defId) {
	const spec = Space4x.troopGlyphSpec(state, defId);
	if (spec.asset) return spec.asset;
	if (defId) return "assets/troops/" + defId + ".svg";
	return Space4x.TROOP_GLYPH_FALLBACK;
};

Space4x.makeTroopGlyph = function (state, defId) {
	const img = document.createElement("img");
	img.className = "troop-glyph troop-glyph-img";
	img.src = Space4x.troopGlyphAsset(state, defId);
	img.width = 18;
	img.height = 18;
	img.alt = "";
	img.addEventListener("error", function () {
		if (img.src.indexOf("_fallback.svg") < 0) img.src = Space4x.TROOP_GLYPH_FALLBACK;
	}, { once: true });
	return img;
};

Space4x.troopIsWildlife = function (state, defId) {
	const def = defId && Space4x.settingOf(state).builds[defId];
	return !!(def && Space4x.defMatchesTags(def, ["Wildlife"]));
};

Space4x.makeWildlifeMark = function () {
	const span = document.createElement("span");
	span.className = "troop-badge-art troop-wildlife-mark";
	span.title = "Wildlife";
	const img = document.createElement("img");
	img.src = "assets/troops/wildlife-mark.svg";
	img.width = 22;
	img.height = 22;
	img.alt = "";
	span.appendChild(img);
	return span;
};

Space4x.makeTroopBadgeRow = function (state, opts) {
	opts = opts || {};
	const row = document.createElement("span");
	row.className = "troop-badge-row" + (opts.extraClass ? " " + opts.extraClass : "");
	const defId = opts.defId;
	const glyph = Space4x.makeTroopGlyph(state, defId);
	glyph.setAttribute("data-def", defId || "");
	row.appendChild(glyph);
	if (opts.culture) {
		const art = document.createElement("img");
		art.className = "troop-badge-art";
		art.alt = "";
		Space4x.setCultureImg(art, state, opts.culture);
		row.appendChild(art);
	} else if (Space4x.troopIsWildlife(state, defId)) {
		row.appendChild(Space4x.makeWildlifeMark());
	}
	if (!opts.iconsOnly) {
		const def = defId && Space4x.settingOf(state).builds[defId];
		const species = opts.culture ? Space4x.cultureName(state, opts.culture) : "";
		const name = document.createElement("span");
		name.className = "troop-badge-name";
		let label = opts.name || (def ? def.name : defId || "Unit");
		if (species) label += " · " + species;
		name.textContent = label;
		row.appendChild(name);
		if (opts.count != null) {
			const count = document.createElement("span");
			count.className = "troop-badge-count";
			count.textContent = "×" + opts.count;
			row.appendChild(count);
		}
	}
	if (opts.title) row.title = opts.title;
	return row;
};

Space4x.makeTroopGlyphToken = function (state, troop, opts) {
	opts = opts || {};
	const span = document.createElement("span");
	span.className = "troop-glyph-token" + (opts.extraClass ? " " + opts.extraClass : "");
	span.setAttribute("data-troop-id", troop.id);
	span.appendChild(Space4x.makeTroopGlyph(state, troop.defId));
	if (opts.title) span.title = opts.title;
	return span;
};

Space4x.makeTroopUnitBadge = function (state, troop, opts) {
	return Space4x.makeTroopGlyphToken(state, troop, opts);
};

Space4x.syncTroopLaneBoard = function (container, state, st, opts) {
	opts = opts || {};
	const stacks = st ? Space4x.troopStacks(state, st) : [];
	const empire = st ? Space4x.empireById(state, st.empireId) : null;
	const selIds = opts.selectedIds || [];
	function selHas(id) {
		for (let i = 0; i < selIds.length; i++) if (selIds[i] === id) return true;
		return false;
	}
	Space4x.syncKeyedList(container, stacks, function (s) { return s.id; },
		function () {
			const lane = document.createElement("div");
			if (opts.inline) {
				lane.className = "troop-lane troop-lane-inline";
				const row = document.createElement("div");
				row.className = "troop-lane-inline-row";
				lane.appendChild(row);
				return lane;
			}
			lane.className = "troop-lane" + (opts.compact ? " troop-lane-compact" : "");
			const head = document.createElement("div");
			head.className = "troop-lane-head";
			const units = document.createElement("div");
			units.className = "troop-lane-units";
			lane.appendChild(head);
			lane.appendChild(units);
			return lane;
		},
		function (lane, stack) {
			lane.setAttribute("data-stack-id", stack.id);
			const troops = [];
			if (st && st.troops) {
				const parsed = Space4x.parseTroopStackId(stack.id);
				for (let i = 0; i < st.troops.length; i++) {
					const t = st.troops[i];
					if (t.defId !== parsed.defId) continue;
					if ((t.culture || "") !== (parsed.culture || "")) continue;
					troops.push(t);
				}
			}
			const species = stack.culture ? Space4x.cultureName(state, stack.culture) : "";
			const ts = Space4x.troopTs(state, empire, stack.def, stack.culture);
			const unitName = stack.def ? stack.def.name : stack.defId;
			const laneTitle = unitName + (species ? " · " + species : "") + " · TS " + ts;
			lane.title = laneTitle;
			if (opts.inline) {
				const row = lane.querySelector(".troop-lane-inline-row");
				row.replaceChildren();
				if (stack.culture) {
					const art = document.createElement("img");
					art.className = "troop-lane-species";
					art.alt = "";
					Space4x.setCultureImg(art, state, stack.culture);
					art.title = laneTitle;
					row.appendChild(art);
				} else if (Space4x.troopIsWildlife(state, stack.defId)) {
					const mark = Space4x.makeWildlifeMark();
					mark.title = laneTitle;
					row.appendChild(mark);
				}
				for (let i = 0; i < troops.length; i++) {
					const troop = troops[i];
					const each = Space4x.troopTs(state, empire, stack.def, troop.culture);
					const token = Space4x.makeTroopGlyphToken(state, troop);
					token.title = unitName + (species ? " · " + species : "") + " · TS " + each +
						(opts.transferTip ? " · " + opts.transferTip : "");
					token.classList.toggle("is-selected", selHas(troop.id));
					row.appendChild(token);
				}
				if (opts.onHeadClick) {
					row.style.cursor = "pointer";
					row.onclick = function () { opts.onHeadClick(stack); };
				}
				return;
			}
			const head = lane.querySelector(".troop-lane-head");
			head.replaceChildren();
			if (stack.culture) {
				const art = document.createElement("img");
				art.className = "troop-lane-species";
				art.alt = "";
				Space4x.setCultureImg(art, state, stack.culture);
				head.appendChild(art);
			} else if (Space4x.troopIsWildlife(state, stack.defId)) {
				head.appendChild(Space4x.makeWildlifeMark());
			}
			const label = document.createElement("span");
			label.className = "troop-lane-name";
			label.textContent = stack.def ? stack.def.name : stack.defId;
			head.appendChild(label);
			head.title = laneTitle;
			if (opts.onHeadClick) {
				head.style.cursor = "pointer";
				head.onclick = function () { opts.onHeadClick(stack); };
			}
			const unitsBox = lane.querySelector(".troop-lane-units");
			Space4x.syncKeyedList(unitsBox, troops, function (t) { return t.id; },
				function (troop) {
					return Space4x.makeTroopGlyphToken(state, troop);
				},
				function (token, troop) {
					const each = Space4x.troopTs(state, empire, stack.def, troop.culture);
					token.title = unitName +
						(species ? " · " + species : "") + " · TS " + each +
						(opts.transferTip ? " · " + opts.transferTip : "");
					token.classList.toggle("is-selected", selHas(troop.id));
				}
			);
		}
	);
};

Space4x.syncTroopMoveCost = function (ui, state, st) {
	if (!ui.settleTroopCost) return;
	const factor = Space4x.settingOf(state).troopMoveFreighterFactor || 1;
	const n = parseInt(ui.settleTroopCount.value, 10) || 0;
	const parsed = ui.settleTroopDef ? Space4x.parseTroopStackId(ui.settleTroopDef.value) : { defId: "", culture: null };
	const have = st ? Space4x.countTroops(st, parsed.defId, parsed.culture || undefined) : 0;
	const player = st ? Space4x.empireById(state, st.empireId) : null;
	const use = player ? Space4x.empireFreighterUse(state, player.id) : { idle: 0, transit: 0, owned: 0 };
	let text = "";
	if (n > 0) text = n * factor + " freighter" + (n * factor === 1 ? "" : "s");
	if (have && n > have) text += " · only " + have + " here";
	if (use.transit > 0) text += (text ? " · " : "") + use.transit + " in use";
	if (n > 0 && n * factor > use.idle) {
		text += (text ? " · " : "") + use.idle + " idle of " + use.owned;
	}
	Space4x.setText(ui.settleTroopCost, text);
};

Space4x.bindGarrisonTransfers = function (app) {
	const board = app.ui.settleGarrison;
	if (!board || board._garrisonBound) return;
	board._garrisonBound = true;
	board.addEventListener("click", function (ev) {
		if (app.state.ui.stage !== "settlement") return;
		const player = Space4x.playerEmpire(app.state);
		const st = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
		if (!player || !st || st.empireId !== player.id) return;
		if (ev.target.closest("button")) return;

		const troopToken = ev.target.closest(".troop-glyph-token");
		if (!troopToken) return;
		ev.stopPropagation();
		Space4x.clearEmpirePopSel(app.state);
		const troopLane = troopToken.closest(".troop-lane");
		const tokens = troopLane ? troopLane.querySelectorAll(".troop-glyph-token") : [];
		const ids = [];
		let after = false;
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i] === troopToken) after = true;
			if (!after) continue;
			ids.push(tokens[i].getAttribute("data-troop-id"));
		}
		app.state.ui.empireTroopSel = { settlementId: st.id, ids: ids };
		app.sync();
	});
};

Space4x.syncGarrison = function (ui, state, cmds, st, mine) {
	if (!ui.settleGarrison) return;
	const stacks = st ? Space4x.troopStacks(state, st) : [];
	if (ui.settleGarrisonEmpty) ui.settleGarrisonEmpty.hidden = stacks.length > 0;
	const inspect = state.ui.inspect;
	const troopSel = state.ui.empireTroopSel || { settlementId: null, ids: [] };
	const selectedIds = st && troopSel.settlementId === st.id ? troopSel.ids : [];
	Space4x.syncTroopLaneBoard(ui.settleGarrison, state, st, {
		selectedIds: selectedIds,
		transferTip: "click to select, then Send to fleet or move",
		onHeadClick: function (stack) {
			cmds.inspectBuild("troop", stack.defId, null, stack.culture);
		}
	});
	if (inspect) {
		const lanes = ui.settleGarrison.querySelectorAll(".troop-lane");
		for (let i = 0; i < lanes.length; i++) {
			const stackId = lanes[i].getAttribute("data-stack-id");
			const parsed = Space4x.parseTroopStackId(stackId);
			const sameTroop = inspect.defId === parsed.defId &&
				(inspect.kind === "catalog" || (inspect.kind === "troop" && (inspect.culture || "") === (parsed.culture || "")));
			lanes[i].classList.toggle("is-inspect", !!sameTroop);
		}
	}

	const player = Space4x.playerEmpire(state);
	const homes = player ? Space4x.settlementsOf(state, player.id) : [];
	const dests = [];
	if (st && mine) {
		for (let i = 0; i < homes.length; i++) {
			if (homes[i].id !== st.id) dests.push(homes[i]);
		}
	}
	if (ui.settleTroopFleet) ui.settleTroopFleet.hidden = !mine || !stacks.length;
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
				opt.textContent = Space4x.settlementLabel(state, home);
			}
		);
	}
	if (ui.btnSettleTroopMove) {
		const selN = selectedIds.length;
		const useSel = selN > 0;
		ui.btnSettleTroopMove.disabled = !mine || !stacks.length || dests.length < 1 || (useSel && !selN);
		ui.btnSettleTroopMove.textContent = useSel ? ("Send " + selN + " to colony") : "Send";
	}
	if (ui.btnSettleTroopFleet) {
		const selN = selectedIds.length;
		const factor = Space4x.settingOf(state).troopMoveFreighterFactor || 1;
		const use = player ? Space4x.empireFreighterUse(state, player.id) : { idle: 0, transit: 0, owned: 0 };
		const need = selN * factor;
		const canShip = selN > 0 && use.idle >= need;
		ui.btnSettleTroopFleet.disabled = !mine || !stacks.length || !selN || !canShip;
		let label = selN ? ("Send " + selN + " to fleet") : "Send to fleet";
		if (selN && !canShip && use.transit > 0) {
			label += " (" + use.transit + " freighters in use)";
		}
		ui.btnSettleTroopFleet.textContent = label;
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
		const selN = selectedIds.length;
		if (!warpOk) {
			ui.btnSettleTroopMove.disabled = true;
			if (ui.settleTroopCost) Space4x.setText(ui.settleTroopCost, "Needs Warp Drive to move between stars");
		} else if (selN > 0) {
			const factor = Space4x.settingOf(state).troopMoveFreighterFactor || 1;
			const idle = player ? Space4x.empireFreighterUse(state, player.id).idle : 0;
			ui.btnSettleTroopMove.disabled = !mine || dests.length < 1 || Math.floor(idle / factor) < selN;
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
				let dest = unit.fleetMode ? "fleet" : (to ? Space4x.settlementLabel(state, to) : "?");
				row.querySelector("span").textContent =
					Space4x.troopCargoLabel(state, cargo) +
					" · " + Space4x.unitFreighterHulls(state, unit) + " freighters in use" +
					" · " + (from ? Space4x.settlementLabel(state, from) : "?") + " → " + dest;
				row.querySelector("button").disabled = !mine;
			}
		);
	}
};
