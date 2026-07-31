import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { groupPatchSchema } from "@/lib/validation";
import { ApiError, authenticate, errorResponse, requireAdmin } from "@/lib/server/auth";
import { recordAudit, recordChange } from "@/lib/server/sync";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  try {
    const actor = await authenticate(request);
    requireAdmin(actor);
    const { groupId } = await context.params;

    const body = await request.json();
    const parsed = groupPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos");
    }

    await adminDb.runTransaction(async (transaction) => {
      const groupRef = adminDb.collection("groups").doc(groupId);
      const groupDoc = await transaction.get(groupRef);
      if (!groupDoc.exists) throw new ApiError(404, "Grupo não encontrado");

      transaction.update(groupRef, {
        ...parsed.data,
        updatedAt: FieldValue.serverTimestamp(),
      });

      recordChange(transaction, { entity: "group", entityId: groupId, operation: "update", scope: "global", actorId: actor.uid });
      recordChange(transaction, { entity: "group", entityId: groupId, operation: "update", scope: "group", groupId, actorId: actor.uid });
      recordAudit(transaction, actor.uid, "group.update", groupId);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
