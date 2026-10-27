import { fallbackLinkTitle, lookupLinkTitles } from "@/lib/link-preview"
import type { SupabaseClient } from "@/lib/supabase/server"

/** Concilia a lista colada no textarea com os links já gravados. */
export async function aplicarLinks(
  supabase: SupabaseClient,
  atividadeId: number,
  hrefs: string[]
): Promise<string | null> {
  // Ordem e unicidade dos hrefs já vêm do parse, mas a função pode ser usada
  // por outros fluxos: deduplicar aqui evita dois links iguais na conciliação.
  const lista = [...new Set(hrefs)]

  const { data: atuais, error } = await supabase
    .from("links")
    .select("id, href, ordem")
    .eq("atividade_id", atividadeId)
    .order("ordem")

  if (error) {
    console.error("aplicarLinks:select", error)
    return "Não foi possível carregar os links."
  }

  const idsPorHref = new Map<string, number[]>()
  for (const link of atuais ?? []) {
    const ids = idsPorHref.get(link.href) ?? []
    ids.push(link.id)
    idsPorHref.set(link.href, ids)
  }

  const mantidos: { href: string; id: number }[] = []
  const novos: string[] = []

  for (const href of lista) {
    const id = idsPorHref.get(href)?.shift()
    if (id) mantidos.push({ href, id })
    else novos.push(href)
  }

  const mantidosIds = new Set(mantidos.map((link) => link.id))
  const removidos = (atuais ?? [])
    .filter((link) => !mantidosIds.has(link.id))
    .map((link) => link.id)

  // Busca os títulos antes de mexer no banco: se a rede estiver lenta, a lista
  // atual continua intacta até o momento da gravação.
  const titulos = await lookupLinkTitles(novos)
  const maiorOrdem = (atuais ?? []).reduce(
    (maior, link) => Math.max(maior, link.ordem),
    0
  )

  if (removidos.length > 0) {
    const { error: erroRemover } = await supabase
      .from("links")
      .delete()
      .in("id", removidos)

    if (erroRemover) {
      console.error("aplicarLinks:delete", erroRemover)
      return "Não foi possível remover os links antigos."
    }
  }

  const idsNovos = new Map<string, number>()

  if (novos.length > 0) {
    // Entram no fim, em ordens temporárias; o reorder_links define a posição
    // final de todos de uma vez, sem violar unique (atividade_id, ordem).
    const { data: inseridos, error: erroInserir } = await supabase
      .from("links")
      .insert(
        novos.map((href, index) => ({
          atividade_id: atividadeId,
          href,
          titulo: titulos.get(href) ?? fallbackLinkTitle(href),
          ordem: maiorOrdem + index + 1,
        }))
      )
      .select("id, href")

    if (erroInserir || !inseridos) {
      console.error("aplicarLinks:insert", erroInserir)
      return "Não foi possível adicionar os links."
    }

    for (const link of inseridos) {
      idsNovos.set(link.href, link.id)
    }
  }

  const idsFinais = lista.map((href) => {
    const mantido = mantidos.find((link) => link.href === href)
    return mantido?.id ?? idsNovos.get(href) ?? 0
  })

  if (idsFinais.some((id) => !id)) {
    console.error("aplicarLinks:ids", { atividadeId, idsFinais })
    return "Não foi possível organizar os links."
  }

  if (idsFinais.length > 0) {
    const { error: erroOrdem } = await supabase.rpc("reorder_links", {
      p_atividade_id: atividadeId,
      p_link_ids: idsFinais,
    })

    if (erroOrdem) {
      console.error("aplicarLinks:reorder", erroOrdem)
      return "Não foi possível organizar os links."
    }
  }

  return null
}
