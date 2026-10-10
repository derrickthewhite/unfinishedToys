var DE = DE || {};

DE.qs = function (sel) {
	return document.querySelector(sel);
};

DE.esc = function (s) {
	return String(s == null ? "" : s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
};

DE.unitAsset = function (unit) {
	return DE.speciesArt(DE.portraitSpecies(unit.species, unit.type));
};

DE.renderPortrait = function (species, type, homeFaction) {
	var artSpecies = DE.portraitSpecies(species, type);
	var html = "<span class=\"unit-portrait\">";
	if (homeFaction && homeFaction.symbol) {
		html += "<span class=\"home-mark\" title=\"" + DE.esc(homeFaction.name || "Home") +
			"\" style=\"--c1:" + DE.esc(homeFaction.colors[0]) + ";--c2:" + DE.esc(homeFaction.colors[1]) + "\">";
		html += "<img src=\"" + DE.esc(homeFaction.symbol) + "\" alt=\"\"></span>";
	}
	html += "<img class=\"species\" src=\"" + encodeURI(DE.speciesArt(artSpecies)) + "\" alt=\"\">";
	var w = DE.weaponArt(type);
	if (w) {
		html += "<span class=\"weapon-badge\"><img class=\"weapon\" src=\"" + encodeURI(w) + "\" alt=\"\"></span>";
	}
	html += "</span>";
	return html;
};

DE.renderWeaponKit = function (type) {
	var def = DE.unitDef(type);
	var label = def ? def.name : type;
	var art = DE.weaponArt(type) || DE.speciesArt("human");
	return "<span class=\"weapon-kit\" title=\"" + DE.esc(label) + "\">" +
		"<img src=\"" + encodeURI(art) + "\" alt=\"" + DE.esc(label) + "\"></span>";
};

DE.renderWeaponKits = function (weapons) {
	weapons = DE.filterWeaponKits(weapons || []);
	if (!weapons.length) return "<span class=\"muted\">none</span>";
	var html = "<span class=\"weapon-kit-row\">";
	for (var i = 0; i < weapons.length; i++) {
		html += DE.renderWeaponKit(weapons[i]);
	}
	html += "</span>";
	return html;
};

DE.renderResourceIcon = function (kind) {
	var src = DE.resourceArt(kind);
	if (!src) return "";
	var label = kind === "gold" ? "Gold" : kind === "food" ? "Food" : kind === "magic" ? "Magic" : kind;
	return "<span class=\"res-icon\" title=\"" + DE.esc(label) + "\">" +
		"<img src=\"" + encodeURI(src) + "\" alt=\"\"></span>";
};

DE.renderResourceAmount = function (kind, amount) {
	return "<span class=\"res-amt\">" + DE.renderResourceIcon(kind) +
		"<span class=\"res-num\">" + (amount == null ? 0 : amount) + "</span></span>";
};

DE.renderStuffResources = function (stuff) {
	stuff = stuff || {};
	return DE.renderResourceAmount("gold", stuff.gold || 0) +
		" · " + DE.renderResourceAmount("magic", stuff.magic || 0) +
		" · " + DE.renderResourceAmount("food", stuff.food || 0);
};

DE.renderGoldPrice = function (amount) {
	return DE.renderResourceIcon("gold") + "<span class=\"res-num\">" + (amount == null ? 0 : amount) + "</span>";
};

DE.renderForce = function (state, units, stuff, title, faction, leader, opts) {
	opts = opts || {};
	var towardId = opts.towardFactionId || null;
	var showPartyTrust = !!(towardId && opts.showPartyTrust);
	var html = "<div class=\"force\">";
	if (faction) {
		html += "<div class=\"faction-mark\" style=\"--c1:" + DE.esc(faction.colors[0]) + ";--c2:" + DE.esc(faction.colors[1]) + "\">";
		html += "<div class=\"glyph-plate\"><img class=\"glyph-img\" src=\"" + DE.esc(faction.symbol) + "\" alt=\"\"></div>";
		html += "<div><div class=\"faction-name\">" + DE.esc(faction.name) + "</div>";
		var speciesLabel = DE.SPECIES_LABELS[faction.species] || faction.species || "";
		if (speciesLabel && speciesLabel.toLowerCase() !== String(faction.name || "").toLowerCase()) {
			html += "<div class=\"muted\">" + DE.esc(speciesLabel) + "</div>";
		}
		html += "</div></div>";
	}
	html += "<h3>" + DE.esc(title) + "</h3>";
	if (leader && leader.name) {
		html += "<p class=\"leader-line\">Led by " + DE.esc(leader.name) + "</p>";
	}
	html += "<div class=\"stuff\">" + DE.renderStuffResources(stuff);
	if ((stuff.weapons || []).length) {
		html += " · Kits " + DE.renderWeaponKits(stuff.weapons);
	}
	if ((stuff.captives || []).length) html += " · Captives " + stuff.captives.length;
	html += "</div>";
	html += "<ul class=\"unit-list\">";
	var groups = DE.groupUnits(units);
	for (var i = 0; i < groups.length; i++) {
		var g = groups[i];
		var home = (state && g.homeFactionId) ? DE.factionById(state, g.homeFactionId) : null;
		html += "<li class=\"" + (g.wounded ? "wounded" : "") + "\">";
		html += DE.renderPortrait(g.species, g.type, home);
		html += "<span>" + DE.esc(DE.groupLabel(g));
		if (showPartyTrust && g.homeFactionId && g.homeFactionId !== "player") {
			var uBand = DE.partyMemberTrustBand(state, g.homeFactionId, towardId);
			var uDelta = DE.partyTrustDisplayDelta(uBand, false);
			if (uDelta) {
				html += " <span class=\"party-trust-mod\" title=\"Hireling trust vs them (" +
					DE.esc(uBand) + ")\">" + DE.esc(DE.formatPartyTrustDelta(uDelta)) + " trust</span>";
			}
		}
		html += "</span></li>";
	}
	html += "</ul>";
	if (showPartyTrust && stuff && (stuff.captives || []).length) {
		html += "<h4 class=\"force-captives-title\">Captives</h4><ul class=\"unit-list captives\">";
		var capGroups = DE.groupUnits(stuff.captives);
		for (var c = 0; c < capGroups.length; c++) {
			var cg = capGroups[c];
			var capHomeId = cg.homeFactionId || (cg.units[0] && DE.captiveHomeId(cg.units[0]));
			var capHome = capHomeId ? DE.factionById(state, capHomeId) : null;
			html += "<li>";
			html += DE.renderPortrait(cg.species, cg.type, capHome);
			html += "<span>" + DE.esc(DE.groupLabel(cg));
			if (capHomeId) {
				var cBand = DE.partyMemberTrustBand(state, capHomeId, towardId);
				var cDelta = DE.partyTrustDisplayDelta(cBand, true);
				if (cDelta) {
					html += " <span class=\"party-trust-mod\" title=\"Captive trust vs them (" +
						DE.esc(cBand) + ", opposite of hirelings)\">" +
						DE.esc(DE.formatPartyTrustDelta(cDelta)) + " trust</span>";
				}
			}
			html += "</span></li>";
		}
		html += "</ul>";
	}
	html += "</div>";
	return html;
};

DE.renderPartyTrustSummary = function (state, enc) {
	if (!enc || !enc.factionId || enc.kind === "animal" || enc.animal) return "";
	var mod = DE.computePartyTrustModifier(
		state,
		enc.factionId,
		enc.playerUnits,
		(enc.playerStuff && enc.playerStuff.captives) || []
	);
	if (!mod.hireFriendly && !mod.hireHostile && !mod.capFriendly && !mod.capHostile) {
		return "";
	}
	var html = "<div class=\"party-trust-summary\">";
	html += "<p><strong>Party trust</strong> " + DE.esc(DE.formatPartyTrustDelta(mod.total));
	html += " <span class=\"muted\">(hirelings " + DE.esc(DE.formatPartyTrustDelta(mod.hireling)) +
		" · captives " + DE.esc(DE.formatPartyTrustDelta(mod.captive)) + ")</span></p>";
	html += "<p class=\"muted\">1 hireling/captive ±5%, 2+ ±10%. Same faction counts friendly. Captives flip the sign.</p>";
	html += "</div>";
	return html;
};

DE.renderLogPanel = function (state, factionId) {
	if (!factionId || factionId.indexOf("wild-") === 0) {
		return "<aside class=\"log-panel\"><h3>Faction history</h3><p class=\"muted\">No faction to remember.</p></aside>";
	}
	var q = state.ui.logQuery || "";
	var filter = state.ui.logFilter || "all";
	var rows = DE.searchLog(state, factionId, q, filter);
	var html = "<aside class=\"log-panel\"><h3>Faction history</h3>";
	html += "<input type=\"search\" data-field=\"logQuery\" placeholder=\"Search leader, fight, gift…\" value=\"" + DE.esc(q) + "\">";
	html += "<select data-field=\"logFilter\">";
	["all", "fought", "gifted", "traded", "village", "field"].forEach(function (f) {
		html += "<option value=\"" + f + "\"" + (filter === f ? " selected" : "") + ">" + f + "</option>";
	});
	html += "</select><ul class=\"log-list\">";
	if (!rows.length) html += "<li class=\"muted\">Nothing recorded yet.</li>";
	for (var i = 0; i < rows.length; i++) {
		html += "<li>" + DE.esc(DE.describeLogEntry(rows[i])) + "</li>";
	}
	html += "</ul></aside>";
	return html;
};

DE.renderActions = function (enc) {
	var html = "<div class=\"actions\">";
	for (var i = 0; i < DE.ACTIONS.length; i++) {
		var a = DE.ACTIONS[i];
		if (!DE.actionAvailable(enc, a, "player")) continue;
		var disabled = a === "trade" && enc.roundIndex === 0;
		html += "<button type=\"button\" class=\"act" + (disabled ? " dim" : "") + "\" data-act=\"" + a + "\"" + (disabled ? " disabled" : "") + ">";
		html += "<img src=\"assets/actions/" + a + ".svg\" alt=\"\">";
		html += "<span>" + DE.ACTION_LABELS[a] + "</span></button>";
	}
	html += "</div>";
	return html;
};

DE.renderBase = function (state) {
	var h = DE.factionById(state, state.hostileFactionId);
	var held = DE.markHostagesStillHeld(state);
	var html = "<section class=\"screen base\">";
	html += "<header class=\"hero-brand\"><img class=\"cave-mark\" src=\"assets/be/base.svg\" alt=\"\"><div>";
	html += "<p class=\"brand\">Diplomacy Encounters</p>";
	html += "<h1>Cavern camp</h1>";
	html += "<p class=\"lede\">Rescue the five humans held by the " + DE.esc(h ? h.name : "mark") +
		". " + held + " still captive.</p>";
	html += "</div></header>";
	if (state.ui.flash) {
		html += "<p class=\"flash\">" + DE.esc(state.ui.flash) + "</p>";
		state.ui.flash = "";
	}
	html += "<div class=\"stat-line\">" +
		DE.renderResourceAmount("gold", state.player.gold) + " · " +
		DE.renderResourceAmount("magic", state.player.magic || 0) + " · " +
		DE.renderResourceAmount("food", state.player.food || 0) +
		" · Soldiers " + DE.playerLiving(state).length +
		" · Encounters " + (state.totalEncounters || 0) + "</div>";
	html += "<div class=\"split\">";
	html += "<div><h2>Roster</h2><p class=\"muted\">Choose how many to send.</p>";
	html += "<ul class=\"unit-list pick\">";
	var groups = DE.groupUnits(DE.playerLiving(state));
	var counts = state.ui.sendCounts || {};
	for (var i = 0; i < groups.length; i++) {
		var g = groups[i];
		var key = DE.groupSendKey(g);
		var send = counts[key];
		if (send == null) send = 0;
		send = Math.max(0, Math.min(g.count, Number(send) || 0));
		var home = g.homeFactionId ? DE.factionById(state, g.homeFactionId) : null;
		html += "<li>";
		html += DE.renderPortrait(g.species, g.type, home);
		html += "<span class=\"pick-meta\">" + DE.esc(DE.groupLabel(g));
		html += " <label class=\"count-pick\">Send <input type=\"number\" min=\"0\" max=\"" + g.count +
			"\" data-send-key=\"" + DE.esc(key) + "\" data-send-ids=\"" + g.ids.join(",") +
			"\" value=\"" + send + "\"></label></span>";
		html += "<span class=\"send-adjust\">";
		html += "<button type=\"button\" data-cmd=\"send-none\" data-send-key=\"" + DE.esc(key) + "\">None</button>";
		html += "<button type=\"button\" data-cmd=\"send-all\" data-send-key=\"" + DE.esc(key) + "\">All</button>";
		html += "<button type=\"button\" data-cmd=\"send-delta\" data-send-key=\"" + DE.esc(key) + "\" data-delta=\"5\">+5</button>";
		html += "<button type=\"button\" data-cmd=\"send-delta\" data-send-key=\"" + DE.esc(key) + "\" data-delta=\"-5\">-5</button>";
		html += "</span>";
		if (g.type === "civilian") {
			html += " <button type=\"button\" data-cmd=\"equip-open\" data-id=\"" + g.ids[0] + "\">Equip kit</button>";
			if (g.units[0] && g.units[0].previousType) {
				html += " <button type=\"button\" data-cmd=\"reequip\" data-id=\"" + g.ids[0] + "\">Reequip last</button>";
			}
		}
		html += DE.renderRosterPersonActions(state, g);
		html += "</li>";
	}
	html += "</ul>";
	if ((state.player.training || []).length) {
		html += "<h3>Training</h3><ul class=\"muted\">";
		for (var tr = 0; tr < state.player.training.length; tr++) {
			var T = state.player.training[tr];
			var kindLabel = T.kind === "language" ? "language" : "kit";
			html += "<li>" + DE.esc(T.name) + " · " + kindLabel + " · " + T.remaining +
				" encounter(s) left · returns after</li>";
		}
		html += "</ul>";
	}
	html += DE.renderCampCaptives(state);
	if (state.ui.campGiftFor) {
		html += DE.renderCampGiftChooser(state);
	}
	html += "<h2>Recruit</h2><div class=\"row\">";
	html += "<button type=\"button\" data-cmd=\"recruit\" data-type=\"infantry\">Infantry · " +
		DE.renderGoldPrice(DE.unitStuffPrice("infantry")) + "</button>";
	html += "<button type=\"button\" data-cmd=\"recruit\" data-type=\"machineGunner\">Machine gunner · " +
		DE.renderGoldPrice(DE.unitStuffPrice("machineGunner")) + "</button>";
	html += "<button type=\"button\" data-cmd=\"recruit\" data-type=\"civilian\">Civilian · " +
		DE.renderGoldPrice(DE.unitStuffPrice("civilian")) + "</button>";
	html += "</div>";
	html += "<p class=\"muted\">Foreign kits need training, then equip onto a civilian above.</p>";
	if (state.ui.equipFor) {
		html += "<h3>Equip onto civilian</h3><div class=\"row\">";
		var knownKits = Object.keys(DE.knownUnitTypes(state)).filter(function (t) {
			return DE.isWeaponKitType(t);
		});
		var camp = DE.filterWeaponKits(state.player.weapons || []);
		for (var ek = 0; ek < knownKits.length; ek++) {
			var kt = knownKits[ek];
			var have = camp.filter(function (x) { return x === kt; }).length;
			var label = (DE.unitDef(kt) || {}).name || kt;
			if (have) {
				html += "<button type=\"button\" data-cmd=\"equip-kit\" data-id=\"" + DE.esc(state.ui.equipFor) +
					"\" data-type=\"" + kt + "\">" + DE.esc(label) + " (" + have + ")</button>";
			} else {
				html += "<button type=\"button\" disabled>" + DE.esc(label) + " — no kit in camp</button>";
			}
		}
		var unknownCamp = DE.uniqueTypes(camp).filter(function (t) {
			return !DE.canUseKit(state, t);
		});
		for (var uk = 0; uk < unknownCamp.length; uk++) {
			var ut = unknownCamp[uk];
			html += "<p class=\"muted\">Have " + DE.esc((DE.unitDef(ut) || {}).name || ut) +
				" kit — need training before you can equip it.</p>";
		}
		html += "<button type=\"button\" data-cmd=\"equip-cancel\">Cancel</button></div>";
	}
	html += "<h3>Weapon kits in camp</h3>";
	var campKits = DE.filterWeaponKits(state.player.weapons || []);
	if (!campKits.length) {
		html += "<p class=\"muted\">None in camp — buy sets below or leave them here when you march.</p>";
	} else {
		html += "<p class=\"muted\">Choose how many kits to take. The rest stay in camp.</p>";
		html += "<ul class=\"kit-take-list\">";
		var kitCounts = DE.countWeaponKits(campKits);
		var takeCounts = state.ui.weaponTakeCounts || {};
		var kitTypes = Object.keys(kitCounts);
		for (var ck = 0; ck < kitTypes.length; ck++) {
			var kitType = kitTypes[ck];
			var have = kitCounts[kitType];
			var takeN = takeCounts[kitType];
			if (takeN == null) takeN = 0;
			takeN = Math.max(0, Math.min(have, Number(takeN) || 0));
			html += "<li>" + DE.renderWeaponKit(kitType) + " " + DE.esc((DE.unitDef(kitType) || {}).name || kitType);
			html += " · " + have + " in camp <label class=\"set-buy\">Take <input type=\"number\" min=\"0\" max=\"" + have +
				"\" data-kit-take=\"" + DE.esc(kitType) + "\" value=\"" + takeN + "\"></label></li>";
		}
		html += "</ul>";
	}
	html += "</div>";
	html += "<div><h2>Next excursion</h2>";
	var foodCost = (state.ui.foodBuy || 0) * DE.FOOD_GOLD_COST;
	html += "<p class=\"muted\">Camp stores " + DE.renderResourceAmount("food", state.player.food || 0) +
		" (carried on the next march).</p>";
	var expectedBuy = DE.expectedFoodBuy(state);
	html += "<label>" + DE.renderResourceIcon("food") + " Buy food (0.5g each) <input type=\"number\" min=\"0\" data-field=\"foodBuy\" value=\"" + (state.ui.foodBuy || 0) + "\"></label>";
	html += "<button type=\"button\" data-cmd=\"expected-food\">Expected food (" + expectedBuy + ")</button>";
	html += "<p class=\"muted\">Food cost now: " + DE.renderGoldPrice(foodCost) + " · Need " + expectedBuy +
		" more for " + DE.expectedFoodPartySize(state) + " soldiers × " +
		(state.ui.missionDistance || 5) + " encounters (camp stores already subtracted).</p>";
	html += "<label>" + DE.renderResourceIcon("gold") + " Gold to take <input type=\"number\" min=\"0\" data-field=\"goldTake\" value=\"" + (state.ui.goldTake != null ? state.ui.goldTake : 100) + "\"></label>";
	html += "<label>Expected encounters <input type=\"number\" min=\"1\" max=\"16\" data-field=\"missionDistance\" value=\"" + (state.ui.missionDistance || 5) + "\"></label>";
	html += "<h3>Buy weapon sets for the march</h3><p class=\"muted\">Infantry and machine-gun kits only. Foreign kits come from trade or loot, then stay in camp or go with you above.</p><div class=\"row\">";
	var setTypes = DE.marchWeaponSetTypes(state);
	for (var st = 0; st < setTypes.length; st++) {
		var setType = setTypes[st];
		var nBuy = (state.ui.weaponSetBuys && state.ui.weaponSetBuys[setType]) || 0;
		html += "<label class=\"set-buy\">" + DE.renderWeaponKit(setType) + " " +
			DE.esc((DE.unitDef(setType) || {}).name || setType) +
			" (" + DE.renderGoldPrice(DE.unitStuffPrice(setType)) + ") <input type=\"number\" min=\"0\" max=\"5\" data-set-buy=\"" + setType + "\" value=\"" + nBuy + "\"></label>";
	}
	html += "</div>";
	html += "<button type=\"button\" class=\"primary\" data-cmd=\"start\">Start scout</button>";
	var knownV = DE.discoveredVillages(state);
	if (knownV.length) {
		html += "<h3>Known villages</h3><ul class=\"village-list\">";
		for (var v = 0; v < knownV.length; v++) {
			html += DE.renderVillageListItem(state, knownV[v], { withMarch: true });
		}
		html += "</ul>";
	}
	html += "<p class=\"muted\">Seed " + DE.esc(state.seedText) + "</p>";
	html += "</div></div></section>";
	return html;
};

DE.renderRosterPersonActions = function (state, g) {
	var u0 = g.units && g.units[0];
	var hireling = u0 && DE.isHireling(u0);
	var speak = u0 && DE.canSpeakWith(state, u0);
	var parts = "";
	if (hireling && DE.isCivilizedLanguage(g.species) && !speak) {
		parts += "<button type=\"button\" data-cmd=\"language-train\" data-id=\"" + g.ids[0] +
			"\">Language training (10)</button>";
	}
	if (hireling && speak) {
		parts += "<button type=\"button\" data-cmd=\"ask-hireling-village\" data-id=\"" + g.ids[0] +
			"\">Ask village</button>";
		parts += "<button type=\"button\" data-cmd=\"camp-gift-open\" data-id=\"" + g.ids[0] + "\">Gift</button>";
	}
	if (!DE.canUseKit(state, g.type) && g.type !== "civilian" && DE.isWeaponKitType(g.type)) {
		if (hireling && !speak) {
			parts += "<button type=\"button\" disabled title=\"He can't train until you share a language.\">Leave to train (5)</button>";
		} else {
			parts += "<button type=\"button\" data-cmd=\"train\" data-id=\"" + g.ids[0] + "\">Leave to train (5)</button>";
		}
	}
	if (hireling && u0.hireExpired) {
		parts += "<span class=\"muted\">Contract up</span>";
		parts += "<button type=\"button\" data-cmd=\"rehire\" data-id=\"" + g.ids[0] + "\">Pay again · " +
			DE.renderGoldPrice(u0.hirePrice != null ? u0.hirePrice : DE.unitStuffPrice(u0.type)) + "</button>";
		parts += "<button type=\"button\" data-cmd=\"release-hireling\" data-id=\"" + g.ids[0] + "\">Let go</button>";
		parts += "<button type=\"button\" data-cmd=\"capture-hireling\" data-id=\"" + g.ids[0] + "\">Capture</button>";
	}
	if (!parts) return "";
	return "<span class=\"camp-row-actions\">" + parts + "</span>";
};

DE.renderCampCaptives = function (state) {
	var caps = state.player.captives || [];
	if (!caps.length) return "";
	var html = "<h2>Captives</h2><p class=\"muted\">Held in camp. Interrogate once if you share a language.</p>";
	html += "<ul class=\"unit-list captives\">";
	var groups = DE.groupUnits(caps);
	for (var i = 0; i < groups.length; i++) {
		var g = groups[i];
		var home = g.homeFactionId ? DE.factionById(state, g.homeFactionId) : null;
		if (!home && g.units[0]) home = DE.factionById(state, DE.captiveHomeId(g.units[0]));
		html += "<li>";
		html += DE.renderPortrait(g.species, g.type, home);
		html += "<span class=\"pick-meta\">" + DE.esc(DE.groupLabel(g)) + "</span>";
		html += "<span class=\"camp-row-actions\">";
		var speak = DE.canSpeakWith(state, g.units[0]);
		var civilized = DE.isCivilizedLanguage(g.species);
		var openId = null;
		var c;
		for (c = 0; c < g.units.length; c++) {
			if (!g.units[c].interrogated) {
				openId = g.units[c].id;
				break;
			}
		}
		if (civilized && !speak) {
			html += "<button type=\"button\" data-cmd=\"language-train\" data-id=\"" + g.ids[0] +
				"\">Language training (10)</button>";
		} else if (civilized && speak && openId) {
			html += "<button type=\"button\" data-cmd=\"interrogate\" data-id=\"" + openId + "\">Interrogate</button>";
		} else if (civilized && speak) {
			html += "<span class=\"muted\">Already interrogated</span>";
		}
		html += "</span></li>";
	}
	html += "</ul>";
	return html;
};

DE.renderCampGiftChooser = function (state) {
	var u = DE.findPlayerUnit(state, state.ui.campGiftFor);
	if (!u) return "";
	var html = "<h3>Gift " + DE.esc(u.name || DE.unitLabel(u)) + "</h3>";
	html += "<p class=\"muted\">Gold and food from camp stores. Their faction remembers it.</p>";
	html += "<label>" + DE.renderResourceIcon("gold") + " Gold <input type=\"number\" min=\"0\" max=\"" + (state.player.gold || 0) +
		"\" data-field=\"campGiftGold\" value=\"" + (state.ui.campGiftGold || 0) + "\"></label>";
	html += "<label>" + DE.renderResourceIcon("food") + " Food <input type=\"number\" min=\"0\" max=\"" + (state.player.food || 0) +
		"\" data-field=\"campGiftFood\" value=\"" + (state.ui.campGiftFood || 0) + "\"></label>";
	html += "<div class=\"row\">";
	html += "<button type=\"button\" class=\"primary\" data-cmd=\"camp-gift-go\" data-id=\"" + DE.esc(u.id) + "\">Offer</button>";
	html += "<button type=\"button\" data-cmd=\"camp-gift-cancel\">Cancel</button>";
	html += "</div>";
	return html;
};

DE.renderVillageListItem = function (state, vil, opts) {
	opts = opts || {};
	DE.syncVillageMarch(vil);
	var vf = DE.factionById(state, vil.factionId);
	var html = "<li class=\"village-item\">";
	if (vf) {
		html += "<span class=\"faction-mark mini\" style=\"--c1:" + DE.esc(vf.colors[0]) + ";--c2:" + DE.esc(vf.colors[1]) + "\">";
		html += "<img class=\"glyph-img\" src=\"" + DE.esc(vf.symbol) + "\" alt=\"\"></span>";
	}
	html += "<div class=\"village-meta\"><strong>" + DE.esc(vil.name) + "</strong>";
	html += "<div class=\"muted\">";
	if (vf) {
		html += DE.esc(DE.SPECIES_LABELS[vf.species] || vf.species);
		html += " · " + DE.esc(vf.name) + " · ";
	}
	html += "depth " + vil.distance + " · round trip " + vil.revisitLength;
	if (opts.showHidden && !vil.discovered) html += " · hidden";
	else if (opts.showHidden && vil.discovered) html += " · known";
	html += "</div></div>";
	if (opts.withMarch && vil.discovered) {
		html += "<button type=\"button\" data-cmd=\"village\" data-id=\"" + vil.id + "\">March</button>";
	}
	html += "</li>";
	return html;
};

DE.renderEmpty = function (state) {
	var m = state.mission;
	var html = "<section class=\"screen empty-beat\">";
	html += "<p class=\"brand\">Empty dark</p>";
	html += "<h1>" + DE.esc(state.ui.message) + "</h1>";
	html += "<p class=\"muted\">" + DE.renderResourceAmount("food", m.stuff.food) + " · Remaining " + m.remaining +
		" · Depth " + DE.encounterDepth(m) + " · Path " + m.progressed + "/" + m.distance;
	if (DE.hungerLabel(state)) html += " · " + DE.hungerLabel(state);
	html += "</p>";
	html += "<button type=\"button\" class=\"primary\" data-cmd=\"continue\">Go on</button>";
	html += DE.cancelButton(state);
	html += "</section>";
	return html;
};

DE.cancelButton = function (state) {
	var m = state.mission;
	if (!m || m.returning || m.progressed >= m.distance / 2) return "";
	return "<button type=\"button\" data-cmd=\"cancel\">Turn back</button>";
};

DE.renderEncounter = function (state) {
	var enc = state.mission.pendingEncounter;
	var fac = DE.factionById(state, enc.factionId);
	var fear = DE.perceivedFearFromStrength(enc.playerUnits, enc.aiUnits, null, state, state.player);
	var raid = !!enc.campRaid;
	var html = "<section class=\"screen encounter" + (raid ? " raid" : "") + "\">";
	html += "<div class=\"mission-bar muted\">" +
		DE.renderResourceAmount("food", state.mission.stuff.food) + " · " +
		DE.renderResourceAmount("gold", state.mission.stuff.gold) + " · " +
		DE.renderResourceAmount("magic", state.mission.stuff.magic || 0) +
		" · Depth " + DE.encounterDepth(state.mission) + " · Remaining " + state.mission.remaining + " · Round " + (enc.roundIndex + 1) +
		(enc.village ? " · Village " + DE.esc(enc.villageName) : "") +
		(raid ? " · Camp under attack" : "");
	if (DE.hungerLabel(state)) html += " · " + DE.esc(DE.hungerLabel(state));
	html += "</div>";
	html += "<div class=\"encounter-grid\">";
	html += DE.renderForce(state, enc.aiUnits, enc.aiStuff, DE.forceCvTitle("Them", fear.enemy, fear.uncertainEnemy, enc.aiUnits, !!enc.village), fac, enc.leader);
	html += "<div class=\"encounter-mid\">";
	if (raid) {
		html += "<p class=\"brand raid-brand\">Raid</p>";
		html += "<h1 class=\"raid-title\"><img class=\"base-icon\" src=\"assets/be/base.svg\" alt=\"\">" +
			DE.esc(DE.encounterHeadline(state, enc)) + "</h1>";
	} else {
		html += "<p class=\"brand\">" + (enc.village ? "Village" : "Encounter") + "</p>";
		html += "<h1>" + DE.esc(DE.encounterHeadline(state, enc)) + "</h1>";
	}
	if (state.ui.message) html += "<p>" + DE.esc(state.ui.message) + "</p>";
	html += "<p class=\"muted\">Your fighting value " + DE.formatPerceivedCv(fear.own, fear.uncertainOwn) +
		(raid ? " · Civilians " + DE.civilianFightValue(enc.playerUnits) : "") + "</p>";
	if (state.ui.chooser) html += DE.renderChooser(state, enc);
	else html += DE.renderActions(enc);
	html += DE.cancelButton(state);
	html += "</div>";
	html += DE.renderForce(
		state,
		enc.playerUnits,
		enc.playerStuff,
		DE.forceCvTitle("You", fear.own, fear.uncertainOwn, enc.playerUnits, raid),
		state.player,
		null,
		{ towardFactionId: enc.factionId, showPartyTrust: true }
	);
	html += "</div>";
	html += DE.renderPartyTrustSummary(state, enc);
	html += DE.renderLogPanel(state, enc.factionId);
	if (state.ui.debugMode) html += DE.renderAiDebug(state, enc);
	html += "</section>";
	return html;
};

DE.forceCvTitle = function (prefix, value, uncertain, units, showCivilians) {
	var title = prefix + " · CV " + DE.formatPerceivedCv(value, uncertain);
	if (showCivilians) title += " · Civilians " + DE.civilianFightValue(units);
	return title;
};

DE.renderAiDebug = function (state, enc) {
	var peek = DE.peekAiAction(state, enc);
	var d = peek.debug || {};
	var stance = enc.stance || {};
	var html = "<aside class=\"ai-debug\">";
	html += "<h3>AI debug</h3>";
	html += "<p><strong>They will: " + DE.esc(DE.ACTION_LABELS[peek.action] || peek.action) + "</strong></p>";
	if (d.F != null) {
		html += "<p>Fear sample <strong>" + DE.esc(DE.pct(d.F)) + "</strong> (" + DE.esc(d.fearBand || "") + ")" +
			" · band " + DE.esc(DE.pct(d.fearLo)) + "–" + DE.esc(DE.pct(d.fearHi)) +
			" · CV them " + Math.round(d.fearOwn) + " / you " + Math.round(d.fearEnemy) + "</p>";
	}
	if (d.T != null) {
		html += "<p>Trust sample <strong>" + DE.esc(DE.pct(d.T)) + "</strong> (" + DE.esc(d.trustBand || "") + ")" +
			" · band " + DE.esc(DE.pct(d.trustLo)) + "–" + DE.esc(DE.pct(d.trustHi)) +
			" · log center " + DE.esc(DE.pct(d.trustCenter)) +
			" · width " + DE.esc(DE.pct(d.trustWidth)) + "</p>";
		if (stance.partyTrust && stance.partyTrust.total) {
			html += "<p>Party trust " + DE.esc(DE.formatPartyTrustDelta(stance.partyTrust.total)) +
				" (hirelings " + DE.esc(DE.formatPartyTrustDelta(stance.partyTrust.hireling)) +
				" · captives " + DE.esc(DE.formatPartyTrustDelta(stance.partyTrust.captive)) + ")</p>";
		}
	} else {
		html += "<p>Trust — (beast / no faction log)</p>";
	}
	if (stance.locked) html += "<p class=\"muted\">F/T locked for this encounter.</p>";
	if (d.band) html += "<p>Decision cell: " + DE.esc(d.band) + "</p>";
	if (d.weights) html += "<p>Weights: " + DE.esc(DE.formatWeightTable(d.weights)) + "</p>";
	if (d.rolls && d.rolls.length) {
		html += "<p>Rolls:</p><ul>";
		for (var i = 0; i < d.rolls.length; i++) {
			html += "<li>" + DE.esc(d.rolls[i].label) + ": " + DE.esc(DE.pct(d.rolls[i].value)) + "</li>";
		}
		html += "</ul>";
	}
	if (d.overrides && d.overrides.length) {
		html += "<p>Overrides:</p><ul>";
		for (var o = 0; o < d.overrides.length; o++) {
			html += "<li>" + DE.esc(d.overrides[o]) + "</li>";
		}
		html += "</ul>";
	}
	if (d.reasons && d.reasons.length) {
		html += "<p>Why:</p><ul>";
		for (var r = 0; r < d.reasons.length; r++) {
			html += "<li>" + DE.esc(d.reasons[r]) + "</li>";
		}
		html += "</ul>";
	}
	html += "<p class=\"muted\">Action rolls are peeked with RNG restored; F/T samples stay locked.</p>";
	html += "</aside>";
	return html;
};

DE.renderChooser = function (state, enc) {
	var kind = state.ui.chooser;
	var html = "<div class=\"chooser\"><h2>" + DE.esc(kind) + "</h2>";
	if (kind === "seize") {
		html += "<button type=\"button\" data-cmd=\"seize-pick\" data-kind=\"food\">Half their food (" + Math.floor((enc.aiStuff.food || 0) / 2) + ")</button>";
		html += "<button type=\"button\" data-cmd=\"seize-pick\" data-kind=\"gold\">Half their gold (" + Math.floor((enc.aiStuff.gold || 0) / 2) + ")</button>";
		var groups = DE.groupUnits(DE.fightingUnits(enc.aiUnits));
		for (var i = 0; i < groups.length; i++) {
			if (!DE.unitDropsWeapon(groups[i].units[0])) continue;
			html += "<button type=\"button\" data-cmd=\"seize-pick\" data-kind=\"weapons\" data-type=\"" + groups[i].type + "\" data-unit=\"" + groups[i].ids[0] + "\">Weapons: " + DE.esc(DE.groupLabel(groups[i])) + "</button>";
		}
		for (var w = 0; w < (enc.aiStuff.weapons || []).length; w++) {
			html += "<button type=\"button\" data-cmd=\"seize-pick\" data-kind=\"weapons\" data-type=\"" + enc.aiStuff.weapons[w] + "\">";
			html += DE.renderWeaponKit(enc.aiStuff.weapons[w]) + " Stash: " +
				DE.esc((DE.unitDef(enc.aiStuff.weapons[w]) || {}).name || enc.aiStuff.weapons[w]) + "</button>";
		}
	} else if (kind === "capture") {
		var caps = DE.groupUnits(DE.fightingUnits(enc.aiUnits));
		for (var c = 0; c < caps.length; c++) {
			html += "<button type=\"button\" data-cmd=\"capture-pick\" data-id=\"" + caps[c].ids[0] + "\">" + DE.esc(DE.groupLabel(caps[c])) + "</button>";
		}
		if (!caps.length) html += "<p class=\"muted\">No one standing to take.</p>";
	} else if (kind === "gift") {
		var pe = state.ui.pendingExtra || {};
		var giftWepIx = pe.giftWeaponIx || [];
		var giftCapIds = pe.giftCaptiveIds || [];
		html += "<label>" + DE.renderResourceIcon("gold") + " Gold <input type=\"number\" min=\"0\" max=\"" + (enc.playerStuff.gold || 0) + "\" data-field=\"giftGold\" value=\"" + (pe.giftGold || 0) + "\"></label>";
		html += "<label>" + DE.renderResourceIcon("food") + " Food <input type=\"number\" min=\"0\" max=\"" + (enc.playerStuff.food || 0) + "\" data-field=\"giftFood\" value=\"" + (pe.giftFood || 0) + "\"></label>";
		if (DE.encounterAllowsItemTrade(enc, state)) {
			html += "<h3>Weapon kits</h3>";
			var kits = enc.playerStuff.weapons || [];
			if (!kits.length) html += "<p class=\"muted\">No kits in your pack.</p>";
			for (var gw = 0; gw < kits.length; gw++) {
				var kitOn = giftWepIx.indexOf(gw) >= 0 || giftWepIx.indexOf(String(gw)) >= 0;
				html += "<button type=\"button\" class=\"" + (kitOn ? "primary" : "") + "\" data-cmd=\"gift-toggle-weapon\" data-ix=\"" + gw + "\">";
				html += DE.renderWeaponKit(kits[gw]);
				html += " " + (kitOn ? "✓ " : "") + DE.esc((DE.unitDef(kits[gw]) || {}).name || kits[gw]) +
					" kit · " + DE.renderGoldPrice(DE.unitStuffPrice(kits[gw])) + "</button>";
			}
			html += "<h3>Prisoners</h3>";
			var giftCaps = enc.playerStuff.captives || [];
			if (!giftCaps.length) html += "<p class=\"muted\">No prisoners with you.</p>";
			for (var gc = 0; gc < giftCaps.length; gc++) {
				var cap = giftCaps[gc];
				var capOn = giftCapIds.indexOf(cap.id) >= 0;
				html += "<button type=\"button\" class=\"" + (capOn ? "primary" : "") + "\" data-cmd=\"gift-toggle-captive\" data-id=\"" + DE.esc(cap.id) + "\">" +
					(capOn ? "✓ " : "") + DE.esc(DE.unitLabel(cap)) + "</button>";
			}
		}
		html += "<button type=\"button\" class=\"primary\" data-cmd=\"gift-go\">Offer</button>";
	} else if (kind === "sell-weapon") {
		var armed = DE.groupUnits(DE.fightingUnits(enc.playerUnits)).filter(function (g) {
			return DE.unitDropsWeapon(g.units[0]);
		});
		for (var sw = 0; sw < armed.length; sw++) {
			html += "<button type=\"button\" data-cmd=\"sell-weapon-pick\" data-id=\"" + armed[sw].ids[0] + "\">Sell kit from 1 of " +
				DE.esc(DE.groupLabel(armed[sw])) + " · +" + DE.renderGoldPrice(DE.unitStuffPrice(armed[sw].type)) +
				" (becomes civilian)</button>";
		}
		if (!armed.length) html += "<p class=\"muted\">No kits to sell.</p>";
	}
	html += "<button type=\"button\" data-cmd=\"chooser-cancel\">Back</button></div>";
	return html;
};

DE.renderResolve = function (state) {
	var r = state.ui.lastResult || {};
	var m = state.mission;
	var enc = m && m.pendingEncounter;
	var html = "<section class=\"screen resolve\">";
	html += "<p class=\"brand\">Aftermath</p>";
	html += "<h1>" + DE.esc(state.ui.message || "The moment passes.") + "</h1>";
	if (enc && enc.awaitingTrade) html += DE.renderGossip(enc);
	html += DE.renderActionPair(r);
	if (r.battle) {
		html += "<p>Winner: " + (r.battle.winner === "player" ? "you" : "they") + (r.displayBattle ? " (display)" : "") + "</p>";
		html += DE.casualtyLine("Yours", r.battle.playerCasualties);
		html += DE.casualtyLine("Theirs", r.battle.aiCasualties);
	}
	if (r.hold && DE.isHoldGroundAftermath(r)) {
		html += "<p class=\"muted\">" + (r.hold.player ? "You hold the ground." : "They hold the ground.") + "</p>";
	}
	html += DE.renderAttitudeShift(state, r.attitude);
	if (m) {
		html += "<p class=\"muted\">Remaining " + m.remaining + " · " + DE.renderResourceAmount("food", m.stuff.food);
		if (DE.hungerLabel(state)) html += " · " + DE.esc(DE.hungerLabel(state));
		html += "</p>";
	}
	if (enc && enc.awaitingTrade) {
		html += "<button type=\"button\" class=\"primary\" data-cmd=\"enter-trade\">Trade</button>";
	}
	html += "<button type=\"button\" data-cmd=\"continue\">Continue</button>";
	html += "</section>";
	return html;
};

DE.renderAttitudeShift = function (state, shift) {
	if (!shift) return "";
	var debug = !!(state && state.ui && state.ui.debugMode);
	var html = "<div class=\"attitude-shift\">";
	html += "<p>" + DE.esc(DE.formatAttitudeShift(shift, debug)) + "</p>";
	if (debug && shift.reasons && shift.reasons.length) {
		html += "<ul class=\"attitude-shift-why\">";
		for (var i = 0; i < shift.reasons.length; i++) {
			html += "<li>" + DE.esc(shift.reasons[i]) + "</li>";
		}
		html += "</ul>";
	}
	html += "</div>";
	return html;
};

DE.renderActionPair = function (result) {
	if (!result || (!result.playerAction && !result.aiAction)) return "";
	var you = DE.ACTION_LABELS[result.playerAction] || result.playerAction || "—";
	var they = DE.ACTION_LABELS[result.aiAction] || result.aiAction || "—";
	var html = "<div class=\"action-pair\">";
	html += "<div><span class=\"muted\">You</span><strong>" + DE.esc(you) + "</strong></div>";
	html += "<div><span class=\"muted\">They</span><strong>" + DE.esc(they) + "</strong></div>";
	html += "</div>";
	return html;
};

DE.casualtyLine = function (label, list) {
	list = list || [];
	if (!list.length) return "<p class=\"muted\">" + label + ": no casualties</p>";
	return "<p>" + label + ": " + list.map(function (x) { return x.type + " " + x.fate; }).join(", ") + "</p>";
};

DE.renderGossip = function (enc) {
	if (!enc || !enc.gossip || !enc.gossip.text) return "";
	return "<p class=\"gossip\">" + DE.esc(enc.gossip.text) + "</p>";
};

DE.renderTradeParty = function (state, enc) {
	var fac = DE.factionById(state, enc.factionId);
	var living = DE.livingUnits(enc.aiUnits || []);
	var species = DE.tradePartySpecies(enc, fac);
	var speciesLabel = DE.SPECIES_LABELS[species] || species || "Unknown";
	var html = "<div class=\"trade-party\">";
	if (fac && fac.symbol) {
		html += "<span class=\"faction-mark mini\" title=\"" + DE.esc(fac.name || "") +
			"\" style=\"--c1:" + DE.esc(fac.colors[0]) + ";--c2:" + DE.esc(fac.colors[1]) + "\">";
		html += "<img class=\"glyph-img\" src=\"" + DE.esc(fac.symbol) + "\" alt=\"\"></span>";
	}
	if (species) {
		html += "<img class=\"species\" src=\"" + encodeURI(DE.speciesArt(DE.portraitSpecies(species))) +
			"\" alt=\"" + DE.esc(speciesLabel) + "\">";
	}
	html += "<div><strong>" + DE.esc(speciesLabel) + "</strong>";
	html += "<div class=\"muted\">" + living.length + "</div></div></div>";
	return html;
};

DE.renderTrade = function (state) {
	var enc = state.mission.pendingEncounter;
	var fac = DE.factionById(state, enc.factionId);
	var stall = DE.ensureTradeStall(state, enc);
	var html = "<section class=\"screen trade\">";
	html += "<p class=\"brand\">Trade</p><h1>" + DE.esc(DE.tradeHeadline(enc)) + "</h1>";
	html += DE.renderGossip(enc);
	html += DE.renderTradeParty(state, enc);
	var itemsOk = DE.encounterAllowsItemTrade(enc, state);
	html += "<p class=\"muted\">" + (itemsOk
		? "1g food · kits at stuff price (25 standard, 100 machine gunner / special / ranger, civilian 10) · hire once they agree"
		: "They trade gold, food, and magic only.") + "</p>";
	html += "<div class=\"trade-asks row\">";
	if (fac && fac.kind === "civilized" && !enc.village && DE.canSpeakWithEncounter(state, enc)) {
		html += "<button type=\"button\" data-cmd=\"ask-village\">Where is your Village?</button>";
		if (enc.villageTipOffered) {
		html += "<button type=\"button\" data-cmd=\"buy-village\">Buy village location · " + DE.renderGoldPrice(DE.VILLAGE_TIP_PRICE) + "</button>";
		}
	}
	if (fac && fac.kind === "civilized") {
		html += "<button type=\"button\" data-cmd=\"ask-hire\">Can I hire one of you?</button>";
	}
	html += "</div>";
	html += "<div class=\"split\">";
	html += "<div><h2>Their stall</h2>";
	html += "<p>" + DE.renderStuffResources(stall) + "</p>";
	if ((stall.food || 0) > 0) {
		html += "<button type=\"button\" data-cmd=\"buy\" data-kind=\"food\" data-amount=\"1\">" +
			DE.renderResourceIcon("food") + " Buy 1 · " + DE.renderGoldPrice(1) + "</button>";
		if (stall.food >= 5) {
			html += "<button type=\"button\" data-cmd=\"buy\" data-kind=\"food\" data-amount=\"5\">" +
				DE.renderResourceIcon("food") + " Buy 5 · " + DE.renderGoldPrice(5) + "</button>";
		}
	}
	if ((stall.magic || 0) > 0) {
		html += "<button type=\"button\" data-cmd=\"buy\" data-kind=\"magic\" data-amount=\"1\">" +
			DE.renderResourceIcon("magic") + " Buy 1 · " + DE.renderGoldPrice(1) + "</button>";
	}
	if (itemsOk) {
		var theirWeps = DE.filterWeaponKits(stall.weapons || []);
		for (var tw = 0; tw < theirWeps.length; tw++) {
			html += "<button type=\"button\" data-cmd=\"buy\" data-kind=\"weapons\" data-type=\"" + theirWeps[tw] + "\">";
			html += DE.renderWeaponKit(theirWeps[tw]) + " Buy " +
				DE.esc((DE.unitDef(theirWeps[tw]) || {}).name || theirWeps[tw]) + " kit · " +
				DE.renderGoldPrice(DE.unitStuffPrice(theirWeps[tw])) + "</button>";
		}
		var caps = stall.captives || [];
		for (var c = 0; c < caps.length; c++) {
			html += "<button type=\"button\" data-cmd=\"buy\" data-kind=\"captive\" data-id=\"" + DE.esc(caps[c].id) + "\" data-type=\"" + caps[c].type + "\">Ransom captive " + DE.esc(DE.unitLabel(caps[c])) + "</button>";
		}
		if (enc.hireUnlocked) {
			var theirs = DE.hirableGroups(enc);
			if (!theirs.length) {
				html += "<p class=\"muted\">" +
					(enc.hireRefused === "luck"
						? "Trust is high enough, but you got unlucky — nobody willing to hire on."
						: "Nobody willing to hire on right now.") +
					"</p>";
			}
			for (var u = 0; u < theirs.length; u++) {
				html += "<button type=\"button\" data-cmd=\"buy\" data-kind=\"unit\" data-id=\"" + theirs[u].ids[0] + "\" data-type=\"" + theirs[u].type + "\">Hire 1 of " + DE.esc(DE.groupLabel(theirs[u])) + " · " +
					DE.renderGoldPrice(DE.unitStuffPrice(theirs[u].type)) + "</button>";
			}
		} else if (fac && fac.kind === "civilized") {
			html += "<p class=\"muted\">" +
				(enc.hireRefused === "trust"
					? "Trust is too low for hiring."
					: "Ask before you try to hire.") +
				"</p>";
		}
	}
	html += "</div><div><h2>Your pack</h2>";
	html += "<p>" + DE.renderStuffResources(enc.playerStuff) + "</p>";
	if ((enc.playerStuff.food || 0) > 0) {
		html += "<button type=\"button\" data-cmd=\"sell\" data-kind=\"food\" data-amount=\"1\">" +
			DE.renderResourceIcon("food") + " Sell 1 · " + DE.renderGoldPrice(1) + "</button>";
	}
	if ((enc.playerStuff.magic || 0) > 0) {
		html += "<button type=\"button\" data-cmd=\"sell\" data-kind=\"magic\" data-amount=\"1\">" +
			DE.renderResourceIcon("magic") + " Sell 1 · " + DE.renderGoldPrice(1) + "</button>";
	}
	if (itemsOk) {
		var ourWeps = DE.filterWeaponKits(enc.playerStuff.weapons || []);
		for (var ow = 0; ow < ourWeps.length; ow++) {
			var sellPrice = DE.weaponKitSellPrice(ourWeps[ow], fac);
			html += "<button type=\"button\" data-cmd=\"sell\" data-kind=\"weapons\" data-type=\"" + ourWeps[ow] + "\">";
			html += DE.renderWeaponKit(ourWeps[ow]) + " Sell " +
				DE.esc((DE.unitDef(ourWeps[ow]) || {}).name || ourWeps[ow]) + " kit · " +
				DE.renderGoldPrice(sellPrice) + "</button>";
		}
		var pc = enc.playerStuff.captives || [];
		for (var k = 0; k < pc.length; k++) {
			html += "<button type=\"button\" data-cmd=\"sell\" data-kind=\"captive\" data-id=\"" + DE.esc(pc[k].id) + "\" data-type=\"" + pc[k].type + "\">Hand over captive " + DE.esc(DE.unitLabel(pc[k])) + "</button>";
		}
		var ours = DE.groupUnits(DE.fightingUnits(enc.playerUnits));
		for (var o = 0; o < ours.length; o++) {
			html += "<button type=\"button\" data-cmd=\"sell\" data-kind=\"unit\" data-id=\"" + ours[o].ids[0] + "\" data-type=\"" + ours[o].type + "\">Send away 1 of " + DE.esc(DE.groupLabel(ours[o])) + " · " +
				DE.renderGoldPrice(DE.unitStuffPrice(ours[o].type)) + "</button>";
		}
	}
	html += "</div></div>";
	if (itemsOk) {
		html += "<div class=\"row\"><button type=\"button\" data-cmd=\"sell-weapon\">Sell a kit off a soldier</button></div>";
		if (state.ui.chooser === "sell-weapon") html += DE.renderChooser(state, enc);
	}
	html += DE.renderAttitudeShift(state, state.ui.lastResult && state.ui.lastResult.attitude);
	if (state.ui.tradeNote) html += "<p>" + DE.esc(state.ui.tradeNote) + "</p>";
	html += "<button type=\"button\" class=\"primary\" data-cmd=\"done-trade\">Continue your Journey</button>";
	html += "</section>";
	return html;
};

DE.renderChronicle = function (state) {
	var h = DE.factionById(state, state.hostileFactionId);
	var held = DE.markHostagesStillHeld(state);
	var html = "<footer class=\"chronicle\">";
	html += "<div class=\"eliminate\">";
	if (h) {
		html += "<span class=\"faction-mark mini\" style=\"--c1:" + DE.esc(h.colors[0]) + ";--c2:" + DE.esc(h.colors[1]) + "\">";
		html += "<img class=\"glyph-img\" src=\"" + DE.esc(h.symbol) + "\" alt=\"\"></span>";
		html += "<div><strong>Rescue</strong> " + DE.esc(h.name) +
			"<div class=\"muted\">" + held + " hostage" + (held === 1 ? "" : "s") + " still held</div></div>";
	} else {
		html += "<div><strong>Rescue</strong> —</div>";
	}
	html += "</div>";
	html += "<h3>Complete history</h3><ul class=\"chronicle-list\">";
	var rows = state.chronicle || [];
	if (!rows.length) html += "<li class=\"muted\">Nothing written yet.</li>";
	for (var i = 0; i < rows.length; i++) {
		html += "<li>" + DE.esc(rows[i].text) + "</li>";
	}
	html += "</ul></footer>";
	return html;
};

DE.renderWin = function (state) {
	var h = DE.factionById(state, state.hostileFactionId);
	return "<section class=\"screen win\"><p class=\"brand\">Broken mark</p><h1>The five taken from the surface are free.</h1><p>The " +
		DE.esc(h ? h.name : "mark") + " cannot hold them. The caverns will remember the expedition.</p><button type=\"button\" class=\"primary\" data-cmd=\"new\">New campaign</button></section>";
};

DE.render = function (state) {
	var root = DE.qs("#app");
	if (!root) return;
	var screen = state.ui.screen;
	var html = "";
	if (screen === "base") html = DE.renderBase(state);
	else if (screen === "empty") html = DE.renderEmpty(state);
	else if (screen === "encounter") html = DE.renderEncounter(state);
	else if (screen === "resolve") html = DE.renderResolve(state);
	else if (screen === "trade") html = DE.renderTrade(state);
	else if (screen === "win") html = DE.renderWin(state);
	else html = DE.renderBase(state);
	root.innerHTML = DE.renderMenuChrome(state) + html + DE.renderChronicle(state);
};

DE.renderMenuChrome = function (state) {
	var html = "<div class=\"top-fabs\">";
	html += "<button type=\"button\" class=\"menu-fab\" data-cmd=\"info-open\" aria-label=\"Information\">Info</button>";
	html += "<button type=\"button\" class=\"menu-fab\" data-cmd=\"politics-open\" aria-label=\"Politics\">Politics</button>";
	html += "<button type=\"button\" class=\"menu-fab\" data-cmd=\"menu-open\" aria-label=\"Menu\">Menu</button>";
	html += "</div>";
	if (state.ui.menuOpen) html += DE.renderMenuModal(state);
	if (state.ui.politicsOpen) html += DE.renderPoliticsModal(state);
	if (state.ui.infoOpen) html += DE.renderInfoModal(state);
	return html;
};

DE.titleText = function (s) {
	return String(s == null ? "" : s).replace(/\w\S*/g, function (w) {
		return w.charAt(0).toUpperCase() + w.slice(1);
	});
};

DE.renderInfoSpeciesIcon = function (species) {
	return "<img class=\"info-icon\" src=\"" + encodeURI(DE.speciesArt(species)) + "\" alt=\"\">";
};

DE.renderInfoUnitIcon = function (type) {
	var def = DE.unitDef(type);
	var species = "human";
	if (def && def.monster) species = type;
	else if (type === "ghost") species = "ghost";
	else if (def && def.undead) species = "undead";
	var html = "<span class=\"info-unit-icon\">";
	html += DE.renderInfoSpeciesIcon(species);
	var w = DE.weaponArt(type);
	if (w) html += "<img class=\"info-weapon\" src=\"" + encodeURI(w) + "\" alt=\"\">";
	html += "</span>";
	return html;
};

DE.renderInfoModal = function (state) {
	DE.ensureInfoState(state);
	var html = "<div class=\"menu-backdrop\" data-cmd=\"info-close\"></div>";
	html += "<div class=\"menu-modal info-modal\" role=\"dialog\" aria-label=\"Information\">";
	html += "<header><h2>Information</h2><button type=\"button\" data-cmd=\"info-close\">Close</button></header>";
	html += "<p class=\"muted\">What your expedition has learned.</p>";

	html += "<h3>Language training</h3><ul class=\"info-list\">";
	for (var s = 0; s < DE.SPECIES.length; s++) {
		var sp = DE.SPECIES[s];
		var hasLang = DE.hasLanguage(state, sp);
		var spTitle = DE.titleText(DE.SPECIES_LABELS[sp] || sp);
		var langJob = null;
		var jobs = state.player.training || [];
		for (var tj = 0; tj < jobs.length; tj++) {
			if (jobs[tj].kind === "language" && jobs[tj].species === sp) {
				langJob = jobs[tj];
				break;
			}
		}
		html += "<li class=\"info-row " + (hasLang ? "info-known" : "info-unknown") + "\">";
		html += DE.renderInfoSpeciesIcon(sp);
		html += "<span class=\"info-title\">" + DE.esc(spTitle) + "</span>";
		html += "<span class=\"info-status\">" +
			(hasLang ? "trained" : (langJob ? ("training · " + langJob.remaining + " left") : "not trained")) +
			"</span>";
		html += "</li>";
	}
	html += "</ul>";

	html += "<h3>Unit descriptions</h3><ul class=\"info-list\">";
	var catalog = DE.infoUnitCatalog();
	var seenAny = false;
	for (var u = 0; u < catalog.length; u++) {
		var ut = catalog[u];
		if (!DE.hasSeenType(state, ut)) continue;
		seenAny = true;
		var faced = DE.hasFacedType(state, ut);
		var uName = DE.titleText((DE.unitDef(ut) || {}).name || ut);
		html += "<li class=\"info-row " + (faced ? "info-known" : "info-unknown") + "\">";
		html += DE.renderInfoUnitIcon(ut);
		html += "<div class=\"info-copy\"><span class=\"info-title\">" + DE.esc(uName) + "</span>";
		html += "<div class=\"muted\">" + DE.esc(faced ? DE.unitBlurb(ut) : "???") + "</div></div>";
		html += "</li>";
	}
	if (!seenAny) html += "<li class=\"muted\">No unit dossiers yet — see them in an encounter.</li>";
	html += "</ul>";

	html += "<h3>Weapons training</h3><ul class=\"info-list\">";
	var weapons = DE.infoWeaponTypes();
	var trainAny = false;
	for (var w = 0; w < weapons.length; w++) {
		var wt = weapons[w];
		if (!DE.hasSeenType(state, wt)) continue;
		trainAny = true;
		var trained = DE.canUseKit(state, wt) || DE.canRecruit(state, wt);
		var wName = DE.titleText((DE.unitDef(wt) || {}).name || wt);
		html += "<li class=\"info-row " + (trained ? "info-known" : "info-unknown") + "\">";
		html += DE.renderInfoUnitIcon(wt);
		html += "<span class=\"info-title\">" + DE.esc(wName) + "</span>";
		html += "<span class=\"info-status\">" + (trained ? "trained" : "not trained") + "</span>";
		html += "</li>";
	}
	if (!trainAny) html += "<li class=\"muted\">No weapon kits seen yet.</li>";
	html += "</ul>";

	if (state.ui.debugMode) {
		html += "<h3>Debug · faction knowledge of human units</h3>";
		html += "<p class=\"muted\">The marked faction knows every human kit. Others learn what they face in real battle.</p>";
		html += "<ul class=\"info-list\">";
		var factions = (state.factions || []).filter(function (f) { return f.kind !== "animal"; });
		for (var f = 0; f < factions.length; f++) {
			var fac = factions[f];
			var known = [];
			var unknown = [];
			for (var h = 0; h < DE.HUMAN_INTEL_TYPES.length; h++) {
				var ht = DE.HUMAN_INTEL_TYPES[h];
				var label = DE.titleText((DE.unitDef(ht) || {}).name || ht);
				if (DE.factionKnowsHumanType(fac, ht)) known.push(label);
				else unknown.push(label);
			}
			html += "<li class=\"info-row\">";
			html += DE.renderInfoSpeciesIcon(fac.species || "human");
			html += "<div class=\"info-copy\"><span class=\"info-title\">" + DE.esc(DE.titleText(fac.name)) + "</span>";
			if (fac.hostileTarget) html += " <span class=\"muted\">(mark)</span>";
			html += "<div class=\"muted\">Knows: " + DE.esc(known.length ? known.join(", ") : "nothing") + "</div>";
			if (unknown.length) html += "<div class=\"muted\">Blind to: " + DE.esc(unknown.join(", ")) + "</div>";
			html += "</div></li>";
		}
		html += "</ul>";
	}

	html += "</div>";
	return html;
};

DE.politicsActorTitle = function (actor) {
	if (!actor) return "Unknown faction";
	if (actor.id === "player") return DE.titleText(actor.name || "Expedition");
	if (actor.kind === "loner" || actor.monsterType) {
		var key = actor.monsterType || actor.species;
		return DE.titleText(DE.SPECIES_LABELS[key] || key || actor.name);
	}
	return DE.titleText(actor.name);
};

DE.renderPoliticsActorHead = function (actor, known) {
	if (!known) {
		return { html: "?", title: "Unknown faction" };
	}
	var title = DE.politicsActorTitle(actor);
	var species = actor.id === "player" ? "human" : (actor.species || actor.monsterType || "human");
	var html = "<span class=\"politics-actor\">";
	if (actor.symbol) {
		html += "<span class=\"faction-mark mini\" style=\"--c1:" + DE.esc((actor.colors || ["#888", "#ccc"])[0]) +
			";--c2:" + DE.esc((actor.colors || ["#888", "#ccc"])[1]) + "\">";
		html += "<img class=\"glyph-img\" src=\"" + DE.esc(actor.symbol) + "\" alt=\"\"></span>";
	}
	html += DE.renderInfoSpeciesIcon(species);
	html += "</span>";
	return { html: html, title: title };
};

DE.renderPoliticsModal = function (state) {
	DE.syncPoliticsContacts(state);
	var actors = DE.politicsViewActors(state);
	var debug = !!(state.ui && state.ui.debugMode);
	var knownPairs = 0;
	var unknownPairs = 0;
	var html = "<div class=\"menu-backdrop\" data-cmd=\"politics-close\"></div>";
	html += "<div class=\"menu-modal politics-modal\" role=\"dialog\" aria-label=\"Politics\">";
	html += "<header><h2>Politics" + (debug ? " <span class=\"muted\">(debug)</span>" : "") +
		"</h2><button type=\"button\" data-cmd=\"politics-close\">Close</button></header>";
	if (debug) {
		html += "<p class=\"muted\">Debug: full true attitude grid. H / W / F from ground truth.</p>";
	} else {
		html += "<p class=\"muted\">Encounter reveals a symbol. Captive or hireling reveals every attitude involving their faction. Lost contacts keep letters in (parentheses).</p>";
	}
	html += "<div class=\"politics-scroll\"><table class=\"politics-grid\"><thead><tr><th></th>";
	for (var h = 0; h < actors.length; h++) {
		var headKnown = debug || DE.politicsFactionKnown(state, actors[h].id);
		var head = DE.renderPoliticsActorHead(actors[h], headKnown);
		html += "<th class=\"" + (headKnown ? "" : "politics-actor-unknown") + "\" title=\"" +
			DE.esc(head.title) + "\">" + head.html + "</th>";
	}
	html += "</tr></thead><tbody>";
	for (var r = 0; r < actors.length; r++) {
		var rowKnown = debug || DE.politicsFactionKnown(state, actors[r].id);
		var row = DE.renderPoliticsActorHead(actors[r], rowKnown);
		html += "<tr><th scope=\"row\" class=\"" + (rowKnown ? "" : "politics-actor-unknown") +
			"\" title=\"" + DE.esc(row.title) + "\">" + row.html + "</th>";
		for (var c = 0; c < actors.length; c++) {
			if (r === c) {
				html += "<td class=\"politics-self\">—</td>";
				continue;
			}
			if (debug) {
				var dt = DE.politicsTrust(state, actors[r].id, actors[c].id);
				var dBand = DE.politicsBand(dt);
				knownPairs++;
				html += "<td class=\"politics-" + dBand + " politics-debug-cell\" title=\"" +
					DE.esc(dBand + (dt != null ? " · " + DE.pct(dt) : "")) + "\">";
				html += "<div class=\"politics-band\">" + dBand.charAt(0).toUpperCase() + "</div>";
				if (dt != null) html += "<div class=\"politics-trust\">" + DE.esc(DE.pct(dt)) + "</div>";
				html += "</td>";
				continue;
			}
			var entry = DE.viewPoliticsLearned(state, actors[r].id, actors[c].id);
			if (!entry) {
				unknownPairs++;
				html += "<td class=\"politics-unknown\" title=\"Unknown\">?</td>";
				continue;
			}
			knownPairs++;
			var band = DE.politicsBand(entry.trust);
			var letter = band.charAt(0).toUpperCase();
			var shown = entry.stale ? "(" + letter + ")" : letter;
			var tip = band + (entry.stale ? " (no longer held)" : "");
			html += "<td class=\"politics-" + band + (entry.stale ? " politics-stale" : "") +
				"\" title=\"" + DE.esc(tip) + "\">" + shown + "</td>";
		}
		html += "</tr>";
	}
	html += "</tbody></table></div>";
	html += "<p class=\"muted\">H = hostile · W = wary · F = friendly · ? = unknown · (H) = remembered. Rows feel about columns. Known " +
		knownPairs + " · unknown " + unknownPairs + ".</p>";
	html += "</div>";
	return html;
};

DE.renderMenuModal = function (state) {
	var html = "<div class=\"menu-backdrop\" data-cmd=\"menu-close\"></div>";
	html += "<div class=\"menu-modal\" role=\"dialog\" aria-label=\"Game menu\">";
	html += "<header><h2>Menu</h2><button type=\"button\" data-cmd=\"menu-close\">Close</button></header>";
	html += "<p class=\"muted\">Named saves stay in this browser.</p>";
	html += "<label>Save as <input type=\"text\" data-field=\"saveName\" maxlength=\"48\" placeholder=\"Camp name\" value=\"" +
		DE.esc(state.ui.saveName || "") + "\"></label>";
	html += "<div class=\"row\">";
	html += "<button type=\"button\" class=\"primary\" data-cmd=\"save-local\">Save</button>";
	html += "</div>";
	var saves = DE.listLocalSaves();
	html += "<h3>Saved games</h3>";
	if (!saves.length) html += "<p class=\"muted\">No named saves yet.</p>";
	else {
		html += "<ul class=\"save-list\">";
		for (var i = 0; i < saves.length; i++) {
			var s = saves[i];
			html += "<li><div><strong>" + DE.esc(s.name) + "</strong>";
			if (s.savedAt) html += "<div class=\"muted\">" + DE.esc(DE.formatSaveTime(s.savedAt)) + "</div>";
			html += "</div><div class=\"row\">";
			html += "<button type=\"button\" data-cmd=\"load-local\" data-name=\"" + DE.esc(s.name) + "\">Load</button>";
			html += "<button type=\"button\" data-cmd=\"delete-local\" data-name=\"" + DE.esc(s.name) + "\">Delete</button>";
			html += "</div></li>";
		}
		html += "</ul>";
	}
	html += "<div class=\"row\">";
	html += "<button type=\"button\" data-cmd=\"export-download\">Export file</button>";
	html += "<button type=\"button\" data-cmd=\"export-show\">Show export text</button>";
	html += "</div>";
	html += "<div class=\"row\">";
	html += "<button type=\"button\" data-cmd=\"list-villages\">List all villages</button>";
	html += "<button type=\"button\" data-cmd=\"toggle-debug\">Debug mode: " +
		(state.ui.debugMode ? "ON" : "OFF") + "</button>";
	html += "</div>";
	if (state.ui.villageAtlas) {
		html += "<h3>Village atlas</h3><p class=\"muted\">Villages are placed at worldgen (1d3 per faction). Depth uses √(d6²+d6²). On a march, depth rises to the midpoint then falls on the way back.</p>";
		html += "<ul class=\"village-list\">";
		var atlas = state.villages.slice().sort(function (a, b) { return a.distance - b.distance; });
		for (var ai = 0; ai < atlas.length; ai++) {
			html += DE.renderVillageListItem(state, atlas[ai], { showHidden: true });
		}
		html += "</ul>";
	}
	html += "<h3>Import</h3>";
	html += "<textarea data-field=\"importText\" rows=\"6\" placeholder=\"Paste exported JSON here\">" +
		DE.esc(state.ui.importText || "") + "</textarea>";
	html += "<button type=\"button\" data-cmd=\"import-state\">Import pasted save</button>";
	if (state.ui.menuNote) html += "<p class=\"flash\">" + DE.esc(state.ui.menuNote) + "</p>";
	html += "</div>";
	return html;
};

DE.collectSendCounts = function (state) {
	var inputs = document.querySelectorAll("[data-send-ids]");
	state.ui.sendCounts = state.ui.sendCounts || {};
	var ids = [];
	for (var i = 0; i < inputs.length; i++) {
		var el = inputs[i];
		var key = el.getAttribute("data-send-key");
		var all = (el.getAttribute("data-send-ids") || "").split(",").filter(Boolean);
		var n = Math.max(0, Math.min(all.length, Number(el.value) || 0));
		state.ui.sendCounts[key] = n;
		for (var j = 0; j < n; j++) ids.push(all[j]);
	}
	state.ui.selectedUnitIds = ids;
	return ids;
};

DE.adjustSendCounts = function (state, mode, delta, onlyKey) {
	DE.collectSendCounts(state);
	var groups = DE.groupUnits(DE.playerLiving(state));
	state.ui.sendCounts = state.ui.sendCounts || {};
	for (var i = 0; i < groups.length; i++) {
		var g = groups[i];
		var key = DE.groupSendKey(g);
		if (onlyKey && key !== onlyKey) continue;
		var cur = state.ui.sendCounts[key];
		if (cur == null) cur = 0;
		if (mode === "none") cur = 0;
		else if (mode === "all") cur = g.count;
		else cur = Number(cur) + (Number(delta) || 0);
		state.ui.sendCounts[key] = Math.max(0, Math.min(g.count, cur));
	}
	state.ui.selectedUnitIds = [];
	for (var j = 0; j < groups.length; j++) {
		var g2 = groups[j];
		var key2 = DE.groupSendKey(g2);
		var n = state.ui.sendCounts[key2] || 0;
		for (var k = 0; k < n && k < g2.ids.length; k++) state.ui.selectedUnitIds.push(g2.ids[k]);
	}
};

DE.collectWeaponSetBuys = function (state) {
	var inputs = document.querySelectorAll("[data-set-buy]");
	state.ui.weaponSetBuys = {};
	var list = [];
	for (var i = 0; i < inputs.length; i++) {
		var type = inputs[i].getAttribute("data-set-buy");
		var n = Math.max(0, Math.min(5, Number(inputs[i].value) || 0));
		state.ui.weaponSetBuys[type] = n;
		for (var j = 0; j < n; j++) list.push(type);
	}
	return list;
};

DE.collectWeaponTakeCounts = function (state) {
	var inputs = document.querySelectorAll("[data-kit-take]");
	state.ui.weaponTakeCounts = state.ui.weaponTakeCounts || {};
	for (var i = 0; i < inputs.length; i++) {
		var type = inputs[i].getAttribute("data-kit-take");
		state.ui.weaponTakeCounts[type] = Math.max(0, Math.floor(Number(inputs[i].value) || 0));
	}
	return state.ui.weaponTakeCounts;
};

DE.readFields = function (state) {
	var fields = document.querySelectorAll("[data-field]");
	for (var i = 0; i < fields.length; i++) {
		var name = fields[i].getAttribute("data-field");
		var val = fields[i].value;
		if (name === "foodBuy" || name === "missionDistance" || name === "giftGold" || name === "giftFood" || name === "goldTake") {
			state.ui[name] = Number(val);
			if (name === "giftGold" || name === "giftFood") {
				state.ui.pendingExtra[name] = Number(val);
			}
		} else {
			state.ui[name] = val;
		}
	}
	DE.collectSendCounts(state);
	DE.collectWeaponSetBuys(state);
	DE.collectWeaponTakeCounts(state);
};

DE.bindUi = function () {
	var root = DE.qs("#app");
	if (!root || root._bound) return;
	root._bound = true;
	root.addEventListener("change", function (ev) {
		var state = window.DE_STATE;
		var t = ev.target;
		if (t.getAttribute("data-field") || t.getAttribute("data-send-ids") || t.getAttribute("data-set-buy") || t.getAttribute("data-kit-take")) {
			DE.readFields(state);
			var field = t.getAttribute("data-field");
			if (field === "logQuery" || field === "logFilter" || field === "foodBuy" || field === "missionDistance" ||
				t.getAttribute("data-send-ids") || state.ui.screen === "base") {
				DE.render(state);
			}
		}
	});
	root.addEventListener("input", function (ev) {
		var field = ev.target.getAttribute("data-field");
		if (field === "logQuery") {
			window.DE_STATE.ui.logQuery = ev.target.value;
		}
		if (field === "importText") {
			window.DE_STATE.ui.importText = ev.target.value;
		}
	});
	root.addEventListener("keydown", function (ev) {
		if (ev.key === "Enter" && ev.target.getAttribute("data-field") === "logQuery") {
			window.DE_STATE.ui.logQuery = ev.target.value;
			DE.render(window.DE_STATE);
		}
	});
	root.addEventListener("click", function (ev) {
		var t = ev.target.closest("[data-cmd],[data-act]");
		if (!t) return;
		ev.preventDefault();
		var state = window.DE_STATE;
		if (t.getAttribute("data-cmd") !== "menu-close" && t.getAttribute("data-cmd") !== "menu-open" &&
			t.getAttribute("data-cmd") !== "politics-close" && t.getAttribute("data-cmd") !== "politics-open" &&
			t.getAttribute("data-cmd") !== "info-close" && t.getAttribute("data-cmd") !== "info-open") {
			DE.readFields(state);
		}
		var cmd = t.getAttribute("data-cmd");
		var act = t.getAttribute("data-act");
		if (act) DE.onAction(state, act);
		else DE.onCmd(state, cmd, t);
	});
};

DE.onCmd = function (state, cmd, el) {
	if (cmd === "menu-open") {
		state.ui.menuOpen = true;
		state.ui.politicsOpen = false;
		state.ui.infoOpen = false;
		state.ui.menuNote = "";
		DE.render(state);
		return;
	}
	if (cmd === "menu-close") {
		state.ui.menuOpen = false;
		state.ui.menuNote = "";
		DE.render(state);
		return;
	}
	if (cmd === "politics-open") {
		state.ui.politicsOpen = true;
		state.ui.menuOpen = false;
		state.ui.infoOpen = false;
		DE.render(state);
		return;
	}
	if (cmd === "politics-close") {
		state.ui.politicsOpen = false;
		DE.render(state);
		return;
	}
	if (cmd === "info-open") {
		state.ui.infoOpen = true;
		state.ui.menuOpen = false;
		state.ui.politicsOpen = false;
		DE.render(state);
		return;
	}
	if (cmd === "info-close") {
		state.ui.infoOpen = false;
		DE.render(state);
		return;
	}
	if (cmd === "save-local") {
		DE.readFields(state);
		var saved = DE.saveToLocal(state, state.ui.saveName);
		state.ui.menuNote = saved.ok ? ("Saved as \"" + saved.name + "\".") : saved.reason;
		DE.render(state);
		return;
	}
	if (cmd === "load-local") {
		var loaded = DE.loadFromLocal(el.getAttribute("data-name"));
		if (!loaded.ok) {
			state.ui.menuNote = loaded.reason;
			DE.render(state);
			return;
		}
		window.DE_STATE = loaded.state;
		window.DE_STATE.ui.menuOpen = false;
		window.DE_STATE.ui.saveName = loaded.name;
		window.DE_STATE.ui.flash = "Loaded \"" + loaded.name + "\".";
		DE.render(window.DE_STATE);
		return;
	}
	if (cmd === "delete-local") {
		var deleted = DE.deleteLocalSave(el.getAttribute("data-name"));
		state.ui.menuNote = deleted.ok ? ("Deleted \"" + deleted.name + "\".") : deleted.reason;
		DE.render(state);
		return;
	}
	if (cmd === "list-villages") {
		state.ui.villageAtlas = !state.ui.villageAtlas;
		DE.render(state);
		return;
	}
	if (cmd === "toggle-debug") {
		state.ui.debugMode = !state.ui.debugMode;
		state.ui.menuNote = "Debug mode " + (state.ui.debugMode ? "on" : "off") + ".";
		DE.render(state);
		return;
	}
	if (cmd === "export-download") {
		DE.readFields(state);
		var dl = DE.downloadExport(state, state.ui.saveName);
		state.ui.menuNote = dl.ok ? "Export downloaded." : dl.reason;
		DE.render(state);
		return;
	}
	if (cmd === "export-show") {
		state.ui.importText = DE.exportStateText(state);
		state.ui.menuNote = "Export text filled below — copy it if you like.";
		DE.render(state);
		return;
	}
	if (cmd === "import-state") {
		DE.readFields(state);
		try {
			window.DE_STATE = DE.deserializeState(state.ui.importText || "");
			window.DE_STATE.ui.menuOpen = false;
			window.DE_STATE.ui.flash = "Imported save.";
			DE.render(window.DE_STATE);
		} catch (err) {
			state.ui.menuNote = "Import failed: " + (err && err.message ? err.message : err);
			DE.render(state);
		}
		return;
	}
	if (cmd === "new") {
		window.DE_STATE = DE.newCampaign();
		DE.render(window.DE_STATE);
		return;
	}
	if (cmd === "expected-food") {
		DE.readFields(state);
		state.ui.foodBuy = DE.expectedFoodBuy(state);
		DE.render(state);
		return;
	}
	if (cmd === "send-none") {
		DE.adjustSendCounts(state, "none", 0, el.getAttribute("data-send-key"));
		DE.render(state);
		return;
	}
	if (cmd === "send-all") {
		DE.adjustSendCounts(state, "all", 0, el.getAttribute("data-send-key"));
		DE.render(state);
		return;
	}
	if (cmd === "send-delta") {
		DE.adjustSendCounts(state, "delta", Number(el.getAttribute("data-delta") || 0), el.getAttribute("data-send-key"));
		DE.render(state);
		return;
	}
	if (cmd === "recruit") {
		var r = DE.recruitUnit(state, el.getAttribute("data-type"));
		var hired = el.getAttribute("data-type");
		state.ui.flash = r.ok
			? ("Recruited " + ((DE.unitDef(hired) || {}).name || hired) + ".")
			: r.reason;
		DE.render(state);
		return;
	}
	if (cmd === "equip-open") {
		state.ui.equipFor = el.getAttribute("data-id");
		DE.render(state);
		return;
	}
	if (cmd === "equip-cancel") {
		state.ui.equipFor = null;
		DE.render(state);
		return;
	}
	if (cmd === "equip-kit") {
		var eq = DE.equipKitOnCivilian(state, el.getAttribute("data-id"), el.getAttribute("data-type"));
		state.ui.flash = eq.ok ? "Kit equipped." : eq.reason;
		if (eq.ok) state.ui.equipFor = null;
		DE.render(state);
		return;
	}
	if (cmd === "train") {
		var tr = DE.startTraining(state, el.getAttribute("data-id"));
		state.ui.flash = tr.ok ? "Left behind to train for 5 encounters. They will return." : tr.reason;
		DE.render(state);
		return;
	}
	if (cmd === "language-train") {
		var lang = DE.startLanguageTraining(state, el.getAttribute("data-id"));
		state.ui.flash = lang.ok ? "Language training started · 10 encounters. They will return." : lang.reason;
		DE.render(state);
		return;
	}
	if (cmd === "interrogate") {
		var iq = DE.interrogateCaptive(state, el.getAttribute("data-id"));
		state.ui.flash = iq.reason;
		DE.render(state);
		return;
	}
	if (cmd === "ask-hireling-village") {
		var asked = DE.askHirelingVillage(state, el.getAttribute("data-id"));
		state.ui.flash = asked.reason;
		DE.render(state);
		return;
	}
	if (cmd === "camp-gift-open") {
		state.ui.campGiftFor = el.getAttribute("data-id");
		state.ui.campGiftGold = 0;
		state.ui.campGiftFood = 0;
		DE.render(state);
		return;
	}
	if (cmd === "camp-gift-cancel") {
		state.ui.campGiftFor = null;
		DE.render(state);
		return;
	}
	if (cmd === "camp-gift-go") {
		DE.readFields(state);
		var gifted = DE.giftHireling(state, el.getAttribute("data-id"), {
			gold: state.ui.campGiftGold || 0,
			food: state.ui.campGiftFood || 0
		});
		state.ui.flash = gifted.reason;
		if (gifted.ok) state.ui.campGiftFor = null;
		DE.render(state);
		return;
	}
	if (cmd === "rehire") {
		var rh = DE.rehireUnit(state, el.getAttribute("data-id"));
		state.ui.flash = rh.reason;
		DE.render(state);
		return;
	}
	if (cmd === "release-hireling") {
		var rel = DE.releaseHireling(state, el.getAttribute("data-id"));
		state.ui.flash = rel.reason;
		DE.render(state);
		return;
	}
	if (cmd === "capture-hireling") {
		var capH = DE.captureHireling(state, el.getAttribute("data-id"));
		state.ui.flash = capH.reason;
		DE.render(state);
		return;
	}
	if (cmd === "reequip") {
		var re = DE.reequipUnit(state, el.getAttribute("data-id"));
		state.ui.flash = re.ok ? "Reequipped." : re.reason;
		DE.render(state);
		return;
	}
	if (cmd === "start") {
		DE.readFields(state);
		var start = DE.startMission(state, {
			unitIds: state.ui.selectedUnitIds,
			foodBuy: state.ui.foodBuy,
			goldTake: state.ui.goldTake,
			weaponSetBuys: DE.collectWeaponSetBuys(state),
			weaponTakeCounts: DE.collectWeaponTakeCounts(state),
			distance: state.ui.missionDistance
		});
		if (!start.ok) {
			state.ui.screen = "base";
			state.ui.flash = start.reason;
		}
		DE.render(state);
		return;
	}
	if (cmd === "village") {
		DE.readFields(state);
		var vStart = DE.startMission(state, {
			unitIds: state.ui.selectedUnitIds,
			foodBuy: state.ui.foodBuy,
			goldTake: state.ui.goldTake,
			weaponSetBuys: DE.collectWeaponSetBuys(state),
			weaponTakeCounts: DE.collectWeaponTakeCounts(state),
			villageId: el.getAttribute("data-id")
		});
		if (!vStart.ok) {
			state.ui.screen = "base";
			state.ui.flash = vStart.reason;
		}
		DE.render(state);
		return;
	}
	if (cmd === "enter-trade") {
		var encTrade = state.mission && state.mission.pendingEncounter;
		if (encTrade && encTrade.awaitingTrade) {
			state.ui.screen = "trade";
			state.ui.tradeNote = "";
		}
		DE.render(state);
		return;
	}
	if (cmd === "continue") {
		if (state.ui.screen === "empty" || state.ui.screen === "resolve") DE.continueAfterResolve(state);
		if (state.ui.screen === "empty") {
			/* nextBeat already advanced empty */
		}
		DE.render(state);
		return;
	}
	if (cmd === "cancel") {
		DE.cancelMission(state);
		state.ui.message = "You turn around. The way home is as long as you have already walked.";
		DE.render(state);
		return;
	}
	if (cmd === "chooser-cancel") {
		state.ui.chooser = null;
		DE.render(state);
		return;
	}
	if (cmd === "seize-pick") {
		var seize = { kind: el.getAttribute("data-kind") };
		if (seize.kind === "weapons") {
			seize.type = el.getAttribute("data-type");
			seize.unitId = el.getAttribute("data-unit");
			seize.equipped = !!seize.unitId;
		}
		state.ui.chooser = null;
		DE.commitAction(state, "seize", { seize: seize });
		return;
	}
	if (cmd === "capture-pick") {
		state.ui.chooser = null;
		DE.commitAction(state, "capture", { captureId: el.getAttribute("data-id") });
		return;
	}
	if (cmd === "gift-toggle-weapon") {
		state.ui.pendingExtra = state.ui.pendingExtra || {};
		var list = (state.ui.pendingExtra.giftWeaponIx || []).map(Number);
		var ix = Number(el.getAttribute("data-ix"));
		var at = list.indexOf(ix);
		if (at >= 0) list.splice(at, 1);
		else list.push(ix);
		state.ui.pendingExtra.giftWeaponIx = list;
		DE.render(state);
		return;
	}
	if (cmd === "gift-toggle-captive") {
		state.ui.pendingExtra = state.ui.pendingExtra || {};
		var caps = (state.ui.pendingExtra.giftCaptiveIds || []).slice();
		var cid = el.getAttribute("data-id");
		var cAt = caps.indexOf(cid);
		if (cAt >= 0) caps.splice(cAt, 1);
		else caps.push(cid);
		state.ui.pendingExtra.giftCaptiveIds = caps;
		DE.render(state);
		return;
	}
	if (cmd === "gift-go") {
		var peGift = state.ui.pendingExtra || {};
		var encGift = state.mission && state.mission.pendingEncounter;
		var weps = [];
		var kitBag = (encGift && encGift.playerStuff.weapons) || [];
		var ixList = (peGift.giftWeaponIx || []).map(Number).sort(function (a, b) { return a - b; });
		for (var wi = 0; wi < ixList.length; wi++) {
			if (kitBag[ixList[wi]] != null) weps.push(kitBag[ixList[wi]]);
		}
		var capsOut = [];
		var packCaps = (encGift && encGift.playerStuff.captives) || [];
		var idList = peGift.giftCaptiveIds || [];
		for (var ci = 0; ci < packCaps.length; ci++) {
			if (idList.indexOf(packCaps[ci].id) >= 0) capsOut.push({ id: packCaps[ci].id });
		}
		if (encGift && !DE.encounterAllowsItemTrade(encGift, state)) {
			weps = [];
			capsOut = [];
		}
		var gift = {
			gold: state.ui.giftGold || peGift.giftGold || 0,
			food: state.ui.giftFood || peGift.giftFood || 0,
			weapons: weps,
			captives: capsOut
		};
		state.ui.chooser = null;
		state.ui.pendingExtra = {};
		DE.commitAction(state, "gift", { gift: gift });
		return;
	}
	if (cmd === "sell-weapon") {
		if (state.ui.screen !== "trade") {
			state.ui.message = "Sell kits at the trade stall.";
			DE.render(state);
			return;
		}
		state.ui.chooser = "sell-weapon";
		DE.render(state);
		return;
	}
	if (cmd === "sell-weapon-pick") {
		if (state.ui.screen !== "trade") {
			state.ui.chooser = null;
			DE.render(state);
			return;
		}
		var sold = DE.sellMissionWeapon(state, el.getAttribute("data-id"));
		state.ui.chooser = null;
		state.ui.tradeNote = sold.ok ? ("Sold a kit for " + sold.price + "g. One soldier is now a civilian.") : sold.reason;
		DE.render(state);
		return;
	}
	if (cmd === "buy" || cmd === "sell") {
		var enc = state.mission.pendingEncounter;
		var kind = el.getAttribute("data-kind");
		if (cmd === "buy" && kind === "unit" && !enc.hireUnlocked) {
			state.ui.tradeNote = "Ask \"Can I hire one of you?\" first.";
			DE.render(state);
			return;
		}
		var type = el.getAttribute("data-type");
		var amount = Number(el.getAttribute("data-amount") || 1);
		var deal = {
			kind: kind,
			type: type,
			amount: amount,
			id: el.getAttribute("data-id"),
			allowItems: DE.encounterAllowsItemTrade(enc, state)
		};
		var res;
		if (kind === "unit") {
			if (cmd === "buy") {
				var hireU = null;
				for (var hi = 0; hi < enc.aiUnits.length; hi++) {
					if (enc.aiUnits[hi].id === deal.id) hireU = enc.aiUnits[hi];
				}
				if (!hireU || !hireU.hirable) {
					state.ui.tradeNote = "That one will not join you.";
					DE.render(state);
					return;
				}
				deal.fromUnits = enc.aiUnits;
				deal.toUnits = enc.playerUnits;
				deal.buyerFactionId = "player";
				deal.foreignWeapons = type !== "infantry" && type !== "machineGunner";
			} else {
				deal.fromUnits = enc.playerUnits;
				deal.toUnits = enc.aiUnits;
				deal.buyerFactionId = enc.factionId;
			}
		}
		var stall = DE.ensureTradeStall(state, enc);
		if (cmd === "buy") {
			deal.sellerGoldOwner = stall;
			res = DE.applyTradeDeal(state, enc.playerStuff, stall, enc.playerStuff, deal);
		} else {
			deal.sellerGoldOwner = enc.playerStuff;
			if (kind === "weapons") deal.sellToFaction = DE.factionById(state, enc.factionId);
			res = DE.applyTradeDeal(state, stall, enc.playerStuff, stall, deal);
		}
		state.ui.tradeNote = res.ok ? "Done (" + res.price + "g)" : res.reason;
		if (res.ok) enc.didTrade = true;
		DE.render(state);
		return;
	}
	if (cmd === "ask-village") {
		var tip = DE.askVillageLocation(state, state.mission.pendingEncounter);
		state.ui.tradeNote = tip.reason;
		DE.render(state);
		return;
	}
	if (cmd === "buy-village") {
		var bought = DE.buyVillageLocation(state, state.mission.pendingEncounter);
		state.ui.tradeNote = bought.reason;
		DE.render(state);
		return;
	}
	if (cmd === "ask-hire") {
		var hireAsk = DE.askToHire(state, state.mission.pendingEncounter);
		state.ui.tradeNote = hireAsk.reason;
		DE.render(state);
		return;
	}
	if (cmd === "done-trade") {
		DE.closeTrade(state, !!(state.mission.pendingEncounter && state.mission.pendingEncounter.didTrade));
		DE.render(state);
	}
};

DE.onAction = function (state, act) {
	if (act === "seize") {
		state.ui.chooser = "seize";
		DE.render(state);
		return;
	}
	if (act === "capture") {
		state.ui.chooser = "capture";
		DE.render(state);
		return;
	}
	if (act === "gift") {
		state.ui.chooser = "gift";
		state.ui.pendingExtra = {
			giftGold: 0,
			giftFood: 0,
			giftWeaponIx: [],
			giftCaptiveIds: []
		};
		state.ui.giftGold = 0;
		state.ui.giftFood = 0;
		DE.render(state);
		return;
	}
	DE.commitAction(state, act, {});
};

DE.commitAction = function (state, act, extra) {
	var r = DE.playRound(state, act, extra);
	if (!r.ok && r.reason) state.ui.message = r.reason;
	DE.render(state);
};

DE.boot = function () {
	var params = new URLSearchParams(window.location.search);
	var seed = params.get("seed") || String(Date.now());
	window.DE_STATE = DE.newCampaign(seed);
	DE.bindUi();
	DE.render(window.DE_STATE);
};
