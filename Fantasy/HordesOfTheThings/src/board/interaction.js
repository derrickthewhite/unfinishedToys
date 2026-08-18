(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./camera.js'),
            require('./pointer.js'),
            require('./handles.js'),
            require('./draft.js')
        );
        return;
    }
    root.HordesBoardInteraction = factory(
        root.HordesBoardCamera,
        root.HordesBoardPointer,
        root.HordesBoardHandles,
        root.HordesBoardDraft
    );
}(typeof globalThis !== 'undefined' ? globalThis : this, function (camera, pointer, handles, draft) {
    function install(BoardInteractionPrototype) {
        camera.install(BoardInteractionPrototype);
        pointer.install(BoardInteractionPrototype);
        handles.install(BoardInteractionPrototype);
        draft.install(BoardInteractionPrototype);
    }

    return { install };
}));
