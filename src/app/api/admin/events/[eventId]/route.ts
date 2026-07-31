import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { eventPatchSchema } from "@/lib/validation";
import { ApiError, authenticate, errorResponse, requireLeaderOrAdmin } from "@/lib/server/auth";
import { recordAudit, recordChange } from "@/lib/server/sync";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  try {
    const actor = await authenticate(request);
    requireLeaderOrAdmin(actor);
    const { eventId } = await context.params;

    const body = await request.json();
    const parsed = eventPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos");
    }

    await adminDb.runTransaction(async (transaction) => {
      const eventRef = adminDb.collection("events").doc(eventId);
      const eventDoc = await transaction.get(eventRef);
      if (!eventDoc.exists) throw new ApiError(404, "Evento não encontrado");

      const current = eventDoc.data()!;
      if (actor.role === "leader" && current.createdBy !== actor.uid) {
        throw new ApiError(403, "Líder só pode editar seus próprios eventos");
      }

      const updateData: Record<string, unknown> = {
        ...parsed.data,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (parsed.data.startsAtIso) {
        updateData.startsAt = Timestamp.fromDate(new Date(parsed.data.startsAtIso));
        delete updateData.startsAtIso;
      }

      transaction.update(eventRef, updateData);

      const scope = current.scope;
      if (scope === "global") {
        recordChange(transaction, { entity: "event", entityId: eventId, operation: "update", scope: "global", actorId: actor.uid });
      } else {
        const gIds: string[] = current.groupIds ?? [];
        for (const groupId of gIds) {
          recordChange(transaction, { entity: "event", entityId: eventId, operation: "update", scope: "group", groupId, actorId: actor.uid });
        }
      }

      recordAudit(transaction, actor.uid, "event.update", eventId);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  try {
    const actor = await authenticate(request);
    requireLeaderOrAdmin(actor);
    const { eventId } = await context.params;

    await adminDb.runTransaction(async (transaction) => {
      const eventRef = adminDb.collection("events").doc(eventId);
      const eventDoc = await transaction.get(eventRef);
      if (!eventDoc.exists) throw new ApiError(404, "Evento não encontrado");

      const current = eventDoc.data()!;
      if (actor.role === "leader" && current.createdBy !== actor.uid) {
        throw new ApiError(403, "Líder só pode excluir seus próprios eventos");
      }

      transaction.delete(eventRef);

      const scope = current.scope;
      if (scope === "global") {
        recordChange(transaction, { entity: "event", entityId: eventId, operation: "delete", scope: "global", actorId: actor.uid });
      } else {
        const gIds: string[] = current.groupIds ?? [];
        for (const groupId of gIds) {
          recordChange(transaction, { entity: "event", entityId: eventId, operation: "delete", scope: "group", groupId, actorId: actor.uid });
        }
      }

      recordAudit(transaction, actor.uid, "event.delete", eventId);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
