import type { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { AccessRole } from "@/types/domain";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type AuthenticatedActor = { uid: string; role: AccessRole; active: boolean; groupIds: string[] };

export async function authenticate(request: NextRequest): Promise<AuthenticatedActor> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new ApiError(401, "Token de autenticação ausente");

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(authorization.slice(7));
  } catch (err) {
    console.error("Erro na verificação do ID Token do Firebase Auth:", err);
    throw new ApiError(401, "Token de autenticação inválido ou expirado");
  }

  let profile = await adminDb.collection("users").doc(decoded.uid).get();

  // Se o usuário foi autenticado no Firebase Auth mas ainda não possuía documento no Firestore, cria um perfil ativo
  if (!profile.exists) {
    const rawPhone = decoded.email?.replace("@ibcmembros.internal", "") || "";
    const name = decoded.name || (rawPhone ? `Membro (${rawPhone})` : "Novo Membro");

    const defaultProfile = {
      name,
      nameSearch: name.toLowerCase(),
      birthMonthDay: "01-01",
      phoneE164: rawPhone,
      photoUrl: decoded.picture || null,
      photoPublicId: null,
      role: "common" as AccessRole,
      type: "member",
      groupIds: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await adminDb.collection("users").doc(decoded.uid).set(defaultProfile, { merge: true });
    profile = await adminDb.collection("users").doc(decoded.uid).get();
  }

  if (profile.get("active") !== true) {
    throw new ApiError(403, "Cadastro inativo. Entre em contato com a liderança da igreja.");
  }

  const storedRole = (profile.get("role") as AccessRole) || "common";
  const storedGroupIds = (profile.get("groupIds") ?? []) as string[];
  let effectiveRole = storedRole;
  let effectiveGroupIds = storedGroupIds;

  // Compatibilidade com líderes antigos: a fonte de verdade da liderança é o
  // próprio grupo. Não exige migração prévia de users.role ou users.groupIds.
  if (storedRole !== "admin") {
    const ledGroups = await adminDb.collection("groups").where("leaderIds", "array-contains", decoded.uid).get();
    if (!ledGroups.empty) {
      effectiveRole = "leader";
      effectiveGroupIds = [...new Set([...storedGroupIds, ...ledGroups.docs.map((group) => group.id)])];
    }
  }

  return {
    uid: decoded.uid,
    role: effectiveRole,
    active: true,
    groupIds: effectiveGroupIds,
  };
}

export function requireAdmin(actor: AuthenticatedActor) {
  if (actor.role !== "admin") throw new ApiError(403, "Acesso exclusivo para administradores");
}

export function requireLeaderOrAdmin(actor: AuthenticatedActor) {
  if (actor.role !== "admin" && actor.role !== "leader") {
    throw new ApiError(403, "Acesso exclusivo para líderes e administradores");
  }
}

export function errorResponse(error: unknown) {
  if (!(error instanceof ApiError)) {
    console.error("Erro interno do servidor em API route:", error);
  }
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof ApiError ? error.message : "Erro interno do servidor";
  return Response.json({ error: message }, { status });
}
