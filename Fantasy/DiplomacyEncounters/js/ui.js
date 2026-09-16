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
	return DE.speciesArt(unit.type === "ghost" ? "ghost" : unit.species);
};

DE.renderPortrait = function (species, type) {
	var artSpecies = type === "ghost" ? "ghost" : species;
	var html = "<span class=\"unit-portrait\">";
	html += "<img class=\"species\" src=\"" + encodeURI(DE.speciesArt(artSpecies)) + "\" alt=\"\">";
	var w = DE.weaponArt(type);
	if (w) html += "<img class=\"weapon\" src=\"" + encodeURI(w) + "\" alt=\"\">";
	html += "</span>";
	return html;
};

DE.renderForce = function (units, stuff, title, faction, leader) {
	var html = "<div class=\"force\">";
	if (faction) {
		html += "<div class=\"faction-mark\" style=\"--c1:" + DE.esc(faction.colors[0]) + ";--c2:" + DE.esc(faction.colors[1]) + "\">";
		html += "<div class=\"glyph-plate\"><img class=\"glyph-img\" src=\"" + DE.esc(faction.symbol) + "\" alt=\"\"></div>";
		html += "<div><div class=\"faction-name\">" + DE.esc(faction.name) + "</div>";
		html += "<div class=\"muted\">" + DE.esc(DE.SPECIES_LABELS[faction.species] || faction.species) + "</div></div></div>";
	}
	html += "<h3>" + DE.esc(title) + "</h3>";
	if (leader && leader.name) {
		html += "<p class=\"leader-line\">Led by " + DE.esc(leader.name) + "</p>";
	}
	html += "<div class=\"stuff\">Gold " + (stuff.gold || 0) + " · Food " + (stuff.food || 0);
	if ((stuff.weapons || []).length) html += " · Weapon sets " + stuff.weapons.join(", ");
	if ((stuff.captives || []).length) html += " · Captives " + stuff.captives.length;
	html += "</div>";
	html += "<ul class=\"unit-list\">";
	var groups = DE.groupUnits(units);
	for (var i = 0; i < groups.length; i++) {
		var g = groups[i];
		html += "<li class=\"" + (g.wounded ? "wounded" : "") + "\">";
		html += DE.renderPortrait(g.species, g.type);
		html += "<span>" + DE.esc(DE.groupLabel(g)) + "</span></li>";
	}
	html += "</ul></div>";
	return html;
};

