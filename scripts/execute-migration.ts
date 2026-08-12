import { readFile } from "node:fs/promises";
import { FieldValue } from "firebase-admin/firestore";
import { loadMigrationEnvironment, requireProductionConfirmation } from "./migration-runtime";

type PreviewMember = { name: string; nameSearch?: string; username: string; initialPassword: string; birthDate: string | null; phoneE164: string; secondaryPhone: string; nickname: string; group: string | null; role: "admin" | "leader" | "common"; photo: string | null };
type PreviewGroup = { name: string; participantUsernames: string[]; leaderNames: string[] };

const RESET_COLLECTIONS = ["changes", "auditLogs", "groupMemberships", "groups", "events", "userPrivate", "users", "sync"];

async function deleteCollection(adminDb: FirebaseFirestore.Firestore, name: string) {
  while (true) {
    const snapshot = await adminDb.collection(name).limit(250).get();
    if (snapshot.empty) return;
    for (const doc of snapshot.docs) {
      for (const child of await doc.ref.listCollections()) await deleteCollection(adminDb, child.path);
    }
    const batch = adminDb.batch(); snapshot.docs.forEach((doc) => batch.delete(doc.ref)); await batch.commit();
  }
}

async function run() {
  const args = process.argv.slice(2);
  const resume = args.includes("--resume");
  if (!resume) requireProductionConfirmation(args);
  else if (!args.includes("--execute") || !args.includes("--project=ibc-membros") || !args.includes("--confirm=RETOMAR-MIGRACAO")) throw new Error("Retomada bloqueada.");
  loadMigrationEnvironment();
  const preview = JSON.parse(await readFile("migration-output/migration-preview.json", "utf8")) as { members: PreviewMember[]; groups: PreviewGroup[] };
  if (preview.members.length !== 381 || preview.groups.length !== 17) throw new Error("Prévia divergente: esperado 381 membros e 17 grupos.");
  const { adminAuth, adminDb } = await import("../src/lib/firebase/admin");

  if (!resume) {
    console.info("Apagando documentos antigos do Firestore...");
    for (const collection of RESET_COLLECTIONS) await deleteCollection(adminDb, collection);
    console.info("Apagando contas antigas do Firebase Auth...");
    while (true) {
      const page = await adminAuth.listUsers(1000);
      if (!page.users.length) break;
      for (let index = 0; index < page.users.length; index += 1000) await adminAuth.deleteUsers(page.users.slice(index, index + 1000).map((user) => user.uid));
    }
  }

  const uidByUsername = new Map<string, string>();
  for (const member of preview.members) {
    const email = `${member.username}@ibcmembros.internal`;
    let auth;
    try { auth = await adminAuth.getUserByEmail(email); }
    catch (error: unknown) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
      auth = await adminAuth.createUser({ email, password: member.initialPassword, displayName: member.name, disabled: false });
    }
    uidByUsername.set(member.username, auth.uid);
    await Promise.all([
      adminDb.collection("users").doc(auth.uid).set({ name: member.name, nameSearch: member.name.toLocaleLowerCase("pt-BR"), username: member.username, birthMonthDay: member.birthDate?.slice(5) || "", phoneE164: member.phoneE164 || "", photoUrl: null, photoPublicId: null, mustChangePassword: true, role: member.role, type: "member", groupIds: [], active: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }),
      adminDb.collection("userPrivate").doc(auth.uid).set({ birthDate: member.birthDate, nickname: member.nickname || "", secondaryPhone: member.secondaryPhone || "", sourcePhotoPath: member.photo, conversionDate: null, conversionReason: null, updatedAt: FieldValue.serverTimestamp() }),
    ]);
  }

  for (const group of preview.groups) {
    const groupId = group.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const groupRef = adminDb.collection("groups").doc(groupId);
    const participantIds = group.participantUsernames.map((username) => uidByUsername.get(username)).filter((uid): uid is string => Boolean(uid));
    const leaderIds = group.leaderNames.map((name) => preview.members.find((member) => member.name === name)).map((member) => member && uidByUsername.get(member.username)).filter((uid): uid is string => Boolean(uid));
    await groupRef.set({ name: group.name, description: "", leaderIds, participantIds, active: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    const batch = adminDb.batch();
    participantIds.forEach((uid) => {
      batch.set(adminDb.collection("groupMemberships").doc(`${groupRef.id}_${uid}`), { groupId: groupRef.id, userId: uid, isLeader: leaderIds.includes(uid), active: true, joinedAt: FieldValue.serverTimestamp() });
      batch.update(adminDb.collection("users").doc(uid), { groupIds: FieldValue.arrayUnion(groupRef.id), updatedAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();
  }
  await adminDb.collection("sync").doc("global").set({ version: Date.now().toString(), schemaVersion: 1, updatedAt: FieldValue.serverTimestamp() });
  console.info("Migração concluída. Fotos permanecem sem publicação até a revisão humana.");
}

run().catch((error) => { console.error(error); process.exit(1); });
