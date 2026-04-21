(function () {
  'use strict';

  // Usage: node add_locations.js [inputs.txt]
  // If no file provided, the embedded SAMPLE_INPUT will be used.

  const fs = require('fs');
  const path = require('path');

  const BASE_DIR = __dirname;
  const LOCATIONS_FILE = path.join(BASE_DIR, 'currentLocations.json');
  const INPUTS_FILE = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : null;

  const GRID_SPACING_PX = 240; // from swamp-shared.js (60mm * 4 px/mm)
  const GRID_OFFSET_X = 50;
  const GRID_OFFSET_Y = 70;

  const FALLBACK_COLORS = {
    yeti: '#FFFFFF',
    squellions: '#2A4C41'
  };

  const SAMPLE_INPUT = `
(11,2) - Yeti
(11,5) - Koidrac
(11,9) - Veracity (Boral (climbing bugs))
(11,10) - Orion Alliance (Tortholite, Tortholite)
(12,1) - Orion Alliance (Tortholite, Furbite)
(12,5) - Orion Alliance (Furbite, Hermit Squid, Furbite, Hermit Squid)
(12,5) - Marass
(12,6) - Veracity (Sorgumm)
(12,8) - Squellions
(13,3) - Orion Alliance (Keverling, Tortholite, Keverling, Hawfax)
(13,6) - Yeti
(14,7) - Pacchekki
(15,5) - Koidrac
(15,9) - Veracity (Boral (climbing bugs))
(16,1) - Veracity (Prime Soldiers)
(16,7) - Veracity (Quarius)
(17,2) - Orion Alliance (Hermit Squid, Tortholite, Hawfax, Furbite)
(17,2) - Vuto
(18,6) - Squellions
(18,7) - Marass
(19,1) - Veracity (Sorgumm)
(19,1) - Veracity (Quarius)
(19,8) - Veracity (Baxxit)
(20,10) - Pacchekki
(20,10) - Koidrac
`.trim();

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  function readLocations() {
    const raw = fs.readFileSync(LOCATIONS_FILE, 'utf8');
    const payload = JSON.parse(raw);
    return payload.locations || [];
  }

  function writeLocations(locations) {
    const payload = { version: 1, type: 'swamp-locations', locations };
    fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  }

  function parseInputs(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const entries = [];
    for (const line of lines) {
      // split at the first ' - '
      const parts = line.split(' - ');
      if (parts.length < 2) {
        console.warn('Skipping unrecognized line:', line);
        continue;
      }
      const coordPart = parts[0].replace(/[()]/g, '').trim();
      const namePart = parts.slice(1).join(' - ').trim();

      const coordBits = coordPart.split(',').map((s) => s.trim());
      if (coordBits.length < 2) {
        console.warn('Skipping bad coords:', coordPart);
        continue;
      }
      const col = Number(coordBits[0]);
      const row = Number(coordBits[1]);
      // split name and gmNotes: take first ' (' as start of gmNotes if present
      let name = namePart;
      let gmNotes = '';
      const idx = namePart.indexOf(' (');
      if (idx !== -1) {
        name = namePart.slice(0, idx).trim();
        gmNotes = namePart.slice(idx + 2).trim();
        if (gmNotes.endsWith(')')) {
          gmNotes = gmNotes.slice(0, -1).trim();
        }
      }
      entries.push({ col, row, name, gmNotes });
    }
    return entries;
  }

  function findFactionColor(factionName, existingLocations) {
    if (!factionName) return '#ff00ff';
    const key = factionName.toLowerCase();
    // search for a location whose name includes the faction name
    for (const loc of existingLocations) {
      if (!loc.name) continue;
      if (loc.name.toLowerCase().includes(key)) return loc.color;
    }
    // search in gmNotes
    for (const loc of existingLocations) {
      if (!loc.gmNotes) continue;
      if (loc.gmNotes.toLowerCase().includes(key)) return loc.color;
    }
    // fallback map
    if (FALLBACK_COLORS[key]) return FALLBACK_COLORS[key];
    return '#ff00ff';
  }

  function createLocationId(existingLocations) {
    let index = existingLocations.length;
    let candidate = '';
    const existingIds = new Set(existingLocations.map((l) => l.id));
    do {
      candidate = 'poi-' + String(index).padStart(2, '0');
      index += 1;
    } while (existingIds.has(candidate));
    return candidate;
  }

  function gridToWorld(col, row) {
    // grid indices are 1-based; swamp grid code displays labels as (gx+5, gy+5)
    const gx = col - 5;
    const gy = row - 5;
    const cellOriginX = GRID_OFFSET_X + (gx * GRID_SPACING_PX);
    const cellOriginY = GRID_OFFSET_Y + (gy * GRID_SPACING_PX);
    const x = round2(cellOriginX + Math.random() * GRID_SPACING_PX);
    const y = round2(cellOriginY + Math.random() * GRID_SPACING_PX);
    // clamp inside cell
    const xClamped = Math.max(cellOriginX, Math.min(x, cellOriginX + GRID_SPACING_PX - 0.01));
    const yClamped = Math.max(cellOriginY, Math.min(y, cellOriginY + GRID_SPACING_PX - 0.01));
    return { x: round2(xClamped), y: round2(yClamped) };
  }

  function main() {
    const inputText = INPUTS_FILE ? fs.readFileSync(INPUTS_FILE, 'utf8') : SAMPLE_INPUT;
    const entries = parseInputs(inputText);
    if (entries.length === 0) {
      console.log('No entries parsed from input.');
      return;
    }

    const existing = readLocations();
    for (const e of entries) {
      const loc = gridToWorld(e.col, e.row);
      const color = findFactionColor(e.name, existing);
      const id = createLocationId(existing);
      const newLocation = {
        id,
        name: e.name,
        x: loc.x,
        y: loc.y,
        color,
        notes: '',
        gmNotes: e.gmNotes || ''
      };
      existing.push(newLocation);
      console.log('Added', id, e.name, `(${e.col},${e.row}) ->`, loc.x, loc.y, color, e.gmNotes || '');
    }

    writeLocations(existing);
    console.log('Wrote', LOCATIONS_FILE);
  }

  main();

})();
