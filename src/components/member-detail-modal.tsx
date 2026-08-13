"use client";

import Image from "next/image";
import { useAuth } from "./auth-provider";
import { useOfflineData } from "./offline-data-provider";
import { formatPhoneMask, formatWhatsAppLink } from "@/lib/phone-auth";

interface MemberDetailModalProps {
  userId: string | null;
  onClose: () => void;
  onOpenEdit?: (uid: string) => void;
  onDelete?: (uid: string) => void;
}

export function MemberDetailModal({ userId, onClose, onOpenEdit, onDelete }: MemberDetailModalProps) {
  const { user } = useAuth();
  const offline = useOfflineData();

  if (!userId) return null;

  const viewingUser = offline.users.find((u) => u.id === userId);
  if (!viewingUser) return null;

  const currentUser = offline.users.find((u) => u.id === user?.uid);
  const isAdmin = currentUser?.role === "admin";

  const viewingGroups = offline.groups.filter((g) => viewingUser.groupIds.includes(g.id));
  const whatsappUrl = `${formatWhatsAppLink(viewingUser.phoneE164)}?text=${encodeURIComponent(`Olá, ${viewingUser.name}!`)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Perfil do Membro</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1">✕</button>
        </div>

        <div className="mt-4 text-center">
          {viewingUser.photoUrl ? (
            <Image
              src={viewingUser.photoUrl}
              alt={viewingUser.name}
              width={96}
              height={96}
              className="mx-auto size-24 rounded-full object-cover border-2 border-emerald-700 shadow-md"
            />
          ) : (
            <div className="mx-auto grid size-24 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800 text-2xl shadow-inner">
              {viewingUser.name.substring(0, 2).toUpperCase()}
            </div>
          )}

          <h2 className="mt-3 text-xl font-bold text-slate-900">{viewingUser.name}</h2>
          <div className="mt-1 flex justify-center gap-1.5">
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${viewingUser.type === "member" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>
              {viewingUser.type === "member" ? "Membro" : "Frequentador"}
            </span>
            {viewingUser.role !== "common" && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                {viewingUser.role === "admin" ? "Administrador" : "Líder de Grupo"}
              </span>
            )}
            {!viewingUser.active && (
              <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                Inativo
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4 rounded-2xl bg-slate-50 p-4 border border-slate-100">
          {/* Telefone + WhatsApp */}
          <div>
            <p className="text-xs font-semibold text-slate-500">Telefone para Contato</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900">
                {formatPhoneMask(viewingUser.phoneE164) || viewingUser.phoneE164 || "Não informado"}
              </p>
              {viewingUser.phoneE164 && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  💬 WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Aniversário */}
          {viewingUser.birthMonthDay && (
            <div>
              <p className="text-xs font-semibold text-slate-500">Aniversário</p>
              <p className="text-sm font-bold text-slate-900">
                🎂 {viewingUser.birthMonthDay.split("-").reverse().join("/")}
              </p>
            </div>
          )}

          {/* Grupos do Membro */}
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Grupos de Comunhão</p>
            {viewingGroups.length ? (
              <div className="flex flex-wrap gap-1.5">
                {viewingGroups.map((g) => (
                  <span key={g.id} className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-emerald-900 border border-slate-200 shadow-2xs">
                    🤝 {g.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">Não vinculado a nenhum grupo no momento.</p>
            )}
          </div>
        </div>

        {/* Ações de Administrador */}
        {isAdmin && (onOpenEdit || onDelete) && (
          <div className="mt-6 border-t border-slate-100 pt-4 flex gap-2">
            {onOpenEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEdit(viewingUser.id);
                }}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800"
              >
                ✏️ Editar Cadastro
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(viewingUser.id)}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                🗑️ Excluir
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
