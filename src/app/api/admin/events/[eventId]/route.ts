import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { eventPatchSchema } from "@/lib/validation";
import { ApiError, authenticate, errorResponse, requireLeaderOrAdmin } from "@/lib/server/auth";
import { recordAudit, recordChange } from "@/lib/server/sync";

export const runtime = "nodejs";

async function leaderOwnsGroups(uid: string, groupIds: string[]) {
  if (!groupIds.length) return false;
  const groups = await Promise.all(groupIds.map((id) => adminDb.collection("groups").doc(id).get()));
  return groups.every((group) => group.exists && ((group.get("leaderIds") ?? []) as string[]).includes(uid));
}

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

    const eventRef = adminDb.collection("events").doc(eventId);
    const existing = await eventRef.get();
    if (!existing.exists) throw new ApiError(404, "Agenda não encontrada");
    const existingData = existing.data()!;
    const targetScope = parsed.data.scope ?? existingData.scope;
    const targetGroupIds = (parsed.data.groupIds ?? existingData.groupIds ?? []) as string[];
    if (targetScope === "groups" && !targetGroupIds.length) throw new ApiError(400, "Selecione pelo menos um grupo");
    if (actor.role === "leader") {
      const currentGroupIds = (existingData.groupIds ?? []) as string[];
      if (existingData.scope === "global" || targetScope === "global" || !(await leaderOwnsGroups(actor.uid, currentGroupIds)) || !(await leaderOwnsGroups(actor.uid, targetGroupIds))) {
        throw new ApiError(403, "Líder só pode editar agendas dos grupos que lidera");
      }
    }

    await adminDb.runTransaction(async (transaction) => {
      const eventDoc = await transaction.get(eventRef);
      if (!eventDoc.exists) throw new ApiError(404, "Agenda não encontrada");
      const current = eventDoc.data()!;

      const updateData: Record<string, unknown> = {
        ...parsed.data,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (parsed.data.startsAtIso) {
        updateData.startsAt = Timestamp.fromDate(new Date(parsed.data.startsAtIso));
        delete updateData.startsAtIso;
      }

      transaction.update(eventRef, updateData);

      recordChange(transaction, { entity: "event", entityId: eventId, operation: "update", scope: "global", actorId: actor.uid });
      if (current.scope === "groups") {
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

    const eventRef = adminDb.collection("events").doc(eventId);
    const existing = await eventRef.get();
    if (!existing.exists) throw new ApiError(404, "Agenda não encontrada");
    const existingData = existing.data()!;
    if (actor.role === "leader" && (existingData.scope === "global" || !(await leaderOwnsGroups(actor.uid, (existingData.groupIds ?? []) as string[])))) {
      throw new ApiError(403, "Líder só pode excluir agendas dos grupos que lidera");
    }

    await adminDb.runTransaction(async (transaction) => {
      const eventDoc = await transaction.get(eventRef);
      if (!eventDoc.exists) throw new ApiError(404, "Agenda não encontrada");
      const current = eventDoc.data()!;

      transaction.delete(eventRef);

      recordChange(transaction, { entity: "event", entityId: eventId, operation: "delete", scope: "global", actorId: actor.uid });
      if (current.scope === "groups") {
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
