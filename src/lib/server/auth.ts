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
  try { decoded = await adminAuth.verifyIdToken(authorization.slice(7)); }
  catch { throw new ApiError(401, "Token de autenticação inválido"); }

  const profile = await adminDb.collection("users").doc(decoded.uid).get();
  if (!profile.exists || profile.get("active") !== true) throw new ApiError(403, "Usuário inativo ou sem perfil");
  return { uid: decoded.uid, role: profile.get("role") as AccessRole, active: true, groupIds: (profile.get("groupIds") ?? []) as string[] };
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
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof ApiError ? error.message : "Erro interno";
  return Response.json({ error: message }, { status });
}
