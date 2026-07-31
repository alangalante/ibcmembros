"use client";

import { useState } from "react";
import { NavHeader } from "@/components/nav-header";
import { useAuth } from "@/components/auth-provider";
import { useOfflineData } from "@/components/offline-data-provider";

export default function AdminGroupsPage() {
  const { user } = useAuth();
  const offline = useOfflineData();

  const currentUser = offline.users.find((u) => u.id === user?.uid);
  const isAdmin = currentUser?.role === "admin";

  // Modal Criar Grupo
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  // Modal Editar Grupo
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", active: true });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Adicionar Membro ao Grupo
  const [selectedUserToAdd, setSelectedUserToAdd] = useState("");
  const [isLeaderRoleCheck, setIsLeaderRoleCheck] = useState(false);
  const [memberAddLoading, setMemberAddLoading] = useState(false);
  const [memberAddError, setMemberAddError] = useState("");
  const [basicUpdateSuccess, setBasicUpdateSuccess] = useState(false);

  if (!isAdmin) {

    return (
      <div className="min-h-dvh bg-slate-50 text-slate-900">
        <NavHeader />
        <main className="mx-auto max-w-lg p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">Acesso Restrito a Administradores</p>
        </main>
      </div>
    );
  }

  const activeGroups = offline.groups;
  const editingGroup = activeGroups.find((g) => g.id === editingGroupId);

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);

    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar grupo");

      setShowCreateModal(false);
      setCreateForm({ name: "", description: "" });
      await offline.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Falha ao criar grupo");
    } finally {
      setCreateLoading(false);
    }
  }

  function openEditModal(groupId: string) {
    const group = activeGroups.find((g) => g.id === groupId);
    if (!group) return;
    setEditingGroupId(groupId);
    setEditForm({ name: group.name, description: group.description, active: group.active });
    setEditError("");
    setMemberAddError("");
  }

  async function handleEditGroup(e: React.FormEvent) {

    e.preventDefault();
    if (!editingGroupId) return;
    setEditError("");
    setBasicUpdateSuccess(false);
    setEditLoading(true);

    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/groups/${editingGroupId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar grupo");

      setBasicUpdateSuccess(true);
      setTimeout(() => setBasicUpdateSuccess(false), 3000);
      await offline.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Falha ao salvar grupo");
    } finally {
      setEditLoading(false);
    }
  }


  async function handleAddMemberToGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGroupId || !selectedUserToAdd) return;
    setMemberAddError("");
    setMemberAddLoading(true);

    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/groups/${editingGroupId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: selectedUserToAdd,
          isLeader: isLeaderRoleCheck,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar membro");

      setSelectedUserToAdd("");
      setIsLeaderRoleCheck(false);
      await offline.refresh();
    } catch (err) {
      setMemberAddError(err instanceof Error ? err.message : "Falha ao vincular membro");
    } finally {
      setMemberAddLoading(false);
    }
  }

  async function handleRemoveMemberFromGroup(userId: string) {
    if (!editingGroupId) return;
    if (!confirm("Remover este membro do grupo?")) return;

    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/groups/${editingGroupId}/members`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao remover participante");
      await offline.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao remover participante");
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 pb-20">
      <NavHeader />
      <main className="mx-auto max-w-lg px-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Grupos de Comunhão</h1>
            <p className="text-xs text-slate-500">{activeGroups.length} grupos cadastrados</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-900"
          >
            + Novo Grupo
          </button>
        </div>

        {/* Lista de Grupos */}
        <div className="mt-6 space-y-3">
          {activeGroups.length ? (
            activeGroups.map((group) => {
              const leaders = offline.users.filter((u) => group.leaderIds.includes(u.id));
              return (
                <article
                  key={group.id}
                  onClick={() => openEditModal(group.id)}
                  className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs cursor-pointer hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-slate-900">{group.name}</h3>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      {group.participantIds.length} participantes
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">{group.description || "Sem descrição."}</p>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2 text-xs text-slate-500">
                    <span>Líderes: {leaders.map((l) => l.name).join(", ") || "Nenhum atribuído"}</span>
                    <span className="font-semibold text-emerald-800">Gerenciar →</span>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">
              Nenhum grupo de comunhão cadastrado.
            </div>
          )}
        </div>
      </main>

      {/* Modal Criar Grupo */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Novo Grupo de Comunhão</h2>
            {createError && <p className="mt-2 text-xs font-semibold text-rose-700">{createError}</p>}

            <form onSubmit={handleCreateGroup} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">Nome do Grupo *</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  placeholder="ex: Comunhão & Fé"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Descrição</label>
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  placeholder="Horários, local ou foco do grupo…"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
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
                  {createLoading ? "Salvando…" : "Criar Grupo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Grupo & Gerenciar Participantes */}
      {editingGroupId && editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <h2 className="text-lg font-bold">Editar Grupo: {editingGroup.name}</h2>
            {basicUpdateSuccess && (
              <p className="mt-2 text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                ✓ Dados do grupo atualizados com sucesso!
              </p>
            )}
            {editError && <p className="mt-2 text-xs font-semibold text-rose-700">{editError}</p>}


            <form onSubmit={handleEditGroup} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">Nome do Grupo</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Descrição</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="groupActiveCheck"
                  checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                  className="size-4 rounded border-slate-300 text-emerald-800"
                />
                <label htmlFor="groupActiveCheck" className="text-xs font-semibold text-slate-800">
                  Grupo Ativo
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800"
                >
                  {editLoading ? "Salvando…" : "Atualizar Dados Básicos"}
                </button>
              </div>
            </form>

            {/* Lista de Membros Atualmente Vinculados */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Membros no Grupo ({editingGroup.participantIds.length})
              </h3>
              <div className="mt-2.5 space-y-2 max-h-48 overflow-y-auto pr-1">
                {editingGroup.participantIds.length ? (
                  editingGroup.participantIds
                    .map((memberId) => offline.users.find((u) => u.id === memberId))
                    .filter((u): u is NonNullable<typeof u> => Boolean(u))
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                    .map((member) => {
                      const isLeader = editingGroup.leaderIds.includes(member.id);
                      return (
                        <div key={member.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 border border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="grid size-8 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 shadow-2xs">
                              {member.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{member.name}</p>
                              <span className={`text-[10px] font-bold ${isLeader ? "text-amber-700" : "text-slate-500"}`}>
                                {isLeader ? "⭐ Líder do Grupo" : "Membro"}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveMemberFromGroup(member.id)}
                            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                          >
                            Desvincular
                          </button>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhum participante vinculado ainda.</p>
                )}
              </div>
            </div>

            {/* Adicionar Participante */}
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase">Adicionar Novo Participante / Líder</h3>
              {memberAddError && <p className="mt-1 text-xs text-rose-700">{memberAddError}</p>}

              <form onSubmit={handleAddMemberToGroup} className="mt-2 space-y-2">
                <select
                  required
                  value={selectedUserToAdd}
                  onChange={(e) => setSelectedUserToAdd(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                >
                  <option value="">Selecione uma pessoa para vincular…</option>
                  {offline.users
                    .filter((u) => !editingGroup.participantIds.includes(u.id))
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.type === "member" ? "Membro" : "Visitante"})
                      </option>
                    ))}
                </select>


                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={isLeaderRoleCheck}
                      onChange={(e) => setIsLeaderRoleCheck(e.target.checked)}
                      className="size-4 rounded border-slate-300 text-emerald-800"
                    />
                    Promover como Líder do Grupo
                  </label>

                  <button
                    type="submit"
                    disabled={memberAddLoading || !selectedUserToAdd}
                    className="rounded-xl bg-emerald-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-900"
                  >
                    {memberAddLoading ? "Vinculando…" : "+ Vincular ao Grupo"}
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingGroupId(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
