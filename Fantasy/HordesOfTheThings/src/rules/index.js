(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./core.js'),
            require('./terrain.js'),
            require('./recoil.js'),
            require('./melee.js'),
            require('./shooting.js'),
            require('./form-up.js'),
            require('./movement.js'),
            require('./rank-dress.js')
        );
        return;
    }
    root.HordesRules = factory(
        root.HordesRulesCore,
        root.HordesRulesTerrain,
        root.HordesRulesRecoil,
        root.HordesRulesMelee,
        root.HordesRulesShooting,
        root.HordesRulesFormUp,
        root.HordesRulesMovement,
        root.HordesRulesRankDress
    );
}(typeof globalThis !== 'undefined' ? globalThis : this, function (core, terrain, recoil, melee, shooting, formUp, movement, rankDress) {
    return Object.assign({}, core, terrain, recoil, melee, shooting, formUp, movement, rankDress);
}));
