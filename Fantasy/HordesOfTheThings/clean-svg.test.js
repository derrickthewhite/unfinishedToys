const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { cleanSvgContent, deriveOutputPath } = require('./clean-svg.js');

test('cleanSvgContent removes Inkscape metadata and rounds numeric attributes', () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" width="40.0000" height="20.0000" viewBox="0 0 40.0000 20.0000">
  <!-- editor comment -->
  <metadata>ignore me</metadata>
  <sodipodi:namedview id="namedview1" inkscape:pageopacity="0"/>
  <g id="layer1" style="fill:#123456;stroke:#654321;stroke-width:1.50000;-inkscape-font-specification:Sans">
    <clipPath id="clip-a"><rect x="0.0000" y="0.0000" width="10.0000" height="10.0000"/></clipPath>
    <path id="drop-id" inkscape:label="Layer" d="M 1.23456 2.34567 L 9.87654 8.76543"/>
  </g>
  <path clip-path="url(#clip-a)" style="fill:none;stroke:#000000;stroke-width:2.0000" d="M 3.33333 4.44444 L 5.55555 6.66666"/>
</svg>`;

    const cleaned = cleanSvgContent(source, { precision: 2 });

    assert.equal(cleaned.includes('inkscape:'), false);
    assert.equal(cleaned.includes('sodipodi:'), false);
    assert.equal(cleaned.includes('<metadata'), false);
    assert.equal(cleaned.includes('<!--'), false);
    assert.equal(cleaned.includes('id="drop-id"'), false);
    assert.equal(cleaned.includes('id="clip-a"'), true);
    assert.equal(cleaned.includes('stroke-width="1.5"'), true);
    assert.equal(cleaned.includes('viewBox="0 0 40 20"'), true);
    assert.equal(cleaned.includes('d="M 3.33 4.44 L 5.56 6.67"'), true);
});

test('deriveOutputPath appends .clean before the extension', () => {
  assert.equal(deriveOutputPath(path.join('C:', 'tmp', 'hero.svg')), path.join('C:', 'tmp', 'hero.clean.svg'));
});
