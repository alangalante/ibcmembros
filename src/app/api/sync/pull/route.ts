import { NextRequest, NextResponse } from "next/server";
import { Timestamp, type DocumentSnapshot, type Query } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { datePartsInSaoPaulo } from "@/lib/date";
import { ApiError, authenticate, errorResponse, type AuthenticatedActor } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Entity = "user" | "group" | "membership" | "event";
type PullRecord = { entity: Entity; id: string; operation: "upsert" | "delete"; data?: Record<string, unknown> };

const chunks = <T,>(values: T[], size: number) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));

function plain(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
}

function record(entity: Entity, snapshot: DocumentSnapshot): PullRecord {
  return { entity, id: snapshot.id, operation: "upsert", data: plain(snapshot.data()) as Record<string, unknown> };
}

function canRead(actor: AuthenticatedActor, entity: Entity, snapshot: DocumentSnapshot) {
  if (actor.role === "admin") return true;
  const data = snapshot.data() ?? {};
  if (entity === "user") return data.active === true;
  if (entity === "group") return actor.groupIds.includes(snapshot.id);
  if (entity === "membership") return data.userId === actor.uid || actor.groupIds.includes(data.groupId);
  return data.scope === "global" || (data.groupIds ?? []).some((id: string) => actor.groupIds.includes(id));
}

async function fullSnapshot(actor: AuthenticatedActor) {
  const today = datePartsInSaoPaulo().isoDate;
  const usersPromise = adminDb.collection("users").where("active", "==", true).get();
  const groupsPromise = actor.role === "admin"
    ? adminDb.collection("groups").get()
    : actor.groupIds.length ? adminDb.getAll(...actor.groupIds.map((id) => adminDb.collection("groups").doc(id))) : Promise.resolve([]);
  const eventPromises = actor.role === "admin"
    ? [adminDb.collection("events").where("eventDate", ">=", today).get()]
    : [
        adminDb.collection("events").where("scope", "==", "global").where("eventDate", ">=", today).get(),
        ...chunks(actor.groupIds, 30).map((ids) => adminDb.collection("events").where("groupIds", "array-contains-any", ids).where("eventDate", ">=", today).get()),
      ];
  const [users, groups, eventSnapshots] = await Promise.all([usersPromise, groupsPromise, Promise.all(eventPromises)]);
  const groupDocs = Array.isArray(groups) ? groups.filter((item) => item.exists) : groups.docs;
  const eventDocs = [...new Map(eventSnapshots.flatMap((snapshot) => snapshot.docs).map((item) => [item.id, item])).values()];
  return [
    ...users.docs.map((item) => record("user", item)),
    ...groupDocs.map((item) => record("group", item)),
    ...eventDocs.map((item) => record("event", item)),
  ];
}

async function incremental(actor: AuthenticatedActor, since: Timestamp, until: Timestamp) {
  const base = adminDb.collection("changes");
  const queries: Query[] = [
    base.where("scope", "==", "global").where("changedAt", ">", since).where("changedAt", "<=", until).orderBy("changedAt").limit(500),
    base.where("userId", "==", actor.uid).where("changedAt", ">", since).where("changedAt", "<=", until).orderBy("changedAt").limit(500),
    ...chunks(actor.groupIds, 30).map((ids) => base.where("groupId", "in", ids).where("changedAt", ">", since).where("changedAt", "<=", until).orderBy("changedAt").limit(500)),
  ];
  const snapshots = await Promise.all(queries.map((item) => item.get()));
  if (snapshots.some((item) => item.size === 500)) return { records: await fullSnapshot(actor), full: true };

  const changes = [...new Map(snapshots.flatMap((snapshot) => snapshot.docs).map((item) => [item.id, item])).values()];
  const latestByEntity = new Map<string, FirebaseFirestore.DocumentData>();
  for (const change of changes) latestByEntity.set(`${change.get("entity")}:${change.get("entityId")}`, change.data());

  const records: PullRecord[] = [];
  for (const change of latestByEntity.values()) {
    const entity = change.entity as Entity;
    if (change.operation === "delete") { records.push({ entity, id: change.entityId, operation: "delete" }); continue; }
    const collection = entity === "user" ? "users" : entity === "group" ? "groups" : entity === "event" ? "events" : "groupMemberships";
    const snapshot = await adminDb.collection(collection).doc(change.entityId).get();
    if (!snapshot.exists || !canRead(actor, entity, snapshot)) records.push({ entity, id: change.entityId, operation: "delete" });
    else records.push(record(entity, snapshot));
  }
  return { records, full: false };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticate(request);
    const syncStartedAt = Timestamp.now();
    const cursor = request.nextUrl.searchParams.get("cursor");
    if (!cursor) return NextResponse.json({ full: true, cursor: syncStartedAt.toDate().toISOString(), records: await fullSnapshot(actor) });

    const parsedCursor = new Date(cursor);
    if (Number.isNaN(parsedCursor.getTime())) throw new ApiError(400, "Cursor inválido");
    const result = await incremental(actor, Timestamp.fromDate(parsedCursor), syncStartedAt);
    return NextResponse.json({ ...result, cursor: syncStartedAt.toDate().toISOString() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
