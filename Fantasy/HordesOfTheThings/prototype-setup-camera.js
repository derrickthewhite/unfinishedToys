(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./prototype-data.js'), require('./prototype-geometry.js'));
        return;
    }
    root.HordesSetupCamera = factory(root.HordesData, root.HordesGeometry);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (data, geometry) {
    function createCamera() {
        return {
            x: data.BOARD_SIZE / 2,
            y: data.BOARD_SIZE / 2,
            scale: 1,
            minScale: 0.6,
            maxScale: 10
        };
    }

    function install(Prototype) {
        Object.assign(Prototype.prototype, {
            getSetupCamera(key) {
                if (!this.state.setupCameras) {
                    this.state.setupCameras = {};
                }
                if (!this.state.setupCameras[key]) {
                    this.state.setupCameras[key] = createCamera();
                }
                return this.state.setupCameras[key];
            },

            setupScreenToWorld(event, key, canvas) {
                const rect = canvas.getBoundingClientRect();
                const camera = this.getSetupCamera(key);
                return {
                    x: ((event.clientX - rect.left) - (rect.width / 2)) / camera.scale + camera.x,
                    y: ((event.clientY - rect.top) - (rect.height / 2)) / camera.scale + camera.y
                };
            },

            zoomSetupAt(event, key, canvas) {
                const camera = this.getSetupCamera(key);
                const factor = event.deltaY > 0 ? 0.9 : 1.1;
                const before = this.setupScreenToWorld(event, key, canvas);
                camera.scale = geometry.clamp(camera.scale * factor, camera.minScale, camera.maxScale);
                const after = this.setupScreenToWorld(event, key, canvas);
                camera.x += before.x - after.x;
                camera.y += before.y - after.y;
            },

            panSetupCamera(interaction, event, key) {
                const camera = this.getSetupCamera(key);
                camera.x = interaction.cameraStartX - ((event.clientX - interaction.startClientX) / camera.scale);
                camera.y = interaction.cameraStartY - ((event.clientY - interaction.startClientY) / camera.scale);
            },

            renderSetupCanvas(key, canvas, ctx, draw) {
                const width = Math.max(1, canvas.clientWidth);
                const height = Math.max(1, canvas.clientHeight);
                const pixelRatio = window.devicePixelRatio || 1;
                const pixelWidth = Math.round(width * pixelRatio);
                const pixelHeight = Math.round(height * pixelRatio);
                if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
                    canvas.width = pixelWidth;
                    canvas.height = pixelHeight;
                }
                const camera = this.getSetupCamera(key);
                const previousCamera = this.state.camera;
                ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
                ctx.clearRect(0, 0, width, height);
                ctx.save();
                ctx.translate(width / 2, height / 2);
                ctx.scale(camera.scale, camera.scale);
                ctx.translate(-camera.x, -camera.y);
                this.state.camera = camera;
                try {
                    draw();
                } finally {
                    this.state.camera = previousCamera;
                    ctx.restore();
                }
            }
        });
    }

    return { install };
}));