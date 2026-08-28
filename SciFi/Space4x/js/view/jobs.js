var Space4x = Space4x || {};

Space4x.JOB_COLORS = {
	idle: "#9aa7c2",
	agriculture: "#3d9b5f",
	industry: "#d4a574",
	research: "#6ea8fe",
	greenhouse: "#6fbf7a",
	money: "#e6c35c"
};

Space4x._jobSel = { ids: [], fromJob: null };
Space4x._jobDrag = null;

Space4x.clearJobDrag = function () {
	const drag = Space4x._jobDrag;
	if (!drag) return;
	if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
	Space4x._jobDrag = null;
};

Space4x.jobSelHas = function (popId) {
	const ids = Space4x._jobSel && Space4x._jobSel.ids;
	if (!ids) return false;
	for (let i = 0; i < ids.length; i++) if (ids[i] === popId) return true;
	return false;
};

Space4x.clearJobSel = function () {
	Space4x._jobSel = { ids: [], fromJob: null };
};

Space4x.makePopToken = function (state, pop, job) {
	const token = document.createElement("span");
	token.className = "pop-token";
	token.setAttribute("data-pop-id", pop.id);
	token.style.borderColor = Space4x.JOB_COLORS[job] || "#888";
	token.title = "Drag this worker and everyone after them to another job";
	const img = document.createElement("img");
	img.className = "pop-token-art";
	img.draggable = false;
	Space4x.setCultureImg(img, state, pop.culture);
	token.appendChild(img);
	return token;
};

Space4x.makeProdGlyph = function (kind, color) {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 12 12");
	svg.setAttribute("width", "12");
	svg.setAttribute("height", "12");
	svg.classList.add("prod-glyph");
	if (kind === "spendFive" || kind === "spendOne") {
		svg.classList.add("is-spend");
		kind = kind === "spendFive" ? "five" : "one";
	}
	if (kind === "five") {
		const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		r.setAttribute("x", "1.2");
		r.setAttribute("y", "1.2");
		r.setAttribute("width", "9.6");
		r.setAttribute("height", "9.6");
		r.setAttribute("fill", color);
		svg.appendChild(r);
	} else if (kind === "missTen" || kind === "missOne") {
		svg.classList.add("prod-miss");
		const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
		const a = document.createElementNS("http://www.w3.org/2000/svg", "line");
		const b = document.createElementNS("http://www.w3.org/2000/svg", "line");
		a.setAttribute("x1", "2.2");
		a.setAttribute("y1", "2.2");
		a.setAttribute("x2", "9.8");
		a.setAttribute("y2", "9.8");
		b.setAttribute("x1", "9.8");
		b.setAttribute("y1", "2.2");
		b.setAttribute("x2", "2.2");
		b.setAttribute("y2", "9.8");
		const stroke = color || "#e25a4a";
		const heavy = kind === "missTen";
		a.setAttribute("stroke", stroke);
		b.setAttribute("stroke", stroke);
		a.setAttribute("stroke-width", heavy ? "3.6" : "1.2");
		b.setAttribute("stroke-width", heavy ? "3.6" : "1.2");
		a.setAttribute("stroke-linecap", heavy ? "square" : "round");
		b.setAttribute("stroke-linecap", heavy ? "square" : "round");
		if (!heavy) {
			a.setAttribute("stroke-dasharray", "1.5 1.4");
			b.setAttribute("stroke-dasharray", "1.5 1.4");
		}
		g.appendChild(a);
		g.appendChild(b);
		svg.appendChild(g);
	} else if (kind === "importFive") {
		const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		r.setAttribute("x", "1.2");
		r.setAttribute("y", "1.2");
		r.setAttribute("width", "9.6");
		r.setAttribute("height", "9.6");
		r.setAttribute("fill", "none");
		r.setAttribute("stroke", color);
		r.setAttribute("stroke-width", "1.4");
		r.setAttribute("stroke-dasharray", "2 1.5");
		svg.appendChild(r);
	} else if (kind === "importOne") {
		const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		c.setAttribute("cx", "6");
		c.setAttribute("cy", "6");
		c.setAttribute("r", "4.1");
		c.setAttribute("fill", "none");
		c.setAttribute("stroke", color);
		c.setAttribute("stroke-width", "1.4");
		c.setAttribute("stroke-dasharray", "1.6 1.4");
		svg.appendChild(c);
	} else {
		const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		c.setAttribute("cx", "6");
		c.setAttribute("cy", "6");
		c.setAttribute("r", "4.1");
		c.setAttribute("fill", "none");
		c.setAttribute("stroke", color);
		c.setAttribute("stroke-width", "1.4");
		svg.appendChild(c);
	}
	return svg;
};

