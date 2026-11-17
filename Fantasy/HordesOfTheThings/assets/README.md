# Hordes SVG assets

## Units

Each unit SVG is drawn in unit-local coordinates.

- Origin: top-left of the unit footprint is `(0, 0)`.
- Width: always `40`.
- Height: match the unit depth (`20`, `30`, or `40`).
- Front edge: the top of the SVG is the unit front.
- Suggested replacement workflow: keep the same `viewBox` and draw inside the inner safe area.

Generic art lives at `assets/<UnitType>.svg`. Faction art lives at `assets/<Faction>/<UnitType>.svg`. If a faction file is missing, the prototype falls back to the generic SVG.

Each faction folder has `art.json` with the main base `background` color and whether overlay boot prints should be `dark` (current grey) or `light` (chalky white, for contrast on dark or grey art). Goblin and Undead use `light`. The Magician/Artillery shooting handle uses `assets/shoot.svg`.

## Terrain

Outlines live in `terrain/original/` and `terrain/waved/`, with point catalogs in `terrain/catalog.json`. Local coordinates are centered at the origin and typically span about `[-1, 1]`. Runtime loads the original outline, then applies the wave function so uploaded blocks can use the same pipeline.
