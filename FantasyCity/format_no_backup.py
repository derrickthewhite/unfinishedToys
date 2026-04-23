#!/usr/bin/env python3
import json
import sys
from pathlib import Path

def format_in_place(path):
    p = Path(path)
    if not p.exists():
        print(f"File not found: {p}")
        return 2
    with p.open('r', encoding='utf-8') as f:
        data = json.load(f)
    with p.open('w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Formatted {p}")
    return 0

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: format_no_backup.py <path>')
        sys.exit(1)
    sys.exit(format_in_place(sys.argv[1]))
