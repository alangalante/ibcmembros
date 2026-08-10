"use client";

export async function uploadAgendaPdf(file: File, idToken: string) {
  if (file.type !== "application/pdf") throw new Error("Selecione um arquivo PDF.");
  if (file.size > 4 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 4 MB.");
  const form = new FormData();
  form.append("file", file);
  return new Promise<{ pdfUrl: string; pdfPublicId: string }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/admin/agenda-pdf");
    request.setRequestHeader("Authorization", `Bearer ${idToken}`);
    request.timeout = 60_000;
    request.onload = () => {
      let result: { pdfUrl?: string; pdfPublicId?: string; error?: string } = {};
      try { result = JSON.parse(request.responseText); } catch { /* resposta sem JSON */ }
      if (request.status >= 200 && request.status < 300 && result.pdfUrl && result.pdfPublicId) {
        resolve({ pdfUrl: result.pdfUrl, pdfPublicId: result.pdfPublicId });
      } else {
        reject(new Error(result.error || `Falha ao enviar o PDF (${request.status || "sem resposta"}).`));
      }
    };
    request.onerror = () => reject(new Error("O navegador não conseguiu concluir o envio do PDF."));
    request.ontimeout = () => reject(new Error("O envio do PDF excedeu 60 segundos. Tente novamente."));
    request.send(form);
  });
}
