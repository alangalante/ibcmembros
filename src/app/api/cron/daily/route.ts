import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { datePartsInSaoPaulo } from "@/lib/date";
import { activeUserIds, sendPush } from "@/lib/notifications";
import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { recordChange } from "@/lib/server/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function removeExpiredAgendaPdfs(today: string) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const snapshot = await adminDb.collection("events").where("eventDate", "<", monthStart).get();
  const candidates = snapshot.docs.filter((doc) => Boolean(doc.get("pdfPublicId")));
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return { removed: 0, skipped: candidates.length };
  let removed = 0;
  for (const doc of candidates) {
    const publicId = String(doc.get("pdfPublicId"));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
    const form = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: apiKey, signature });
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/destroy`, { method: "POST", body: form });
    if (!response.ok) continue;
    await adminDb.runTransaction(async (transaction) => {
      transaction.update(doc.ref, { pdfUrl: null, pdfPublicId: null, updatedAt: FieldValue.serverTimestamp() });
      recordChange(transaction, { entity: "event", entityId: doc.id, operation: "update", scope: "global", actorId: "cron" });
      if (doc.get("scope") === "groups") for (const groupId of doc.get("groupIds") || []) recordChange(transaction, { entity: "event", entityId: doc.id, operation: "update", scope: "group", groupId, actorId: "cron" });
    });
    removed += 1;
  }
  return { removed, skipped: candidates.length - removed };
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
      body: String(data.description || "Agenda de hoje"),
      link: `${request.nextUrl.origin}/events/${event.id}`,
      data: { kind: "event", eventId: event.id },
    }));
  }

  const pdfCleanup = await removeExpiredAgendaPdfs(isoDate);
  return NextResponse.json({ date: isoDate, birthdays: birthdays.size, agendas: events.size, birthdayResults, eventResults, pdfCleanup });
}
