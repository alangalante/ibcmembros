import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { groupSchema } from "@/lib/validation";
import { ApiError, authenticate, errorResponse, requireAdmin } from "@/lib/server/auth";
import { recordAudit, recordChange } from "@/lib/server/sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await authenticate(request);
    requireAdmin(actor);

    const body = await request.json();
    const parsed = groupSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados do grupo inválidos");
    }

    const groupRef = adminDb.collection("groups").doc();
    const groupId = groupRef.id;

    await adminDb.runTransaction(async (transaction) => {
      transaction.set(groupRef, {
        name: parsed.data.name,
        description: parsed.data.description,
        leaderIds: parsed.data.leaderIds,
        participantIds: parsed.data.participantIds,
        active: parsed.data.active,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Se houver membros/líderes associados, atualizar user.groupIds
      const allUserIds = Array.from(new Set([...parsed.data.leaderIds, ...parsed.data.participantIds]));
      for (const userId of allUserIds) {
        const userRef = adminDb.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists) {
          const currentGroupIds: string[] = userDoc.data()?.groupIds ?? [];
          if (!currentGroupIds.includes(groupId)) {
            transaction.update(userRef, {
              groupIds: FieldValue.arrayUnion(groupId),
              updatedAt: FieldValue.serverTimestamp(),
            });
            recordChange(transaction, { entity: "user", entityId: userId, operation: "update", scope: "user", userId, actorId: actor.uid });
          }
        }
      }

      recordChange(transaction, { entity: "group", entityId: groupId, operation: "create", scope: "global", actorId: actor.uid });
      recordAudit(transaction, actor.uid, "group.create", groupId);
    });

    return NextResponse.json({ ok: true, id: groupId }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
