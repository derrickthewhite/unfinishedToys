(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./move-candidates.js'),
            require('./move-simulate.js'),
            require('./move-score.js'),
            require('./move-apply.js')
        );
        return;
    }
    root.HordesMoveAi = factory(
        root.HordesMoveAiCandidates,
        root.HordesMoveAiSimulate,
        root.HordesMoveAiScore,
        root.HordesMoveAiApply
    );
}(typeof globalThis !== 'undefined' ? globalThis : this, function (candidates, simulate, score, applyAi) {
    return Object.assign({}, candidates, simulate, score, applyAi);
}));
