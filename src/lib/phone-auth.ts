/**
 * Converte um número de telefone (com ou sem formatação) em um e-mail sintético interno
 * para ser usado pelo Firebase Auth.
 */
export function phoneToInternalEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@ibcmembros.internal`;
}
