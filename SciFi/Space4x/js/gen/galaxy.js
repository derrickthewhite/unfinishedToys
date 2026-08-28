var Space4x = Space4x || {};

Space4x.STAR_NAMES = [
	"Helios", "Vega", "Rigel", "Deneb", "Altair", "Spica", "Polaris", "Sirius",
	"Procyon", "Achernar", "Hadar", "Acrux", "Aldebaran", "Antares", "Betelgeuse",
	"Canopus", "Capella", "Castor", "Pollux", "Fomalhaut", "Mimosa", "Regulus",
	"Shaula", "Alnilam", "Bellatrix", "Alnair", "Alioth", "Dubhe", "Mirfak", "Wezen"
];

Space4x.generateGalaxy = function (state) {
	const w = state.galaxy.width;
	const h = state.galaxy.height;
	const n = Math.min(state.galaxy.starCount, w * h);
	const used = {};
	const stars = [];
	let attempts = 0;
	while (stars.length < n && attempts < n * 40) {
		attempts += 1;
		const x = Space4x.rngInt(state, w);
		const y = Space4x.rngInt(state, h);
		const key = x + "," + y;
		if (used[key]) continue;
		used[key] = true;
		const name = Space4x.STAR_NAMES[stars.length] || ("Star " + (stars.length + 1));
		stars.push({
			id: Space4x.nextId(state, "st"),
			name: name,
			x: x,
			y: y,
			bodies: Space4x.generateBodies(state)
		});
	}
	state.galaxy.stars = stars;
};

Space4x.generateBodies = function (state) {
	const set = Space4x.settingOf(state);
	const count = Space4x.roll3d4minus5(state);
	const bodies = [];
	for (let i = 0; i < count; i++) {
		bodies.push(Space4x.rollBody(state, set, i));
	}
	return bodies;
};

Space4x.rollBody = function (state, set, index) {
	const roll = set.bodyKinds[Space4x.rngInt(state, set.bodyKinds.length)];
	const body = {
		id: Space4x.nextId(state, "b"),
		name: "Body " + (index + 1),
		kind: "rocky",
		size: null,
		biome: null,
		settlePrerequisite: null
	};
	if (roll === "gasGiant") {
		body.kind = "gasGiant";
		body.name = "Gas giant";
		body.settlePrerequisite = "gasGiantTech";
		return body;
	}
	if (roll === "asteroidBelt") {
		body.kind = "asteroidBelt";
		body.name = "Asteroid belt";
		body.richness = Space4x.rollRichness(state, set.asteroidRichness || set.richness);
		body.settlePrerequisite = "wp2ag";
		return body;
	}
	body.size = roll;
	if (roll === "tiny") {
		body.biome = "barren";
		body.richness = Space4x.rollRichness(state, set.richness);
		body.name = "Tiny barren";
		return body;
	}
	body.biome = set.biomes[Space4x.rngInt(state, set.biomes.length)];
	body.richness = Space4x.rollRichness(state, set.richness);
	body.name = Space4x.titleCase(body.size) + " " + Space4x.titleCase(body.biome);
	return body;
};

Space4x.rollRichness = function (state, list) {
	list = list || [];
	if (!list.length) return "normal";
	let total = 0;
	for (let i = 0; i < list.length; i++) total += list[i].weight || 0;
	if (!(total > 0)) return "normal";
	let r = Space4x.rngInt(state, total);
	for (let i = 0; i < list.length; i++) {
		r -= list[i].weight || 0;
		if (r < 0) return list[i].id;
	}
	return list[list.length - 1].id;
};

Space4x.titleCase = function (s) {
	if (!s) return "";
	return s.charAt(0).toUpperCase() + s.slice(1);
};

Space4x.ensureMediumGarden = function (state, star) {
	for (let i = 0; i < star.bodies.length; i++) {
		const b = star.bodies[i];
		if (b.kind === "rocky" && b.size === "medium" && b.biome === "garden") {
			b.richness = "normal";
			return b;
		}
	}
	const body = {
		id: Space4x.nextId(state, "b"),
		name: "Medium Garden",
		kind: "rocky",
		size: "medium",
		biome: "garden",
		richness: "normal",
		settlePrerequisite: null
	};
	star.bodies.push(body);
	return body;
};
