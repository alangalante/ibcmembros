import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { adminCreateUserSchema } from "@/lib/validation";
import { ApiError, authenticate, errorResponse, requireAdmin } from "@/lib/server/auth";
import { recordAudit, recordChange } from "@/lib/server/sync";
import { phoneToInternalEmail } from "@/lib/phone-auth";


export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await authenticate(request);
    requireAdmin(actor);

    const body = await request.json();
    const parsed = adminCreateUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Dados inválidos");
    }

    const { email, password, name, phoneE164, birthDate, role, type, conversionDate, conversionReason } = parsed.data;

    const existing = await adminDb.collection("users").where("phoneE164", "==", phoneE164).get();
    if (!existing.empty) {
      throw new ApiError(400, "Já existe um cadastro com este telefone.");
    }

    const authEmail = email || phoneToInternalEmail(phoneE164);
    const userRecord = await adminAuth.createUser({
      email: authEmail,
      password,
      displayName: name,
      disabled: false,
    });
    const targetUid = userRecord.uid;



    const birthMonthDay = birthDate.slice(5); // YYYY-MM-DD -> MM-DD
    const nameSearch = name.toLocaleLowerCase("pt-BR");

    const publicProfile = {
      name,
      nameSearch,
      birthMonthDay,
      phoneE164,
      photoUrl: null,
      photoPublicId: null,
      role,
      type,
      groupIds: [],
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const privateProfile = {
      birthDate,
      conversionDate: conversionDate || null,
      conversionReason: conversionReason || null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection("users").doc(targetUid);
      const userPrivateRef = adminDb.collection("userPrivate").doc(targetUid);

      transaction.set(userRef, publicProfile);
      transaction.set(userPrivateRef, privateProfile);

      recordChange(transaction, { entity: "user", entityId: targetUid, operation: "create", scope: "global", actorId: actor.uid });
      recordChange(transaction, { entity: "user", entityId: targetUid, operation: "create", scope: "user", userId: targetUid, actorId: actor.uid });
      recordAudit(transaction, actor.uid, "user.create", targetUid);
    });

    return NextResponse.json({ ok: true, uid: targetUid }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
