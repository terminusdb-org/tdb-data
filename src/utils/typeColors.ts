export interface TypeColor {
  readonly hex: string;
  readonly hsl: string;
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

export function generateTypeColors(types: ReadonlyArray<string>): Readonly<Record<string, TypeColor>> {
  const goldenRatio = 0.618033988749895;
  const result: Record<string, TypeColor> = {};
  let h = 0.1;
  for (const type of types) {
    const hue = Math.round(h * 360);
    const color: TypeColor = {
      hex: hslToHex(hue, 65, 55),
      hsl: `hsl(${hue}, 65%, 55%)`,
    };
    result[type] = color;
    h = (h + goldenRatio) % 1;
  }
  return result;
}
