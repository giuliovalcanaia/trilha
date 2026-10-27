/** Converte o FormData em um objeto simples; valores repetidos ficam com o último. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const data: Record<string, string> = {}

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") data[key] = value
  }

  return data
}
