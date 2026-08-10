import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { authenticate, errorResponse, requireLeaderOrAdmin, ApiError } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await authenticate(request);
    requireLeaderOrAdmin(actor);
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf") throw new ApiError(400, "Selecione um arquivo PDF válido.");
    if (file.size > 4 * 1024 * 1024) throw new ApiError(400, "O PDF deve ter no máximo 4 MB.");

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) throw new ApiError(503, "O armazenamento de PDFs não está configurado.");

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "ibc_membros/agenda";
    // Em recursos "raw", a extensão faz parte do public_id e é necessária
    // para que a URL de entrega aponte para o arquivo existente.
    const publicId = `agenda_${actor.uid}_${timestamp}.pdf`;
    const signature = crypto.createHash("sha1").update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
    const upload = new FormData();
    upload.append("file", file);
    upload.append("api_key", apiKey);
    upload.append("timestamp", String(timestamp));
    upload.append("signature", signature);
    upload.append("folder", folder);
    upload.append("public_id", publicId);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, { method: "POST", body: upload });
    const result = await response.json();
    if (!response.ok) throw new ApiError(502, result.error?.message || "O armazenamento recusou o PDF.");
    return NextResponse.json({ pdfUrl: result.secure_url, pdfPublicId: result.public_id });
  } catch (error) {
    return errorResponse(error);
  }
}
