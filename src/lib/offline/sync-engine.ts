"use client";

import type { User } from "firebase/auth";
import { applyPull, deleteUserCache, openUserCache, readMeta, writeMeta, type PullRecord } from "./db";

type Manifest = { schemaVersion: number; global: unknown; user: unknown; groups: Record<string, unknown> };
type PullResponse = { full: boolean; cursor: string; records: PullRecord[] };

async function authorizedJson<T>(user: User, url: string): Promise<T> {
  const token = await user.getIdToken();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`Falha na sincronização (${response.status})`);
  return response.json() as Promise<T>;
}

export async function synchronize(user: User) {
  const manifest = await authorizedJson<Manifest>(user, "/api/sync/manifest");
  let database = await openUserCache(user.uid);
  const [localSchema, localManifest, cursor] = await Promise.all([
    readMeta<number>(database, "schemaVersion"),
    readMeta<Manifest>(database, "manifest"),
    readMeta<string>(database, "cursor"),
  ]);

  if (localSchema !== null && localSchema !== manifest.schemaVersion) {
    database.close();
    await deleteUserCache(user.uid);
    database = await openUserCache(user.uid);
  }

  const unchanged = cursor && JSON.stringify(localManifest) === JSON.stringify(manifest);
  if (unchanged) return { database, changed: false };

  const url = new URL("/api/sync/pull", window.location.origin);
  if (cursor && localSchema === manifest.schemaVersion) url.searchParams.set("cursor", cursor);
  const pull = await authorizedJson<PullResponse>(user, url.toString());
  await applyPull(database, pull.records, pull.full);
  await writeMeta(database, {
    schemaVersion: manifest.schemaVersion,
    manifest,
    cursor: pull.cursor,
    lastSyncedAt: new Date().toISOString(),
  });
  return { database, changed: true };
}
