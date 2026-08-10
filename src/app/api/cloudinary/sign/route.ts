import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authenticate, errorResponse } from "@/lib/server/auth";



export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await authenticate(request);

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || "demo";
    const apiKey = process.env.CLOUDINARY_API_KEY || "demo_key";
    const apiSecret = process.env.CLOUDINARY_API_SECRET || "demo_secret";

    const body = await request.json().catch(() => ({})) as { kind?: string };
    const isAgendaPdf = body.kind === "agenda-pdf";
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = isAgendaPdf ? "ibc_membros/agenda" : "ibc_membros/profiles";
    const publicId = isAgendaPdf ? `agenda_${actor.uid}_${timestamp}` : `user_${actor.uid}_${timestamp}`;

    // Cloudinary exige ordenação alfabética das chaves a serem assinadas
    const stringToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(stringToSign).digest("hex");

    return NextResponse.json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
      publicId,
      resourceType: isAgendaPdf ? "raw" : "image",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
