/**
 * Normaliza qualquer formato de telefone (removendo código do país 55, caracteres especiais e espaços)
 * para manter unicamente DDD + Número (10 ou 11 dígitos, ex: 22999947318).
 */
export function normalizeDDDPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  // Se começar com código de país 55 e tiver 12 ou 13 dígitos, remove o 55 inicial
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
