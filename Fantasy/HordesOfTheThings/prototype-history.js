(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
        return;
    }
    root.HordesHistory = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    function cloneUnits(units) {
        return units.map((unit) => ({ ...unit }));
    }

    function createEditSnapshot(units, selectedIds, nextUnitId) {
        return {
            units: cloneUnits(units),
            selectedIds: [...selectedIds],
            nextUnitId
        };
    }

    function restoreEditSnapshot(snapshot) {
        return {
            units: cloneUnits(snapshot.units),
            selectedIds: [...snapshot.selectedIds],
            nextUnitId: snapshot.nextUnitId
        };
    }

    return {
        createEditSnapshot,
        restoreEditSnapshot
    };
}));