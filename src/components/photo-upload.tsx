"use client";

import Image from "next/image";
import { useState } from "react";
import { uploadProfilePhoto } from "@/lib/image";

interface PhotoUploadProps {
  currentPhotoUrl: string | null;
  idToken: string;
  onPhotoUploaded: (url: string, publicId: string) => void;
  onPhotoCleared: () => void;
}

export function PhotoUpload({
  currentPhotoUrl,
  idToken,
  onPhotoUploaded,
  onPhotoCleared,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(currentPhotoUrl);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);

    try {
      // Preview local imediato
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);

      // Upload otimizado
      const result = await uploadProfilePhoto(file, idToken);
      setPreview(result.photoUrl);
      onPhotoUploaded(result.photoUrl, result.photoPublicId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar foto");
      setPreview(currentPhotoUrl);
    } finally {
      setUploading(false);
    }
  }

  function handleClear() {
    setPreview(null);
    setError("");
    onPhotoCleared();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative grid size-24 place-items-center overflow-hidden rounded-full border-2 border-emerald-800/20 bg-slate-100 shadow-inner">
        {preview ? (
          <Image
            src={preview}
            alt="Foto de perfil"
            width={96}
            height={96}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-3xl text-slate-400">👤</span>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-bold text-white">
            Processando…
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="cursor-pointer rounded-xl bg-emerald-800 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-900 active:bg-emerald-950">
          {preview ? "Alterar foto" : "Selecionar foto"}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {preview && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Remover
          </button>
        )}
      </div>

      {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
    </div>
  );
}
