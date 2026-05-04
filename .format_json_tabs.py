import json
p = r"c:\Users\derri\Desktop\SquirrelBackup\Code\unfinishedToys\FantasyCity\FantasyCityGeneratorExternal\Building Template.json"
with open(p, 'r', encoding='utf-8-sig') as f:
    data = json.load(f)
with open(p, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent="\t", ensure_ascii=False)
print('Formatted with tabs:', p)
