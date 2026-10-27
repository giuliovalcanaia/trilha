import { z } from "zod"

import { optionalId, requiredId } from "@/lib/dominio/campos"
import { linksTexto } from "@/lib/dominio/link"
import {
  SENHA_MAX,
  SENHA_MIN,
  SUBTITULO_ATIVIDADE_MAX,
  TITULO_ATIVIDADE_MAX,
} from "@/lib/dominio/limites"

export const tituloAtividade = z
  .string()
  .trim()
  .min(1, "Informe o título da atividade.")
  .max(
    TITULO_ATIVIDADE_MAX,
    `O título deve ter no máximo ${TITULO_ATIVIDADE_MAX} caracteres.`
  )

export const subtituloAtividade = z
  .string()
  .trim()
  .max(
    SUBTITULO_ATIVIDADE_MAX,
    `O subtítulo deve ter no máximo ${SUBTITULO_ATIVIDADE_MAX} caracteres.`
  )

export const senhaAtividade = z
  .string()
  .trim()
  .min(SENHA_MIN, "A senha precisa ter pelo menos 4 caracteres.")
  .max(SENHA_MAX, `A senha deve ter no máximo ${SENHA_MAX} caracteres.`)

export const createAtividadeSchema = z.object({
  titulo: tituloAtividade,
  subtitulo: subtituloAtividade.optional().transform((value) => value || null),
  pasta_id: optionalId,
  senha: senhaAtividade,
  embaralhar_links: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  links_texto: linksTexto,
})

export const updateAtividadeSchema = z.object({
  id: requiredId("Atividade inválida."),
  titulo: tituloAtividade.optional(),
  subtitulo: subtituloAtividade.optional(),
})

export const renameAtividadeSchema = z.object({
  id: requiredId("Atividade inválida."),
  titulo: tituloAtividade,
})

export const moveAtividadeSchema = z.object({
  id: requiredId("Atividade inválida."),
  pasta_id: optionalId,
})

export const updateActivityPasswordSchema = z.object({
  atividade_id: requiredId("Atividade inválida."),
  senha: senhaAtividade,
})

export const alternarAtividadeSchema = z.object({
  id: requiredId("Atividade inválida."),
  ativa: z
    .string()
    .optional()
    .transform((value) => value === "1"),
})

export const trashAtividadeSchema = z.object({
  id: requiredId("Atividade inválida."),
})
