import { loadEnvConfig } from "@next/env";

export const PRODUCTION_PROJECT = "ibc-membros";

export function loadMigrationEnvironment() {
  loadEnvConfig(process.cwd());
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (projectId !== PRODUCTION_PROJECT) {
    throw new Error(`Projeto Firebase inválido: ${projectId || "não configurado"}. Esperado: ${PRODUCTION_PROJECT}.`);
  }
  return projectId;
}

export function requireProductionConfirmation(args: string[]) {
  const project = args.find((arg) => arg.startsWith("--project="))?.slice("--project=".length);
  if (!args.includes("--execute") || project !== PRODUCTION_PROJECT || !args.includes("--confirm=APAGAR-E-MIGRAR")) {
    throw new Error("Execução bloqueada. Use --execute --project=ibc-membros --confirm=APAGAR-E-MIGRAR após validar o backup.");
  }
}

export function jsonValue(value: unknown): unknown {
  if (value instanceof Date) return { __type: "date", value: value.toISOString() };
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return { __type: "timestamp", value: (value as { toDate: () => Date }).toDate().toISOString() };
  }
  if (Buffer.isBuffer(value)) return { __type: "buffer", value: value.toString("base64") };
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]));
  return value;
}
