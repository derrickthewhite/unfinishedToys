export function generateModeColors(modeCount, issueIndex) {
  const count = Math.max(1, modeCount);
  const baseHue = (issueIndex * 37) % 360;
  const colors = [];

  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0.5 : index / (count - 1);
    const lightness = 82 - ratio * 52;
    colors.push(`hsl(${baseHue}, 65%, ${lightness}%)`);
  }

  return colors;
}