DE.renderLogPanel = function (state, factionId) {
	if (!factionId || factionId.indexOf("wild-") === 0) {
		return "<aside class=\"log-panel\"><h3>History</h3><p class=\"muted\">No faction to remember.</p></aside>";
	}
	var q = state.ui.logQuery || "";
	var filter = state.ui.logFilter || "all";
	var rows = DE.searchLog(state, factionId, q, filter);
	var html = "<aside class=\"log-panel\"><h3>History with them</h3>";
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
	var leaders = h ? DE.livingLeaders(h) : [];
	var html = "<section class=\"screen base\">";
	html += "<header class=\"hero-brand\"><img class=\"cave-mark\" src=\"assets/be/base.svg\" alt=\"\"><div>";
	html += "<p class=\"brand\">Diplomacy Encounters</p>";
	html += "<h1>Cavern camp</h1>";
	html += "<p class=\"lede\">Defeat the " + DE.esc(h ? h.name : "hostile faction") + ". " + leaders.length + " leaders still live.</p>";
	html += "</div></header>";
	if (h) {
		html += "<div class=\"faction-mark target\" style=\"--c1:" + DE.esc(h.colors[0]) + ";--c2:" + DE.esc(h.colors[1]) + "\">";
		html += "<div class=\"glyph-plate\"><img class=\"glyph-img\" src=\"" + DE.esc(h.symbol) + "\" alt=\"\"></div>";
		html += "<div>Hostile mark · " + DE.esc(h.name) + "</div></div>";
	}
	if (state.ui.flash) {
		html += "<p class=\"flash\">" + DE.esc(state.ui.flash) + "</p>";
		state.ui.flash = "";
	}
	html += "<div class=\"stat-line\">Gold " + state.player.gold + " · Soldiers " + DE.playerLiving(state).length +
		" · Encounters " + (state.totalEncounters || 0) + "</div>";
	html += "<div class=\"split\">";
	html += "<div><h2>Roster</h2><p class=\"muted\">Choose how many to send.</p><ul class=\"unit-list pick\">";
	var groups = DE.groupUnits(DE.playerLiving(state));
	var counts = state.ui.sendCounts || {};
	for (var i = 0; i < groups.length; i++) {
		var g = groups[i];
		var key = g.species + "|" + g.type + (g.wounded ? "|w" : "");
		var send = counts[key];
		if (send == null) send = g.count;
		send = Math.max(0, Math.min(g.count, Number(send) || 0));
		html += "<li>";
		html += DE.renderPortrait(g.species, g.type);
		html += "<span class=\"pick-meta\">" + DE.esc(DE.groupLabel(g));
		html += " <label class=\"count-pick\">Send <input type=\"number\" min=\"0\" max=\"" + g.count +
			"\" data-send-key=\"" + DE.esc(key) + "\" data-send-ids=\"" + g.ids.join(",") +
			"\" value=\"" + send + "\"></label></span>";
		if (g.type === "civilian" && g.units[0] && g.units[0].previousType) {
			html += " <button type=\"button\" data-cmd=\"reequip\" data-id=\"" + g.ids[0] + "\">Reequip</button>";
		}
		if (!DE.canRecruit(state, g.type) && g.type !== "civilian") {
			html += " <button type=\"button\" data-cmd=\"train\" data-id=\"" + g.ids[0] + "\">Leave to train (5)</button>";
		}
		html += "</li>";
	}
	html += "</ul>";
	if ((state.player.training || []).length) {
		html += "<h3>Training</h3><ul class=\"muted\">";
		for (var tr = 0; tr < state.player.training.length; tr++) {
			var T = state.player.training[tr];
			html += "<li>" + DE.esc(T.name) + " · " + T.remaining + " encounter(s) left</li>";
		}
		html += "</ul>";
	}
	html += "<h2>Raise troops</h2><div class=\"row\">";
	var known = Object.keys(DE.knownUnitTypes(state));
	for (var k = 0; k < known.length; k++) {
		var typ = known[k];
		var def = DE.unitDef(typ);
		html += "<button type=\"button\" data-cmd=\"recruit\" data-type=\"" + typ + "\">" +
			DE.esc(def ? def.name : typ) + " · " + DE.unitStuffPrice(typ) + "g</button>";
	}
	html += "</div>";
	html += "<p class=\"muted\">Weapon sets in camp: " + ((state.player.weapons || []).join(", ") || "none") + "</p>";
	html += "</div>";
	html += "<div><h2>Next excursion</h2>";
	var foodCost = (state.ui.foodBuy || 0) * DE.FOOD_GOLD_COST;
	html += "<label>Buy food (0.5g each) <input type=\"number\" min=\"0\" data-field=\"foodBuy\" value=\"" + (state.ui.foodBuy || 0) + "\"></label>";
	html += "<p class=\"muted\">Food cost now: " + foodCost + "g</p>";
	html += "<label>Gold to take <input type=\"number\" min=\"0\" data-field=\"goldTake\" value=\"" + (state.ui.goldTake != null ? state.ui.goldTake : 200) + "\"></label>";
	html += "<label>Expected encounters <input type=\"number\" min=\"1\" max=\"16\" data-field=\"missionDistance\" value=\"" + (state.ui.missionDistance || 5) + "\"></label>";
	html += "<h3>Buy weapon sets for the march</h3><p class=\"muted\">Stashed kits you can reequip or field later.</p><div class=\"row\">";
	var setTypes = ["melee", "archer", "infantry", "machineGunner"].concat(DE.MAGE_TYPES);
	for (var st = 0; st < setTypes.length; st++) {
		var setType = setTypes[st];
		var nBuy = (state.ui.weaponSetBuys && state.ui.weaponSetBuys[setType]) || 0;
		html += "<label class=\"set-buy\">" + DE.esc((DE.unitDef(setType) || {}).name || setType) +
			" (" + DE.unitStuffPrice(setType) + "g) <input type=\"number\" min=\"0\" max=\"5\" data-set-buy=\"" + setType + "\" value=\"" + nBuy + "\"></label>";
	}
	html += "</div>";
	html += "<button type=\"button\" class=\"primary\" data-cmd=\"start\">Start scout</button>";
	var knownV = DE.discoveredVillages(state);
	if (knownV.length) {
		html += "<h3>Known villages</h3><ul>";
		for (var v = 0; v < knownV.length; v++) {
			var vil = knownV[v];
			var vf = DE.factionById(state, vil.factionId);
			html += "<li>" + DE.esc(vil.name) + " · depth " + vil.distance +
				(vf ? " · " + DE.esc(vf.name) : "") +
				" · march " + vil.revisitLength + " ";
			html += "<button type=\"button\" data-cmd=\"village\" data-id=\"" + vil.id + "\">March</button></li>";
		}
		html += "</ul>";
	}
	if ((state.player.captives || []).length) {
		html += "<p class=\"muted\">Captives in camp: " + state.player.captives.length + "</p>";
	}
	html += "<p class=\"muted\">Seed " + DE.esc(state.seedText) + "</p>";
	html += "</div></div></section>";
	return html;
};

