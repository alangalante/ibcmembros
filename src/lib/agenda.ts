export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export function isoFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function weekBounds(referenceIso = todayIso()) {
  const reference = new Date(`${referenceIso}T12:00:00`);
  const start = new Date(reference);
  start.setDate(reference.getDate() - reference.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: isoFromDate(start), end: isoFromDate(end) };
}

export function birthdayDate(monthDay: string, year: number) {
  return `${year}-${monthDay}`;
}

export function formatAgendaDate(iso: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", options || { weekday: "long", day: "2-digit", month: "long" })
    .format(new Date(`${iso}T12:00:00`));
}
