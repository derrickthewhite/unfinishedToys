(function (root) {
    root.addEventListener('DOMContentLoaded', function () {
        root.hordesPrototype = new root.HordesPrototypeApp.HordesPrototype();
    });
}(typeof globalThis !== 'undefined' ? globalThis : this));