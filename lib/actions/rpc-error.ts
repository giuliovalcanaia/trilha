import { fail, type ActionResult } from "@/lib/actions/result"
import { ERROS, type CodigoErro } from "@/lib/dominio/erros"

type ErroRpc = { code?: string | null } | null

/**
 * Traduz um erro de RPC do Supabase em `ActionResult`.
 *
 * Usa o SQLSTATE quando ele é um código TRLxx conhecido e cai no texto da
 * action (`fallback`) para erros de infraestrutura. `mensagens` permite ajustar
 * o texto por contexto (ex.: lixeira x exclusão definitiva).
 */
export function falhaDeRpc(
  error: ErroRpc,
  fallback: string,
  mensagens?: Partial<Record<CodigoErro, string>>
): ActionResult {
  const codigo =
    error?.code && error.code in ERROS ? (error.code as CodigoErro) : null

  return fail(
    codigo ? (mensagens?.[codigo] ?? ERROS[codigo]) : fallback,
    codigo ?? undefined
  )
}
