var Space4x = Space4x || {};

Space4x.spiesWorkingAgainst = function (state, attackerEmpireId, victimEmpireId) {
	const out = [];
	const atk = Space4x.empireById(state, attackerEmpireId);
	const spies = Space4x.empireSpies(atk);
	for (let i = 0; i < spies.length; i++) {
		const spy = spies[i];
		const post = Space4x.parseSpyPost(spy.post);
		if (post.kind === "empire" && post.empireId === victimEmpireId) {
			out.push(spy);
			continue;
		}
		if (post.kind === "settlement") {
			const st = Space4x.settlementById(state, post.settlementId);
			if (st && st.empireId === victimEmpireId) out.push(spy);
		}
	}
	return out;
};

Space4x.empireCompletedTechs = function (state, empire) {
	const ids = (empire && empire.research && empire.research.completedTechIds) || [];
	const out = [];
	for (let i = 0; i < ids.length; i++) {
		const tech = Space4x.techById(state, ids[i]);
		if (tech) out.push(tech);
	}
	out.sort(function (a, b) {
		const ca = (a.category || "").localeCompare(b.category || "");
		if (ca) return ca;
		return (a.name || "").localeCompare(b.name || "");
	});
	return out;
};

Space4x.fillAttitudeBar = function (fillEl, attitude) {
	if (!fillEl) return;
	const pct = Math.max(0, Math.min(100, ((attitude || 0) + 100) / 2));
	fillEl.style.width = pct + "%";
	fillEl.classList.toggle("is-hostile", attitude < -5);
	fillEl.classList.toggle("is-friendly", attitude > 15);
};

