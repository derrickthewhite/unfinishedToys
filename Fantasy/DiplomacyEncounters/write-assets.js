const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "assets");

function svg(inner, vb) {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb || "0 0 100 100"}" fill="none">${inner}</svg>\n`;
}

const stroke = `stroke="#e8e4dc" stroke-width="6" stroke-linecap="square" stroke-linejoin="miter"`;
const fill = `fill="#e8e4dc"`;

const symbols = {
	"symbol-01": `<path ${stroke} d="M22 18 L50 42 L78 18 M50 42 V62 L28 88 M50 62 L72 88"/>`,
	"symbol-02": `<path ${stroke} d="M50 12 L88 50 L50 88 L12 50 Z"/><path ${fill} d="M50 38 L62 50 L50 62 L38 50 Z"/>`,
	"symbol-03": `<path ${stroke} d="M50 14 C32 14 32 38 50 38 C68 38 68 14 50 14 M50 38 C32 38 32 86 50 86 C68 86 68 38 50 38"/><path ${stroke} d="M32 50 H68"/>`,
	"symbol-04": `<path ${stroke} d="M22 28 H52 L28 50 H70 L42 72 H78"/><path ${stroke} d="M18 44 H82 M18 58 H82"/>`,
	"symbol-05": `<circle cx="50" cy="38" r="22" ${stroke}/><path ${stroke} stroke-width="10" d="M18 78 H82"/>`,
	"symbol-06": `<path ${stroke} d="M30 20 L70 80 M70 20 L30 80"/><path ${stroke} d="M22 72 H38 M62 72 H78"/>`,
	"symbol-07": `<path ${stroke} d="M78 28 H32 V78 H68 V48 H48"/>`,
	"symbol-08": `<path ${stroke} d="M18 22 H82 M26 22 V78 M42 22 V78 M58 22 V78 M74 22 V78"/>`,
	"symbol-09": `<path ${stroke} d="M12 50 L50 22 L88 50 L50 78 Z"/><circle cx="50" cy="50" r="10" ${fill}/>`,
	"symbol-10": `<path ${stroke} d="M22 78 L50 48 L78 78 Z"/><path ${stroke} d="M32 40 H68 M42 28 L50 18 L58 28"/>`,
	"symbol-11": `<path ${stroke} d="M24 78 V28 H76 V78"/><path ${stroke} d="M38 78 V42 H62 V78"/>`,
	"symbol-12": `<path ${fill} d="M30 78 V48 H38 V32 H46 V48 H54 V28 H62 V48 H70 V56 H82 V70 H70 V78 Z"/>`
};

const writeSymbols = process.argv.indexOf("--symbols") >= 0;
if (writeSymbols) {
	Object.keys(symbols).forEach(function (k) {
		fs.writeFileSync(path.join(root, "symbols", k + ".svg"), svg(symbols[k]));
	});
}

function icon(d) {
	return svg(`<g ${stroke}>${d}</g>`);
}

const actions = {
	attack: `<path d="M24 76 L70 22 M58 22 H70 V34"/><path d="M28 52 H48"/>`,
	intimidate: `<path d="M50 18 V42"/><circle cx="50" cy="58" r="16"/><path d="M34 84 H66"/>`,
	gift: `<path d="M22 44 H78 V78 H22 Z"/><path d="M50 44 V78 M22 44 L50 28 L78 44"/>`,
	greet: `<path d="M34 78 V46"/><path d="M34 50 C34 28 70 28 70 50"/>`,
	seize: `<path d="M28 70 L50 30 L72 70"/><path d="M40 58 H60"/>`,
	capture: `<circle cx="50" cy="42" r="14"/><path d="M28 82 C28 64 72 64 72 82"/>`,
	retreat: `<path d="M74 50 H28 M40 34 L24 50 L40 66"/>`,
	run: `<path d="M22 50 H78 M62 32 L78 50 L62 68"/>`,
	trade: `<path d="M30 40 H70 M50 28 V52"/><path d="M24 68 H76"/>`
};

Object.keys(actions).forEach(function (k) {
	fs.writeFileSync(path.join(root, "actions", k + ".svg"), icon(actions[k]));
});

const units = {
	infantry: `<circle cx="50" cy="28" r="12"/><path d="M50 42 V70 M34 52 H66 M38 88 L50 70 L62 88"/><path d="M66 36 L82 24"/>`,
	civilian: `<circle cx="50" cy="30" r="12"/><path d="M50 44 V72 M36 88 L50 72 L64 88"/>`,
	illusionist: `<circle cx="50" cy="30" r="10"/><path d="M50 42 V70 M34 86 L50 70 L66 86"/><circle cx="50" cy="22" r="18" stroke-dasharray="6 6"/>`,
	fireMage: `<circle cx="50" cy="32" r="10"/><path d="M50 44 V68 M36 86 L50 68 L64 86"/><path d="M50 18 C40 28 44 40 50 40 C56 40 60 28 50 18"/>`,
	healer: `<circle cx="50" cy="30" r="10"/><path d="M50 42 V70"/><path d="M38 22 H62 M50 12 V32"/>`,
	mindMage: `<circle cx="50" cy="30" r="10"/><path d="M32 24 H68"/><path d="M50 42 V70 M34 86 L50 70 L66 86"/>`,
	earthMage: `<circle cx="50" cy="28" r="10"/><path d="M22 78 L50 48 L78 78 Z"/>`,
	necromancer: `<circle cx="50" cy="28" r="10"/><path d="M50 40 V72"/><path d="M32 52 C32 84 68 84 68 52"/>`,
	skeleton: `<circle cx="50" cy="26" r="10"/><path d="M50 38 V70 M34 48 H66 M36 86 L50 70 L64 86"/><path d="M42 24 H46 M54 24 H58"/>`,
	ghost: `<path d="M32 78 L32 40 C32 20 68 20 68 40 V78 L58 68 L50 78 L42 68 Z"/>`,
	dragon: `<path d="M18 62 L40 48 L70 42 L86 28 M70 42 L78 70 M40 48 L36 78 M52 44 L48 22 L62 28"/>`,
	spider: `<circle cx="50" cy="50" r="12"/><path d="M20 28 L40 44 M20 50 H38 M20 72 L40 56 M80 28 L60 44 M80 50 H62 M80 72 L60 56"/>`,
	webWorm: `<path d="M18 50 C28 28 40 28 50 50 C60 72 72 72 82 50"/><path d="M34 34 H66 M40 66 H70"/>`,
	elf: `<circle cx="50" cy="30" r="10"/><path d="M28 22 L42 28 M72 22 L58 28"/><path d="M50 42 V70 M34 86 L50 70 L66 86"/>`,
	skitter: `<circle cx="36" cy="48" r="8"/><circle cx="62" cy="48" r="8"/><path d="M24 30 L36 42 M76 30 L62 42 M22 70 L36 54 M78 70 L62 54"/>`
};

Object.keys(units).forEach(function (k) {
	fs.writeFileSync(path.join(root, "units", k + ".svg"), icon(units[k]));
});

console.log("wrote placeholders");
