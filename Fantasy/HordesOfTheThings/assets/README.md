# Hordes Unit SVG Assets

Each unit SVG is drawn in unit-local coordinates.

- Origin: top-left of the unit footprint is `(0, 0)`.
- Width: always `40`.
- Height: match the unit depth.
- Front edge: the top of the SVG is the unit front.
- Suggested replacement workflow: keep the same `viewBox` and draw inside the inner safe area.

Current sample files:

- `Blade.svg` -> `viewBox="0 0 40 20"`
- `Spear.svg` -> `viewBox="0 0 40 20"`
- `Warband.svg` -> `viewBox="0 0 40 20"`
- `Shooter.svg` -> `viewBox="0 0 40 20"`
- `Knights.svg` -> `viewBox="0 0 40 30"`
- `Riders.svg` -> `viewBox="0 0 40 30"`
- `Flyers.svg` -> `viewBox="0 0 40 30"`
- `Horde.svg` -> `viewBox="0 0 40 40"`
- `Hero.svg` -> `viewBox="0 0 40 40"`

Terrain outlines live in `terrain/original/` and `terrain/waved/`, with point catalogs in `terrain/catalog.json`. Local coordinates are centered at the origin and typically span about `[-1, 1]`. Runtime loads the original outline, then applies the wave function so uploaded blocks can use the same pipeline.
