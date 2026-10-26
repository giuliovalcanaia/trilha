export type PastaCompartilhamento = {
  isOwner: boolean
  owner: { nome: string; email: string | null }
  compartilhamentos: {
    professorId: number
    nome: string
    email: string | null
  }[]
}

type CompartilhamentoBruto = {
  is_owner?: boolean
  owner?: { nome?: string; email?: string | null }
  compartilhamentos?: {
    professor_id?: number
    nome?: string
    email?: string | null
  }[]
}

/** Converte o JSON de `get_pasta_compartilhamento` no formato usado pela UI. */
export function normalizarPastaCompartilhamento(
  data: unknown
): PastaCompartilhamento {
  const bruto = (data ?? {}) as CompartilhamentoBruto

  return {
    isOwner: bruto.is_owner === true,
    owner: {
      nome: bruto.owner?.nome ?? "",
      email: bruto.owner?.email ?? null,
    },
    compartilhamentos: (bruto.compartilhamentos ?? [])
      .filter((item) => typeof item.professor_id === "number")
      .map((item) => ({
        professorId: item.professor_id as number,
        nome: item.nome ?? "",
        email: item.email ?? null,
      })),
  }
}
