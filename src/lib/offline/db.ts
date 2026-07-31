"use client";

export type CacheEntity = "user" | "group" | "membership" | "event";
export type CachedRecord = { key: string; entity: CacheEntity; id: string; data: Record<string, unknown> };
export type PullRecord = { entity: CacheEntity; id: string; operation: "upsert" | "delete"; data?: Record<string, unknown> };

const DATABASE_VERSION = 1;

function databaseName(uid: string) { return `ibc-cache-${uid.replace(/[^a-zA-Z0-9_-]/g, "_")}`; }

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function openUserCache(uid: string) {
  const request = indexedDB.open(databaseName(uid), DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains("records")) {
      const records = database.createObjectStore("records", { keyPath: "key" });
      records.createIndex("entity", "entity");
    }
    if (!database.objectStoreNames.contains("meta")) database.createObjectStore("meta", { keyPath: "key" });
  };
  return requestResult(request);
}

export async function readRecords(database: IDBDatabase, entity: CacheEntity) {
  const transaction = database.transaction("records", "readonly");
  const records = await requestResult(transaction.objectStore("records").index("entity").getAll(entity)) as CachedRecord[];
  await transactionDone(transaction);
  return records;
}

export async function readMeta<T>(database: IDBDatabase, key: string): Promise<T | null> {
  const transaction = database.transaction("meta", "readonly");
  const result = await requestResult(transaction.objectStore("meta").get(key)) as { key: string; value: T } | undefined;
  await transactionDone(transaction);
  return result?.value ?? null;
}

export async function applyPull(database: IDBDatabase, records: PullRecord[], full: boolean) {
  const transaction = database.transaction("records", "readwrite");
  const store = transaction.objectStore("records");
  if (full) store.clear();
  for (const item of records) {
    const key = `${item.entity}:${item.id}`;
    if (item.operation === "delete") store.delete(key);
    else store.put({ key, entity: item.entity, id: item.id, data: item.data ?? {} } satisfies CachedRecord);
  }
  await transactionDone(transaction);
}

export async function writeMeta(database: IDBDatabase, values: Record<string, unknown>) {
  const transaction = database.transaction("meta", "readwrite");
  const store = transaction.objectStore("meta");
  Object.entries(values).forEach(([key, value]) => store.put({ key, value }));
  await transactionDone(transaction);
}

export async function deleteUserCache(uid: string) {
  await requestResult(indexedDB.deleteDatabase(databaseName(uid)));
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(`ibc-${uid}-`)).map((name) => caches.delete(name)));
  }
}
