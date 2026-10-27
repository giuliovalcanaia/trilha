import { createAtividade } from "@/app/painel/actions/atividade"
import { NovaAtividadeForm } from "@/components/painel/nova-atividade-form"
import { createClient } from "@/lib/supabase/server"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pasta?: string }>
}) {
  const { pasta } = await searchParams
  const pastaId = Number(pasta)
  const pastaSolicitada =
    Number.isInteger(pastaId) && pastaId > 0 ? pastaId : null

  const supabase = await createClient()

  const { data: pastas } = await supabase
    .from("pastas")
    .select("id, nome, parent_id")
    .is("deleted_at", null)
    .order("nome")

  const pastaDestino =
    pastaSolicitada === null
      ? null
      : ((pastas ?? []).find((item) => item.id === pastaSolicitada) ?? null)

  const voltarHref =
    pastaDestino === null ? "/painel" : `/painel/pastas/${pastaDestino.id}`

  return (
    <div className="w-full">
      <NovaAtividadeForm
        action={createAtividade}
        pastaId={pastaDestino?.id ?? null}
        pastaNome={pastaDestino?.nome ?? null}
        voltarHref={voltarHref}
      />
    </div>
  )
}
