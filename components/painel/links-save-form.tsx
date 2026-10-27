"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"

import { updateLinks } from "@/app/painel/actions/links"
import { ActionForm } from "@/components/painel/action-form"
import { useLinksDraft } from "@/components/painel/links-draft"
import { SubmitButton } from "@/components/painel/submit-button"

function LinksSubmitButton() {
  const { pending } = useFormStatus()
  const { setSalvando } = useLinksDraft()

  useEffect(() => {
    setSalvando(pending)
  }, [pending, setSalvando])

  return <SubmitButton pendingLabel="Salvando...">Salvar links</SubmitButton>
}

export function LinksSaveForm({ atividadeId }: { atividadeId: number }) {
  const router = useRouter()
  const { pendingAction, limparAcao, setAbaAtiva, marcarSalvo } =
    useLinksDraft()

  return (
    <ActionForm
      id="links-form"
      action={updateLinks}
      onSuccess={() => {
        marcarSalvo()

        const acao = pendingAction
        limparAcao()

        if (!acao) return

        if (acao.type === "tab") {
          setAbaAtiva(acao.value)
          return
        }

        router.push(acao.href)
      }}
      onError={limparAcao}
    >
      <input type="hidden" name="atividade_id" value={atividadeId} />
      <LinksSubmitButton />
    </ActionForm>
  )
}
