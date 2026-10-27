import { z } from "zod"

/** Converte o FormData em um objeto simples; valores repetidos ficam com o último. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const data: Record<string, string> = {}

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") data[key] = value
  }

  return data
}

/**
 * ID opcional de pasta (`parent_id`/`pasta_id`). Vazio, ausente ou inválido vira
 * `null`, que representa a raiz — mesmo comportamento do antigo `idField`.
 */
export const optionalId = z
  .string()
  .optional()
  .transform((value) => {
    const id = Number(value ?? "")
    return Number.isInteger(id) && id > 0 ? id : null
  })

/** ID obrigatório, com a mensagem de erro usada pela action. */
export const requiredId = (message: string) =>
  z.coerce.number({ message }).int(message).positive(message)
