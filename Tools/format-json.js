#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: format-json <file.json> [--backup|-b]');
  process.exit(2);
}
const file = path.resolve(args[0]);
const makeBackup = args.includes('--backup') || args.includes('-b');
if (!fs.existsSync(file)) {
  console.error('File not found:', file);
  process.exit(3);
}
if (makeBackup) {
  const bak = file + '.bak';
  try {
    fs.copyFileSync(file, bak);
    console.error('Backup created:', bak);
  } catch (e) {
    console.error('Failed to create backup:', e.message);
    process.exit(4);
  }
}

const pyScript = path.resolve(__dirname, '..', '.format_json_tabs_arg.py');
if (!fs.existsSync(pyScript)) {
  console.error('Python formatter not found at', pyScript);
  process.exit(5);
}

function tryRun(pythonCmd) {
  try {
    const r = spawnSync(pythonCmd, [pyScript, file], { stdio: 'inherit' });
    return r;
  } catch (e) {
    return { error: e };
  }
}

let result = tryRun('python');
if ((result.error && result.error.code === 'ENOENT') || (result.status !== undefined && result.status !== 0)) {
  result = tryRun('py');
}

if (result.error) {
  console.error('Failed to invoke Python:', result.error.message);
  process.exit(6);
}
if (result.status !== 0) {
  console.error('Formatter exited with code', result.status);
  process.exit(result.status || 1);
}

process.exit(0);
