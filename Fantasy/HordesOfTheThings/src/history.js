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

    function cloneLosses(losses) {
        if (!losses) {
            return null;
        }
        const cloned = {};
        Object.keys(losses).forEach((playerId) => {
            cloned[playerId] = (losses[playerId] || []).map((entry) => ({ ...entry }));
        });
        return cloned;
    }

    function createEditSnapshot(units, selectedIds, nextUnitId, losses, reserveUnits) {
        return {
            units: cloneUnits(units),
            selectedIds: [...selectedIds],
            nextUnitId,
            losses: cloneLosses(losses),
            reserveUnits: cloneUnits(reserveUnits || [])
        };
    }

    function restoreEditSnapshot(snapshot) {
        return {
            units: cloneUnits(snapshot.units),
            selectedIds: [...snapshot.selectedIds],
            nextUnitId: snapshot.nextUnitId,
            losses: cloneLosses(snapshot.losses),
            reserveUnits: cloneUnits(snapshot.reserveUnits || [])
        };
    }

    return {
        createEditSnapshot,
        restoreEditSnapshot
    };
}));