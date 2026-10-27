import { createAtividade } from "@/app/painel/actions/atividade"
import { NovaAtividadeForm } from "@/components/painel/nova-atividade-form"
import { getPasta } from "@/lib/data/pasta"
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
  const pastaDestino = await getPasta(supabase, pastaSolicitada)

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
