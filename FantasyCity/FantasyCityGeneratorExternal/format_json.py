#!/usr/bin/env python3
import json
import shutil
import sys
from pathlib import Path

def format_json_file(path_str):
    p = Path(path_str)
    if not p.exists():
        print(f"File not found: {p}")
        return 2
    bak = p.with_suffix(p.suffix + ".bak")
    shutil.copyfile(p, bak)
    with p.open('r', encoding='utf-8') as f:
        data = json.load(f)
    with p.open('w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Formatted {p} -> backup saved as {bak}")
    return 0

if __name__ == '__main__':
    if len(sys.argv) > 1:
        sys.exit(format_json_file(sys.argv[1]))
    # default target (existing file used before)
    default = Path(__file__).with_name('Generic Fantasy Races.json')
    sys.exit(format_json_file(str(default)))
