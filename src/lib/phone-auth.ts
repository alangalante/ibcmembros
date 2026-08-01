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
 * Formata um telefone com máscara amigável (XX) XXXXX-XXXX ou (XX) XXXX-XXXX.
 */
export function formatPhoneMask(phone: string): string {
  const digits = normalizeDDDPhone(phone);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}


/**
 * Converte um telefone em e-mail interno para o Firebase Auth usando apenas DDD + Número (ex: 22999947318).
 */
export function phoneToInternalEmail(phone: string): string {
  const digits = normalizeDDDPhone(phone);
  return `${digits}@ibcmembros.internal`;
}

/**
 * Gera a URL oficial do WhatsApp garantindo que o DDI +55 (Brasil) seja incluído no link.
 */
export function formatWhatsAppLink(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  return `https://wa.me/${digits}`;
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
