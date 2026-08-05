export function createId(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function matchesFilter(text, filter) {
  if (!filter) {
    return true;
  }

  return normalizeText(text).includes(normalizeText(filter));
}

export function toNumberOrFallback(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

export function shuffle(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function pickWeightedIndex(weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = Math.random() * total;

  for (let index = 0; index < weights.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) {
      return index;
    }
  }

  return weights.length - 1;
}
