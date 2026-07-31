import type { MulticastMessage } from "firebase-admin/messaging";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb, adminMessaging } from "./firebase/admin";

type PushInput = {
  userIds: string[];
  title: string;
  body: string;
  link: string;
  image?: string | null;
  data?: Record<string, string>;
};

const chunks = <T,>(values: T[], size: number) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, i) => values.slice(i * size, (i + 1) * size));

async function tokensForUsers(userIds: string[]) {
  const tokenDocs = await Promise.all(userIds.map((uid) => adminDb.collection("users").doc(uid).collection("devices")
    .where("enabled", "==", true).get()));
  return tokenDocs.flatMap((snapshot) => snapshot.docs.map((doc) => ({ ref: doc.ref, token: String(doc.get("token")) })));
}

export async function sendPush(input: PushInput) {
  const devices = await tokensForUsers([...new Set(input.userIds)]);
  let sent = 0;
  let failed = 0;

  for (const batch of chunks(devices, 500)) {
    const message: MulticastMessage = {
      tokens: batch.map((device) => device.token),
      notification: { title: input.title, body: input.body, ...(input.image ? { imageUrl: input.image } : {}) },
      data: { link: input.link, ...input.data },
      webpush: {
        fcmOptions: { link: input.link },
        notification: {
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          ...(input.image ? { image: input.image } : {}),
          actions: [{ action: "open", title: input.link.includes("wa.me") ? "Abrir WhatsApp" : "Ver evento" }],
        },
      },
    };
    const result = await adminMessaging.sendEachForMulticast(message);
    sent += result.successCount;
    failed += result.failureCount;
    const invalidCodes = new Set(["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]);
    await Promise.all(result.responses.map((response, index) =>
      !response.success && invalidCodes.has(response.error?.code ?? "") ? batch[index].ref.delete() : Promise.resolve()));
  }
  return { sent, failed };
}

export async function activeUserIds(groupIds?: string[]) {
  if (!groupIds?.length) {
    const snapshot = await adminDb.collection("users").where("active", "==", true).select(FieldPath.documentId()).get();
    return snapshot.docs.map((doc) => doc.id);
  }

  const snapshots = await Promise.all(chunks(groupIds, 30).map((ids) =>
    adminDb.collection("users").where("active", "==", true).where("groupIds", "array-contains-any", ids).get()));
  return [...new Set(snapshots.flatMap((snapshot) => snapshot.docs.map((doc) => doc.id)))];
}
