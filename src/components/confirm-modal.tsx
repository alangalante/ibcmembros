"use client";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title = "IBC Membros",
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isDanger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <h3 className="font-bold text-base text-slate-900">{title}</h3>
        </div>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">{message}</p>

        <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors ${
              isDanger ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-800 hover:bg-emerald-900"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
