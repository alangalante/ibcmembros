"use client";

/**
 * Redimensiona e comprime uma imagem no navegador utilizando HTMLCanvasElement.
 * Converte para formato WebP com resolução máxima de 400x400px.
 */
export async function compressAndResizeImage(
  file: File,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Não foi possível inicializar o contexto 2D do Canvas"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Erro na conversão da imagem para WebP"));
            }
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => reject(new Error("Erro ao carregar arquivo de imagem"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo local"));
    reader.readAsDataURL(file);
  });
}

export interface CloudinaryUploadResult {
  photoUrl: string;
  photoPublicId: string;
}

/**
 * Realiza a assinatura via backend e o upload direto para o Cloudinary em WebP.
 */
export async function uploadProfilePhoto(
  file: File,
  idToken: string
): Promise<CloudinaryUploadResult> {
  // 1. Obter assinatura do servidor
  const signRes = await fetch("/api/cloudinary/sign", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!signRes.ok) {
    const err = await signRes.json();
    throw new Error(err.error || "Falha ao obter assinatura do Cloudinary");
  }

  const { signature, timestamp, apiKey, cloudName, folder, publicId } = await signRes.json();

  // 2. Comprimir a imagem para WebP (max 400x400)
  const compressedBlob = await compressAndResizeImage(file, 400, 400, 0.82);

  // 3. Enviar FormData para a API do Cloudinary
  const formData = new FormData();
  formData.append("file", compressedBlob, `${publicId}.webp`);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("public_id", publicId);

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!uploadRes.ok) {
    const uploadErr = await uploadRes.json();
    throw new Error(uploadErr.error?.message || "Falha ao enviar imagem para o Cloudinary");
  }

  const uploadData = await uploadRes.json();

  return {
    photoUrl: uploadData.secure_url,
    photoPublicId: uploadData.public_id,
  };
}
