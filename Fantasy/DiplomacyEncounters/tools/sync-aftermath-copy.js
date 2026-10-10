#!/usr/bin/env node
/* Regenerate js/aftermath-copy.js from data/aftermath-copy.json */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const jsonPath = path.join(root, "data", "aftermath-copy.json");
const outPath = path.join(root, "js", "aftermath-copy.js");
const json = fs.readFileSync(jsonPath, "utf8").trim();
JSON.parse(json); /* validate */
fs.writeFileSync(outPath, "var DE = DE || {};\nDE.setAftermathCopy(" + json + ");\n");
console.log("Wrote", path.relative(root, outPath));
