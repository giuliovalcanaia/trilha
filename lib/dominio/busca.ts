/**
 * Normalização usada pelas buscas do painel (explorador e lixeira).
 *
 * Remove acentos e caixa para que “Aulas” encontre “aulas” e “AULA” encontre
 * “áula”. Não mexe em pontuação: quem busca `2026` não deve casar com `2026?`
 * por acidente.
 */
export function normalizarBusca(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
}
