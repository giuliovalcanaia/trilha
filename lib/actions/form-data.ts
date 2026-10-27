export function field(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

/** Como `field`, mas sem aparar as bordas (preserva as linhas do textarea). */
export function textField(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

export function optionalField(formData: FormData, name: string) {
  const value = field(formData, name)
  return value ? value : null
}

export function idField(formData: FormData, name: string) {
  const value = Number(field(formData, name))
  return Number.isInteger(value) && value > 0 ? value : null
}
