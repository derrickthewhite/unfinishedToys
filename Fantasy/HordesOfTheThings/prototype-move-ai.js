(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-move-ai-candidates.js'),
            require('./prototype-move-ai-simulate.js'),
            require('./prototype-move-ai-score.js'),
            require('./prototype-move-ai-apply.js')
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
