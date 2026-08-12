import { z } from "zod";

export const phoneE164 = z.preprocess(
  (val) => {
    if (typeof val !== "string") return val;
    let digits = val.replace(/\D/g, "");
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
      digits = digits.slice(2);
    }
    return digits;
  },
  z.string().regex(/^\d{10,11}$/, "Telefone inválido (informe DDD + Número com 10 ou 11 dígitos)")
);

export const optionalPhoneE164 = z.preprocess(
  (val) => typeof val === "string" ? val.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "") : val,
  z.union([z.literal(""), z.string().regex(/^\d{10,11}$/, "Telefone inválido (informe DDD + Número)")])
);

export const username = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:\.[a-z0-9]+)+$/, "Usuário inválido").min(4).max(80);
export const optionalBirthDate = z.union([z.literal(""), z.iso.date()]).transform((value) => value || null);

export const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  birthDate: optionalBirthDate,
  phoneE164: optionalPhoneE164,
  photoUrl: z.url().nullable(),
  photoPublicId: z.string().trim().max(300).nullable().default(null),
  role: z.enum(["admin", "leader", "common"]),
  type: z.enum(["member", "visitor"]),
  conversionDate: z.iso.date().nullable(),
  conversionReason: z.string().trim().max(500).nullable(),
}).superRefine((data, ctx) => {
  if (data.type === "member" && Boolean(data.conversionDate) !== Boolean(data.conversionReason)) {
    ctx.addIssue({ code: "custom", path: ["conversionDate"], message: "Data e motivo devem ser informados juntos" });
  }
});

export const publicUserPatchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username,
  phoneE164: optionalPhoneE164,
  photoUrl: z.url().nullable(),
  photoPublicId: z.string().trim().max(300).nullable(),
  role: z.enum(["admin", "leader", "common"]),
  type: z.enum(["member", "visitor"]),
  active: z.boolean().optional(),
}).partial();

export const privateUserPatchSchema = z.object({
  birthDate: z.union([z.literal(""), z.iso.date(), z.null()]).optional(),
  conversionDate: z.iso.date().nullable().optional(),
  conversionReason: z.string().trim().max(500).nullable().optional(),
});

export const adminUserPatchSchema = z.object({
  public: publicUserPatchSchema,
  private: privateUserPatchSchema,
  accessPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional(),
}).refine((data) => Object.keys(data.public).length + Object.keys(data.private).length > 0 || Boolean(data.accessPassword), "Nenhuma alteração informada");

export const adminCreateUserSchema = z.object({
  username,
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  name: z.string().trim().min(2, "Nome curto demais").max(120),
  phoneE164: optionalPhoneE164,
  birthDate: optionalBirthDate,
  role: z.enum(["admin", "leader", "common"]),
  type: z.enum(["member", "visitor"]),
  conversionDate: z.iso.date().nullable().optional(),
  conversionReason: z.string().trim().max(500).nullable().optional(),
});

export const groupSchema = z.object({
  name: z.string().trim().min(2, "Nome do grupo é obrigatório").max(100),
  description: z.string().trim().max(500).default(""),
  leaderIds: z.array(z.string()).default([]),
  participantIds: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export const groupPatchSchema = z.object({
  name: z.string().trim().min(2, "Nome do grupo é obrigatório").max(100).optional(),
  description: z.string().trim().max(500).optional(),
  leaderIds: z.array(z.string()).optional(),
  participantIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const eventSchema = z.object({
  title: z.string().trim().min(2, "Título é obrigatório").max(150),
  description: z.string().trim().max(1000).default(""),
  startsAtIso: z.string().datetime({ offset: true }).or(z.iso.date()),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser no formato YYYY-MM-DD"),
  scope: z.enum(["global", "groups"]),
  groupIds: z.array(z.string()).default([]),
  pdfUrl: z.url().nullable().default(null),
  pdfPublicId: z.string().trim().max(300).nullable().default(null),
});

export const eventPatchSchema = z.object({
  title: z.string().trim().min(2, "Título é obrigatório").max(150).optional(),
  description: z.string().trim().max(1000).optional(),
  startsAtIso: z.string().datetime({ offset: true }).or(z.iso.date()).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser no formato YYYY-MM-DD").optional(),
  scope: z.enum(["global", "groups"]).optional(),
  groupIds: z.array(z.string()).optional(),
  pdfUrl: z.url().nullable().optional(),
  pdfPublicId: z.string().trim().max(300).nullable().optional(),
});
