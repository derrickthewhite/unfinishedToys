(function (global) {
  'use strict';

  const BASE_SIZE = 1600;
  const CHUNK_SIZE = 200;
  const MASK_OUTSIDE = 'rgba(0, 0, 0, 0.94)';
  const DEFAULT_SEED = 'derrick';
  const TREE_GREEN = { r: 60, g: 120, b: 70 };
  const NOTE_OFFSET_X = 18;
  const NOTE_OFFSET_Y = -18;
  const BASE_MILLIMETERS = 400;
  const GRID_MILLIMETERS = 60;
  const PIXELS_PER_MILLIMETER = BASE_SIZE / BASE_MILLIMETERS;
  const GRID_SPACING_PX = GRID_MILLIMETERS * PIXELS_PER_MILLIMETER;

  function rgbaWithAlpha(color, alpha) {
    if (!color.startsWith('rgba(')) {
      return color;
    }
    const channels = color.slice(5, -1).split(',').map((part) => part.trim());
    return 'rgba(' + channels[0] + ', ' + channels[1] + ', ' + channels[2] + ', ' + alpha + ')';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createSeededRandom(seed) {
    if (global.Math && typeof global.Math.seedrandom === 'function') {
      return new global.Math.seedrandom(seed);
    }
    const seedFn = xmur3(seed);
    return mulberry32(seedFn());
  }

  function hash2d(seed, x, y) {
    let value = (Math.imul((x | 0) ^ seed, 374761393) + Math.imul((y | 0) ^ (seed >>> 1), 668265263)) | 0;
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    value ^= value >>> 16;
    return (value >>> 0) / 4294967295;
  }

  function xmur3(seed) {
    let hash = 1779033703 ^ seed.length;
    for (let index = 0; index < seed.length; index += 1) {
      hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return function next() {
      hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
      hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
      hash ^= hash >>> 16;
      return hash >>> 0;
    };
  }

  function mulberry32(seed) {
    let state = seed >>> 0;
    return function next() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class Grad {
    constructor(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    dot2(x, y) {
      return this.x * x + this.y * y;
    }
  }

  class SimplexNoise {
    constructor(seed) {
      const gradients = [
        new Grad(1, 1, 0), new Grad(-1, 1, 0), new Grad(1, -1, 0), new Grad(-1, -1, 0),
        new Grad(1, 0, 1), new Grad(-1, 0, 1), new Grad(1, 0, -1), new Grad(-1, 0, -1),
        new Grad(0, 1, 1), new Grad(0, -1, 1), new Grad(0, 1, -1), new Grad(0, -1, -1)
      ];
      const random = createSeededRandom(seed);
      const permutation = [];
      this.perm = new Array(512);
      this.gradP = new Array(512);
      for (let index = 0; index < 256; index += 1) {
        permutation[index] = Math.floor(random() * 256);
      }
      for (let index = 0; index < 512; index += 1) {
        this.perm[index] = permutation[index & 255];
        this.gradP[index] = gradients[this.perm[index] % 12];
      }
    }

    simplex2(xin, yin) {
      const s = (xin + yin) * 0.366025403;
      const i = Math.floor(xin + s);
      const j = Math.floor(yin + s);
      const t = (i + j) * 0.211324865;
      const x0 = xin - i + t;
      const y0 = yin - j + t;
      const i1 = x0 > y0 ? 1 : 0;
      const j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + 0.211324865;
      const y1 = y0 - j1 + 0.211324865;
      const x2 = x0 - 1 + 0.42264973;
      const y2 = y0 - 1 + 0.42264973;
      const ii = i & 255;
      const jj = j & 255;
      const gi0 = this.gradP[ii + this.perm[jj]];
      const gi1 = this.gradP[ii + i1 + this.perm[jj + j1]];
      const gi2 = this.gradP[ii + 1 + this.perm[jj + 1]];
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      const n0 = t0 < 0 ? 0 : ((t0 *= t0), t0 * t0 * gi0.dot2(x0, y0));
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      const n1 = t1 < 0 ? 0 : ((t1 *= t1), t1 * t1 * gi1.dot2(x1, y1));
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      const n2 = t2 < 0 ? 0 : ((t2 *= t2), t2 * t2 * gi2.dot2(x2, y2));
      return 70 * (n0 + n1 + n2);
    }

    fbm(x, y, octaves, lacunarity, gain) {
      let amplitude = 1;
      let frequency = 1;
      let sum = 0;
      let maxSum = 0;
      for (let index = 0; index < octaves; index += 1) {
        sum += this.simplex2(x * frequency, y * frequency) * amplitude;
        maxSum += amplitude;
        frequency *= lacunarity;
        amplitude *= gain;
      }
      return sum / maxSum;
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to load image: ' + src));
      image.src = src;
    });
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
      reader.readAsText(file);
    });
  }

  function readJsonPath(path) {
    return fetch(path, { cache: 'no-store' }).then((response) => {
      if (!response.ok) {
        throw new Error('Missing ' + path);
      }
      return response.json();
    }).catch(() => new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('GET', path, true);
      request.overrideMimeType('application/json');
      request.onload = () => {
        if ((request.status >= 200 && request.status < 300) || (request.status === 0 && request.responseText)) {
          try {
            resolve(JSON.parse(request.responseText));
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error('Missing ' + path));
        }
      };
      request.onerror = () => reject(new Error('Missing ' + path));
      request.send();
    }));
  }

  function isEditableElement(target) {
    if (!target) {
      return false;
    }
    const tagName = target.tagName;
    return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
  }

  function ensureSharedOverlayStyles() {
    if (document.getElementById('swamp-shared-overlay-styles')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'swamp-shared-overlay-styles';
    style.textContent = [
      '.swamp-note-layer { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }',
      '.swamp-note-card { position: absolute; min-width: 220px; max-width: 320px; pointer-events: auto; border: 1px solid rgba(255,255,255,0.18); border-radius: 12px; background: rgba(12, 16, 19, 0.92); color: #f4f1e8; box-shadow: 0 16px 32px rgba(0,0,0,0.28); }',
      '.swamp-note-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.12); cursor: move; user-select: none; }',
      '.swamp-note-title { font-size: 0.9rem; font-weight: 600; }',
      '.swamp-note-close { border: 0; background: transparent; color: #f4f1e8; cursor: pointer; font: inherit; line-height: 1; padding: 0 2px; }',
      '.swamp-note-body { padding: 10px; font-size: 0.92rem; line-height: 1.4; word-break: break-word; }',
      '.swamp-note-section-title { margin: 0 0 4px; font-size: 0.76rem; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.72; }',
      '.swamp-note-section-copy { margin: 0; white-space: pre-wrap; }',
      '.swamp-note-section + .swamp-note-section { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); }'
    ].join('');
    document.head.appendChild(style);
  }

  function getLocationLabel(location) {
    if (!location) {
      return '';
    }
    return location.name && String(location.name).trim() ? location.name.trim() : location.id;
  }

  function formatMillimeters(value) {
    return round2(value / PIXELS_PER_MILLIMETER);
  }

  function buildTerrainColor(depthNoise, treeNoise, treeVisible) {
    let red;
    let green;
    let blue;
    let depthType;

    if (depthNoise > 0.35) {
      depthType = 'dry';
    } else if (depthNoise > -0.15) {
      depthType = 'shallow';
    } else {
      depthType = 'deep';
    }

    if (depthType === 'deep') {
      red = 20;
      green = 50;
      blue = 100;
    } else if (depthType === 'shallow') {
      red = 50;
      green = 80;
      blue = 60;
    } else {
      red = 80;
      green = 60;
      blue = 30;
    }

    if (treeNoise > -0.1 && treeVisible) {
      red = TREE_GREEN.r;
      green = TREE_GREEN.g;
      blue = TREE_GREEN.b;
    }

    return [red, green, blue];
  }

  function createLocationId(existingLocations) {
    let index = existingLocations.length;
    let candidate = '';
    do {
      candidate = 'poi-' + String(index).padStart(2, '0');
      index += 1;
    } while (existingLocations.some((location) => location.id === candidate));
    return candidate;
  }

  class SwampMapApp {
    constructor(options) {
      this.options = options || {};
      this.canvas = typeof this.options.canvas === 'string'
        ? document.getElementById(this.options.canvas)
        : this.options.canvas;
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.baseSize = BASE_SIZE;
      this.chunkSize = CHUNK_SIZE;
      this.maxScale = this.options.maxScale || 4;
      this.camera = {
        x: BASE_SIZE / 2,
        y: BASE_SIZE / 2,
        scale: 1
      };
      this.dragState = null;
      this.pointerWorld = null;
      this.mode = this.options.defaultMode || 'pan';
      this.revealRadius = this.options.defaultRevealRadius || 20;
      this.showLocations = this.options.showLocations !== false;
      this.showMask = this.options.showMask !== false;
      this.showGrid = this.options.showGrid !== false;
      this.showGridLabels = this.options.showGridLabels !== false;
      this.gridOffsetX = Number(this.options.gridOffsetX) || 50;
      this.gridOffsetY = Number(this.options.gridOffsetY) || 70;
      this.showGmNotes = !!this.options.showGmNotes;
      this.locations = deepClone((this.options.initialLocations || []).map((location) => ({
        id: location.id,
        name: location.name || '',
        x: location.x,
        y: location.y,
        color: location.color || '#ff00ff',
        notes: location.notes || '',
        gmNotes: location.gmNotes || ''
      })));
      this.maskOps = [];
      this.redoMaskOps = [];
      this.selectedLocationId = null;
      this.chunkCache = new Map();
      this.images = { base: null, mask: null };
      this.noise = new SimplexNoise(this.options.seed || DEFAULT_SEED);
      this.seedSalt = xmur3(this.options.seed || DEFAULT_SEED)();
      this.maskCanvas = document.createElement('canvas');
      this.maskCtx = this.maskCanvas.getContext('2d');
      this.noteLayer = null;
      this.openNotes = new Map();
      this.noteZIndex = 10;
      this.measurement = null;
      this.needsRender = false;
      this.ui = this.options.ui || {};
      this.statusMessage = this.options.statusMessage || 'Ready';
    }

    async init() {
      this.images.base = await loadImage(this.options.baseImage || 'randomSwampBaseOnly.png');
      this.images.mask = await loadImage(this.options.maskImage || 'randomSwampExplorationMask.png');
      this.ensureNoteLayer();
      this.bindUi();
      this.bindCanvas();
      this.resizeCanvas();
      await this.autoLoadSidecarFiles();
      this.camera.scale = Math.max(this.minScale, this.minScale * 1.2);
      this.updateUiState();
      this.requestRender();
    }

    bindUi() {
      window.addEventListener('resize', () => this.resizeCanvas());
      window.addEventListener('keydown', (event) => {
        if (isEditableElement(event.target)) {
          return;
        }
        if (!(event.ctrlKey || event.metaKey)) {
          return;
        }
        const key = event.key.toLowerCase();
        if (key === 'z' && !event.shiftKey) {
          event.preventDefault();
          this.undoMaskOp();
        } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
          event.preventDefault();
          this.redoMaskOp();
        }
      });

      if (this.ui.stepButtons) {
        this.ui.stepButtons.forEach((button) => {
          button.addEventListener('click', () => {
            const dx = Number(button.dataset.dx || 0) * this.getStepSize();
            const dy = Number(button.dataset.dy || 0) * this.getStepSize();
            this.camera.x += dx;
            this.camera.y += dy;
            this.statusMessage = 'Moved viewport';
            this.requestRender();
            this.updateUiState();
          });
        });
      }

      if (this.ui.modeButtons) {
        this.ui.modeButtons.forEach((button) => {
          button.addEventListener('click', () => {
            this.setMode(button.dataset.mode);
          });
        });
      }

      if (this.ui.revealButtons) {
        this.ui.revealButtons.forEach((button) => {
          button.addEventListener('click', () => {
            this.revealRadius = Number(button.dataset.radius || 20);
            this.updateUiState();
          });
        });
      }

      if (this.ui.toggleLocations) {
        this.ui.toggleLocations.checked = this.showLocations;
        this.ui.toggleLocations.addEventListener('change', () => {
          this.showLocations = this.ui.toggleLocations.checked;
          this.requestRender();
        });
      }

      if (this.ui.toggleMask) {
        this.ui.toggleMask.checked = this.showMask;
        this.ui.toggleMask.addEventListener('change', () => {
          this.showMask = this.ui.toggleMask.checked;
          this.requestRender();
        });
      }

      if (this.ui.toggleGrid) {
        this.ui.toggleGrid.checked = this.showGrid;
        this.ui.toggleGrid.addEventListener('change', () => {
          this.showGrid = this.ui.toggleGrid.checked;
          this.requestRender();
        });
      }

      if (this.ui.toggleGridLabels) {
        this.ui.toggleGridLabels.checked = this.showGridLabels;
        this.ui.toggleGridLabels.addEventListener('change', () => {
          this.showGridLabels = this.ui.toggleGridLabels.checked;
          this.requestRender();
        });
      }

      if (this.ui.resetViewButton) {
        this.ui.resetViewButton.addEventListener('click', () => {
          this.camera.x = BASE_SIZE / 2;
          this.camera.y = BASE_SIZE / 2;
          this.camera.scale = Math.max(this.minScale, this.minScale * 1.2);
          this.statusMessage = 'Camera reset';
          this.requestRender();
          this.updateUiState();
        });
      }

      if (this.ui.exportSessionButton) {
        this.ui.exportSessionButton.addEventListener('click', () => {
          downloadText('currentExploration.json', JSON.stringify(this.buildSessionExport(), null, 2));
          this.statusMessage = 'Exported reveal session';
          this.updateUiState();
        });
      }

      if (this.ui.importSessionInput) {
        this.ui.importSessionInput.addEventListener('change', async (event) => {
          const file = event.target.files && event.target.files[0];
          if (!file) {
            return;
          }
          try {
            const text = await readFileAsText(file);
            const payload = JSON.parse(text);
            this.loadSession(payload);
            this.statusMessage = 'Imported reveal session';
          } catch (error) {
            this.statusMessage = error.message;
          }
          event.target.value = '';
          this.updateUiState();
          this.requestRender();
        });
      }

      if (this.ui.exportLocationsButton) {
        this.ui.exportLocationsButton.addEventListener('click', () => {
          downloadText('currentLocations.json', JSON.stringify(this.buildLocationsExport(), null, 2));
          this.statusMessage = 'Exported locations';
          this.updateUiState();
        });
      }

      if (this.ui.importLocationsInput) {
        this.ui.importLocationsInput.addEventListener('change', async (event) => {
          const file = event.target.files && event.target.files[0];
          if (!file) {
            return;
          }
          try {
            const text = await readFileAsText(file);
            const payload = JSON.parse(text);
            this.loadLocations(payload);
            this.statusMessage = 'Imported locations';
          } catch (error) {
            this.statusMessage = error.message;
          }
          event.target.value = '';
          this.updateUiState();
          this.requestRender();
        });
      }

      if (this.ui.locationColorInput) {
        this.ui.locationColorInput.addEventListener('input', () => {
          if (!this.selectedLocationId) {
            return;
          }
          const location = this.getSelectedLocation();
          if (!location) {
            return;
          }
          location.color = this.ui.locationColorInput.value;
          this.requestRender();
        });
      }

      if (this.ui.locationNameInput) {
        this.ui.locationNameInput.addEventListener('input', () => {
          if (!this.selectedLocationId) {
            return;
          }
          const location = this.getSelectedLocation();
          if (!location) {
            return;
          }
          location.name = this.ui.locationNameInput.value;
          this.updateUiState();
          this.requestRender();
        });
      }

      if (this.ui.locationNotesInput) {
        this.ui.locationNotesInput.addEventListener('input', () => {
          if (!this.selectedLocationId) {
            return;
          }
          const location = this.getSelectedLocation();
          if (!location) {
            return;
          }
          location.notes = this.ui.locationNotesInput.value;
          this.updateUiState();
          this.requestRender();
        });
      }

      if (this.ui.locationGmNotesInput) {
        this.ui.locationGmNotesInput.addEventListener('input', () => {
          if (!this.selectedLocationId) {
            return;
          }
          const location = this.getSelectedLocation();
          if (!location) {
            return;
          }
          location.gmNotes = this.ui.locationGmNotesInput.value;
          this.updateUiState();
          this.requestRender();
        });
      }

      if (this.ui.deleteLocationButton) {
        this.ui.deleteLocationButton.addEventListener('click', () => {
          this.deleteSelectedLocation();
        });
      }

      if (this.ui.clearSelectionButton) {
        this.ui.clearSelectionButton.addEventListener('click', () => {
          this.selectedLocationId = null;
          this.statusMessage = 'Selection cleared';
          this.updateUiState();
          this.requestRender();
        });
      }

      if (this.ui.randomizeLocationButton) {
        this.ui.randomizeLocationButton.addEventListener('click', () => {
          this.randomizeSelectedLocation();
        });
      }
    }

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
    }

    ensureNoteLayer() {
      ensureSharedOverlayStyles();
      const host = this.canvas.parentElement;
      if (global.getComputedStyle(host).position === 'static') {
        host.style.position = 'relative';
      }
      this.noteLayer = document.createElement('div');
      this.noteLayer.className = 'swamp-note-layer';
      host.appendChild(this.noteLayer);
    }

    onPointerDown(event) {
      const world = this.screenToWorld(event.offsetX, event.offsetY);
      this.pointerWorld = world;
      this.canvas.setPointerCapture(event.pointerId);
      const dragMode = event.button === 2 ? 'pan' : this.mode;
      this.dragState = {
        pointerId: event.pointerId,
        startScreenX: event.offsetX,
        startScreenY: event.offsetY,
        lastScreenX: event.offsetX,
        lastScreenY: event.offsetY,
        moved: false,
        mode: dragMode,
        stroke: null
      };

      if (dragMode === 'reveal' || dragMode === 'obscure') {
        this.startMaskStroke(dragMode);
        this.addMaskPoint(world.x, world.y, dragMode);
      } else if (dragMode === 'measure') {
        this.measurement = {
          start: { x: round2(world.x), y: round2(world.y) },
          end: { x: round2(world.x), y: round2(world.y) }
        };
        this.statusMessage = 'Measuring';
        this.updateUiState();
        this.requestRender();
      }
    }

    onPointerMove(event) {
      this.pointerWorld = this.screenToWorld(event.offsetX, event.offsetY);
      if (!this.dragState || this.dragState.pointerId !== event.pointerId) {
        this.requestRender();
        return;
      }

      const dx = event.offsetX - this.dragState.lastScreenX;
      const dy = event.offsetY - this.dragState.lastScreenY;
      if (Math.abs(event.offsetX - this.dragState.startScreenX) > 3 || Math.abs(event.offsetY - this.dragState.startScreenY) > 3) {
        this.dragState.moved = true;
      }

      if (this.dragState.mode === 'pan') {
        this.camera.x -= dx / this.camera.scale;
        this.camera.y -= dy / this.camera.scale;
        this.statusMessage = 'Panning';
        this.updateUiState();
        this.requestRender();
      } else if (this.dragState.mode === 'reveal' || this.dragState.mode === 'obscure') {
        this.addMaskPoint(this.pointerWorld.x, this.pointerWorld.y, this.dragState.mode);
      } else if (this.dragState.mode === 'measure' && this.measurement) {
        this.measurement.end = { x: round2(this.pointerWorld.x), y: round2(this.pointerWorld.y) };
        this.updateUiState();
        this.requestRender();
      }

      this.dragState.lastScreenX = event.offsetX;
      this.dragState.lastScreenY = event.offsetY;
    }

    onPointerUp(event) {
      if (!this.dragState) {
        return;
      }

      if (this.dragState.pointerId === event.pointerId && !this.dragState.moved) {
        const world = this.screenToWorld(event.offsetX, event.offsetY);
        if (this.mode === 'pan') {
          this.openNoteAt(world.x, world.y);
        } else if (this.mode === 'create') {
          this.createLocation(world.x, world.y);
        } else if (this.mode === 'select') {
          this.selectLocationAt(world.x, world.y);
        }
      }

      if (this.dragState.stroke && this.dragState.stroke.points.length === 0) {
        this.maskOps.pop();
      }

      this.dragState = null;
      this.requestRender();
    }

    resizeCanvas() {
      const container = this.canvas.parentElement;
      const nextWidth = Math.max(640, Math.floor(container.clientWidth));
      const nextHeight = Math.max(640, Math.floor(container.clientHeight));
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
      this.maskCanvas.width = nextWidth;
      this.maskCanvas.height = nextHeight;
      this.minScale = Math.min(this.canvas.width / BASE_SIZE, this.canvas.height / BASE_SIZE);
      this.camera.scale = clamp(this.camera.scale, this.minScale, this.maxScale);
      this.updateUiState();
      this.requestRender();
    }

    getStepSize() {
      if (!this.ui.stepInputs) {
        return 200;
      }
      const selected = Array.from(this.ui.stepInputs).find((input) => input.checked);
      return selected ? Number(selected.value) : 200;
    }

    setMode(mode) {
      this.mode = mode;
      this.statusMessage = 'Mode: ' + mode;
      this.updateUiState();
      this.requestRender();
    }

    zoomAt(screenX, screenY, factor) {
      const before = this.screenToWorld(screenX, screenY);
      this.camera.scale = clamp(this.camera.scale * factor, this.minScale, this.maxScale);
      const after = this.screenToWorld(screenX, screenY);
      this.camera.x += before.x - after.x;
      this.camera.y += before.y - after.y;
      this.statusMessage = 'Zoom ' + round2(this.camera.scale) + 'x';
      this.updateUiState();
      this.requestRender();
    }

    worldToScreen(worldX, worldY) {
      return {
        x: (worldX - this.camera.x) * this.camera.scale + (this.canvas.width / 2),
        y: (worldY - this.camera.y) * this.camera.scale + (this.canvas.height / 2)
      };
    }

    screenToWorld(screenX, screenY) {
      return {
        x: (screenX - (this.canvas.width / 2)) / this.camera.scale + this.camera.x,
        y: (screenY - (this.canvas.height / 2)) / this.camera.scale + this.camera.y
      };
    }

    getVisibleWorldRect() {
      const halfWidth = this.canvas.width / (2 * this.camera.scale);
      const halfHeight = this.canvas.height / (2 * this.camera.scale);
      return {
        left: this.camera.x - halfWidth,
        right: this.camera.x + halfWidth,
        top: this.camera.y - halfHeight,
        bottom: this.camera.y + halfHeight
      };
    }

    getProceduralChunk(chunkX, chunkY) {
      const key = chunkX + ',' + chunkY;
      if (this.chunkCache.has(key)) {
        return this.chunkCache.get(key);
      }

      const chunkCanvas = document.createElement('canvas');
      chunkCanvas.width = CHUNK_SIZE;
      chunkCanvas.height = CHUNK_SIZE;
      const context = chunkCanvas.getContext('2d');
      const image = context.createImageData(CHUNK_SIZE, CHUNK_SIZE);
      const data = image.data;
      const pixelShiftX = chunkX * CHUNK_SIZE;
      const pixelShiftY = chunkY * CHUNK_SIZE;

      for (let y = 0; y < CHUNK_SIZE; y += 1) {
        for (let x = 0; x < CHUNK_SIZE; x += 1) {
          const worldX = x + pixelShiftX;
          const worldY = y + pixelShiftY;
          const depthNoise = this.noise.fbm(worldX * 0.002, worldY * 0.002, 5, 2, 0.5);
          const rawTreeNoise = this.noise.fbm((worldX * 0.0075) + 100, (worldY * 0.0075) + 100, 5, 2, 0.5);
          const treeNoise = rawTreeNoise + (depthNoise * 0.5);
          const treeVisible = hash2d(this.seedSalt, worldX, worldY) > 0.3;
          const color = buildTerrainColor(depthNoise, treeNoise, treeVisible);
          const index = (y * CHUNK_SIZE + x) * 4;
          data[index] = color[0];
          data[index + 1] = color[1];
          data[index + 2] = color[2];
          data[index + 3] = 255;
        }
      }

      context.putImageData(image, 0, 0);
      this.chunkCache.set(key, chunkCanvas);
      return chunkCanvas;
    }

    drawProceduralTerrain() {
      const view = this.getVisibleWorldRect();
      const startChunkX = Math.floor(view.left / CHUNK_SIZE);
      const endChunkX = Math.floor((view.right - 1) / CHUNK_SIZE);
      const startChunkY = Math.floor(view.top / CHUNK_SIZE);
      const endChunkY = Math.floor((view.bottom - 1) / CHUNK_SIZE);

      for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY += 1) {
        for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX += 1) {
          const chunkCanvas = this.getProceduralChunk(chunkX, chunkY);
          const topLeft = this.worldToScreen(chunkX * CHUNK_SIZE, chunkY * CHUNK_SIZE);
          this.ctx.drawImage(
            chunkCanvas,
            topLeft.x,
            topLeft.y,
            CHUNK_SIZE * this.camera.scale,
            CHUNK_SIZE * this.camera.scale
          );
        }
      }
    }

    drawBaseImage() {
      const topLeft = this.worldToScreen(0, 0);
      this.ctx.drawImage(this.images.base, topLeft.x, topLeft.y, BASE_SIZE * this.camera.scale, BASE_SIZE * this.camera.scale);
    }

    drawLocations() {
      if (!this.showLocations) {
        return;
      }

      this.locations.forEach((location) => {
        const point = this.worldToScreen(location.x, location.y);
        const radius = Math.max(4, 6 * this.camera.scale);
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = location.color;
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.stroke();

        if (location.id === this.selectedLocationId) {
          this.ctx.beginPath();
          this.ctx.arc(point.x, point.y, radius + 5, 0, Math.PI * 2);
          this.ctx.strokeStyle = '#ffd966';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
        }
      });
    }

    drawMask() {
      if (!this.showMask) {
        return;
      }

      this.maskCtx.clearRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
      this.maskCtx.save();
      this.maskCtx.fillStyle = MASK_OUTSIDE;
      this.maskCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);

      const topLeft = this.worldToScreen(0, 0);
      const width = BASE_SIZE * this.camera.scale;
      const height = BASE_SIZE * this.camera.scale;

      this.maskCtx.clearRect(topLeft.x, topLeft.y, width, height);
      this.maskCtx.drawImage(this.images.mask, topLeft.x, topLeft.y, width, height);

      this.maskOps.forEach((stroke) => {
        this.maskCtx.globalCompositeOperation = stroke.mode === 'obscure' ? 'source-over' : 'destination-out';
        this.maskCtx.fillStyle = MASK_OUTSIDE;
        stroke.points.forEach((pointData) => {
          const point = this.worldToScreen(pointData.x, pointData.y);
          this.maskCtx.beginPath();
          this.maskCtx.arc(point.x, point.y, pointData.radius * this.camera.scale, 0, Math.PI * 2);
          this.maskCtx.fill();
        });
      });

      this.maskCtx.restore();
      this.ctx.drawImage(this.maskCanvas, 0, 0);
    }

    drawPointerPreview() {
      if (!this.pointerWorld || (this.mode !== 'reveal' && this.mode !== 'obscure')) {
        return;
      }

      const point = this.worldToScreen(this.pointerWorld.x, this.pointerWorld.y);
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, this.revealRadius * this.camera.scale, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(255, 244, 140, 0.9)';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.restore();
    }

    drawGrid() {
      if (!this.showGrid && !this.showGridLabels) {
        return;
      }
      const view = this.getVisibleWorldRect();
      const startN = Math.floor((view.left - this.gridOffsetX) / GRID_SPACING_PX);
      const endN = Math.ceil((view.right - this.gridOffsetX) / GRID_SPACING_PX);
      const startM = Math.floor((view.top - this.gridOffsetY) / GRID_SPACING_PX);
      const endM = Math.ceil((view.bottom - this.gridOffsetY) / GRID_SPACING_PX);

      if (this.showGrid) {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 244, 185, 0.22)';
        this.ctx.lineWidth = 1;
        for (let n = startN; n <= endN; n += 1) {
          const worldX = this.gridOffsetX + (n * GRID_SPACING_PX);
          const screen = this.worldToScreen(worldX, 0);
          this.ctx.beginPath();
          this.ctx.moveTo(screen.x, 0);
          this.ctx.lineTo(screen.x, this.canvas.height);
          this.ctx.stroke();
        }
        for (let m = startM; m <= endM; m += 1) {
          const worldY = this.gridOffsetY + (m * GRID_SPACING_PX);
          const screen = this.worldToScreen(0, worldY);
          this.ctx.beginPath();
          this.ctx.moveTo(0, screen.y);
          this.ctx.lineTo(this.canvas.width, screen.y);
          this.ctx.stroke();
        }
        this.ctx.restore();
      }

      if (this.showGridLabels) {
        const startGridX = Math.floor(view.left / GRID_SPACING_PX);
        const endGridX = Math.floor((view.right - 1) / GRID_SPACING_PX);
        const startGridY = Math.floor(view.top / GRID_SPACING_PX);
        const endGridY = Math.floor((view.bottom - 1) / GRID_SPACING_PX);
        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const baseFont = 12;
        const fontScale = Math.min(1.2, Math.max(1, this.camera.scale));
        const fontSize = Math.max(10, Math.round(baseFont * fontScale));
        this.ctx.font = fontSize + 'px Georgia';

        const roundRect = (x, y, w, h, r) => {
          const ctx = this.ctx;
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
        };

        for (let gx = startGridX; gx <= endGridX; gx += 1) {
          for (let gy = startGridY; gy <= endGridY; gy += 1) {
            const centerWorldX = this.gridOffsetX + ((gx + 0.5) * GRID_SPACING_PX);
            const centerWorldY = this.gridOffsetY + ((gy + 0.5) * GRID_SPACING_PX);
            const screen = this.worldToScreen(centerWorldX, centerWorldY);
            const label = '(' + (gx + 5) + ',' + (gy + 5) + ')';
            const metrics = this.ctx.measureText(label);
            const textWidth = metrics.width;
            const padX = 8 * (fontSize / baseFont);
            const padY = 4 * (fontSize / baseFont);
            const rectW = textWidth + padX * 2;
            const rectH = fontSize + padY * 2;
            const rectX = screen.x - (rectW / 2);
            const rectY = screen.y - (rectH / 2);

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            roundRect(rectX, rectY, rectW, rectH, 6);
            this.ctx.fill();

            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            roundRect(rectX, rectY, rectW, rectH, 6);
            this.ctx.stroke();

            this.ctx.fillStyle = 'rgba(255, 244, 185, 0.98)';
            this.ctx.fillText(label, screen.x, screen.y);
          }
        }
        this.ctx.restore();
      }
    }

    drawMeasurement() {
      if (!this.measurement) {
        return;
      }
      const start = this.worldToScreen(this.measurement.start.x, this.measurement.start.y);
      const end = this.worldToScreen(this.measurement.end.x, this.measurement.end.y);
      const dx = this.measurement.end.x - this.measurement.start.x;
      const dy = this.measurement.end.y - this.measurement.start.y;
      const millimeters = formatMillimeters(Math.sqrt((dx * dx) + (dy * dy)));

      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(255, 214, 112, 0.95)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(start.x, start.y);
      this.ctx.lineTo(end.x, end.y);
      this.ctx.stroke();

      this.ctx.fillStyle = '#ffe6a7';
      this.ctx.beginPath();
      this.ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
      this.ctx.fill();

      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const label = millimeters + ' mm';
      this.ctx.font = '13px Georgia';
      const textWidth = this.ctx.measureText(label).width;
      this.ctx.fillStyle = 'rgba(13, 19, 18, 0.9)';
      this.ctx.fillRect(midX - (textWidth / 2) - 8, midY - 18, textWidth + 16, 22);
      this.ctx.fillStyle = '#ffe6a7';
      this.ctx.fillText(label, midX - (textWidth / 2), midY - 3);
      this.ctx.restore();
    }

    render() {
      this.needsRender = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = '#0e1612';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawProceduralTerrain();
      this.drawBaseImage();
      this.drawLocations();
      this.drawMask();
      this.drawGrid();
      this.drawPointerPreview();
      this.drawMeasurement();
      this.updateOpenNotePositions();
    }

    requestRender() {
      if (this.needsRender) {
        return;
      }
      this.needsRender = true;
      requestAnimationFrame(() => this.render());
    }

    startMaskStroke(mode) {
      const stroke = { mode, points: [] };
      this.maskOps.push(stroke);
      this.redoMaskOps = [];
      this.dragState.stroke = stroke;
    }

    addMaskPoint(x, y, mode) {
      if (!this.dragState || !this.dragState.stroke || this.dragState.stroke.mode !== mode) {
        this.startMaskStroke(mode);
      }
      const stroke = this.dragState.stroke;
      const last = stroke.points[stroke.points.length - 1];
      if (last) {
        const dx = last.x - x;
        const dy = last.y - y;
        if (Math.sqrt((dx * dx) + (dy * dy)) < Math.max(4, this.revealRadius / 3)) {
          return;
        }
      }
      stroke.points.push({ x: round2(x), y: round2(y), radius: this.revealRadius });
      this.statusMessage = mode === 'obscure' ? 'Obscured area' : 'Revealed area';
      this.updateUiState();
      this.requestRender();
    }

    undoMaskOp() {
      if (this.maskOps.length === 0) {
        return;
      }
      this.redoMaskOps.push(this.maskOps.pop());
      this.statusMessage = 'Undid mask edit';
      this.updateUiState();
      this.requestRender();
    }

    redoMaskOp() {
      if (this.redoMaskOps.length === 0) {
        return;
      }
      this.maskOps.push(this.redoMaskOps.pop());
      this.statusMessage = 'Redid mask edit';
      this.updateUiState();
      this.requestRender();
    }

    buildSessionExport() {
      return {
        version: 1,
        type: 'swamp-session',
        seed: this.options.seed || DEFAULT_SEED,
        maskOps: deepClone(this.maskOps)
      };
    }

    loadSession(payload) {
      const ops = payload && Array.isArray(payload.maskOps)
        ? payload.maskOps
        : (payload && Array.isArray(payload.revealOps)
          ? payload.revealOps.map((op) => ({ ...op, mode: 'reveal' }))
          : null);
      if (!payload || payload.type !== 'swamp-session' || !ops) {
        throw new Error('Invalid swamp session file.');
      }
      this.maskOps = ops.map((op) => ({
        mode: op.mode === 'obscure' ? 'obscure' : 'reveal',
        points: Array.isArray(op.points)
          ? op.points.map((point) => ({
            x: Number(point.x) || 0,
            y: Number(point.y) || 0,
            radius: Number(point.radius) || 20
          }))
          : [{
            x: Number(op.x) || 0,
            y: Number(op.y) || 0,
            radius: Number(op.radius) || 20
          }]
      }));
      this.redoMaskOps = [];
    }

    buildLocationsExport() {
      return {
        version: 1,
        type: 'swamp-locations',
        locations: deepClone(this.locations)
      };
    }

    loadLocations(payload) {
      const nextLocations = Array.isArray(payload)
        ? payload
        : (payload && Array.isArray(payload.locations) ? payload.locations : null);
      if (!nextLocations) {
        throw new Error('Invalid locations file.');
      }
      this.locations = nextLocations.map((location, index) => ({
        id: location.id || ('poi-' + String(index).padStart(2, '0')),
        name: location.name || '',
        x: Number(location.x) || 0,
        y: Number(location.y) || 0,
        color: location.color || '#ff00ff',
        notes: location.notes || '',
        gmNotes: location.gmNotes || ''
      }));
      this.selectedLocationId = null;
      this.pruneMissingNotes();
    }

    async autoLoadSidecarFiles() {
      const results = await Promise.allSettled([
        readJsonPath('currentExploration.json'),
        readJsonPath('currentLocations.json')
      ]);
      let loadedAny = false;
      if (results[0].status === 'fulfilled') {
        try {
          this.loadSession(results[0].value);
          loadedAny = true;
        } catch (_error) {
        }
      }
      if (results[1].status === 'fulfilled') {
        try {
          this.loadLocations(results[1].value);
          loadedAny = true;
        } catch (_error) {
        }
      }
      if (loadedAny) {
        this.statusMessage = 'Loaded current session files';
      }
    }

    selectLocationAt(x, y) {
      const match = this.findLocationAt(x, y);
      const best = match ? match.location : null;
      const bestDistance = match ? match.distance : Number.POSITIVE_INFINITY;

      if (!best || bestDistance > 30) {
        this.selectedLocationId = null;
        this.statusMessage = 'No location selected';
      } else {
        this.selectedLocationId = best.id;
        this.statusMessage = 'Selected ' + getLocationLabel(best);
      }

      this.updateUiState();
      this.requestRender();
    }

    findLocationAt(x, y) {
      let best = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      this.locations.forEach((location) => {
        const dx = location.x - x;
        const dy = location.y - y;
        const distance = Math.sqrt((dx * dx) + (dy * dy));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = location;
        }
      });
      if (!best || bestDistance > 30) {
        return null;
      }
      return { location: best, distance: bestDistance };
    }

    openNoteAt(x, y) {
      const match = this.findLocationAt(x, y);
      if (!match) {
        return;
      }
      const location = match.location;
      this.selectedLocationId = location.id;
      this.openLocationNote(location.id);
      this.statusMessage = 'Opened note for ' + getLocationLabel(location);
      this.updateUiState();
      this.requestRender();
    }

    openLocationNote(locationId) {
      const location = this.locations.find((entry) => entry.id === locationId);
      if (!location) {
        return;
      }
      if (this.openNotes.has(locationId)) {
        this.bringNoteToFront(locationId);
        this.updateSingleNote(locationId);
        return;
      }

      const card = document.createElement('div');
      card.className = 'swamp-note-card';
      card.dataset.locationId = locationId;

      const header = document.createElement('div');
      header.className = 'swamp-note-header';

      const title = document.createElement('div');
      title.className = 'swamp-note-title';
      header.appendChild(title);

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'swamp-note-close';
      closeButton.textContent = 'x';
      closeButton.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
      closeButton.addEventListener('pointerup', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.closeLocationNote(locationId);
      });
      header.appendChild(closeButton);

      const body = document.createElement('div');
      body.className = 'swamp-note-body';

      header.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.bringNoteToFront(locationId);
        const note = this.openNotes.get(locationId);
        if (!note) {
          return;
        }
        note.drag = {
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          originOffsetX: note.offsetX,
          originOffsetY: note.offsetY
        };
        header.setPointerCapture(event.pointerId);
      });

      header.addEventListener('pointermove', (event) => {
        const note = this.openNotes.get(locationId);
        if (!note || !note.drag || note.drag.pointerId !== event.pointerId) {
          return;
        }
        note.offsetX = note.drag.originOffsetX + (event.clientX - note.drag.startClientX);
        note.offsetY = note.drag.originOffsetY + (event.clientY - note.drag.startClientY);
        this.updateSingleNote(locationId);
      });

      const stopDragging = (event) => {
        const note = this.openNotes.get(locationId);
        if (!note || !note.drag || note.drag.pointerId !== event.pointerId) {
          return;
        }
        note.drag = null;
        header.releasePointerCapture(event.pointerId);
      };

      header.addEventListener('pointerup', stopDragging);
      header.addEventListener('pointercancel', stopDragging);

      card.appendChild(header);
      card.appendChild(body);
      this.noteLayer.appendChild(card);

      this.openNotes.set(locationId, {
        card,
        header,
        title,
        body,
        offsetX: NOTE_OFFSET_X,
        offsetY: NOTE_OFFSET_Y,
        drag: null,
        zIndex: ++this.noteZIndex
      });
      this.updateSingleNote(locationId);
      this.bringNoteToFront(locationId);
    }

    closeLocationNote(locationId) {
      const note = this.openNotes.get(locationId);
      if (!note) {
        return;
      }
      note.card.remove();
      this.openNotes.delete(locationId);
    }

    bringNoteToFront(locationId) {
      const note = this.openNotes.get(locationId);
      if (!note) {
        return;
      }
      note.zIndex = ++this.noteZIndex;
      note.card.style.zIndex = String(note.zIndex);
    }

    updateOpenNotePositions() {
      this.pruneMissingNotes();
      this.openNotes.forEach((_note, locationId) => {
        this.updateSingleNote(locationId);
      });
    }

    updateSingleNote(locationId) {
      const note = this.openNotes.get(locationId);
      const location = this.locations.find((entry) => entry.id === locationId);
      if (!note || !location) {
        return;
      }
      const anchor = this.worldToScreen(location.x, location.y);
      note.title.textContent = getLocationLabel(location);
      note.body.innerHTML = '';
      if (location.notes) {
        const notesSection = document.createElement('div');
        notesSection.className = 'swamp-note-section';
        const notesTitle = document.createElement('div');
        notesTitle.className = 'swamp-note-section-title';
        notesTitle.textContent = 'Notes';
        const notesBody = document.createElement('div');
        notesBody.className = 'swamp-note-section-copy';
        notesBody.textContent = location.notes;
        notesSection.appendChild(notesTitle);
        notesSection.appendChild(notesBody);
        note.body.appendChild(notesSection);
      }
      if (this.showGmNotes && location.gmNotes) {
        const gmSection = document.createElement('div');
        gmSection.className = 'swamp-note-section';
        const gmTitle = document.createElement('div');
        gmTitle.className = 'swamp-note-section-title';
        gmTitle.textContent = 'GM Notes';
        const gmBody = document.createElement('div');
        gmBody.className = 'swamp-note-section-copy';
        gmBody.textContent = location.gmNotes;
        gmSection.appendChild(gmTitle);
        gmSection.appendChild(gmBody);
        note.body.appendChild(gmSection);
      }
      note.card.style.left = Math.round(anchor.x + note.offsetX) + 'px';
      note.card.style.top = Math.round(anchor.y + note.offsetY) + 'px';
      note.card.style.borderColor = location.color;
    }

    pruneMissingNotes() {
      const validIds = new Set(this.locations.map((location) => location.id));
      Array.from(this.openNotes.keys()).forEach((locationId) => {
        if (!validIds.has(locationId)) {
          this.closeLocationNote(locationId);
        }
      });
    }

    createLocation(x, y) {
      const color = this.ui.locationColorInput ? this.ui.locationColorInput.value : '#ff33cc';
      const name = this.ui.locationNameInput ? this.ui.locationNameInput.value.trim() : '';
      const notes = this.ui.locationNotesInput ? this.ui.locationNotesInput.value : '';
      const gmNotes = this.ui.locationGmNotesInput ? this.ui.locationGmNotesInput.value : '';
      const location = {
        id: createLocationId(this.locations),
        name,
        x: round2(x),
        y: round2(y),
        color,
        notes,
        gmNotes
      };
      this.locations.push(location);
      this.selectedLocationId = location.id;
      this.statusMessage = 'Created ' + getLocationLabel(location);
      this.updateUiState();
      this.requestRender();
    }

    deleteSelectedLocation() {
      if (!this.selectedLocationId) {
        return;
      }
      this.closeLocationNote(this.selectedLocationId);
      this.locations = this.locations.filter((location) => location.id !== this.selectedLocationId);
      this.statusMessage = 'Deleted ' + this.selectedLocationId;
      this.selectedLocationId = null;
      this.updateUiState();
      this.requestRender();
    }

    getSelectedLocation() {
      if (!this.selectedLocationId) {
        return null;
      }
      return this.locations.find((location) => location.id === this.selectedLocationId) || null;
    }

    randomizeSelectedLocation() {
      const location = this.getSelectedLocation();
      if (!location) {
        this.statusMessage = 'No location selected';
        this.updateUiState();
        return;
      }
      const cellIndexX = Math.floor((location.x - this.gridOffsetX) / GRID_SPACING_PX);
      const cellIndexY = Math.floor((location.y - this.gridOffsetY) / GRID_SPACING_PX);
      const cellOriginX = this.gridOffsetX + (cellIndexX * GRID_SPACING_PX);
      const cellOriginY = this.gridOffsetY + (cellIndexY * GRID_SPACING_PX);
      const newX = cellOriginX + (Math.random() * GRID_SPACING_PX);
      const newY = cellOriginY + (Math.random() * GRID_SPACING_PX);
      location.x = round2(clamp(newX, 0, BASE_SIZE));
      location.y = round2(clamp(newY, 0, BASE_SIZE));
      this.statusMessage = 'Randomized ' + getLocationLabel(location);
      this.updateUiState();
      this.requestRender();
    }

    updateUiState() {
      if (this.ui.modeButtons) {
        this.ui.modeButtons.forEach((button) => {
          button.classList.toggle('is-active', button.dataset.mode === this.mode);
        });
      }

      if (this.ui.revealButtons) {
        this.ui.revealButtons.forEach((button) => {
          button.classList.toggle('is-active', Number(button.dataset.radius) === this.revealRadius);
        });
      }

      if (this.ui.zoomValue) {
        this.ui.zoomValue.textContent = round2(this.camera.scale) + 'x';
      }

      if (this.ui.centerValue) {
        this.ui.centerValue.textContent = round2(this.camera.x) + ', ' + round2(this.camera.y);
      }

      if (this.ui.revealCountValue) {
        this.ui.revealCountValue.textContent = String(this.maskOps.length);
      }

      if (this.ui.measurementValue) {
        if (!this.measurement) {
          this.ui.measurementValue.textContent = 'None';
        } else {
          const dx = this.measurement.end.x - this.measurement.start.x;
          const dy = this.measurement.end.y - this.measurement.start.y;
          this.ui.measurementValue.textContent = formatMillimeters(Math.sqrt((dx * dx) + (dy * dy))) + ' mm';
        }
      }

      if (this.ui.statusValue) {
        this.ui.statusValue.textContent = this.statusMessage;
      }

      if (this.ui.selectedLocationValue) {
        const selected = this.getSelectedLocation();
        this.ui.selectedLocationValue.textContent = selected ? getLocationLabel(selected) : 'None';
      }

      if (this.ui.locationNameInput) {
        const selected = this.getSelectedLocation();
        this.ui.locationNameInput.value = selected ? selected.name || '' : this.ui.locationNameInput.value;
      }

      if (this.ui.locationColorInput) {
        const selected = this.getSelectedLocation();
        this.ui.locationColorInput.value = selected ? selected.color : (this.ui.locationColorInput.value || '#ff33cc');
      }

      if (this.ui.locationNotesInput) {
        const selected = this.getSelectedLocation();
        this.ui.locationNotesInput.value = selected ? selected.notes : this.ui.locationNotesInput.value;
      }

      if (this.ui.locationGmNotesInput) {
        const selected = this.getSelectedLocation();
        this.ui.locationGmNotesInput.value = selected ? selected.gmNotes || '' : this.ui.locationGmNotesInput.value;
      }

      if (this.ui.locationCountValue) {
        this.ui.locationCountValue.textContent = String(this.locations.length);
      }
    }
  }

  global.SwampMapApp = SwampMapApp;
})(window);