Space4x.makeProdGap = function () {
	const span = document.createElement("span");
	span.className = "prod-gap";
	return span;
};

Space4x.makeProdTotal = function (n) {
	const span = document.createElement("span");
	span.className = "prod-total" + (n < 0 ? " is-neg" : "");
	span.textContent = Space4x.fmtMoney ? Space4x.fmtMoney(n) : String(n);
	return span;
};

Space4x.jobPrimaryOutput = function (y) {
	return (y.food || 0) + (y.industry || 0) + (y.research || 0);
};

Space4x.laneOutputAmount = function (state, settlement, job) {
	if (!settlement || job === "idle") return 0;
	return Space4x.outputExplain(state, settlement, job).amount;
};

Space4x.outputGlyphItems = function (amount, prefix) {
	const items = [];
	const tag = prefix || "";
	const n = Math.max(0, Math.floor(amount || 0));
	const squares = Math.floor(n / 5);
	const circles = n - squares * 5;
	for (let i = 0; i < squares; i++) items.push({ id: tag + "5-" + i, kind: "five" });
	for (let i = 0; i < circles; i++) items.push({ id: tag + "1-" + i, kind: "one" });
	return items;
};

Space4x.moneyGlyphItems = function (income, spend) {
	const items = Space4x.outputGlyphItems(Math.round(income || 0), "in-");
	const spent = Math.max(0, Math.round(spend || 0));
	if (!spent) return items;
	items.push({ id: "mgap", kind: "gap" });
	const extra = Space4x.outputGlyphItems(spent, "sp-");
	for (let i = 0; i < extra.length; i++) {
		extra[i].kind = extra[i].kind === "five" ? "spendFive" : "spendOne";
		items.push(extra[i]);
	}
	return items;
};

Space4x.missGlyphItems = function (amount, prefix) {
	const items = [];
	const tag = prefix || "m-";
	const n = Math.max(0, Math.floor(amount || 0));
	const tens = Math.floor(n / 10);
	const ones = n - tens * 10;
	for (let i = 0; i < tens; i++) items.push({ id: tag + "10-" + i, kind: "missTen" });
	for (let i = 0; i < ones; i++) items.push({ id: tag + "1-" + i, kind: "missOne" });
	return items;
};

Space4x.importGlyphItems = function (amount, prefix) {
	const items = [];
	const tag = prefix || "i-";
	const n = Math.max(0, Math.floor(amount || 0));
	for (let i = 0; i < n; i++) items.push({ id: tag + "1-" + i, kind: "importOne" });
	return items;
};

Space4x.agricultureGlyphItems = function (produced, need, imported) {
	const cover = Math.min(produced, need);
	const importCover = Math.min(Math.max(0, imported || 0), Math.max(0, need - cover));
	const deficit = Math.max(0, need - cover - importCover);
	const surplus = Math.max(0, produced - need);
	let items = Space4x.outputGlyphItems(cover, "c-");
	const incoming = Space4x.importGlyphItems(importCover, "i-");
	for (let i = 0; i < incoming.length; i++) items.push(incoming[i]);
	const miss = Space4x.missGlyphItems(deficit, "m-");
	for (let i = 0; i < miss.length; i++) items.push(miss[i]);
	if (surplus > 0) {
		items.push({ id: "gap", kind: "gap" });
		const extra = Space4x.outputGlyphItems(surplus, "s-");
		for (let i = 0; i < extra.length; i++) items.push(extra[i]);
	}
	return items;
};

