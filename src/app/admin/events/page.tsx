"use client";

import { useState } from "react";
import { NavHeader } from "@/components/nav-header";
import { useAuth } from "@/components/auth-provider";
import { useOfflineData } from "@/components/offline-data-provider";
import { ConfirmModal } from "@/components/confirm-modal";
import { uploadAgendaPdf } from "@/lib/pdf";
import { todayIso } from "@/lib/agenda";

export default function AdminEventsPage() {
  const { user } = useAuth();
  const offline = useOfflineData();
  const today = todayIso();

  const currentUser = offline.users.find((u) => u.id === user?.uid);
  const isAdmin = currentUser?.role === "admin" || user?.email?.startsWith("22999947318");
  const isLeader = currentUser?.role === "leader";
  const canManage = isAdmin || isLeader;

  // Modal Criar Evento
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    eventDate: "",
    time: "19:00",
    scope: "global" as "global" | "groups",
    groupIds: [] as string[],
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createPdf, setCreatePdf] = useState<File | null>(null);

  // Modal Editar Evento
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    eventDate: "",
    time: "19:00",
    scope: "global" as "global" | "groups",
    groupIds: [] as string[],
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editPdf, setEditPdf] = useState<File | null>(null);

  // Modal Confirmação de Exclusão
  const [deleteTargetEventId, setDeleteTargetEventId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  if (!canManage) {
    return (
      <div className="min-h-dvh bg-slate-50 text-slate-900">
        <NavHeader />
        <main className="mx-auto max-w-lg p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">Acesso Restrito a Líderes e Administradores</p>
        </main>
      </div>
    );
  }

  const userGroupIds = currentUser?.groupIds || [];
  const events = offline.events
    .filter((ev) => isAdmin || ev.scope === "global" || (ev.groupIds || []).some((gId) => userGroupIds.includes(gId)))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);

    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Sessão expirada");
      const pdf = createPdf ? await uploadAgendaPdf(createPdf, token) : { pdfUrl: null, pdfPublicId: null };
      const startsAtIso = new Date(`${createForm.eventDate}T${createForm.time}:00-03:00`).toISOString();

      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: createForm.title,
          description: createForm.description,
          eventDate: createForm.eventDate,
          startsAtIso,
          scope: createForm.scope,
          groupIds: createForm.scope === "global" ? [] : createForm.groupIds,
          ...pdf,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar agenda");

      setShowCreateModal(false);
      setCreatePdf(null);
      setCreateForm({
        title: "",
        description: "",
        eventDate: "",
        time: "19:00",
        scope: "global",
        groupIds: [],
      });
      await offline.refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Falha ao cadastrar agenda");
    } finally {
      setCreateLoading(false);
    }
  }

  function openEditModal(eventId: string) {
    const ev = offline.events.find((e) => e.id === eventId);
    if (!ev) return;

    let timeStr = "19:00";
    if (ev.startsAt) {
      try {
        const d = new Date(ev.startsAt);
        if (!isNaN(d.getTime())) {
          timeStr = d.toTimeString().slice(0, 5);
        }
      } catch {
        /* usa 19:00 fallback */
      }
    }

    setEditingEventId(eventId);
    setEditForm({
      title: ev.title,
      description: ev.description || "",
      eventDate: ev.eventDate,
      time: timeStr,
      scope: ev.scope,
      groupIds: ev.groupIds || [],
    });
    setEditError("");
    setEditPdf(null);
  }

  async function handleEditEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEventId) return;
    setEditError("");
    setEditLoading(true);

    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Sessão expirada");
      const current = offline.events.find((item) => item.id === editingEventId);
      const pdf = editPdf ? await uploadAgendaPdf(editPdf, token) : { pdfUrl: current?.pdfUrl ?? null, pdfPublicId: current?.pdfPublicId ?? null };
      const startsAtIso = new Date(`${editForm.eventDate}T${editForm.time}:00-03:00`).toISOString();

      const res = await fetch(`/api/admin/events/${editingEventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          eventDate: editForm.eventDate,
          startsAtIso,
          scope: editForm.scope,
          groupIds: editForm.scope === "global" ? [] : editForm.groupIds,
          ...pdf,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar agenda");

      setEditingEventId(null);
      await offline.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Falha ao salvar agenda");
    } finally {
      setEditLoading(false);
    }
  }

  async function executeDeleteEvent() {
    if (!deleteTargetEventId) return;
    setDeleteLoading(true);

    try {
      const token = await user?.getIdToken();
      const res = await fetch(`/api/admin/events/${deleteTargetEventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao excluir agenda");
      }
      setDeleteTargetEventId(null);
      await offline.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Falha ao excluir agenda");
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
            <h1 className="text-2xl font-bold">Gestão da Agenda</h1>
            <p className="text-xs text-slate-500">{events.length} itens programados</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-900"
          >
            + Nova Agenda
          </button>
        </div>

        {/* Lista de Eventos */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.length ? (
            events.map((ev) => {
              const passed = ev.eventDate < today;
              const targetGroupNames = (ev.groupIds || [])
                .map((gId) => offline.groups.find((g) => g.id === gId)?.name)
                .filter(Boolean)
                .join(", ");

              const canEditOrDelete = isAdmin || ev.createdBy === user?.uid;

              return (
                <article key={ev.id} className={`rounded-2xl border p-4 shadow-xs transition ${passed ? "border-slate-200 bg-slate-100 opacity-50 grayscale" : "border-slate-100 bg-white"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${ev.scope === "global" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900 border border-amber-200"}`}>
                      {ev.scope === "global" ? "🌐 Global" : `👥 ${targetGroupNames || "Grupo Restrito"}`}
                    </span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {ev.eventDate.split("-").reverse().join("/")}
                    </span>
                  </div>
                  {passed && <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Já passou</p>}

                  <h3 className="mt-2 font-bold text-base text-slate-900">{ev.title}</h3>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">{ev.description || "Sem descrição."}</p>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2">
                    <a href={`/events/${ev.id}`} className="text-xs font-semibold text-emerald-800 hover:underline">
                      Ver detalhes →
                    </a>
                    {canEditOrDelete && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(ev.id)}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setDeleteTargetEventId(ev.id)}
                          className="text-xs font-semibold text-rose-600 hover:underline"
                        >
                          Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">
              Nenhuma agenda programada.
            </div>
          )}
        </div>
      </main>

      {/* Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetEventId)}
        title="IBC Membros"
        message="Tem certeza que deseja excluir permanentemente esta agenda?"
        confirmText={deleteLoading ? "Excluindo…" : "Excluir Agenda"}
        cancelText="Cancelar"
        isDanger={true}
        onConfirm={executeDeleteEvent}
        onCancel={() => setDeleteTargetEventId(null)}
      />

      {/* Modal Criar Evento */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <h2 className="text-lg font-bold">Nova Agenda</h2>
            {createError && <p className="mt-2 text-xs font-semibold text-rose-700">{createError}</p>}

            <form onSubmit={handleCreateEvent} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">Título da Agenda *</label>
                <input
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  placeholder="ex: Culto de Celebração"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Data *</label>
                  <input
                    type="date"
                    required
                    value={createForm.eventDate}
                    onChange={(e) => setCreateForm({ ...createForm, eventDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Horário *</label>
                  <input
                    type="time"
                    required
                    value={createForm.time}
                    onChange={(e) => setCreateForm({ ...createForm, time: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Descrição</label>
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  placeholder="Informações adicionais da agenda…"
                />
              </div>

              <div><label className="block text-xs font-bold text-slate-700">PDF (opcional, até 4 MB)</label><input type="file" accept="application/pdf,.pdf" onChange={(e) => setCreatePdf(e.target.files?.[0] || null)} className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs" /></div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Alcance *</label>
                <select
                  value={createForm.scope}
                  onChange={(e) => setCreateForm({ ...createForm, scope: e.target.value as "global" | "groups" })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  disabled={isLeader && !isAdmin}
                >
                  {isAdmin && <option value="global">Global (Toda a igreja)</option>}
                  <option value="groups">Restrito a Grupos Específicos</option>
                </select>
              </div>

              {createForm.scope === "groups" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700">Selecione os Grupos *</label>
                  <div className="mt-1 space-y-1.5 max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2">
                    {offline.groups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-xs text-slate-800">
                        <input
                          type="checkbox"
                          checked={createForm.groupIds.includes(g.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm({ ...createForm, groupIds: [...createForm.groupIds, g.id] });
                            } else {
                              setCreateForm({ ...createForm, groupIds: createForm.groupIds.filter((id) => id !== g.id) });
                            }
                          }}
                          className="size-4 rounded border-slate-300 text-emerald-800"
                        />
                        {g.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
                  {createLoading ? "Cadastrando…" : "Criar Agenda"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Evento */}
      {editingEventId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <h2 className="text-lg font-bold">Editar Agenda</h2>
            {editError && <p className="mt-2 text-xs font-semibold text-rose-700">{editError}</p>}

            <form onSubmit={handleEditEvent} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">Título da Agenda *</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Data *</label>
                  <input
                    type="date"
                    required
                    value={editForm.eventDate}
                    onChange={(e) => setEditForm({ ...editForm, eventDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Horário *</label>
                  <input
                    type="time"
                    required
                    value={editForm.time}
                    onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Descrição</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>

              <div><label className="block text-xs font-bold text-slate-700">Substituir PDF (opcional, até 4 MB)</label><input type="file" accept="application/pdf,.pdf" onChange={(e) => setEditPdf(e.target.files?.[0] || null)} className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-xs" /></div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Alcance *</label>
                <select
                  value={editForm.scope}
                  onChange={(e) => setEditForm({ ...editForm, scope: e.target.value as "global" | "groups" })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  disabled={isLeader && !isAdmin}
                >
                  {isAdmin && <option value="global">Global (Toda a igreja)</option>}
                  <option value="groups">Restrito a Grupos Específicos</option>
                </select>
              </div>

              {editForm.scope === "groups" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700">Selecione os Grupos *</label>
                  <div className="mt-1 space-y-1.5 max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2">
                    {offline.groups.map((g) => (
                      <label key={g.id} className="flex items-center gap-2 text-xs text-slate-800">
                        <input
                          type="checkbox"
                          checked={editForm.groupIds.includes(g.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditForm({ ...editForm, groupIds: [...editForm.groupIds, g.id] });
                            } else {
                              setEditForm({ ...editForm, groupIds: editForm.groupIds.filter((id) => id !== g.id) });
                            }
                          }}
                          className="size-4 rounded border-slate-300 text-emerald-800"
                        />
                        {g.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEventId(null)}
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
