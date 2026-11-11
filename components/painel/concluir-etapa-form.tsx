"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { updateStudentProgress } from "@/app/painel/actions/aluno"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { formatarNota, parseNota } from "@/lib/dominio/nota"

/**
 * Conclusão rápida da etapa atual de um aluno, direto na lista da aba Alunos.
 *
 * O campo de nota é opcional: salvar sem nota conclui a etapa sem lançar nota.
 * A ação recebida é sempre uma etapa não concluída, então o formulário marca
 * `concluida` (o RPC abre a próxima etapa) e atualiza a nota. A etapa não
 * aparece na linha — fica no `aria-label` do campo e no toast.
 */
export function ConcluirEtapaForm({
  atividadeId,
  participacaoId,
  linkId,
  indice,
  titulo,
  pontuacao,
}: {
  atividadeId: number
  participacaoId: number
  linkId: number
  indice: number
  titulo: string
  pontuacao: number | null
}) {
  const router = useRouter()
  const [nota, setNota] = useState(formatarNota(pontuacao))
  const [notaServidor, setNotaServidor] = useState(pontuacao)
  const [pending, startTransition] = useTransition()

  // Mantém o campo alinhado com o servidor sem apagar o que o professor está
  // digitando: só sobrescreve quando a nota gravada realmente muda.
  if (notaServidor !== pontuacao) {
    setNotaServidor(pontuacao)
    setNota(formatarNota(pontuacao))
  }

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const valor = String(
      new FormData(event.currentTarget).get("pontuacao") ?? ""
    ).trim()
    const resultado = parseNota(valor)

    if (!resultado.ok) {
      toast.add({ type: "error", title: resultado.erro })
      return
    }

    const formData = new FormData()
    formData.set("atividade_id", String(atividadeId))
    formData.set("participacao_id", String(participacaoId))
    formData.set("link_id", String(linkId))
    formData.set("status", "concluida")
    formData.set("pontuacao", valor)

    startTransition(async () => {
      const resposta = await updateStudentProgress({ error: null }, formData)

      if (resposta.error) {
        toast.add({ type: "error", title: resposta.error })
        return
      }

      toast.add({
        type: "success",
        title:
          resultado.valor === null
            ? "Etapa concluída sem nota."
            : `Nota ${formatarNota(resultado.valor)} salva e etapa concluída.`,
        description: titulo,
      })
      router.refresh()
    })
  }

  return (
    <form onSubmit={salvar} className="mt-3 flex flex-wrap items-center gap-2">
      <Input
        name="pontuacao"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={`Nota da etapa ${indice}: ${titulo}`}
        placeholder="Nota (opcional)"
        className="min-w-0 flex-1 sm:max-w-40"
        value={nota}
        onChange={(event) => setNota(event.target.value)}
        disabled={pending}
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  )
}
