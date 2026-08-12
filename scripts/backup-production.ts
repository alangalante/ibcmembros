import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadMigrationEnvironment, jsonValue } from "./migration-runtime";

async function run() {
  const projectId = loadMigrationEnvironment();
  const { adminAuth, adminDb } = await import("../src/lib/firebase/admin");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const output = path.resolve("migration-output", `backup-${projectId}-${timestamp}`);
  await mkdir(output, { recursive: true });

  const collections = await adminDb.listCollections();
  const firestore: Record<string, unknown>[] = [];
  async function backupCollection(collection: FirebaseFirestore.CollectionReference) {
    const snapshot = await collection.get();
    for (const doc of snapshot.docs) {
      firestore.push({ path: doc.ref.path, data: jsonValue(doc.data()) });
      for (const child of await doc.ref.listCollections()) await backupCollection(child);
    }
    console.info(`${collection.path}: ${snapshot.size} documentos`);
  }
  for (const collection of collections) await backupCollection(collection);

  const authUsers: unknown[] = [];
  let pageToken: string | undefined;
  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    authUsers.push(...page.users.map((user) => jsonValue(user.toJSON())));
    pageToken = page.pageToken;
  } while (pageToken);

  await Promise.all([
    writeFile(path.join(output, "firestore.json"), JSON.stringify(firestore, null, 2)),
    writeFile(path.join(output, "auth.json"), JSON.stringify(authUsers, null, 2)),
    writeFile(path.join(output, "manifest.json"), JSON.stringify({ projectId, createdAt: new Date().toISOString(), firestoreDocuments: firestore.length, authUsers: authUsers.length }, null, 2)),
  ]);
  console.info(`Backup concluído em ${output}`);
}

run().catch((error) => { console.error(error); process.exit(1); });
