"use client";

export async function uploadAgendaPdf(file: File, idToken: string) {
  if (file.type !== "application/pdf") throw new Error("Selecione um arquivo PDF.");
  if (file.size > 4 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 4 MB.");
  const form = new FormData();
  form.append("file", file);
  let response: Response;
  try {
    response = await fetch("/api/admin/agenda-pdf", { method: "POST", headers: { Authorization: `Bearer ${idToken}` }, body: form });
  } catch {
    throw new Error("Não foi possível enviar o PDF. Verifique sua conexão e tente novamente.");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Falha ao enviar o PDF");
  return { pdfUrl: result.secure_url as string, pdfPublicId: result.public_id as string };
}
