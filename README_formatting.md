JSON formatting tools for this repo

Overview
- Provides a small Python formatter that writes JSON with one tab per nesting level.
- Adds a Node CLI wrapper so JavaScript-based workflows can call the Python formatter easily.

Files
- `.format_json_tabs_arg.py` — Python formatter (reads with `utf-8-sig`, writes `utf-8`, uses `indent="\t"`).
- `tools/format-json.js` — Node CLI wrapper that calls the Python script.
- `package.json` — registers the CLI as `format-json`.

Quick usage
- Run directly with Node:

  node tools/format-json.js "path/to/file.json"

- Make a backup before overwriting:

  node tools/format-json.js "path/to/file.json" --backup

- If you `npm link` in this folder, you can run:

  format-json "path/to/file.json"

Notes
- The Node wrapper attempts to call `python` first, then `py` if `python` isn't available.
- For batch formatting, use PowerShell or a shell loop and call the CLI for each file.
- If JSON parsing fails, the formatter will report an error and will not overwrite the file.
