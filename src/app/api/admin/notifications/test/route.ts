import { NextRequest, NextResponse } from "next/server";
import { ApiError, authenticate, errorResponse, requireAdmin } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const actor = await authenticate(request);
    requireAdmin(actor);
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new ApiError(503, "O disparo de notificações não está configurado.");
    const response = await fetch(new URL("/api/cron/daily", request.nextUrl.origin), {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new ApiError(response.status, result.error || "Falha ao disparar notificações.");
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
