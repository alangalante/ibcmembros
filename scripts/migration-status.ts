import { loadMigrationEnvironment } from "./migration-runtime";

async function run() {
  loadMigrationEnvironment();
  const { adminAuth, adminDb } = await import("../src/lib/firebase/admin");
  const names = ["users", "userPrivate", "groups", "groupMemberships", "events"];
  const counts = Object.fromEntries(await Promise.all(names.map(async (name) => [name, (await adminDb.collection(name).count().get()).data().count])));
  let authUsers = 0; let token: string | undefined;
  do { const page = await adminAuth.listUsers(1000, token); authUsers += page.users.length; token = page.pageToken; } while (token);
  const alan = await adminDb.collection("users").where("username", "==", "alanc.galante").get();
  console.info(JSON.stringify({ ...counts, authUsers, alan: alan.docs.map((doc) => ({ uid: doc.id, role: doc.get("role"), mustChangePassword: doc.get("mustChangePassword") })) }, null, 2));
}
run().catch((error) => { console.error(error); process.exit(1); });
