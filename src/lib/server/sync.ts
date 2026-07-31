import { randomUUID } from "node:crypto";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { ChangeEntity, ChangeOperation } from "@/types/domain";

export const SYNC_SCHEMA_VERSION = 1;

export function newVersion() {
  return `${Date.now().toString(36)}_${randomUUID()}`;
}

type RecordChangeInput = {
  entity: ChangeEntity;
  entityId: string;
  operation: ChangeOperation;
  scope: "global" | "group" | "user";
  groupId?: string;
  userId?: string;
  actorId: string;
  participantIds?: string[];
};

export function recordChange(transaction: Transaction, input: RecordChangeInput) {
  const version = newVersion();
  const syncId = input.scope === "global" ? "global" : input.scope === "group" ? `group_${input.groupId}` : `user_${input.userId}`;
  transaction.set(adminDb.collection("sync").doc(syncId), {
    version,
    schemaVersion: SYNC_SCHEMA_VERSION,
    updatedAt: FieldValue.serverTimestamp(),
    ...(input.scope === "group" ? { participantIds: input.participantIds ?? [] } : {}),
  }, { merge: true });
  transaction.create(adminDb.collection("changes").doc(), {
    entity: input.entity,
    entityId: input.entityId,
    operation: input.operation,
    scope: input.scope,
    groupId: input.groupId ?? null,
    userId: input.userId ?? null,
    actorId: input.actorId,
    version,
    changedAt: FieldValue.serverTimestamp(),
  });
  return version;
}

export function recordAudit(transaction: Transaction, actorId: string, action: string, targetId: string) {
  transaction.create(adminDb.collection("auditLogs").doc(), {
    actorId, action, targetId, createdAt: FieldValue.serverTimestamp(),
  });
}
