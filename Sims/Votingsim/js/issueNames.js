const ISSUE_NAME_GROUPS = {
  1: ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape', 'Honeydew', 'Kiwi', 'Lemon', 'Mango', 'Nectarine', 'Orange', 'Papaya', 'Quince', 'Raspberry', 'Strawberry', 'Tangerine', 'Ugli', 'Vanilla'],
  2: ['Artichoke', 'Beet', 'Carrot', 'Daikon', 'Eggplant', 'Fennel', 'Garlic', 'Horseradish', 'Kale', 'Leek', 'Mushroom', 'Okra', 'Parsnip', 'Radish', 'Scallion', 'Turnip', 'UplandCress', 'Wasabi', 'Yam', 'Zucchini'],
  3: ['Brie', 'Cheddar', 'Comte', 'Danzón', 'Edam', 'Feta', 'Gouda', 'Halloumi', 'Idiazabal', 'Jarlsberg', 'Kashkaval', 'Limburger', 'Mascarpone', 'Nabulsi', 'Oka', 'Paneer', 'QuesoBlanco', 'Rocquefort', 'Sbrinz', 'Taleggio'],
  4: ['BakedZiti', 'ChickenParmesan', 'EggplantParmigiana', 'FettuccineAlfredo', 'GnocchiPuttanesca', 'Lasagna', 'LinguineVongole', 'MushroomRisotto', 'OrecchietteAllaRomana', 'PappardelleAlCinghiale', 'PenneArrabbiata', 'RavioliAlForno', 'SpaghettiCarbonara', 'TagliatelleAlfredo', 'TortelliniInBrodo', 'VealSaltimbocca', 'VesuvioPasta', 'WildMushroomPappardelle', 'ZitiAlForno', 'Cannelloni']
};

function createNamePool(modeCount) {
  return [...(ISSUE_NAME_GROUPS[modeCount] ?? [])];
}

export function createIssueNameGenerator() {
  const pools = Object.fromEntries(Object.entries(ISSUE_NAME_GROUPS).map(([modeCount, names]) => [modeCount, [...names]]));
  const usedNames = new Map();

  return {
    getName(modeCount, index) {
      const pool = pools[modeCount] ?? [];
      if (!pool.length) {
        return `Issue ${index}`;
      }

      const usedForGroup = usedNames.get(modeCount) ?? [];
      if (usedForGroup.length >= pool.length) {
        return `Issue ${index}`;
      }

      const available = pool.filter((name) => !usedForGroup.includes(name));
      if (!available.length) {
        return `Issue ${index}`;
      }

      const selected = available[Math.floor(Math.random() * available.length)];
      usedNames.set(modeCount, [...usedForGroup, selected]);
      return selected;
    }
  };
}