DE.renderEmpty = function (state) {
	var m = state.mission;
	var html = "<section class=\"screen empty-beat\">";
	html += "<p class=\"brand\">Empty dark</p>";
	html += "<h1>" + DE.esc(state.ui.message) + "</h1>";
	html += "<p class=\"muted\">Food " + m.stuff.food + " · Remaining " + m.remaining + " · Held " + m.progressed + "/" + m.distance + "</p>";
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
	var fear = DE.fearFromStrength(enc.playerUnits, enc.aiUnits, null, state);
	var html = "<section class=\"screen encounter\">";
	html += "<div class=\"mission-bar muted\">Food " + state.mission.stuff.food + " · Gold " + state.mission.stuff.gold +
		" · Remaining " + state.mission.remaining + " · Round " + (enc.roundIndex + 1) +
		(enc.village ? " · Village " + DE.esc(enc.villageName) : "") + "</div>";
	html += "<div class=\"encounter-grid\">";
	html += DE.renderForce(enc.aiUnits, enc.aiStuff, "Them · CV " + Math.round(fear.enemy), fac, enc.leader);
	html += "<div class=\"encounter-mid\">";
	html += "<p class=\"brand\">" + (enc.village ? "Village" : "Encounter") + "</p>";
	html += "<h1>You see " + DE.esc(DE.summarizeUnits(enc.aiUnits)) + "</h1>";
	if (state.ui.message) html += "<p>" + DE.esc(state.ui.message) + "</p>";
	html += "<p class=\"muted\">Your fighting value " + Math.round(fear.own) + "</p>";
	if (state.ui.chooser) html += DE.renderChooser(state, enc);
	else html += DE.renderActions(enc);
	html += "<div class=\"row\"><button type=\"button\" data-cmd=\"sell-weapon\">Sell a kit off a soldier</button></div>";
	html += DE.cancelButton(state);
	html += "</div>";
	html += DE.renderForce(enc.playerUnits, enc.playerStuff, "You · CV " + Math.round(fear.own), state.player, null);
	html += "</div>";
	html += DE.renderLogPanel(state, enc.factionId);
	html += "</section>";
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
			html += "<button type=\"button\" data-cmd=\"seize-pick\" data-kind=\"weapons\" data-type=\"" + enc.aiStuff.weapons[w] + "\">Stash: " + DE.esc(enc.aiStuff.weapons[w]) + "</button>";
		}
	} else if (kind === "capture") {
		var caps = DE.groupUnits(DE.fightingUnits(enc.aiUnits));
		for (var c = 0; c < caps.length; c++) {
			html += "<button type=\"button\" data-cmd=\"capture-pick\" data-id=\"" + caps[c].ids[0] + "\">" + DE.esc(DE.groupLabel(caps[c])) + "</button>";
		}
		if (!caps.length) html += "<p class=\"muted\">No one standing to take.</p>";
	} else if (kind === "gift") {
		html += "<label>Gold <input type=\"number\" min=\"0\" max=\"" + (enc.playerStuff.gold || 0) + "\" data-field=\"giftGold\" value=\"" + (state.ui.pendingExtra.giftGold || 0) + "\"></label>";
		html += "<label>Food <input type=\"number\" min=\"0\" max=\"" + (enc.playerStuff.food || 0) + "\" data-field=\"giftFood\" value=\"" + (state.ui.pendingExtra.giftFood || 0) + "\"></label>";
		html += "<button type=\"button\" class=\"primary\" data-cmd=\"gift-go\">Offer</button>";
	} else if (kind === "sell-weapon") {
		var armed = DE.groupUnits(DE.fightingUnits(enc.playerUnits)).filter(function (g) {
			return DE.unitDropsWeapon(g.units[0]);
		});
		for (var sw = 0; sw < armed.length; sw++) {
			html += "<button type=\"button\" data-cmd=\"sell-weapon-pick\" data-id=\"" + armed[sw].ids[0] + "\">Sell kit from 1 of " +
				DE.esc(DE.groupLabel(armed[sw])) + " · +" + DE.unitStuffPrice(armed[sw].type) + "g (becomes civilian)</button>";
		}
		if (!armed.length) html += "<p class=\"muted\">No kits to sell.</p>";
	}
	html += "<button type=\"button\" data-cmd=\"chooser-cancel\">Back</button></div>";
	return html;
};

