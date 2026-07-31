import { z } from "zod";

export const phoneE164 = z.string().regex(/^\+[1-9]\d{7,14}$/, "Use o formato +5522999999999");
export const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  birthDate: z.iso.date(),
  phoneE164,
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
  phoneE164,
  photoUrl: z.url().nullable(),
  photoPublicId: z.string().trim().max(300).nullable(),
  role: z.enum(["admin", "leader", "common"]),
  type: z.enum(["member", "visitor"]),
}).partial();

export const privateUserPatchSchema = z.object({
  birthDate: z.iso.date().optional(),
  conversionDate: z.iso.date().nullable().optional(),
  conversionReason: z.string().trim().max(500).nullable().optional(),
});

export const adminUserPatchSchema = z.object({
  public: publicUserPatchSchema,
  private: privateUserPatchSchema,
}).refine((data) => Object.keys(data.public).length + Object.keys(data.private).length > 0, "Nenhuma alteração informada");
