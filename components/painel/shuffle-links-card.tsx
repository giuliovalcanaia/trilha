"use client"

import { useEffect, useState, useTransition } from "react"
import { ShuffleIcon } from "lucide-react"

import { updateActivityShuffle } from "@/app/painel/actions"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/toast"

/**
 * Opção de embaralhar a ordem dos links por aluno. Salva no mesmo instante em
 * que o switch muda; a ordem canônica (aba Alunos e prévia) não muda.
 */
export function ShuffleLinksCard({
  atividadeId,
  embaralharLinks,
  totalAlunos,
}: {
  atividadeId: number
  embaralharLinks: boolean
  totalAlunos: number
}) {
  const [ativo, setAtivo] = useState(embaralharLinks)
  const [pending, startTransition] = useTransition()

  // Mantém o switch alinhado com o servidor depois de uma revalidação.
  useEffect(() => {
    setAtivo(embaralharLinks)
  }, [embaralharLinks])

  function alterar(valor: boolean) {
    if (pending) return

    const anterior = ativo
    setAtivo(valor)

    startTransition(async () => {
      const resultado = await updateActivityShuffle(atividadeId, valor)

      if (resultado.error) {
        setAtivo(anterior)
        toast.add({ type: "error", title: resultado.error })
        return
      }

      toast.add({
        type: "success",
        title: valor
          ? "Ordem embaralhada para os próximos alunos."
          : "Ordem normal para os próximos alunos.",
      })
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShuffleIcon className="size-4" />
          Ordem dos links
        </CardTitle>
        <CardDescription>
          Cada aluno recebe uma ordem aleatória e estável, sorteada quando
          entra. A lista da aba Alunos e a pré-visualização continuam na ordem
          original.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="embaralhar-links">
              Embaralhar para os alunos
            </FieldLabel>
            <FieldDescription>
              A sequência é sorteada uma vez e não muda a cada acesso.
            </FieldDescription>
          </FieldContent>
          <Switch
            id="embaralhar-links"
            checked={ativo}
            onCheckedChange={alterar}
            disabled={pending}
          />
        </Field>

        {totalAlunos > 0 && (
          <p className="text-xs text-muted-foreground">
            {totalAlunos} aluno(s) já entraram. A mudança vale apenas para quem
            entrar depois; quem já está na atividade mantém a ordem atual.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
