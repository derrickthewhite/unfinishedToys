var Space4x = Space4x || {};

Space4x.combatModel = function (state) {
	const combat = Space4x.settingOf(state).combat;
	return combat && combat.model ? combat.model : null;
};

Space4x.troopListTs = function (state, empire, troops) {
	let n = 0;
	const list = troops || [];
	for (let i = 0; i < list.length; i++) {
		const def = Space4x.settingOf(state).builds[list[i].defId];
		n += Space4x.troopTs(state, empire, def, list[i].culture);
	}
	return n;
};

Space4x.troopListTagTs = function (state, empire, troops, tag) {
	let n = 0;
	const list = troops || [];
	for (let i = 0; i < list.length; i++) {
		const def = Space4x.settingOf(state).builds[list[i].defId];
		if (!Space4x.defMatchesTags(def, [tag])) continue;
		n += Space4x.troopTs(state, empire, def, list[i].culture);
	}
	return n;
};

Space4x.quickCombatDamage = function (state, atkEmpire, atkTroops, defEmpire, defTroops) {
	const total = Space4x.troopListTs(state, atkEmpire, atkTroops);
	if (!(total > 0)) return { damage: 0, d20: 0, extras: [] };
	const d20 = 1 + Space4x.rngInt(state, 20);
	let damage = Math.ceil(total * d20 / 100);
	const extras = [];
	const tags = ["Air", "Armor", "Infantry"];
	for (let i = 0; i < tags.length; i++) {
		const atkT = Space4x.troopListTagTs(state, atkEmpire, atkTroops, tags[i]);
		const defT = Space4x.troopListTagTs(state, defEmpire, defTroops, tags[i]);
		if (!(atkT > 0)) continue;
		if (defT > 0 && atkT < defT * 1.5) continue;
		const d10 = 1 + Space4x.rngInt(state, 10);
		damage += Math.ceil(total * d10 / 100);
		extras.push({ tag: tags[i], d10: d10 });
	}
	return { damage: damage, d20: d20, extras: extras };
};

Space4x.pruneTroopsByLoss = function (state, empire, troops, remain) {
	const list = (troops || []).slice();
	if (!list.length) return list;
	const start = Space4x.troopListTs(state, empire, list);
	let loss = start - (remain > 0 ? remain : 0);
	if (!(loss > 0)) return list;

	function tsOf(t) {
		const def = Space4x.settingOf(state).builds[t.defId];
		return Space4x.troopTs(state, empire, def, t.culture);
	}

	while (list.length && loss > 0) {
		const fit = [];
		for (let i = 0; i < list.length; i++) {
			if (tsOf(list[i]) <= loss) fit.push(i);
		}
		if (!fit.length) break;
		const pick = fit[Space4x.rngInt(state, fit.length)];
		loss -= tsOf(list[pick]);
		list.splice(pick, 1);
	}
	return list;
};

Space4x.quickCombat = function (state, atk, def) {
	const atkStart = Space4x.troopListTs(state, atk.empire, atk.troops);
	const defStart = Space4x.troopListTs(state, def.empire, def.troops);
	let atkPool = atkStart;
	let defPool = defStart;
	const rounds = [];
	let n = 0;
	while (atkPool > 0 && defPool > 0 && n < 200) {
		n += 1;
		const hitDef = Space4x.quickCombatDamage(state, atk.empire, atk.troops, def.empire, def.troops);
		const hitAtk = Space4x.quickCombatDamage(state, def.empire, def.troops, atk.empire, atk.troops);
		atkPool = Math.max(0, atkPool - hitAtk.damage);
		defPool = Math.max(0, defPool - hitDef.damage);
		rounds.push({
			n: n,
			atkDealt: hitDef.damage,
			defDealt: hitAtk.damage,
			atkPool: atkPool,
			defPool: defPool
		});
	}
	let winner = "defender";
	if (defPool <= 0 && atkPool > 0) winner = "attacker";
	else if (atkPool <= 0 && defPool > 0) winner = "defender";
	else if (atkPool <= 0 && defPool <= 0) winner = "defender";
	return {
		winner: winner,
		rounds: rounds,
		atkPool: atkPool,
		defPool: defPool,
		atkTroops: Space4x.pruneTroopsByLoss(state, atk.empire, atk.troops, atkPool),
		defTroops: Space4x.pruneTroopsByLoss(state, def.empire, def.troops, defPool)
	};
};
