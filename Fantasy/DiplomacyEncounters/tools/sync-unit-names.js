#!/usr/bin/env node
/* Regenerate js/unit-names.js from data/unit-names.json */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const jsonPath = path.join(root, "data", "unit-names.json");
const outPath = path.join(root, "js", "unit-names.js");
const json = fs.readFileSync(jsonPath, "utf8").trim();
JSON.parse(json);
fs.writeFileSync(outPath, "var DE = DE || {};\nDE.UNIT_NAMES = " + json + ";\n");
console.log("Wrote", path.relative(root, outPath));
