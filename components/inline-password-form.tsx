"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, LoaderCircleIcon } from "lucide-react"

import { completeLink } from "@/app/atividade/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

const errorMessages: Record<string, string> = {
  invalid_password: "Senha incorreta. Confira com o professor.",
  link_locked: "Este link não está disponível para conclusão.",
  password_not_set: "O professor ainda não definiu a senha desta atividade.",
  application_closed: "Esta turma foi encerrada pelo professor.",
  not_in_application: "Você não está nesta turma. Entre novamente.",
  not_a_student: "Sessão expirada. Entre novamente.",
  not_authenticated: "Sessão expirada. Entre novamente.",
  password_required: "Digite a senha.",
}

const LOCKOUT_SECONDS = 3

/**
 * Senha de liberação digitada direto no cartão do link em andamento.
 *
 * Ao voltar para esta aba, o campo recebe o foco automaticamente: o aluno
 * abre o link em outra aba, faz a tarefa e, na volta, já pode digitar a senha
 * sem clicar em nada (o mesmo comportamento do app antigo).
 *
 * O input não usa `type="password"` de propósito: o Chrome interpretaria o
 * campo como credencial do site e ofereceria salvar a senha. O texto é
 * mascarado via `-webkit-text-security`, como em `SenhaField`.
 */
export function InlinePasswordForm({
  aplicacaoId,
  linkId,
  titulo,
}: {
  aplicacaoId: number
  linkId: number
  titulo: string
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const refreshTimeout = useRef<number | null>(null)
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [bloqueio, setBloqueio] = useState(0)
  const [concluido, setConcluido] = useState(false)
  const [enviando, startTransition] = useTransition()

  const bloqueado = enviando || concluido || bloqueio > 0

  // Foca o campo quando a aba volta a ficar visível. Como normalmente só
  // existe um link em andamento, o primeiro campo habilitado da página é o
  // dono do foco; isso evita disputa caso o professor deixe mais de um.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return

      const input = inputRef.current
      if (!input || input.disabled) return

      const primeiro = document.querySelector<HTMLInputElement>(
        "[data-inline-password]:not(:disabled)"
      )
      if (primeiro && primeiro !== input) return

      input.focus()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  // Contagem regressiva do bloqueio após uma senha incorreta.
  useEffect(() => {
    if (bloqueio === 0) return

    const timer = window.setTimeout(() => {
      if (bloqueio === 1) {
        setBloqueio(0)
        setSenha("")
        inputRef.current?.focus()
      } else {
        setBloqueio(bloqueio - 1)
      }
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [bloqueio])

  useEffect(() => {
    return () => {
      if (refreshTimeout.current !== null) {
        window.clearTimeout(refreshTimeout.current)
      }
    }
  }, [])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (bloqueado) return

    const value = senha.trim()

    if (!value) {
      setErro("Digite a senha.")
      inputRef.current?.focus()
      return
    }

    setErro(null)

    startTransition(async () => {
      const result = await completeLink(aplicacaoId, linkId, value)

      if (result.error) {
        setErro(errorMessages[result.error] ?? "Não foi possível concluir.")

        if (result.error === "invalid_password") {
          setBloqueio(LOCKOUT_SECONDS)
        }

        return
      }

      setConcluido(true)
      toast.add({
        type: "success",
        title: "Atividade concluída!",
        description: "O próximo link foi liberado.",
      })

      refreshTimeout.current = window.setTimeout(() => {
        router.refresh()
      }, 600)
    })
  }

  const erroId = `senha-erro-${linkId}`

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={`senha-${linkId}`} className="sr-only">
          Senha de liberação de {titulo}
        </label>
        <Input
          ref={inputRef}
          id={`senha-${linkId}`}
          data-inline-password
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Senha"
          value={senha}
          onChange={(event) => {
            setSenha(event.target.value)
            if (erro) setErro(null)
          }}
          disabled={bloqueado}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? erroId : undefined}
          className={cn(
            "h-8 w-32 border-amber-500/60",
            "focus-visible:border-amber-500 focus-visible:ring-amber-500/30",
            "[-webkit-text-security:disc]"
          )}
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={bloqueado}
          aria-label={`Concluir ${titulo}`}
          className="min-w-11 border-amber-500/60 text-amber-700 dark:text-amber-300"
        >
          {concluido ? (
            <CheckIcon className="text-emerald-600 dark:text-emerald-400" />
          ) : enviando ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : bloqueio > 0 ? (
            `${bloqueio}s`
          ) : (
            "OK"
          )}
        </Button>
      </div>

      {erro && (
        <p id={erroId} role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      )}
    </form>
  )
}
