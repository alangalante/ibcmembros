import { adminAuth, adminDb } from "../src/lib/firebase/admin";
import { phoneToInternalEmail } from "../src/lib/phone-auth";

async function run() {
  console.info("Iniciando geração de contas Auth para os membros pelo telefone...");

  const usersSnapshot = await adminDb.collection("users").get();
  console.info(`Localizados ${usersSnapshot.size} cadastros no Firestore.`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const userDoc of usersSnapshot.docs) {
    const data = userDoc.data();
    const phone = data.phoneE164 || "";
    const digits = phone.replace(/\D/g, "");

    if (!digits || digits.length < 8) {
      skippedCount++;
      continue;
    }

    const email = phoneToInternalEmail(digits);
    // Senha inicial: 6 últimos dígitos do telefone
    const initialPassword = digits.slice(-6).padStart(6, "0");

    let authUid: string;

    try {
      // Verifica se a conta Auth já existe
      const existingUser = await adminAuth.getUserByEmail(email);
      authUid = existingUser.uid;
    } catch {
      // Cria nova conta no Firebase Auth
      const newUser = await adminAuth.createUser({
        email,
        password: initialPassword,
        displayName: data.name,
        disabled: !data.active,
      });
      authUid = newUser.uid;
      createdCount++;
    }

    // Se o ID do documento no Firestore for diferente do UID do Auth (ex: legacy_1),
    // vinculamos/re-salvamos para que a autenticação no app funcione perfeitamente.
    if (userDoc.id !== authUid) {
      const privateDoc = await adminDb.collection("userPrivate").doc(userDoc.id).get();

      // Copia dados públicos para o novo UID do Auth
      await adminDb.collection("users").doc(authUid).set({
        ...data,
        updatedAt: new Date(),
      }, { merge: true });

      // Copia dados privados se existirem
      if (privateDoc.exists) {
        await adminDb.collection("userPrivate").doc(authUid).set({
          ...privateDoc.data(),
          updatedAt: new Date(),
        }, { merge: true });
      }

      // Se for o admin Alan, garante que a nova conta criada com o UID do Auth também seja admin
      if (data.role === "admin") {
        await adminDb.collection("users").doc(authUid).update({ role: "admin" });
      }
    }
  }

  console.info(`✅ Concluído com sucesso!`);
  console.info(`- Contas criadas no Firebase Auth: ${createdCount}`);
  console.info(`- Sem telefone válido ignorados: ${skippedCount}`);
}

run().catch((err) => {
  console.error("Erro na geração de contas:", err);
  process.exit(1);
});
