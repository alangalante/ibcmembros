import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { datePartsInSaoPaulo } from "@/lib/date";
import { activeUserIds, sendPush } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isoDate, monthDay } = datePartsInSaoPaulo();
  const [birthdays, events, everyone] = await Promise.all([
    adminDb.collection("users").where("active", "==", true).where("birthMonthDay", "==", monthDay).get(),
    adminDb.collection("events").where("eventDate", "==", isoDate).get(),
    activeUserIds(),
  ]);

  const birthdayResults = birthdays.empty ? [] : [await sendPush({
      userIds: everyone,
      title: birthdays.size === 1 ? `Hoje é aniversário de ${birthdays.docs[0].get("name")} 🎉` : `${birthdays.size} aniversariantes hoje 🎉`,
      body: birthdays.size === 1 ? "Toque para ver e enviar uma mensagem." : "Toque para ver quem está celebrando.",
      link: `${request.nextUrl.origin}/birthdays`,
      data: { kind: "birthday", date: isoDate },
    })];

  const eventResults = [];
  for (const event of events.docs) {
    const data = event.data();
    const recipients = data.scope === "global" ? everyone : await activeUserIds(data.groupIds ?? []);
    eventResults.push(await sendPush({
      userIds: recipients,
      title: String(data.title),
      body: String(data.description || "Evento de hoje"),
      link: `${request.nextUrl.origin}/events/${event.id}`,
      data: { kind: "event", eventId: event.id },
    }));
  }

  return NextResponse.json({ date: isoDate, birthdays: birthdays.size, events: events.size, birthdayResults, eventResults });
}
