import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { ApiError, authenticate, errorResponse } from "@/lib/server/auth";
import { recordAudit, recordChange } from "@/lib/server/sync";

const bodySchema = z.object({ userId: z.string().min(1), isLeader: z.boolean().default(false) });
export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await authenticate(request);
    const { groupId } = await context.params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Dados do vínculo inválidos");

    await adminDb.runTransaction(async (transaction) => {
      const groupRef = adminDb.collection("groups").doc(groupId);
      const userRef = adminDb.collection("users").doc(parsed.data.userId);
      const [group, user] = await Promise.all([transaction.get(groupRef), transaction.get(userRef)]);
      if (!group.exists || !user.exists) throw new ApiError(404, "Grupo ou usuário não encontrado");
      const leaders = (group.get("leaderIds") ?? []) as string[];
      const canManage = actor.role === "admin" || leaders.includes(actor.uid);
      if (!canManage) throw new ApiError(403, "Você não lidera este grupo");
      if (parsed.data.isLeader && actor.role !== "admin") throw new ApiError(403, "Somente administradores definem líderes");

      const participantIds = [...new Set([...((group.get("participantIds") ?? []) as string[]), parsed.data.userId])];
      const leaderIds = parsed.data.isLeader ? [...new Set([...leaders, parsed.data.userId])] : leaders;
      transaction.update(groupRef, { participantIds, leaderIds, updatedAt: FieldValue.serverTimestamp() });
      transaction.update(userRef, { groupIds: FieldValue.arrayUnion(groupId), updatedAt: FieldValue.serverTimestamp() });
      transaction.set(adminDb.collection("groupMemberships").doc(`${groupId}_${parsed.data.userId}`), {
        groupId, userId: parsed.data.userId, isLeader: parsed.data.isLeader, active: true,
        joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      recordChange(transaction, { entity: "membership", entityId: `${groupId}_${parsed.data.userId}`, operation: "create", scope: "group", groupId, actorId: actor.uid, participantIds });
      recordChange(transaction, { entity: "membership", entityId: `${groupId}_${parsed.data.userId}`, operation: "update", scope: "user", userId: parsed.data.userId, actorId: actor.uid });
      recordAudit(transaction, actor.uid, "group.member.add", `${groupId}_${parsed.data.userId}`);
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await authenticate(request);
    const { groupId } = await context.params;
    const { userId } = await request.json();
    if (!userId) throw new ApiError(400, "ID do usuário é obrigatório");

    await adminDb.runTransaction(async (transaction) => {
      const groupRef = adminDb.collection("groups").doc(groupId);
      const userRef = adminDb.collection("users").doc(userId);
      const [group, user] = await Promise.all([transaction.get(groupRef), transaction.get(userRef)]);
      if (!group.exists || !user.exists) throw new ApiError(404, "Grupo ou usuário não encontrado");

      const leaders = (group.get("leaderIds") ?? []) as string[];
      const canManage = actor.role === "admin" || leaders.includes(actor.uid);
      if (!canManage) throw new ApiError(403, "Você não tem permissão para gerenciar este grupo");

      const participantIds = ((group.get("participantIds") ?? []) as string[]).filter((id) => id !== userId);
      const leaderIds = leaders.filter((id) => id !== userId);

      transaction.update(groupRef, { participantIds, leaderIds, updatedAt: FieldValue.serverTimestamp() });
      transaction.update(userRef, { groupIds: FieldValue.arrayRemove(groupId), updatedAt: FieldValue.serverTimestamp() });
      transaction.delete(adminDb.collection("groupMemberships").doc(`${groupId}_${userId}`));

      recordChange(transaction, { entity: "membership", entityId: `${groupId}_${userId}`, operation: "delete", scope: "group", groupId, actorId: actor.uid, participantIds });
      recordChange(transaction, { entity: "membership", entityId: `${groupId}_${userId}`, operation: "update", scope: "user", userId, actorId: actor.uid });
      recordAudit(transaction, actor.uid, "group.member.remove", `${groupId}_${userId}`);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
