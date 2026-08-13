import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { FieldValue } from "firebase-admin/firestore";
import { loadMigrationEnvironment } from "./migration-runtime";

type Photo = { name: string; username: string; file: string };

async function run() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  if (!args.includes("--execute") || !args.includes("--project=ibc-membros") || !args.includes("--confirm=PUBLICAR-FOTOS")) throw new Error("Publicação bloqueada.");
  loadMigrationEnvironment();
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Credenciais do Cloudinary ausentes.");
  const manifest = JSON.parse(await readFile("migration-output/profile-photo-manifest.json", "utf8")) as Photo[];
  if (manifest.length !== 295) throw new Error(`Manifesto inesperado: ${manifest.length} fotos; esperado: 295.`);
  const { adminDb } = await import("../src/lib/firebase/admin");
  let completed = 0;

  for (const photo of manifest) {
    const userSnapshot = await adminDb.collection("users").where("username", "==", photo.username).limit(1).get();
    if (userSnapshot.empty) throw new Error(`Usuário não encontrado: ${photo.username}`);
    const user = userSnapshot.docs[0];
    const publicId = `ibc-membros/members/${photo.username}`;
    if (!force && user.get("photoPublicId") === publicId && user.get("photoUrl")) { completed++; continue; }
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash("sha1").update(`invalidate=true&overwrite=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
    const form = new FormData();
    form.set("file", new Blob([await readFile(photo.file)], { type: "image/webp" }), `${photo.username}.webp`);
    form.set("api_key", apiKey); form.set("timestamp", String(timestamp)); form.set("public_id", publicId); form.set("overwrite", "true"); form.set("invalidate", "true"); form.set("signature", signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
    const result = await response.json() as { secure_url?: string; public_id?: string; error?: { message?: string } };
    if (!response.ok || !result.secure_url) throw new Error(`Cloudinary (${photo.username}): ${result.error?.message || response.status}`);
    await user.ref.update({ photoUrl: result.secure_url, photoPublicId: result.public_id || publicId, updatedAt: FieldValue.serverTimestamp() });
    completed++;
    if (completed % 20 === 0) console.info(`${completed}/${manifest.length} fotos publicadas`);
  }
  await adminDb.collection("sync").doc("global").set({ version: Date.now().toString(), schemaVersion: 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.info(`${completed} fotos publicadas e vinculadas.`);
}
run().catch((error) => { console.error(error); process.exit(1); });