DE.renderResolve = function (state) {
	var r = state.ui.lastResult || {};
	var html = "<section class=\"screen resolve\">";
	html += "<p class=\"brand\">Aftermath</p>";
	html += "<h1>" + DE.esc(state.ui.message || "The moment passes.") + "</h1>";
	if (r.battle) {
		html += "<p>Winner: " + (r.battle.winner === "player" ? "you" : "them") + (r.displayBattle ? " (display)" : "") + "</p>";
		html += DE.casualtyLine("Yours", r.battle.playerCasualties);
		html += DE.casualtyLine("Theirs", r.battle.aiCasualties);
	}
	if (r.hold) {
		html += "<p class=\"muted\">" + (r.hold.player ? "You hold the ground." : "You do not hold.") + "</p>";
	}
	var m = state.mission;
	if (m) html += "<p class=\"muted\">Remaining " + m.remaining + " · Food " + m.stuff.food + "</p>";
	html += "<button type=\"button\" class=\"primary\" data-cmd=\"continue\">Continue</button>";
	html += "</section>";
	return html;
};

DE.casualtyLine = function (label, list) {
	list = list || [];
	if (!list.length) return "<p class=\"muted\">" + label + ": no casualties</p>";
	return "<p>" + label + ": " + list.map(function (x) { return x.type + " " + x.fate; }).join(", ") + "</p>";
};

