import json, sys
p = sys.argv[1]
with open(p, 'r', encoding='utf-8-sig') as f:
    data = json.load(f)
with open(p, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent="\t", ensure_ascii=False)
print('Formatted with tabs:', p)
