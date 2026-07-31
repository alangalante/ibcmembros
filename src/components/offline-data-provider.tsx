"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { openUserCache, readRecords } from "@/lib/offline/db";
import { synchronize } from "@/lib/offline/sync-engine";
import type { ChurchEvent, CommunityGroup, UserProfile } from "@/types/domain";

type CachedUser = Omit<UserProfile, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string };
type CachedGroup = Omit<CommunityGroup, "createdAt" | "updatedAt"> & { id: string; createdAt?: string; updatedAt?: string };
type CachedEvent = Omit<ChurchEvent, "startsAt" | "createdAt" | "updatedAt"> & { id: string; startsAt?: string; createdAt?: string; updatedAt?: string };
type SyncStatus = "idle" | "loading-cache" | "syncing" | "ready" | "offline";

type OfflineData = {
  users: Array<CachedUser & { id: string }>;
  groups: CachedGroup[];
  events: CachedEvent[];
  status: SyncStatus;
  refresh: () => Promise<void>;
};

const OfflineDataContext = createContext<OfflineData>({ users: [], groups: [], events: [], status: "idle", refresh: async () => undefined });

export function OfflineDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<OfflineData["users"]>([]);
  const [groups, setGroups] = useState<CachedGroup[]>([]);
  const [events, setEvents] = useState<CachedEvent[]>([]);
  const [status, setStatus] = useState<SyncStatus>("idle");

  const load = useCallback(async (database: IDBDatabase) => {
    const [userRecords, groupRecords, eventRecords] = await Promise.all([
      readRecords(database, "user"), readRecords(database, "group"), readRecords(database, "event"),
    ]);
    setUsers(userRecords.map((item) => ({ id: item.id, ...item.data } as OfflineData["users"][number])));
    setGroups(groupRecords.map((item) => ({ id: item.id, ...item.data } as CachedGroup)));
    setEvents(eventRecords.map((item) => ({ id: item.id, ...item.data } as CachedEvent)));
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setStatus("syncing");
    try {
      const result = await synchronize(user);
      await load(result.database);
      result.database.close();
      setStatus("ready");
    } catch {
      const database = await openUserCache(user.uid);
      await load(database);
      database.close();
      setStatus("offline");
    }
  }, [load, user]);

  useEffect(() => {
    if (!user) { setUsers([]); setGroups([]); setEvents([]); setStatus("idle"); return; }
    let cancelled = false;
    setStatus("loading-cache");
    openUserCache(user.uid)
      .then(async (database) => {
        if (!cancelled) await load(database);
        database.close();
        if (!cancelled) await refresh();
      })
      .catch((err) => {
        console.warn("Falha ao abrir IndexedDB local:", err);
        if (!cancelled) setStatus("offline");
      });
    return () => { cancelled = true; };
  }, [load, refresh, user]);


  return <OfflineDataContext.Provider value={{ users, groups, events, status, refresh }}>{children}</OfflineDataContext.Provider>;
}

export const useOfflineData = () => useContext(OfflineDataContext);
