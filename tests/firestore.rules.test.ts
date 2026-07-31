import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "ibc-membros-rules-test",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "users", "admin"), { name: "Admin", role: "admin", active: true, groupIds: [] });
    await setDoc(doc(db, "users", "member"), { name: "Membro", role: "common", active: true, groupIds: [] });
    await setDoc(doc(db, "userPrivate", "member"), { birthDate: "1975-03-09", conversionDate: null });
  });
});

afterAll(async () => environment.cleanup());

describe("privacidade da data de nascimento", () => {
  it("permite que admin leia dados privados", async () => {
    await assertSucceeds(getDoc(doc(environment.authenticatedContext("admin").firestore(), "userPrivate", "member")));
  });

  it("nega dados privados a membro", async () => {
    await assertFails(getDoc(doc(environment.authenticatedContext("member").firestore(), "userPrivate", "member")));
  });

  it("permite perfil público ativo sem o ano", async () => {
    await assertSucceeds(getDoc(doc(environment.authenticatedContext("member").firestore(), "users", "admin")));
  });

  it("nega escrita direta até mesmo para admin", async () => {
    await assertFails(setDoc(doc(environment.authenticatedContext("admin").firestore(), "userPrivate", "member"), { birthDate: "2000-01-01" }));
  });

  it("nega escrita direta de grupos pelo cliente (forçando uso de API transacional)", async () => {
    await assertFails(setDoc(doc(environment.authenticatedContext("admin").firestore(), "groups", "g1"), { name: "Grupo Teste" }));
  });

  it("nega escrita direta de eventos pelo cliente (forçando uso de API transacional)", async () => {
    await assertFails(setDoc(doc(environment.authenticatedContext("admin").firestore(), "events", "e1"), { title: "Evento Teste" }));
  });
});

