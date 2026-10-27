/**
 * Formatação de datas do app. O fuso é fixo no horário da escola; mudar isso
 * exige mover a configuração para o banco ou para uma variável de ambiente.
 */
export const TIME_ZONE = "America/Sao_Paulo"

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
})

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
})

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Data de hoje (`yyyy-MM-dd`) no fuso da escola. */
export function hoje() {
  return isoDateFormatter.format(new Date())
}

/**
 * Formata uma data `yyyy-MM-dd` (coluna `date` do banco). O meio-dia evita
 * que o fuso empurre a data para o dia anterior.
 */
export function formatarData(value: string | null) {
  return value ? dateFormatter.format(new Date(`${value}T12:00:00`)) : "—"
}

/** Formata um timestamp ISO (`timestamptz`). */
export function formatarDataHora(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—"
}
