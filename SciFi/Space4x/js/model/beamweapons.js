var Space4x = Space4x || {};

Space4x.beamHasDamageFalloff = function (item) {
	return !!(item && item.damageFalloff);
};

Space4x.beamRangeDamageMult = function (item, dist) {
	if (!Space4x.beamHasDamageFalloff(item)) return 1;
	const range = item.range || 0;
	if (!(range > 0)) return 1;
	if (dist <= range * 0.5 + 1e-9) return 1;
	return 0.5;
};

Space4x.beamRangeZones = function (state, battle, token, weapon) {
	const out = { full: [], half: [] };
	if (!token || !weapon || token.dead) return out;
	const item = Space4x.spaceLoadItem(state, weapon.itemId);
	if (!item || !(item.range > 0)) return out;
	const range = item.range;
	const half = range * 0.5;
	const gw = battle.grid.w;
	const gh = battle.grid.h;
	for (let y = 0; y < gh; y++) {
		for (let x = 0; x < gw; x++) {
			const dist = Space4x.euclid(token.x, token.y, x, y);
			if (dist > range + 1e-9) continue;
			const cell = { x: x, y: y };
			if (Space4x.beamHasDamageFalloff(item) && dist > half + 1e-9) out.half.push(cell);
			else out.full.push(cell);
		}
	}
	return out;
};

Space4x.beamMarksPhase = function (item) {
	return !!(item && item.phaseExploit != null);
};

Space4x.beamPhaseBonus = function (battle, target, item) {
	if (!battle || !target || !item || item.phaseExploit == null) return 1;
	const marked = battle.lastTurnPhaseTargets || {};
	return marked[target.id] ? 1 + item.phaseExploit : 1;
};

Space4x.markPhaseHit = function (battle, target, item) {
	if (!battle || !target || !Space4x.beamMarksPhase(item)) return;
	if (!battle.turnPhaseTargets) battle.turnPhaseTargets = {};
	battle.turnPhaseTargets[target.id] = true;
};

Space4x.commitPhaseTurnMarks = function (battle) {
	if (!battle) return;
	battle.lastTurnPhaseTargets = battle.turnPhaseTargets || {};
	battle.turnPhaseTargets = {};
};

Space4x.applyBeamKnock = function (state, target, item) {
	if (!target || !item || !item.knockFacing) return;
	const cfg = Space4x.spaceCombatCfg(state);
	const stepDeg = (cfg && cfg.turnStepDeg) || 15;
	const steps = Math.max(1, Math.round(item.knockFacing / stepDeg));
	const deltaSteps = Space4x.rngInt(state, steps * 2 + 1) - steps;
	const delta = deltaSteps * stepDeg * Math.PI / 180;
	let heading = (target.heading || 0) + delta;
	while (heading > Math.PI) heading -= Math.PI * 2;
	while (heading < -Math.PI) heading += Math.PI * 2;
	target.heading = heading;
};

Space4x.applyBeamMoveDebuff = function (target, item) {
	if (!target || !item || item.moveDebuff == null) return;
	const pct = Math.max(0, Math.min(1, item.moveDebuff));
	target.speedLeft = Math.max(0, (target.speedLeft || 0) * (1 - pct));
};

Space4x.applyBeamDamage = function (state, battle, target, fromX, fromY, amount, item) {
	const out = { absorbed: 0, leftover: 0, shield: 0, armor: 0, structure: 0, facing: null };
	if (target.dead || !(amount > 0)) return out;
	let dmg = amount;
	const face = target.kind === "ship" ? Space4x.combatFacingFrom(target, fromX, fromY) : null;
	out.facing = face;

	if (target.kind === "ship" && !(item && item.ignoreShields) && face) {
		const sh = target.shields[face] || 0;
		const shieldHit = item && item.shieldDamageMult != null ? dmg * item.shieldDamageMult : dmg;
		const take = Math.min(sh, shieldHit);
		target.shields[face] = sh - take;
		out.shield = take;
		if (item && item.shieldDamageMult != null && item.shieldDamageMult > 0) {
			dmg -= take / item.shieldDamageMult;
		} else {
			dmg -= take;
		}
	}

	if (dmg > 0 && item && item.splitArmorStructure && target.armor > 0 && target.structure > 0) {
		const half = dmg * 0.5;
		const armorMult = item.armorDamageMult != null ? item.armorDamageMult : 1;
		const armorHit = half * armorMult;
		const armorTake = Math.min(target.armor, armorHit);
		target.armor -= armorTake;
		out.armor = armorTake;
		const structTake = Math.min(target.structure, half);
		target.structure -= structTake;
		out.structure = structTake;
		dmg = 0;
	} else if (dmg > 0 && item && item.ignoreArmor) {
		const take = Math.min(target.structure, dmg);
		target.structure -= take;
		out.structure = take;
		dmg -= take;
	} else if (dmg > 0 && target.armor > 0) {
		const armorMult = item && item.armorDamageMult != null ? item.armorDamageMult : 1;
		const armorHit = dmg * armorMult;
		const take = Math.min(target.armor, armorHit);
		target.armor -= take;
		out.armor = take;
		dmg -= take / armorMult;
	}

	if (dmg > 0) {
		const take = Math.min(target.structure, dmg);
		target.structure -= take;
		out.structure = take;
		dmg -= take;
	}

	out.absorbed = out.shield + out.armor + out.structure;
	out.leftover = Math.max(0, amount - out.absorbed);
	if (out.absorbed > 0 && target.kind === "ship") {
		battle.roundsSinceDamage = 0;
	}
	if (target.structure <= 0) {
		target.dead = true;
		target.structure = 0;
		battle.log.push((target.name || target.kind) + " destroyed.");
	}
	return out;
};
