export function compareGroupNames(a: string, b: string) {
  const numberA = a.match(/^grupo\s+(\d+)$/i)?.[1];
  const numberB = b.match(/^grupo\s+(\d+)$/i)?.[1];
  if (numberA && numberB) return Number(numberA) - Number(numberB);
  if (numberA) return -1;
  if (numberB) return 1;
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}
