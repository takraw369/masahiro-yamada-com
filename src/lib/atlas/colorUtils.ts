export function getDifficultyColor(difficulty: number = 0.5): string {
  // 青(易) → 橙 → 赤(難)
  if (difficulty < 0.33) return '#4a9eca';
  if (difficulty < 0.66) return '#d4a943';
  return '#e05c2a';
}

export function getGlowStyle(uniqueness: number = 0.5): string {
  if (uniqueness > 0.9) return `0 0 ${Math.round(uniqueness * 20)}px rgba(212, 169, 67, 0.6)`;
  return 'none';
}