Space4x.bindJobBoard = function (app) {
	const board = app.ui.jobBoard;
	const DRAG_PX = 6;

	function ownsBoard() {
		const st = Space4x.settlementById(app.state, app.state.ui.selectedSettlementId);
		const player = Space4x.playerEmpire(app.state);
		return !!(st && player && st.empireId === player.id);
	}

	function paintSelected() {
		const tokens = board.querySelectorAll(".pop-token");
		for (let i = 0; i < tokens.length; i++) {
			tokens[i].classList.toggle("is-selected", Space4x.jobSelHas(tokens[i].getAttribute("data-pop-id")));
		}
	}

	function clearLaneOver() {
		const lanes = board.querySelectorAll(".job-lane");
		for (let i = 0; i < lanes.length; i++) lanes[i].classList.remove("drag-over");
	}

	function laneUnder(ev) {
		const drag = Space4x._jobDrag;
		if (drag && drag.ghost) drag.ghost.style.visibility = "hidden";
		const el = document.elementFromPoint(ev.clientX, ev.clientY);
		if (drag && drag.ghost) drag.ghost.style.visibility = "";
		if (!el || !el.closest) return null;
		return el.closest("#job-board .job-lane");
	}

	function paintOver(ev) {
		const over = laneUnder(ev);
		const lanes = board.querySelectorAll(".job-lane");
		for (let i = 0; i < lanes.length; i++) lanes[i].classList.toggle("drag-over", lanes[i] === over);
		return over;
	}

	function selectFromToken(token) {
		const lane = token.closest(".job-lane");
		const tokens = lane.querySelectorAll(".pop-token");
		const ids = [];
		let after = false;
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i] === token) after = true;
			if (!after) continue;
			ids.push(tokens[i].getAttribute("data-pop-id"));
		}
		Space4x._jobSel = { ids: ids, fromJob: lane.getAttribute("data-id") };
		paintSelected();
	}

	function assignToJob(job) {
		const ids = Space4x._jobSel && Space4x._jobSel.ids;
		if (!ids || !ids.length || !job || job === "money") return false;
		Space4x.clearJobSel();
		Space4x.clearJobDrag();
		clearLaneOver();
		app.cmds.setPopJobs(ids, job);
		return true;
	}

	function onMove(ev) {
		const drag = Space4x._jobDrag;
		if (!drag) return;
		const dx = ev.clientX - drag.startX;
		const dy = ev.clientY - drag.startY;
		if (!drag.moved && (dx * dx + dy * dy) >= DRAG_PX * DRAG_PX) {
			drag.moved = true;
			const ghost = document.createElement("div");
			ghost.className = "pop-drag-ghost";
			ghost.textContent = drag.ids.length + " " + Space4x.peopleWord(drag.ids.length);
			document.body.appendChild(ghost);
			drag.ghost = ghost;
		}
		if (!drag.moved || !drag.ghost) return;
		drag.ghost.style.left = (ev.clientX + 10) + "px";
		drag.ghost.style.top = (ev.clientY + 10) + "px";
		paintOver(ev);
	}

	function onUp(ev) {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		const drag = Space4x._jobDrag;
		if (!drag) return;
		if (drag.moved) {
			const over = paintOver(ev);
			const job = over ? over.getAttribute("data-id") : null;
			Space4x.clearJobDrag();
			clearLaneOver();
			if (job) assignToJob(job);
			else paintSelected();
			return;
		}
		Space4x.clearJobDrag();
		clearLaneOver();
		paintSelected();
	}

	function onLaneUp(ev) {
		window.removeEventListener("pointerup", onLaneUp);
		window.removeEventListener("pointercancel", onLaneUp);
		const job = Space4x._pendingLaneJob;
		Space4x._pendingLaneJob = null;
		if (!job) return;
		const over = laneUnder(ev);
		if (!over || over.getAttribute("data-id") !== job) return;
		if (job === Space4x._jobSel.fromJob) {
			Space4x.clearJobSel();
			paintSelected();
			return;
		}
		assignToJob(job);
	}

	board.addEventListener("pointerdown", function (ev) {
		if (ev.button && ev.button !== 0) return;
		if (!ownsBoard()) return;
		const token = ev.target.closest(".pop-token");
		const lane = ev.target.closest(".job-lane");
		if (lane && lane.getAttribute("data-id") === "money") return;
		if (token && board.contains(token)) {
			ev.preventDefault();
			selectFromToken(token);
			Space4x._jobDrag = {
				ids: Space4x._jobSel.ids.slice(),
				fromJob: Space4x._jobSel.fromJob,
				startX: ev.clientX,
				startY: ev.clientY,
				moved: false,
				ghost: null
			};
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
			window.addEventListener("pointercancel", onUp);
			return;
		}
		if (lane && Space4x._jobSel.ids.length) {
			ev.preventDefault();
			Space4x._pendingLaneJob = lane.getAttribute("data-id");
			window.addEventListener("pointerup", onLaneUp);
			window.addEventListener("pointercancel", onLaneUp);
		}
	});
};

