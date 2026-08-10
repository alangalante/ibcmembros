"use client";

export async function uploadAgendaPdf(file: File, idToken: string) {
  if (file.type !== "application/pdf") throw new Error("Selecione um arquivo PDF.");
  if (file.size > 10 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 10 MB.");
  const signRes = await fetch("/api/cloudinary/sign", { method: "POST", headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ kind: "agenda-pdf" }) });
  const signed = await signRes.json();
  if (!signRes.ok) throw new Error(signed.error || "Falha ao preparar o PDF");
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("folder", signed.folder);
  form.append("public_id", signed.publicId);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/raw/upload`, { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Falha ao enviar o PDF");
  return { pdfUrl: result.secure_url as string, pdfPublicId: result.public_id as string };
}
