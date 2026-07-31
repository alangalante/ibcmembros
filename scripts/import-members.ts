import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { adminDb } from "../src/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { newVersion, SYNC_SCHEMA_VERSION } from "../src/lib/server/sync";

type LegacyMember = { id: string; nome: string; data_nascimento: string; telefone: string; foto_url: string; ativo: string };

async function run() {
  const source = process.argv[2] ?? "membros_rows.csv";
  const fileContent = await readFile(source);
  const rows = parse(fileContent, { columns: true, skip_empty_lines: true, bom: true }) as LegacyMember[];

  console.info(`Encontrados ${rows.length} registros no arquivo ${source}`);

  const chunkSize = 200;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const batch = adminDb.batch();
    const chunk = rows.slice(offset, offset + chunkSize);

    for (const row of chunk) {
      const phoneDigits = row.telefone.replace(/\D/g, "");
      const validPhone = !/^0+$/.test(phoneDigits) && phoneDigits.length >= 8;
      const userId = `legacy_${row.id}`;

      batch.set(adminDb.collection("users").doc(userId), {
        name: row.nome.trim(),
        nameSearch: row.nome.trim().toLocaleLowerCase("pt-BR"),
        birthMonthDay: row.data_nascimento.slice(5),
        phoneE164: validPhone ? `+${phoneDigits}` : "",
        photoUrl: null,
        photoPublicId: null,
        role: "common",
        type: "member",
        groupIds: [],
        active: row.ativo === "true",
        legacyId: Number(row.id),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      batch.set(adminDb.collection("userPrivate").doc(userId), {
        birthDate: row.data_nascimento,
        conversionDate: null,
        conversionReason: null,
        legacyPhotoPath: row.foto_url || null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    await batch.commit();
    console.info(`Importados ${Math.min(offset + chunkSize, rows.length)}/${rows.length}`);
  }

  await adminDb.collection("sync").doc("global").set({
    version: newVersion(),
    schemaVersion: SYNC_SCHEMA_VERSION,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  console.info("Importação e sincronização global concluídas com sucesso!");
}

run().catch((err) => {
  console.error("Erro durante a migração:", err);
  process.exit(1);
});