DE.renderTrade = function (state) {
	var enc = state.mission.pendingEncounter;
	var fac = DE.factionById(state, enc.factionId);
	var html = "<section class=\"screen trade\">";
	html += "<p class=\"brand\">Trade</p><h1>Floor prices in the dark</h1>";
	html += "<p class=\"muted\">1g food · hire willing folk at stuff price once they agree (25 standard, 100 special, civilian 10)</p>";
	html += "<div class=\"trade-asks row\">";
	if (fac && fac.kind === "civilized") {
		html += "<button type=\"button\" data-cmd=\"ask-village\">Where is your Village?</button>";
		html += "<button type=\"button\" data-cmd=\"ask-hire\">Can I hire one of you?</button>";
	}
	html += "</div>";
	var advice = DE.unknownMonsterAdviceKeys(state);
	if (advice.length && fac && fac.kind !== "animal") {
		html += "<h3>Advice</h3><div class=\"row\">";
		for (var a = 0; a < advice.length; a++) {
			var mk = advice[a];
			html += "<button type=\"button\" data-cmd=\"advice\" data-monster=\"" + mk + "\">Advice about " +
				DE.esc(DE.SPECIES_LABELS[mk] || mk) + " · " + DE.MONSTER_ADVICE_PRICE + "g</button>";
		}
		html += "</div>";
	}
	html += "<div class=\"split\">";
	html += "<div><h2>Their stall</h2>";
	html += "<p>Gold " + enc.aiStuff.gold + " · Food " + enc.aiStuff.food + "</p>";
	if ((enc.aiStuff.food || 0) > 0) {
		html += "<button type=\"button\" data-cmd=\"buy\" data-kind=\"food\" data-amount=\"1\">Buy 1 food</button>";
		if (enc.aiStuff.food >= 5) html += "<button type=\"button\" data-cmd=\"buy\" data-kind=\"food\" data-amount=\"5\">Buy 5 food</button>";
	}
	var caps = enc.aiStuff.captives || [];
	for (var c = 0; c < caps.length; c++) {
		html += "<button type=\"button\" data-cmd=\"buy\" data-kind=\"captive\" data-id=\"" + DE.esc(caps[c].id) + "\" data-type=\"" + caps[c].type + "\">Ransom captive " + DE.esc(DE.unitLabel(caps[c])) + "</button>";
	}
	if (enc.hireUnlocked) {
		var theirs = DE.hirableGroups(enc);
		if (!theirs.length) html += "<p class=\"muted\">Nobody willing to hire on right now.</p>";
		for (var u = 0; u < theirs.length; u++) {
			html += "<button type=\"button\" data-cmd=\"buy\" data-kind=\"unit\" data-id=\"" + theirs[u].ids[0] + "\" data-type=\"" + theirs[u].type + "\">Hire 1 of " + DE.esc(DE.groupLabel(theirs[u])) + " · " + DE.unitStuffPrice(theirs[u].type) + "g</button>";
		}
	} else if (fac && fac.kind === "civilized") {
		html += "<p class=\"muted\">Ask before you try to hire.</p>";
	}
	html += "</div><div><h2>Your pack</h2>";
	html += "<p>Gold " + enc.playerStuff.gold + " · Food " + enc.playerStuff.food + "</p>";
	if ((enc.playerStuff.food || 0) > 0) {
		html += "<button type=\"button\" data-cmd=\"sell\" data-kind=\"food\" data-amount=\"1\">Sell 1 food</button>";
	}
	var pc = enc.playerStuff.captives || [];
	for (var k = 0; k < pc.length; k++) {
		html += "<button type=\"button\" data-cmd=\"sell\" data-kind=\"captive\" data-id=\"" + DE.esc(pc[k].id) + "\" data-type=\"" + pc[k].type + "\">Hand over captive " + DE.esc(DE.unitLabel(pc[k])) + "</button>";
	}
	var ours = DE.groupUnits(DE.fightingUnits(enc.playerUnits));
	for (var o = 0; o < ours.length; o++) {
		html += "<button type=\"button\" data-cmd=\"sell\" data-kind=\"unit\" data-id=\"" + ours[o].ids[0] + "\" data-type=\"" + ours[o].type + "\">Send away 1 of " + DE.esc(DE.groupLabel(ours[o])) + " · " + DE.unitStuffPrice(ours[o].type) + "g</button>";
	}
	html += "</div></div>";
	if (state.ui.tradeNote) html += "<p>" + DE.esc(state.ui.tradeNote) + "</p>";
	html += "<button type=\"button\" class=\"primary\" data-cmd=\"done-trade\">Leave the stall</button>";
	html += "</section>";
	return html;
};