Space4x.syncJobBoard = function (ui, state, cmds) {
	if (Space4x._jobDrag && Space4x._jobDrag.moved) return;
	const st = Space4x.settlementById(state, state.ui.selectedSettlementId);
	const lanes = [];
	if (st) {
		lanes.push({ id: "money", money: true, label: "Money", cap: Infinity, count: 0 });
		const jobs = Space4x.visibleJobs(state, st);
		for (let i = 0; i < jobs.length; i++) lanes.push(jobs[i]);
	}
	Space4x.syncKeyedList(ui.jobBoard, lanes, function (lane) { return lane.id; },
		function () {
			const lane = document.createElement("div");
			lane.className = "job-lane";
			const title = document.createElement("div");
			title.className = "job-lane-title";
			const pops = document.createElement("div");
			pops.className = "job-lane-pops";
			const out = document.createElement("div");
			out.className = "job-lane-out";
			lane.appendChild(title);
			lane.appendChild(pops);
			lane.appendChild(out);
			return lane;
		},
		function (row, lane) {
			row.classList.toggle("job-lane-money", !!lane.money);
			const popsBox = row.querySelector(".job-lane-pops");
			let out = row.querySelector(".job-lane-out");
			if (!out) {
				out = document.createElement("div");
				out.className = "job-lane-out";
				row.appendChild(out);
			}
			if (lane.money) {
				const info = st ? Space4x.outputExplain(state, st, "money") : { amount: 0, tip: "No output" };
				row.querySelector(".job-lane-title").textContent = "Money";
				popsBox.hidden = true;
				popsBox.title = "";
				const color = Space4x.JOB_COLORS.money;
				const glyphs = Space4x.moneyGlyphItems(info.income, info.spend);
				glyphs.push({ id: "n", kind: "total", n: info.amount });
				out.title = info.tip;
				Space4x.syncKeyedList(out, glyphs, function (g) { return g.id; },
					function (item) {
						if (item.kind === "gap") return Space4x.makeProdGap();
						if (item.kind === "total") return Space4x.makeProdTotal(item.n);
						return Space4x.makeProdGlyph(item.kind, color);
					},
					function (el, item) {
						if (item.kind === "gap") return;
						if (item.kind === "total") {
							el.textContent = Space4x.fmtMoney ? Space4x.fmtMoney(item.n) : String(item.n);
							el.classList.toggle("is-neg", item.n < 0);
						}
						el.setAttribute("title", info.tip);
					}
				);
				return;
			}
			popsBox.hidden = false;
			let title = lane.label;
			if (lane.cap !== Infinity) title = lane.count + "/" + lane.cap + " " + lane.label;
			const popsHere = [];
			if (st) {
				for (let i = 0; i < st.pops.length; i++) {
					if (st.pops[i].job === lane.id) popsHere.push(st.pops[i]);
				}
			}
			if (st && Space4x.loyaltyRules(state) && popsHere.length) {
				const seen = {};
				const bits = [];
				for (let i = 0; i < popsHere.length; i++) {
					const cid = popsHere[i].culture || "";
					if (seen[cid]) continue;
					seen[cid] = true;
					const who = Space4x.cultureName(state, cid);
					bits.push((who || "Pops") + " " + Space4x.groupLoyalty(state, st, lane.id, cid) + "%");
				}
				if (bits.length) title += " · " + bits.join(" · ");
			}
			row.querySelector(".job-lane-title").textContent = title;
			if (st && Space4x.loyaltyRules(state) && popsHere.length) {
				row.querySelector(".job-lane-title").title = Space4x.loyaltyExplain(state, st, popsHere[0].culture, lane.id).join("\n");
			} else {
				row.querySelector(".job-lane-title").title = "";
			}
			const peopleTip = popsHere.length + " " + Space4x.peopleWord(popsHere.length);
			popsBox.title = peopleTip;
			Space4x.syncKeyedList(popsBox, popsHere, function (p) { return p.id; },
				function (pop) {
					return Space4x.makePopToken(state, pop, lane.id);
				},
				function (token, pop) {
					token.style.borderColor = Space4x.JOB_COLORS[lane.id] || "#888";
					const img = token.querySelector("img");
					if (img) Space4x.setCultureImg(img, state, pop.culture);
					token.classList.toggle("is-selected", Space4x.jobSelHas(pop.id));
					const who = Space4x.cultureName(state, pop.culture);
					const loy = st && Space4x.loyaltyRules(state) ? Space4x.groupLoyalty(state, st, lane.id, pop.culture) + "% loyal" : "";
					token.title = [who, loy, peopleTip].filter(Boolean).join(" · ");
				}
			);
			const info = st ? Space4x.outputExplain(state, st, lane.id) : { amount: 0, tip: "No output" };
			const amount = info.amount;
			const color = Space4x.JOB_COLORS[lane.id] || "#888";
			let glyphs = Space4x.outputGlyphItems(amount);
			if (lane.id === "agriculture" && st) {
				const sit = Space4x.foodSituation(state, st);
				glyphs = Space4x.agricultureGlyphItems(sit.produced, sit.need, sit.imported);
			}
			if (lane.id !== "idle") glyphs.push({ id: "n", kind: "total", n: amount });
			out.title = info.tip;
			Space4x.syncKeyedList(out, glyphs, function (g) { return g.id; },
				function (item) {
					if (item.kind === "gap") return Space4x.makeProdGap();
					if (item.kind === "total") return Space4x.makeProdTotal(item.n);
					if (item.kind === "missTen" || item.kind === "missOne") {
						return Space4x.makeProdGlyph(item.kind, "#e25a4a");
					}
					if (item.kind === "importFive" || item.kind === "importOne") {
						return Space4x.makeProdGlyph(item.kind, color);
					}
					return Space4x.makeProdGlyph(item.kind, color);
				},
				function (el, item) {
					if (item.kind === "gap") return;
					if (item.kind === "total") {
						el.textContent = Space4x.fmtMoney ? Space4x.fmtMoney(item.n) : String(item.n);
						el.classList.toggle("is-neg", item.n < 0);
						el.setAttribute("title", info.tip);
						return;
					}
					if (item.kind === "missTen" || item.kind === "missOne") {
						const lines = el.querySelectorAll("line");
						for (let i = 0; i < lines.length; i++) lines[i].setAttribute("stroke", "#e25a4a");
					} else if (item.kind === "importFive" || item.kind === "importOne") {
						const shape = el.querySelector("rect") || el.querySelector("circle");
						if (shape) shape.setAttribute("stroke", color);
					} else {
						const fill = el.querySelector("rect");
						const stroke = el.querySelector("circle");
						if (fill) fill.setAttribute("fill", color);
						if (stroke) stroke.setAttribute("stroke", color);
					}
					el.setAttribute("title", info.tip);
				}
			);
		}
	);
};
