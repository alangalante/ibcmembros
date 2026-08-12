import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { ApiError, authenticate, errorResponse } from "@/lib/server/auth";
import { recordAudit, recordChange } from "@/lib/server/sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await authenticate(request);
    const userRef = adminDb.collection("users").doc(actor.uid);
    await adminDb.runTransaction(async (transaction) => {
      const profile = await transaction.get(userRef);
      if (!profile.exists) throw new ApiError(404, "Cadastro não encontrado");
      transaction.update(userRef, { mustChangePassword: false, updatedAt: FieldValue.serverTimestamp() });
      recordChange(transaction, { entity: "user", entityId: actor.uid, operation: "update", scope: "global", actorId: actor.uid });
      recordChange(transaction, { entity: "user", entityId: actor.uid, operation: "update", scope: "user", userId: actor.uid, actorId: actor.uid });
      recordAudit(transaction, actor.uid, "password.initial-change", actor.uid);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
