import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { falhaDeRpc } from "@/lib/actions/rpc-error"
import { revalidatePainel } from "@/lib/actions/revalidate"
import type { ProfessorCtx } from "@/lib/actions/with-professor"
import type { ColarInput } from "@/lib/dominio/area-transferencia"
import { moverAtividade, moverPasta } from "@/lib/painel/movimentacao"

type OrigemPasta = { id: number; parent_id: number | null }
type OrigemAtividade = { id: number; pasta_id: number | null }

async function copiarPasta(
  professor: ProfessorCtx,
  id: number,
  destino: number | null
): Promise<ActionResult> {
  const { data: novoId, error } = await professor.supabase.rpc(
    "duplicate_pasta",
    { p_pasta_id: id }
  )

  if (error || !novoId) {
    return falhaDeRpc(error, "Não foi possível copiar a pasta.")
  }

  return moverPasta(professor, novoId, destino)
}

async function copiarAtividade(
  professor: ProfessorCtx,
  id: number,
  destino: number | null
): Promise<ActionResult> {
  const { data: novoId, error } = await professor.supabase.rpc(
    "duplicate_atividade",
    { p_atividade_id: id }
  )

  if (error || !novoId) {
    return falhaDeRpc(error, "Não foi possível copiar a atividade.")
  }

  return moverAtividade(professor, novoId, destino)
}

function mensagemDeColagem(
  modo: ColarInput["modo"],
  feitos: number,
  falhas: number
) {
  const singular = modo === "copiar" ? "copiado" : "movido"
  const plural = modo === "copiar" ? "copiados" : "movidos"
  const sucesso =
    feitos === 1 ? `1 item ${singular}.` : `${feitos} itens ${plural}.`

  if (falhas === 0) return sucesso

  return falhas === 1
    ? `${sucesso} 1 item não pôde ser colado.`
    : `${sucesso} ${falhas} itens não puderam ser colados.`
}

/**
 * Cola os itens em uma pasta.
 *
 * Copiar reaproveita as RPCs de duplicação e move a cópia para o destino;
 * recortar apenas move os originais. Cada item é processado isoladamente para
 * uma falha não impedir os demais — o resultado resume o que passou.
 */
export async function transferir(
  professor: ProfessorCtx,
  { modo, pastas, atividades, destino }: ColarInput
): Promise<ActionResult> {
  const idsPastas = [...new Set(pastas)]
  const idsAtividades = [...new Set(atividades)]

  if (idsPastas.length + idsAtividades.length === 0) {
    return fail("Nenhum item selecionado.", "validacao")
  }

  if (destino !== null) {
    const { data: pastaDestino } = await professor.supabase
      .from("pastas")
      .select("id")
      .eq("id", destino)
      .is("deleted_at", null)
      .maybeSingle()

    if (!pastaDestino) return fail("Pasta de destino inválida.", "validacao")
  }

  // A RLS já esconde itens sem acesso; o que sobrar aqui existe de verdade.
  const { data: pastasOrigem, error: erroPastas } =
    idsPastas.length > 0
      ? await professor.supabase
          .from("pastas")
          .select("id, parent_id")
          .in("id", idsPastas)
          .is("deleted_at", null)
      : { data: [] as OrigemPasta[], error: null }

  const { data: atividadesOrigem, error: erroAtividades } =
    idsAtividades.length > 0
      ? await professor.supabase
          .from("atividades")
          .select("id, pasta_id")
          .in("id", idsAtividades)
          .is("deleted_at", null)
      : { data: [] as OrigemAtividade[], error: null }

  if (erroPastas || erroAtividades) {
    return fail(
      "Não foi possível colar os itens. Tente novamente.",
      "inesperado"
    )
  }

  const origemDasPastas = new Map<number, number | null>(
    (pastasOrigem ?? []).map((pasta) => [pasta.id, pasta.parent_id])
  )
  const origemDasAtividades = new Map<number, number | null>(
    (atividadesOrigem ?? []).map((atividade) => [
      atividade.id,
      atividade.pasta_id,
    ])
  )

  let feitos = 0
  const falhas: string[] = []

  for (const id of idsPastas) {
    if (!origemDasPastas.has(id)) {
      falhas.push("Pasta não encontrada.")
      continue
    }

    if (modo === "recortar" && origemDasPastas.get(id) === destino) continue

    const resultado =
      modo === "copiar"
        ? await copiarPasta(professor, id, destino)
        : await moverPasta(professor, id, destino)

    if (resultado.error) falhas.push(resultado.error)
    else feitos += 1
  }

  for (const id of idsAtividades) {
    if (!origemDasAtividades.has(id)) {
      falhas.push("Atividade não encontrada.")
      continue
    }

    if (modo === "recortar" && origemDasAtividades.get(id) === destino) continue

    const resultado =
      modo === "copiar"
        ? await copiarAtividade(professor, id, destino)
        : await moverAtividade(professor, id, destino)

    if (resultado.error) falhas.push(resultado.error)
    else feitos += 1
  }

  if (feitos === 0) {
    return falhas.length > 0
      ? fail(falhas[0])
      : ok("Os itens já estão nesta pasta.")
  }

  revalidatePainel()

  return ok(mensagemDeColagem(modo, feitos, falhas.length))
}
