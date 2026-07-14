export interface PerfectMatch {
  readonly set_id: string;
  readonly target_id: string;
}

export function parsePerfectMatchCSV(text: string): PerfectMatch[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((c) => c.trim());
  const setIdx = header.indexOf("set_id");
  const targetIdx = header.indexOf("target_id");
  if (setIdx === -1 || targetIdx === -1) return [];
  const matches: PerfectMatch[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols[setIdx] && cols[targetIdx]) {
      matches.push({ set_id: cols[setIdx], target_id: cols[targetIdx] });
    }
  }
  return matches;
}
