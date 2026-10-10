#!/usr/bin/env node
/* Regenerate js/gossip-copy.js from data/gossip-tips.json and data/gossip-color.json */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const tips = JSON.parse(fs.readFileSync(path.join(root, "data", "gossip-tips.json"), "utf8"));
const color = JSON.parse(fs.readFileSync(path.join(root, "data", "gossip-color.json"), "utf8"));
if (!Array.isArray(tips) || !Array.isArray(color)) {
	throw new Error("gossip tips and color must be JSON arrays of strings");
}
const out = [
	"var DE = DE || {};",
	"DE.GOSSIP_TIPS = " + JSON.stringify(tips, null, "\t") + ";",
	"DE.GOSSIP_COLOR = " + JSON.stringify(color, null, "\t") + ";",
	""
].join("\n");
const outPath = path.join(root, "js", "gossip-copy.js");
fs.writeFileSync(outPath, out);
console.log("Wrote", path.relative(root, outPath));
