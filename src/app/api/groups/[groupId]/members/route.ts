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
      transaction.update(userRef, {
        groupIds: FieldValue.arrayUnion(groupId),
        ...(parsed.data.isLeader && user.get("role") !== "admin" ? { role: "leader" } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(adminDb.collection("groupMemberships").doc(`${groupId}_${parsed.data.userId}`), {
        groupId, userId: parsed.data.userId, isLeader: parsed.data.isLeader, active: true,
        joinedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      recordChange(transaction, { entity: "group", entityId: groupId, operation: "update", scope: "global", actorId: actor.uid });
      recordChange(transaction, { entity: "user", entityId: parsed.data.userId, operation: "update", scope: "global", actorId: actor.uid });
      recordChange(transaction, { entity: "membership", entityId: `${groupId}_${parsed.data.userId}`, operation: "create", scope: "group", groupId, actorId: actor.uid, participantIds });
      recordAudit(transaction, actor.uid, "group.member.add", `${groupId}_${parsed.data.userId}`);
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await authenticate(request);
    if (actor.role !== "admin") throw new ApiError(403, "Somente administradores definem líderes");
    const { groupId } = await context.params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, "Dados da liderança inválidos");

    const otherLeaderships = parsed.data.isLeader
      ? null
      : await adminDb.collection("groups").where("leaderIds", "array-contains", parsed.data.userId).get();

    await adminDb.runTransaction(async (transaction) => {
      const groupRef = adminDb.collection("groups").doc(groupId);
      const userRef = adminDb.collection("users").doc(parsed.data.userId);
      const membershipRef = adminDb.collection("groupMemberships").doc(`${groupId}_${parsed.data.userId}`);
      const [group, user, membership] = await Promise.all([
        transaction.get(groupRef), transaction.get(userRef), transaction.get(membershipRef),
      ]);
      if (!group.exists || !user.exists) throw new ApiError(404, "Grupo ou usuário não encontrado");

      const participants = (group.get("participantIds") ?? []) as string[];
      if (!participants.includes(parsed.data.userId) || !membership.exists) {
        throw new ApiError(400, "A pessoa precisa estar vinculada ao grupo");
      }

      const leaders = (group.get("leaderIds") ?? []) as string[];
      const leaderIds = parsed.data.isLeader
        ? [...new Set([...leaders, parsed.data.userId])]
        : leaders.filter((id) => id !== parsed.data.userId);
      const leadsAnotherGroup = otherLeaderships?.docs.some((doc) => doc.id !== groupId) ?? false;
      const roleUpdate = user.get("role") === "admin"
        ? {}
        : parsed.data.isLeader
          ? { role: "leader" }
          : !leadsAnotherGroup ? { role: "common" } : {};

      transaction.update(groupRef, { leaderIds, updatedAt: FieldValue.serverTimestamp() });
      transaction.update(userRef, { ...roleUpdate, updatedAt: FieldValue.serverTimestamp() });
      transaction.update(membershipRef, { isLeader: parsed.data.isLeader, updatedAt: FieldValue.serverTimestamp() });

      recordChange(transaction, { entity: "group", entityId: groupId, operation: "update", scope: "global", actorId: actor.uid });
      recordChange(transaction, { entity: "user", entityId: parsed.data.userId, operation: "update", scope: "global", actorId: actor.uid });
      recordChange(transaction, { entity: "membership", entityId: membershipRef.id, operation: "update", scope: "group", groupId, actorId: actor.uid, participantIds: participants });
      recordAudit(transaction, actor.uid, parsed.data.isLeader ? "group.leader.promote" : "group.leader.demote", membershipRef.id);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
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
      if (actor.role === "leader" && leaders.includes(userId)) {
        throw new ApiError(403, "Líderes não podem remover líderes do grupo");
      }

      const participantIds = ((group.get("participantIds") ?? []) as string[]).filter((id) => id !== userId);
      const leaderIds = leaders.filter((id) => id !== userId);

      transaction.update(groupRef, { participantIds, leaderIds, updatedAt: FieldValue.serverTimestamp() });
      transaction.update(userRef, { groupIds: FieldValue.arrayRemove(groupId), updatedAt: FieldValue.serverTimestamp() });
      transaction.delete(adminDb.collection("groupMemberships").doc(`${groupId}_${userId}`));

      recordChange(transaction, { entity: "group", entityId: groupId, operation: "update", scope: "global", actorId: actor.uid });
      recordChange(transaction, { entity: "user", entityId: userId, operation: "update", scope: "global", actorId: actor.uid });
      recordChange(transaction, { entity: "membership", entityId: `${groupId}_${userId}`, operation: "delete", scope: "group", groupId, actorId: actor.uid, participantIds });
      recordAudit(transaction, actor.uid, "group.member.remove", `${groupId}_${userId}`);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
