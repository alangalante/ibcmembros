/**
 * Normaliza qualquer formato de telefone (removendo código do país 55, caracteres especiais e espaços)
 * para manter unicamente DDD + Número (10 ou 11 dígitos, ex: 22999947318).
 */
export function normalizeDDDPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  return digits;
}

/**
 * Converte um telefone em e-mail interno para o Firebase Auth usando apenas DDD + Número (ex: 22999947318).
 */
export function phoneToInternalEmail(phone: string): string {
  const digits = normalizeDDDPhone(phone);
  return `${digits}@ibcmembros.internal`;
}

/**
 * Retorna o nome amigável para exibição no aplicativo, nunca expondo o e-mail interno sintético.
 */
export function getCleanDisplayName(
  profileName?: string | null,
  user?: { displayName?: string | null; email?: string | null } | null
): string {
  if (profileName) return profileName;
  if (user?.displayName) return user.displayName;
  if (user?.email) {
    const clean = user.email.replace("@ibcmembros.internal", "");
    if (/^\d+$/.test(clean)) {
      return `Membro (${clean})`;
    }
    return user.email;
  }
  return "Membro";
}