Space4x.syncEmpireReportStage = function (ui, state) {
	if (!ui.stageEmpireReport) return;
	const player = Space4x.playerEmpire(state);
	const selected = Space4x.empireById(state, state.ui.diploRivalId);
	if (!player || !selected) {
		Space4x.setText(ui.empireReportTitle, "Empire report");
		Space4x.setText(ui.empireReportMeta, "Select an empire in Diplomacy first.");
		return;
	}
	Space4x.setText(ui.empireReportTitle, selected.name);
	const who = Space4x.cultureName(state, selected.cultureId);
	const war = Space4x.atWar(player, selected);
	Space4x.setText(ui.empireReportMeta,
		(who ? who + " · " : "") + (war ? "At war" : "At peace") +
		(selected.isRevoltPolity ? " · Revolt" : ""));

	if (ui.empireReportArt) {
		Space4x.setCultureImg(ui.empireReportArt, state, selected.cultureId);
		ui.empireReportArt.hidden = false;
	}

	const playerRel = Space4x.relationOf(selected, player.id);
	const attitude = playerRel ? (playerRel.attitude || 0) : 0;
	if (ui.empireReportAttitude) {
		ui.empireReportAttitude.hidden = false;
		Space4x.setText(ui.empireReportAttitudeNum, String(attitude));
		Space4x.setText(ui.empireReportAttitudeMood, Space4x.attitudeMood(attitude));
		Space4x.fillAttitudeBar(ui.empireReportAttitudeFill, attitude);
	}

	if (ui.empireReportThreat) {
		const threat = Space4x.threatAssessment(state, player, selected);
		const bits = [
			"Threat: you " + Space4x.formatThreatNumber(threat.viewerEffective) +
				" vs them " + Space4x.formatThreatNumber(threat.targetEffective) +
				" · ratio " + (Math.round(threat.ratio * 100) / 100),
			"Fleet load " + Space4x.formatThreatNumber(threat.viewerLoad) + "/" +
				Space4x.formatThreatNumber(threat.targetLoad) +
				" · industry/turn " + Space4x.formatThreatNumber(threat.viewerIndustry) + "/" +
				Space4x.formatThreatNumber(threat.targetIndustry) +
				" · upgrades ×" + (Math.round(threat.viewerUpgrade * 100) / 100) + "/×" +
				(Math.round(threat.targetUpgrade * 100) / 100)
		];
		if (threat.sharedWars) bits.push("Shared wars: " + threat.sharedWars);
		Space4x.setText(ui.empireReportThreat, bits.join("\n"));
	}

	const techs = Space4x.empireCompletedTechs(state, selected);
	if (ui.empireReportTechsEmpty) ui.empireReportTechsEmpty.hidden = techs.length > 0;
	if (ui.empireReportTechs) {
		Space4x.syncKeyedList(ui.empireReportTechs, techs, function (t) { return t.id; },
			function () {
				const li = document.createElement("li");
				li.className = "empire-report-tech";
				const cat = document.createElement("span");
				cat.className = "muted";
				const name = document.createElement("span");
				li.appendChild(cat);
				li.appendChild(name);
				return li;
			},
			function (row, tech) {
				row.querySelector(".muted").textContent = tech.category || "";
				row.querySelector("span:last-child").textContent = tech.name || tech.id;
			}
		);
	}

	const spies = Space4x.spiesWorkingAgainst(state, selected.id, player.id);
	if (ui.empireReportSpiesEmpty) ui.empireReportSpiesEmpty.hidden = spies.length > 0;
	if (ui.empireReportSpies) {
		Space4x.syncKeyedList(ui.empireReportSpies, spies, function (s) { return s.id; },
			function () {
				const token = document.createElement("span");
				token.className = "pop-token empire-report-spy";
				const img = document.createElement("img");
				img.className = "pop-token-art";
				img.alt = "";
				token.appendChild(img);
				return token;
			},
			function (row, spy) {
				const img = row.querySelector("img");
				if (img) Space4x.setCultureImg(img, state, spy.culture);
				const post = Space4x.parseSpyPost(spy.post);
				row.title = post.task ? ("Task: " + post.task) : (post.kind || "spy");
			}
		);
	}

	const foreign = Space4x.empireForeignRelations(state, selected).filter(function (row) {
		return row.id !== player.id;
	});
	if (ui.empireReportForeignEmpty) ui.empireReportForeignEmpty.hidden = foreign.length > 0;
	if (ui.empireReportForeign) {
		Space4x.syncKeyedList(ui.empireReportForeign, foreign, function (r) { return r.id; },
			function () {
				const li = document.createElement("li");
				li.className = "empire-report-foreign";
				const head = document.createElement("div");
				head.className = "empire-report-foreign-head";
				const badge = document.createElement("span");
				badge.className = "empire-report-foreign-badge";
				const name = document.createElement("span");
				name.className = "empire-report-foreign-name";
				const rel = document.createElement("span");
				rel.className = "empire-report-foreign-rel muted";
				head.appendChild(badge);
				head.appendChild(name);
				head.appendChild(rel);
				const bar = document.createElement("div");
				bar.className = "diplo-attitude-bar empire-report-foreign-bar";
				const fill = document.createElement("div");
				fill.className = "diplo-attitude-fill";
				const mid = document.createElement("div");
				mid.className = "diplo-attitude-mid";
				bar.appendChild(fill);
				bar.appendChild(mid);
				const threat = document.createElement("p");
				threat.className = "empire-report-foreign-threat muted";
				li.appendChild(head);
				li.appendChild(bar);
				li.appendChild(threat);
				return li;
			},
			function (row, item) {
				const other = Space4x.empireById(state, item.id);
				const badge = row.querySelector(".empire-report-foreign-badge");
				while (badge.firstChild) badge.removeChild(badge.firstChild);
				badge.appendChild(Space4x.makeEmpireCultureBadge(state, item.id));
				row.querySelector(".empire-report-foreign-name").textContent = item.name;
				const noTreaties = !item.war && (!item.text || item.text === "No treaties");
				row.querySelector(".empire-report-foreign-rel").textContent = item.war
					? "War"
					: (noTreaties ? "No treaties" : item.text);
				row.classList.toggle("is-war", !!item.war);
				const theirRel = Space4x.relationOf(selected, item.id);
				const att = theirRel ? (theirRel.attitude || 0) : 0;
				Space4x.fillAttitudeBar(row.querySelector(".diplo-attitude-fill"), att);
				let threatText = "Attitude " + att;
				if (other) {
					const t = Space4x.threatAssessment(state, selected, other);
					threatText += " · threat ratio " + (Math.round(t.ratio * 100) / 100) +
						" (them " + Space4x.formatThreatNumber(t.viewerEffective) +
						" vs " + Space4x.formatThreatNumber(t.targetEffective) + ")";
				}
				row.querySelector(".empire-report-foreign-threat").textContent = threatText;
			}
		);
	}
};
