export function distanceToPercent(d: number): number {
  return Math.round((1.0 - d * 2) * 100);
}

export function distanceColor(d: number): string {
  if (d <= 0.5) {
    const t = d / 0.5;
    const v = Math.round(228 - t * 100);
    return `rgb(${v},${v},${v})`;
  }
  const t = (d - 0.5) / 0.5;
  const r = 128 + Math.round(t * 127);
  const g = Math.round(128 - t * 100);
  const b = Math.round(128 - t * 100);
  return `rgb(${r},${g},${b})`;
}

export function similarityLabel(d: number): string {
  const pct = distanceToPercent(d);
  if (pct >= 80) return "Very similar";
  if (pct >= 60) return "Moderately similar";
  if (pct >= 40) return "Somewhat similar";
  return "Dissimilar";
}
