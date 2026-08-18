(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-rules-core.js'),
            require('./prototype-rules-terrain.js'),
            require('./prototype-rules-recoil.js'),
            require('./prototype-rules-melee.js'),
            require('./prototype-rules-shooting.js'),
            require('./prototype-rules-form-up.js'),
            require('./prototype-rules-movement.js')
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
        root.HordesRulesMovement
    );
}(typeof globalThis !== 'undefined' ? globalThis : this, function (core, terrain, recoil, melee, shooting, formUp, movement) {
    return Object.assign({}, core, terrain, recoil, melee, shooting, formUp, movement);
}));
