"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, LoaderCircleIcon } from "lucide-react"

import { completeLink } from "@/app/atividade/actions"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { parseNota } from "@/lib/dominio/nota"
import { cn } from "@/lib/utils"

const LOCKOUT_SECONDS = 3

/**
 * Nota (opcional) e senha de liberação digitadas direto no cartão do link em
 * andamento. A nota vai para `progresso_estudante.pontuacao` junto da
 * conclusão; em branco, a nota atual é preservada (inclusive a do professor).
 *
 * Ao voltar para esta aba, o campo de senha recebe o foco automaticamente: o
 * aluno abre o link em outra aba, faz a tarefa e, na volta, já pode digitar a
 * senha sem clicar em nada (o mesmo comportamento do app antigo).
 *
 * O input de senha não usa `type="password"` de propósito: o Chrome
 * interpretaria o campo como credencial do site e ofereceria salvar a senha.
 * O texto é mascarado via `-webkit-text-security`, como em `SenhaField`.
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
  const notaRef = useRef<HTMLInputElement>(null)
  const refreshTimeout = useRef<number | null>(null)
  const [nota, setNota] = useState("")
  const [erroNota, setErroNota] = useState<string | null>(null)
  const [senha, setSenha] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [bloqueio, setBloqueio] = useState(0)
  const [concluido, setConcluido] = useState(false)
  const [enviando, startTransition] = useTransition()

  const bloqueado = enviando || concluido || bloqueio > 0

  // Foca o campo de senha quando a aba volta a ficar visível. Como
  // normalmente só existe um link em andamento, o primeiro campo habilitado da
  // página é o dono do foco; isso evita disputa caso o professor deixe mais de
  // um.
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

    const resultadoNota = parseNota(nota)

    if (!resultadoNota.ok) {
      setErroNota(resultadoNota.erro)
      notaRef.current?.focus()
      return
    }

    const pontuacao = resultadoNota.valor

    setErroNota(null)

    const value = senha.trim()

    if (!value) {
      setErro("Digite a senha.")
      inputRef.current?.focus()
      return
    }

    setErro(null)

    startTransition(async () => {
      const result = await completeLink(aplicacaoId, linkId, value, pontuacao)

      if (result.error) {
        setErro(result.error)

        if (result.code === "TRL16") {
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
  const erroNotaId = `nota-erro-${linkId}`

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup className="w-full max-w-60 gap-3">
        <Field data-invalid={erroNota ? true : undefined}>
          <FieldLabel htmlFor={`nota-${linkId}`}>
            Nota{" "}
            <span className="font-normal text-muted-foreground">
              (opcional)
            </span>
          </FieldLabel>
          <Input
            ref={notaRef}
            id={`nota-${linkId}`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={nota}
            onChange={(event) => {
              setNota(event.target.value)
              if (erroNota) setErroNota(null)
            }}
            disabled={bloqueado}
            aria-invalid={erroNota ? true : undefined}
            aria-describedby={erroNota ? erroNotaId : undefined}
            className="w-24"
          />
          {erroNota && <FieldError id={erroNotaId}>{erroNota}</FieldError>}
        </Field>

        <Field data-invalid={erro ? true : undefined}>
          <FieldLabel htmlFor={`senha-${linkId}`}>Senha</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              id={`senha-${linkId}`}
              data-inline-password
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={senha}
              onChange={(event) => {
                setSenha(event.target.value)
                if (erro) setErro(null)
              }}
              disabled={bloqueado}
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? erroId : undefined}
              className={cn("w-32", "[-webkit-text-security:disc]")}
            />
            <Button
              type="submit"
              size="sm"
              disabled={bloqueado}
              aria-label={`Concluir ${titulo}`}
              className="min-w-11"
            >
              {concluido ? (
                <CheckIcon />
              ) : enviando ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : bloqueio > 0 ? (
                `${bloqueio}s`
              ) : (
                "OK"
              )}
            </Button>
          </div>
          {erro && <FieldError id={erroId}>{erro}</FieldError>}
        </Field>
      </FieldGroup>
    </form>
  )
}