DE.renderChronicle = function (state) {
	var h = DE.factionById(state, state.hostileFactionId);
	var living = h ? DE.livingLeaders(h).length : 0;
	var html = "<footer class=\"chronicle\">";
	html += "<div class=\"eliminate\">";
	if (h) {
		html += "<span class=\"faction-mark mini\" style=\"--c1:" + DE.esc(h.colors[0]) + ";--c2:" + DE.esc(h.colors[1]) + "\">";
		html += "<img class=\"glyph-img\" src=\"" + DE.esc(h.symbol) + "\" alt=\"\"></span>";
		html += "<div><strong>Eliminate</strong> " + DE.esc(h.name) +
			"<div class=\"muted\">" + living + " leader" + (living === 1 ? "" : "s") + " still live</div></div>";
	} else {
		html += "<div><strong>Eliminate</strong> —</div>";
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
	return "<section class=\"screen win\"><p class=\"brand\">Broken mark</p><h1>The " + DE.esc(h ? h.name : "foe") + " has no leaders left.</h1><p>The caverns will remember the expedition.</p><button type=\"button\" class=\"primary\" data-cmd=\"new\">New campaign</button></section>";
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
	root.innerHTML = html + DE.renderChronicle(state);
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
};

DE.bindUi = function () {
	var root = DE.qs("#app");
	if (!root || root._bound) return;
	root._bound = true;
	root.addEventListener("change", function (ev) {
		var state = window.DE_STATE;
		var t = ev.target;
		if (t.getAttribute("data-field") || t.getAttribute("data-send-ids") || t.getAttribute("data-set-buy")) {
			DE.readFields(state);
			if (t.getAttribute("data-field") === "logQuery" || t.getAttribute("data-field") === "logFilter") DE.render(state);
		}
	});
	root.addEventListener("input", function (ev) {
		if (ev.target.getAttribute("data-field") === "logQuery") {
			window.DE_STATE.ui.logQuery = ev.target.value;
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
		var state = window.DE_STATE;
		DE.readFields(state);
		var cmd = t.getAttribute("data-cmd");
		var act = t.getAttribute("data-act");
		if (act) DE.onAction(state, act);
		else DE.onCmd(state, cmd, t);
	});
};

DE.onCmd = function (state, cmd, el) {
	if (cmd === "new") {
		window.DE_STATE = DE.newCampaign();
		DE.render(window.DE_STATE);
		return;
	}
	if (cmd === "recruit") {
		var r = DE.recruitUnit(state, el.getAttribute("data-type"));
		if (!r.ok) state.ui.flash = r.reason;
		DE.render(state);
		return;
	}
	if (cmd === "train") {
		var tr = DE.startTraining(state, el.getAttribute("data-id"));
		state.ui.flash = tr.ok ? "Left behind to train for 5 encounters." : tr.reason;
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
			villageId: el.getAttribute("data-id")
		});
		if (!vStart.ok) {
			state.ui.screen = "base";
			state.ui.flash = vStart.reason;
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
	if (cmd === "gift-go") {
		var gift = {
			gold: state.ui.giftGold || 0,
			food: state.ui.giftFood || 0,
			weapons: [],
			captives: []
		};
		state.ui.chooser = null;
		DE.commitAction(state, "gift", { gift: gift });
		return;
	}
	if (cmd === "sell-weapon") {
		state.ui.chooser = "sell-weapon";
		DE.render(state);
		return;
	}
	if (cmd === "sell-weapon-pick") {
		var sold = DE.sellMissionWeapon(state, el.getAttribute("data-id"));
		state.ui.chooser = null;
		state.ui.message = sold.ok ? ("Sold a kit for " + sold.price + "g. One soldier is now a civilian.") : sold.reason;
		DE.render(state);
		return;
	}
	if (cmd === "buy" || cmd === "sell") {
		var enc = state.mission.pendingEncounter;
		var kind = el.getAttribute("data-kind");
		if (kind === "weapons" || kind === "pattern") {
			state.ui.tradeNote = "Weapon sets are not traded here. Hire folk and leave them training at camp.";
			DE.render(state);
			return;
		}
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
			id: el.getAttribute("data-id")
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
		if (cmd === "buy") {
			deal.sellerGoldOwner = enc.aiStuff;
			res = DE.applyTradeDeal(state, enc.playerStuff, enc.aiStuff, enc.playerStuff, deal);
		} else {
			deal.sellerGoldOwner = enc.playerStuff;
			res = DE.applyTradeDeal(state, enc.aiStuff, enc.playerStuff, enc.aiStuff, deal);
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
	if (cmd === "ask-hire") {
		var hireAsk = DE.askToHire(state, state.mission.pendingEncounter);
		state.ui.tradeNote = hireAsk.reason;
		DE.render(state);
		return;
	}
	if (cmd === "advice") {
		var adv = DE.buyMonsterAdvice(state, state.mission.pendingEncounter, el.getAttribute("data-monster"));
		state.ui.tradeNote = adv.reason;
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
