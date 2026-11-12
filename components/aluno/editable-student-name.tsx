"use client"

import {
  useState,
  useTransition,
  type FocusEvent,
  type KeyboardEvent,
} from "react"
import { CheckIcon, LoaderCircleIcon, PencilIcon, XIcon } from "lucide-react"

import { renomearAluno } from "@/app/atividade/actions"
import { mensagemDoErro } from "@/lib/dominio/erros"
import { NOME_ALUNO_MAX } from "@/lib/dominio/limites"
import { cn } from "@/lib/utils"

/**
 * Nome do aluno no título da atividade, editável no lugar.
 *
 * Clicar no nome abre um input do tamanho do título; Enter salva, Esc descarta
 * e sair do campo também salva. O nome vem do servidor, então depois de salvar
 * é a revalidação da página que atualiza o texto.
 */
export function EditableStudentName({
  aplicacaoId,
  nome,
}: {
  aplicacaoId: number
  nome: string
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(nome)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function abrir() {
    setValor(nome)
    setErro(null)
    setEditando(true)
  }

  function cancelar() {
    setEditando(false)
    setErro(null)
  }

  function salvar() {
    const limpo = valor.trim()

    if (!limpo) {
      setErro(mensagemDoErro("TRL04"))
      return
    }

    if (limpo.length > NOME_ALUNO_MAX) {
      setErro(mensagemDoErro("TRL34"))
      return
    }

    if (limpo === nome) {
      setEditando(false)
      return
    }

    startTransition(async () => {
      const resultado = await renomearAluno(aplicacaoId, limpo)

      if (resultado.error) {
        setErro(resultado.error)
        return
      }

      setErro(null)
      setEditando(false)
    })
  }

  function aoSairDoCampo(event: FocusEvent<HTMLSpanElement>) {
    if (pending) return
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return

    // Sair do campo vazio cancela em vez de deixar um erro preso sem foco.
    if (!valor.trim()) {
      cancelar()
      return
    }

    salvar()
  }

  function aoTeclar(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      salvar()
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      cancelar()
    }
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={abrir}
        title="Editar nome"
        aria-describedby="dica-editar-nome"
        className="inline-flex max-w-full cursor-pointer items-baseline gap-1.5 rounded-md text-left underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 break-words">{nome}</span>
        <PencilIcon
          aria-hidden
          className="size-4 shrink-0 self-center text-muted-foreground"
        />
      </button>
    )
  }

  return (
    <span
      onBlur={aoSairDoCampo}
      className="inline-flex max-w-full flex-wrap items-center gap-1.5 align-middle"
    >
      <input
        autoFocus
        value={valor}
        onChange={(event) => {
          setValor(event.target.value)
          if (erro) setErro(null)
        }}
        onKeyDown={aoTeclar}
        maxLength={NOME_ALUNO_MAX}
        disabled={pending}
        aria-label="Nome do aluno"
        aria-invalid={erro ? true : undefined}
        className={cn(
          "h-9 min-h-11 w-full min-w-0 flex-1 rounded-md border bg-background px-2 text-2xl font-semibold tracking-tight outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 sm:min-h-0 sm:text-3xl",
          erro ? "border-destructive" : "border-input"
        )}
      />
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={salvar}
          disabled={pending}
          aria-label="Salvar nome"
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-primary outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 sm:size-9"
        >
          {pending ? (
            <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
          ) : (
            <CheckIcon aria-hidden className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={cancelar}
          disabled={pending}
          aria-label="Cancelar edição do nome"
          className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 sm:size-9"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      </span>
      {erro && (
        <span
          role="alert"
          className="block w-full text-sm font-normal text-destructive"
        >
          {erro}
        </span>
      )}
    </span>
  )
}
