"use client";

import Image from "next/image";
import { useState } from "react";

import { NavHeader } from "@/components/nav-header";
import { useAuth } from "@/components/auth-provider";
import { useOfflineData } from "@/components/offline-data-provider";
import { PhotoUpload } from "@/components/photo-upload";
import { MemberDetailModal } from "@/components/member-detail-modal";
import { ConfirmModal } from "@/components/confirm-modal";
import { formatPhoneMask, normalizeDDDPhone } from "@/lib/phone-auth";

type PersonFilter = "all" | "member" | "visitor" | "inactive";

interface EditPrivateData {
  birthDate?: string;
  conversionDate?: string | null;
  conversionReason?: string | null;
}

export default function MembersDirectoryPage() {
  const { user } = useAuth();
  const offline = useOfflineData();

  const currentUser = offline.users.find((u) => u.id === user?.uid);
  const isAdmin = currentUser?.role === "admin";

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PersonFilter>("all");

  // Modal Ver Detalhes do Membro (para qualquer usuário)
  const [viewingUid, setViewingUid] = useState<string | null>(null);

  // Confirmação de Exclusão
  const [deleteTargetUid, setDeleteTargetUid] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Modal Novo Cadastro (apenas para Admin)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    phoneE164: "",
    birthDate: "",
    role: "common" as "admin" | "leader" | "common",
    type: "member" as "member" | "visitor",
    conversionDate: "",
    conversionReason: "",
  });
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Modal Editar Cadastro (apenas para Admin)
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phoneE164: "",
    role: "common" as "admin" | "leader" | "common",
    type: "member" as "member" | "visitor",
    active: true,
    photoUrl: null as string | null,
    photoPublicId: null as string | null,
    birthDate: "",
    conversionDate: "",
    conversionReason: "",
  });
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [idToken, setIdToken] = useState("");
  const [fetchingPrivate, setFetchingPrivate] = useState(false);

  const filteredUsers = offline.users
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .filter((item) => {
      const cleanSearch = search.toLowerCase().trim();
      const matchesSearch =
        item.name.toLowerCase().includes(cleanSearch) ||
        item.phoneE164.includes(cleanSearch);

      if (!matchesSearch) return false;
      if (filter === "member") return item.type === "member" && item.active;
      if (filter === "visitor") return item.type === "visitor" && item.active;
      if (filter === "inactive") return !item.active;
      return true;
    });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);

    try {
      const cleanPhone = normalizeDDDPhone(createForm.phoneE164);
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...createForm,
          phoneE164: cleanPhone,
          conversionDate: createForm.conversionDate || null,
          conversionReason: createForm.conversionReason || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar cadastro");

      setShowCreateModal(false);
      setCreateForm({
        name: "",
        phoneE164: "",
        birthDate: "",
        role: "common",
        type: "member",
        conversionDate: "",
        conversionReason: "",
      });
      await offline.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Falha ao criar cadastro");
    } finally {
      setCreateLoading(false);
    }
  }

  async function openEditModal(uid: string) {
    setEditingUid(uid);
    setViewingUid(null);
    setEditError("");
    setFetchingPrivate(true);

    const publicProfile = offline.users.find((u) => u.id === uid);
    if (!publicProfile) return;

    const token = await user?.getIdToken();
    if (token) setIdToken(token);

    setEditForm({
      name: publicProfile.name,
      phoneE164: formatPhoneMask(publicProfile.phoneE164),
      role: publicProfile.role,
      type: publicProfile.type,
      active: publicProfile.active,
      photoUrl: publicProfile.photoUrl ?? null,
      photoPublicId: publicProfile.photoPublicId ?? null,
      birthDate: "",
      conversionDate: "",
      conversionReason: "",
    });

    try {
      const res = await fetch(`/api/admin/users/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const priv: EditPrivateData | null = data.private;
        if (priv) {
          setEditForm((prev) => ({
            ...prev,
            birthDate: priv.birthDate || "",
            conversionDate: priv.conversionDate || "",
            conversionReason: priv.conversionReason || "",
          }));
        }
      }
    } catch {
      /* Ignora falha se offline */
    } finally {
      setFetchingPrivate(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUid) return;
    setEditError("");
    setEditLoading(true);

    try {
      const cleanPhone = normalizeDDDPhone(editForm.phoneE164);
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/users/${editingUid}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          public: {
            name: editForm.name,
            phoneE164: cleanPhone,
            role: editForm.role,
            type: editForm.type,
            active: editForm.active,
            photoUrl: editForm.photoUrl,
            photoPublicId: editForm.photoPublicId,
          },
          private: {
            ...(editForm.birthDate ? { birthDate: editForm.birthDate } : {}),
            conversionDate: editForm.conversionDate || null,
            conversionReason: editForm.conversionReason || null,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar cadastro");

      setEditingUid(null);
      await offline.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Falha ao salvar alterações");
    } finally {
      setEditLoading(false);
    }
  }

  async function executeDelete() {
    if (!deleteTargetUid) return;
    setDeleteLoading(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/users/${deleteTargetUid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao excluir cadastro");
      setDeleteTargetUid(null);
      setEditingUid(null);
      setViewingUid(null);
      await offline.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao excluir");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 pb-20">
      <NavHeader />
      <main className="mx-auto max-w-lg md:max-w-4xl lg:max-w-6xl px-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Membros da Igreja</h1>
            <p className="text-xs text-slate-500">{filteredUsers.length} cadastros encontrados</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-900"
            >
              + Novo Cadastro
            </button>
          )}
        </div>

        {/* Busca e Filtros */}
        <div className="mt-4 space-y-2">
          <input
            type="text"
            placeholder="Buscar membro por nome ou telefone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
          />

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: "all", label: "Todos" },
              { id: "member", label: "Membros" },
              { id: "visitor", label: "Visitantes" },
              ...(isAdmin ? [{ id: "inactive", label: "Inativos" }] : []),
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setFilter(chip.id as PersonFilter)}
                className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  filter === chip.id
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Membros */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredUsers.length ? (
            filteredUsers.map((item) => (
              <article
                key={item.id}
                onClick={() => setViewingUid(item.id)}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs cursor-pointer hover:border-emerald-400 hover:shadow-xs transition-all"
              >
                <div className="flex items-center gap-3">
                  {item.photoUrl ? (
                    <Image
                      src={item.photoUrl}
                      alt={item.name}
                      width={44}
                      height={44}
                      className="size-11 rounded-full object-cover border border-slate-200 shadow-2xs"
                    />
                  ) : (
                    <div className="grid size-11 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-800 text-sm shadow-2xs">
                      {item.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900">{item.name}</h3>
                    <p className="text-xs text-slate-500">{formatPhoneMask(item.phoneE164)}</p>
                    <div className="mt-1 flex gap-1 flex-wrap">
                      <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${item.type === "member" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>
                        {item.type === "member" ? "Membro" : "Visitante"}
                      </span>
                      {item.role !== "common" && (
                        <span className="inline-block rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          {item.role === "admin" ? "Admin" : "Líder"}
                        </span>
                      )}
                      {!item.active && (
                        <span className="inline-block rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-700">Ver →</span>
              </article>
            ))
          ) : (
            <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 border border-slate-100">
              Nenhum membro encontrado com os critérios digitados.
            </div>
          )}
        </div>
      </main>

      {/* Modal Visualizar Detalhes do Membro */}
      <MemberDetailModal
        userId={viewingUid}
        onClose={() => setViewingUid(null)}
        onOpenEdit={isAdmin ? openEditModal : undefined}
        onDelete={isAdmin ? (uid) => setDeleteTargetUid(uid) : undefined}
      />

      {/* Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetUid)}
        title="Excluir Cadastro"
        message="Tem certeza que deseja excluir permanentemente este cadastro da igreja?"
        confirmText={deleteLoading ? "Excluindo…" : "Excluir Cadastro"}
        cancelText="Cancelar"
        isDanger={true}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTargetUid(null)}
      />

      {/* Modal Criar Novo Cadastro (Apenas Admin) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <h2 className="text-lg font-bold">Novo Cadastro</h2>
            {createError && <p className="mt-2 text-xs font-semibold text-rose-700">{createError}</p>}

            <form onSubmit={handleCreate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">Nome completo *</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Telefone (DDD + Número) *</label>
                  <input
                    type="text"
                    required
                    placeholder="(22) 99999-9999"
                    value={createForm.phoneE164}
                    onChange={(e) => setCreateForm({ ...createForm, phoneE164: formatPhoneMask(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Nascimento (Privado) *</label>
                  <input
                    type="date"
                    required
                    value={createForm.birthDate}
                    onChange={(e) => setCreateForm({ ...createForm, birthDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Tipo *</label>
                  <select
                    value={createForm.type}
                    onChange={(e) => setCreateForm({ ...createForm, type: e.target.value as "member" | "visitor" })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  >
                    <option value="member">Membro</option>
                    <option value="visitor">Visitante</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Papel de Acesso *</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as "admin" | "leader" | "common" })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  >
                    <option value="common">Comum</option>
                    <option value="leader">Líder</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-900"
                >
                  {createLoading ? "Salvando…" : "Criar Cadastro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Cadastro (Apenas Admin) */}
      {editingUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <h2 className="text-lg font-bold">Editar Cadastro</h2>
            {fetchingPrivate && <p className="text-xs text-amber-700 mt-1">Buscando dados privados…</p>}
            {editError && <p className="mt-2 text-xs font-semibold text-rose-700">{editError}</p>}

            <form onSubmit={handleEdit} className="mt-4 space-y-3">
              <div className="flex justify-center pb-2">
                <PhotoUpload
                  currentPhotoUrl={editForm.photoUrl}
                  idToken={idToken}
                  onPhotoUploaded={(url, publicId) =>
                    setEditForm((prev) => ({ ...prev, photoUrl: url, photoPublicId: publicId }))
                  }
                  onPhotoCleared={() =>
                    setEditForm((prev) => ({ ...prev, photoUrl: null, photoPublicId: null }))
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Nome</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Telefone (DDD + Número)</label>
                  <input
                    type="text"
                    required
                    placeholder="(22) 99999-9999"
                    value={editForm.phoneE164}
                    onChange={(e) => setEditForm({ ...editForm, phoneE164: formatPhoneMask(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Data Nasc. (Privado)</label>
                  <input
                    type="date"
                    value={editForm.birthDate}
                    onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Tipo</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as "member" | "visitor" })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  >
                    <option value="member">Membro</option>
                    <option value="visitor">Visitante</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Papel de Acesso</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as "admin" | "leader" | "common" })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  >
                    <option value="common">Comum</option>
                    <option value="leader">Líder</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                  className="size-4 rounded border-slate-300 text-emerald-800 focus:ring-emerald-700"
                />
                <label htmlFor="activeCheck" className="text-sm font-semibold text-slate-800">
                  Cadastro Ativo
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUid(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-xl bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-900"
                >
                  {editLoading ? "Salvando…" : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
