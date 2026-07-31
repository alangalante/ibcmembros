import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { adminUserPatchSchema } from "@/lib/validation";
import { ApiError, authenticate, errorResponse, requireAdmin } from "@/lib/server/auth";
import { recordAudit, recordChange } from "@/lib/server/sync";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  try {
    const actor = await authenticate(request);
    requireAdmin(actor);
    const { uid } = await context.params;

    const [userDoc, privateDoc] = await Promise.all([
      adminDb.collection("users").doc(uid).get(),
      adminDb.collection("userPrivate").doc(uid).get(),
    ]);

    if (!userDoc.exists) throw new ApiError(404, "Usuário não encontrado");

    return NextResponse.json({
      public: { id: userDoc.id, ...userDoc.data() },
      private: privateDoc.exists ? privateDoc.data() : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  try {
    const actor = await authenticate(request); requireAdmin(actor);
    const { uid } = await context.params;
    const parsed = adminUserPatchSchema.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos");

    const publicPatch: Record<string, unknown> = { ...parsed.data.public };
    if (parsed.data.public.name) publicPatch.nameSearch = parsed.data.public.name.toLocaleLowerCase("pt-BR");
    if (parsed.data.private.birthDate) publicPatch.birthMonthDay = parsed.data.private.birthDate.slice(5);

    await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection("users").doc(uid);
      const user = await transaction.get(userRef);
      if (!user.exists) throw new ApiError(404, "Usuário não encontrado");

      if (Object.keys(publicPatch).length) transaction.update(userRef, { ...publicPatch, updatedAt: FieldValue.serverTimestamp() });
      if (Object.keys(parsed.data.private).length) transaction.set(adminDb.collection("userPrivate").doc(uid), {
        ...parsed.data.private, updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      recordChange(transaction, { entity: "user", entityId: uid, operation: "update", scope: "global", actorId: actor.uid });
      recordChange(transaction, { entity: "user", entityId: uid, operation: "update", scope: "user", userId: uid, actorId: actor.uid });
      recordAudit(transaction, actor.uid, "user.update", uid);
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ uid: string }> }) {
  try {
    const actor = await authenticate(request);
    requireAdmin(actor);
    const { uid } = await context.params;

    await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection("users").doc(uid);
      const userPrivateRef = adminDb.collection("userPrivate").doc(uid);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) throw new ApiError(404, "Usuário não encontrado");

      transaction.delete(userRef);
      transaction.delete(userPrivateRef);

      recordChange(transaction, { entity: "user", entityId: uid, operation: "delete", scope: "global", actorId: actor.uid });
      recordChange(transaction, { entity: "user", entityId: uid, operation: "delete", scope: "user", userId: uid, actorId: actor.uid });
      recordAudit(transaction, actor.uid, "user.delete", uid);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}


