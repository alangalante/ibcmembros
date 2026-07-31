const TIME_ZONE = "America/Sao_Paulo";

export function datePartsInSaoPaulo(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return { isoDate: `${year}-${month}-${day}`, monthDay: `${month}-${day}` };
}
