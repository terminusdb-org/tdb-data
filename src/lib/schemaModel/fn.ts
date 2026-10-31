export function replaceNumeralsWithSubscriptNumerals(str: string): string {
  return str.replace(/[0-9]/g, function (match) {
    return String.fromCodePoint(parseInt(match, 10) + 0x2080);
  });
}

export function replaceSubscriptNumeralsWithNumerals(str: string): string {
  return str.replace(/[⁰-₟]/g, function (match) {
    const codePoint = match.codePointAt(0);
    return (codePoint && String(codePoint - 0x2080)) || match;
  });
}

export function isStringsArray(value: unknown): value is Array<string> {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
