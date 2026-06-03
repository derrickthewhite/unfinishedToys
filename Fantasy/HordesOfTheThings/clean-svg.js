#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const NUMERIC_ATTRS = new Set([
    'cx',
    'cy',
    'd',
    'fill-opacity',
    'font-size',
    'height',
    'opacity',
    'points',
    'r',
    'rx',
    'ry',
    'stroke-dashoffset',
    'stroke-miterlimit',
    'stroke-opacity',
    'stroke-width',
    'transform',
    'viewBox',
    'width',
    'x',
    'x1',
    'x2',
    'y',
    'y1',
    'y2'
]);

const DROPPED_STYLE_PROPS = new Set([
    '-inkscape-font-specification',
    'enable-background',
    'font-variant-ligatures',
    'font-variant-position',
    'font-variant-caps',
    'font-variant-numeric',
    'font-variant-alternates',
    'font-variant-east-asian',
    'paint-order',
    'white-space'
]);

function roundNumericTokens(value, precision) {
    return value.replace(/-?(?:\d+\.\d+|\d+|\.\d+)(?:e[+-]?\d+)?/gi, (match) => {
        const rounded = Number(Number(match).toFixed(precision));
        if (!Number.isFinite(rounded)) {
            return match;
        }
        return Object.is(rounded, -0) ? '0' : String(rounded);
    });
}

function collapseStyleAttributes(svg) {
    return svg.replace(/\sstyle="([^"]*)"/gi, (match, styleValue) => {
        const attributes = styleValue
            .split(';')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => {
                const separator = entry.indexOf(':');
                if (separator === -1) {
                    return null;
                }
                const name = entry.slice(0, separator).trim();
                const value = entry.slice(separator + 1).trim();
                if (!name || !value || name.startsWith('inkscape:') || name.startsWith('sodipodi:') || DROPPED_STYLE_PROPS.has(name)) {
                    return null;
                }
                return ` ${name}="${value}"`;
            })
            .filter(Boolean)
            .join('');
        return attributes;
    });
}

function roundNumericAttributes(svg, precision) {
    return svg.replace(/\s([\w:-]+)="([^"]*)"/g, (match, name, value) => {
        if (!NUMERIC_ATTRS.has(name)) {
            return match;
        }
        return ` ${name}="${roundNumericTokens(value, precision)}"`;
    });
}

function getReferencedIds(svg) {
    const references = new Set();
    const patterns = [
        /url\(#([^\)]+)\)/g,
        /(?:href|xlink:href)="#([^"]+)"/g,
        /aria-labelledby="([^"]+)"/g,
        /aria-describedby="([^"]+)"/g
    ];
    patterns.forEach((pattern) => {
        let match = pattern.exec(svg);
        while (match) {
            match[1].split(/\s+/).filter(Boolean).forEach((id) => references.add(id));
            match = pattern.exec(svg);
        }
    });
    return references;
}

function stripUnusedIds(svg) {
    const referencedIds = getReferencedIds(svg);
    return svg.replace(/\sid="([^"]+)"/g, (match, id) => (referencedIds.has(id) ? match : ''));
}

function stripEditorMarkup(svg) {
    return svg
        .replace(/<\?xml[\s\S]*?\?>/gi, '')
        .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
        .replace(/<sodipodi:namedview[\s\S]*?<\/sodipodi:namedview>/gi, '')
        .replace(/<sodipodi:namedview[^>]*\/>/gi, '')
        .replace(/<inkscape:[^>]*>[\s\S]*?<\/inkscape:[^>]*>/gi, '')
        .replace(/<inkscape:[^>]*\/>/gi, '')
        .replace(/\s(?:inkscape|sodipodi):[\w-]+="[^"]*"/g, '')
        .replace(/\sxmlns:(?:inkscape|sodipodi)="[^"]*"/g, '')
        .replace(/\sxml:space="preserve"/g, '');
}

function removeEmptyContainers(svg) {
    let current = svg
        .replace(/<defs>\s*<\/defs>/gi, '')
        .replace(/<g>\s*<\/g>/gi, '');
    let previous = null;
    while (current !== previous) {
        previous = current;
        current = current.replace(/<g>\s*([\s\S]*?)\s*<\/g>/gi, '$1');
    }
    return current;
}

function minifyMarkup(svg) {
    return svg
        .replace(/>\s+</g, '><')
        .replace(/\s{2,}/g, ' ')
        .trim() + '\n';
}

function cleanSvgContent(svg, options) {
    const precision = Number.isInteger(options?.precision) ? options.precision : 2;
    let cleaned = svg;
    cleaned = stripEditorMarkup(cleaned);
    cleaned = collapseStyleAttributes(cleaned);
    cleaned = roundNumericAttributes(cleaned, precision);
    cleaned = stripUnusedIds(cleaned);
    cleaned = removeEmptyContainers(cleaned);
    cleaned = minifyMarkup(cleaned);
    return cleaned;
}

function deriveOutputPath(inputPath) {
    const parsed = path.parse(inputPath);
    return path.join(parsed.dir, `${parsed.name}.clean${parsed.ext || '.svg'}`);
}

function cleanSvgFile(inputPath, outputPath, options) {
    const source = fs.readFileSync(inputPath, 'utf8');
    const cleaned = cleanSvgContent(source, options);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, cleaned, 'utf8');
    return cleaned;
}

function printUsage() {
    console.log('Usage: node Fantasy/HordesOfTheThings/clean-svg.js <input.svg> [output.svg] [--precision 2] [--in-place]');
}

function runCli(argv) {
    const { values, positionals } = parseArgs({
        args: argv.slice(2),
        allowPositionals: true,
        options: {
            help: { type: 'boolean', short: 'h' },
            'in-place': { type: 'boolean', short: 'i' },
            precision: { type: 'string', short: 'p' }
        }
    });

    if (values.help || positionals.length === 0) {
        printUsage();
        return values.help ? 0 : 1;
    }

    const inputPath = path.resolve(positionals[0]);
    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        return 1;
    }

    const precision = Number.parseInt(values.precision || '2', 10);
    if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
        console.error('Precision must be an integer between 0 and 6.');
        return 1;
    }

    const outputPath = values['in-place']
        ? inputPath
        : path.resolve(positionals[1] || deriveOutputPath(inputPath));

    cleanSvgFile(inputPath, outputPath, { precision });
    console.log(`Cleaned SVG written to ${outputPath}`);
    return 0;
}

if (require.main === module) {
    process.exitCode = runCli(process.argv);
}

module.exports = {
    cleanSvgContent,
    cleanSvgFile,
    deriveOutputPath,
    roundNumericTokens
};
