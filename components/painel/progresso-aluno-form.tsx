"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { updateStudentProgress } from "@/app/painel/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { toast } from "@/components/ui/toast"
import { formatarNota, parseNota } from "@/lib/dominio/nota"

type Status = "aberta" | "fazendo" | "concluida" | "bloqueada"

const statusLabels: Record<Status, string> = {
  aberta: "Aberta",
  fazendo: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
}

type ProgressoAlunoFormProps = {
  atividadeId: number
  participacaoId: number
  linkId: number
  indice: number
  titulo: string
  status: string
  pontuacao: number | null
}

/**
 * Ajuste do progresso de um aluno pelo professor.
 *
 * A situação é salva assim que o select muda. Salvar uma nota não vazia
 * conclui o link e libera a próxima etapa bloqueada.
 */
export function ProgressoAlunoForm({
  atividadeId,
  participacaoId,
  linkId,
  indice,
  titulo,
  status,
  pontuacao,
}: ProgressoAlunoFormProps) {
  const router = useRouter()
  const statusRecebido: Status =
    status in statusLabels ? (status as Status) : "bloqueada"
  const [statusLocal, setStatusLocal] = useState<Status>(statusRecebido)
  const [nota, setNota] = useState(formatarNota(pontuacao))
  const [statusServidor, setStatusServidor] = useState(statusRecebido)
  const [notaServidor, setNotaServidor] = useState(pontuacao)
  const [pending, startTransition] = useTransition()

  // Realinha com o servidor quando a página é revalidada (inclusive após um
  // refresh em tempo real). Enquanto a gravação está em andamento, mantém a
  // escolha otimista do professor. Ajustar o estado durante o render evita um
  // efeito e o render extra que ele provocaria.
  if (!pending && statusRecebido !== statusServidor) {
    setStatusServidor(statusRecebido)
    setStatusLocal(statusRecebido)
  }

  // Só sobrescreve a nota quando o valor vindo do servidor realmente muda.
  // Sincronizar a cada render (ou no blur) apagava o que o professor tinha
  // digitado antes do submit do formulário.
  if (notaServidor !== pontuacao) {
    setNotaServidor(pontuacao)
    setNota(formatarNota(pontuacao))
  }

  function montarFormData(novoStatus: Status, novaPontuacao: string) {
    const formData = new FormData()
    formData.set("atividade_id", String(atividadeId))
    formData.set("participacao_id", String(participacaoId))
    formData.set("link_id", String(linkId))
    formData.set("status", novoStatus)
    formData.set("pontuacao", novaPontuacao)
    return formData
  }

  function salvarStatus(novoStatus: Status) {
    if (novoStatus === statusLocal || pending) return

    setStatusLocal(novoStatus)

    startTransition(async () => {
      const resultado = await updateStudentProgress(
        { error: null },
        montarFormData(novoStatus, nota.trim())
      )

      if (resultado.error) {
        setStatusLocal(statusRecebido)
        toast.add({ type: "error", title: resultado.error })
        return
      }

      router.refresh()
    })
  }

  function salvarNota(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    // Lê direto do formulário: o valor do input é a fonte da verdade, mesmo
    // que um re-render tenha acontecido entre o clique e o submit.
    const valor = String(
      new FormData(event.currentTarget).get("pontuacao") ?? ""
    ).trim()
    const resultado = parseNota(valor)

    if (!resultado.ok) {
      toast.add({ type: "error", title: resultado.erro })
      return
    }

    const concluir = resultado.valor !== null
    const novoStatus: Status = concluir ? "concluida" : statusLocal

    if (concluir) setStatusLocal("concluida")

    startTransition(async () => {
      const resultado = await updateStudentProgress(
        { error: null },
        montarFormData(novoStatus, valor)
      )

      if (resultado.error) {
        setStatusLocal(statusRecebido)
        toast.add({ type: "error", title: resultado.error })
        return
      }

      if (resultado.success) {
        toast.add({
          type: "success",
          title: concluir ? "Nota salva e link concluído." : resultado.success,
        })
      }

      router.refresh()
    })
  }

  return (
    <form
      onSubmit={salvarNota}
      className="flex flex-wrap items-end gap-2 rounded-lg border p-2"
    >
      <div className="min-w-40 flex-1 text-sm">
        <span className="text-muted-foreground">{indice}.</span> {titulo}
        <span className="block text-xs text-muted-foreground">
          {statusLabels[statusLocal]}
        </span>
      </div>

      <div className="space-y-1">
        <Label
          htmlFor={`status-${participacaoId}-${linkId}`}
          className="text-xs"
        >
          Situação
        </Label>
        <NativeSelect
          id={`status-${participacaoId}-${linkId}`}
          value={statusLocal}
          onChange={(event) => salvarStatus(event.target.value as Status)}
          disabled={pending}
          size="sm"
          className="w-full"
        >
          <NativeSelectOption value="bloqueada">Bloqueada</NativeSelectOption>
          <NativeSelectOption value="aberta">Aberta</NativeSelectOption>
          <NativeSelectOption value="fazendo">Em andamento</NativeSelectOption>
          <NativeSelectOption value="concluida">Concluída</NativeSelectOption>
        </NativeSelect>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`nota-${participacaoId}-${linkId}`} className="text-xs">
          Nota
        </Label>
        <Input
          id={`nota-${participacaoId}-${linkId}`}
          name="pontuacao"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className="w-20"
          value={nota}
          onChange={(event) => setNota(event.target.value)}
          placeholder="—"
        />
      </div>

      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  )
}
