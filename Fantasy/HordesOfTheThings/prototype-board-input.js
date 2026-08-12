(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
        return;
    }
    root.HordesBoardInput = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    class BoardInputMethods {
        bindCanvas() {
            this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
            this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
            this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
            this.canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));
            this.canvas.addEventListener('pointerleave', (event) => this.onPointerUp(event));
            this.canvas.addEventListener('wheel', (event) => {
                event.preventDefault();
                const factor = event.deltaY > 0 ? 0.9 : 1.1;
                this.zoomAt(event.offsetX, event.offsetY, factor);
            }, { passive: false });
            this.ui.terrainCanvas.addEventListener('pointerdown', (event) => this.onTerrainPointerDown(event));
            this.ui.terrainCanvas.addEventListener('pointermove', (event) => this.onTerrainPointerMove(event));
            this.ui.terrainCanvas.addEventListener('pointerup', (event) => this.onTerrainPointerUp(event));
            this.ui.terrainCanvas.addEventListener('pointerleave', (event) => this.onTerrainPointerUp(event));
            this.ui.terrainCanvas.addEventListener('contextmenu', (event) => event.preventDefault());
            this.ui.terrainCanvas.addEventListener('wheel', (event) => {
                event.preventDefault();
                this.zoomSetupAt(event, 'terrain', this.ui.terrainCanvas);
                this.renderTerrainPlacement();
            }, { passive: false });
        }
    }

    function install(BoardInputPrototype) {
        const descriptors = Object.getOwnPropertyDescriptors(BoardInputMethods.prototype);
        delete descriptors.constructor;
        Object.defineProperties(BoardInputPrototype.prototype, descriptors);
    }

    return { install };
}));