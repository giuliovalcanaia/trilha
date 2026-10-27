import { z } from "zod"

import { optionalId, requiredId } from "@/lib/dominio/campos"
import { NOME_PASTA_MAX } from "@/lib/dominio/limites"

export const nomePasta = z
  .string()
  .trim()
  .min(1, "Informe o nome da pasta.")
  .max(
    NOME_PASTA_MAX,
    `O nome deve ter no máximo ${NOME_PASTA_MAX} caracteres.`
  )

export const createPastaSchema = z.object({
  nome: nomePasta,
  parent_id: optionalId,
})

export const renamePastaSchema = z.object({
  id: requiredId("Pasta inválida."),
  nome: nomePasta,
})

export const movePastaSchema = z.object({
  id: requiredId("Pasta inválida."),
  parent_id: optionalId,
})

export const trashPastaSchema = z.object({
  id: requiredId("Pasta inválida."),
})

export const trashSelecionadosSchema = z.object({
  itens: z.string().optional().default(""),
})
