import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { eventSchema } from "@/lib/validation";
import { ApiError, authenticate, errorResponse, requireLeaderOrAdmin } from "@/lib/server/auth";
import { recordAudit, recordChange } from "@/lib/server/sync";

export const runtime = "nodejs";

async function leaderOwnsGroups(uid: string, groupIds: string[]) {
  if (!groupIds.length) return false;
  const groups = await Promise.all(groupIds.map((id) => adminDb.collection("groups").doc(id).get()));
  return groups.every((group) => group.exists && ((group.get("leaderIds") ?? []) as string[]).includes(uid));
}

export async function POST(request: NextRequest) {
  try {
    const actor = await authenticate(request);
    requireLeaderOrAdmin(actor);

    const body = await request.json();
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados da agenda inválidos");
    }

    const { title, description, startsAtIso, eventDate, scope, groupIds, pdfUrl, pdfPublicId } = parsed.data;
    if (scope === "groups" && !groupIds.length) throw new ApiError(400, "Selecione pelo menos um grupo");

    // Líder só pode criar evento para grupo que ele lidera
    if (actor.role === "leader") {
      if (scope === "global") throw new ApiError(403, "Líderes não podem criar agendas globais");
      const isLeaderOfAll = await leaderOwnsGroups(actor.uid, groupIds);
      if (!isLeaderOfAll) throw new ApiError(403, "Líder só pode criar agendas para seus próprios grupos");
    }

    const eventRef = adminDb.collection("events").doc();
    const eventId = eventRef.id;

    await adminDb.runTransaction(async (transaction) => {
      transaction.set(eventRef, {
        title,
        description,
        startsAt: Timestamp.fromDate(new Date(startsAtIso)),
        eventDate,
        timezone: "America/Sao_Paulo",
        scope,
        groupIds: scope === "global" ? [] : groupIds,
        pdfUrl,
        pdfPublicId,
        createdBy: actor.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      recordChange(transaction, { entity: "event", entityId: eventId, operation: "create", scope: "global", actorId: actor.uid });
      if (scope === "groups") {
        for (const groupId of groupIds) {
          recordChange(transaction, { entity: "event", entityId: eventId, operation: "create", scope: "group", groupId, actorId: actor.uid });
        }
      }

      recordAudit(transaction, actor.uid, "event.create", eventId);
    });

    return NextResponse.json({ ok: true, id: eventId }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
