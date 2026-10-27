"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { mensagemDoErro } from "@/lib/dominio/erros"
import { createClient } from "@/lib/supabase/client"

export function StudentNameForm({ codigo }: { codigo: string }) {
  const router = useRouter()
  const [nome, setNome] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = nome.trim()

    if (!trimmed) {
      setError("Informe o seu nome.")
      return
    }

    setError(null)
    setLoading(true)

    const supabase = createClient()

    const { data: claimsData } = await supabase.auth.getClaims()

    if (!claimsData?.claims) {
      const { error: signInError } = await supabase.auth.signInAnonymously()

      if (signInError) {
        setLoading(false)
        setError("Não foi possível iniciar a sua sessão. Tente novamente.")
        return
      }
    }

    const { error: joinError } = await supabase.rpc("join_activity", {
      p_codigo: codigo,
      p_nome: trimmed,
    })

    if (joinError) {
      setLoading(false)
      setError(
        mensagemDoErro(joinError.code) ??
          "Não foi possível entrar na atividade. Tente novamente."
      )
      return
    }

    router.push(`/atividade?codigo=${encodeURIComponent(codigo)}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Field orientation="horizontal">
        <Input
          type="text"
          name="nome"
          placeholder="Digite aqui"
          autoFocus
          autoComplete="off"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          disabled={loading}
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Pronto"}
        </Button>
      </Field>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
