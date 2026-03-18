const stage = new Konva.Stage({
    container: 'container',
    width: window.innerWidth,
    height: window.innerHeight,
});

const layer = new Konva.Layer();
stage.add(layer);

let isPanning = false;
let mode = 'select'; // Modes: 'select', 'pan'
let lastPointerPosition = null;

// Enable zooming
stage.on('wheel', (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    stage.scale({ x: newScale, y: newScale });

    const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
    };

    stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
    });
    stage.batchDraw();
});

// Panning mode
stage.on('mousedown', (e) => {
    if (mode === 'pan') {
        isPanning = true;
        lastPointerPosition = stage.getPointerPosition();
        stage.container().style.cursor = 'grabbing';
    }
});

stage.on('mousemove', (e) => {
    if (isPanning) {
        const pointerPosition = stage.getPointerPosition();
        if (lastPointerPosition) {
            const dx = pointerPosition.x - lastPointerPosition.x;
            const dy = pointerPosition.y - lastPointerPosition.y;
            stage.position({
                x: stage.x() + dx,
                y: stage.y() + dy
            });
        }
        lastPointerPosition = pointerPosition;
        stage.batchDraw();
    }
});

stage.on('mouseup', () => {
    isPanning = false;
    stage.container().style.cursor = mode === 'pan' ? 'grab' : 'default';
});

// Context menu for switching modes
stage.on('contextmenu', (e) => {
    e.evt.preventDefault();
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    
    menu.style.display = 'block';
    menu.style.left = `${e.evt.clientX}px`;
    menu.style.top = `${e.evt.clientY}px`;
});

document.getElementById('mode-toggle').addEventListener('click', () => {
    mode = mode === 'select' ? 'pan' : 'select';
    stage.container().style.cursor = mode === 'pan' ? 'grab' : 'default';
    document.getElementById('context-menu').style.display = 'none';
});

document.addEventListener('click', () => {
    document.getElementById('context-menu').style.display = 'none';
});
