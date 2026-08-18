(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./prototype-data.js'),
            require('./prototype-geometry.js'),
            require('./prototype-rules.js'),
            require('./prototype-history.js'),
            require('./prototype-formation.js')
        );
        return;
    }
    root.HordesBoardCamera = factory(root.HordesData, root.HordesGeometry, root.HordesRules, root.HordesHistory, root.HordesFormation);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry, rules, history, formation) {
    class Methods {
        screenToWorld(screenX, screenY) {
            const rect = this.canvas.getBoundingClientRect();
            const localX = screenX - rect.left;
            const localY = screenY - rect.top;
            return {
                x: (localX - rect.width / 2) / this.state.camera.scale + this.state.camera.x,
                y: (localY - rect.height / 2) / this.state.camera.scale + this.state.camera.y
            };
        }


        worldToScreen(worldX, worldY) {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: (worldX - this.state.camera.x) * this.state.camera.scale + rect.width / 2,
                y: (worldY - this.state.camera.y) * this.state.camera.scale + rect.height / 2
            };
        }


        zoomAt(screenX, screenY, factor) {
            const rect = this.canvas.getBoundingClientRect();
            const before = this.screenToWorld(screenX + rect.left, screenY + rect.top);
            this.state.camera.scale = geometry.clamp(this.state.camera.scale * factor, this.state.camera.minScale, this.state.camera.maxScale);
            const after = this.screenToWorld(screenX + rect.left, screenY + rect.top);
            this.state.camera.x += before.x - after.x;
            this.state.camera.y += before.y - after.y;
            this.requestRender();
        }

    }

    function install(BoardInteractionPrototype) {
        const mixinDescriptors = Object.getOwnPropertyDescriptors(Methods.prototype);
        delete mixinDescriptors.constructor;
        Object.defineProperties(BoardInteractionPrototype.prototype, mixinDescriptors);
    }

    return { install };
}));
