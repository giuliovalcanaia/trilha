import type { CodigoErro } from "@/lib/dominio/erros"

/** Códigos de falha devolvidos pelas actions (TRLxx + falhas do wrapper). */
export type CodigoFalha = CodigoErro | "sessao" | "validacao" | "inesperado"

export type ActionResult = {
  error: string | null
  code?: CodigoFalha | null
  success?: string | null
  trashId?: string | null
}

export function fail(error: string, code?: CodigoFalha): ActionResult {
  return { error, code }
}

export function ok(success: string, trashId?: string): ActionResult {
  return { error: null, success, trashId }
}
