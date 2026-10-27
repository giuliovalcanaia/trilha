"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

const errorMessages: Record<string, string> = {
  invalid_activity_code:
    "Código da atividade inválido. Confira com o professor.",
  activity_not_published:
    "Esta atividade ainda não está disponível. Confira com o professor.",
  application_closed: "A atividade foi encerrada. Fale com o professor.",
  student_already_in_another_class: "Você já entrou em outra atividade.",
  teacher_cannot_join_as_student:
    "Esta conta é de professor. Saia e entre com uma conta de aluno.",
  name_required: "Informe o seu nome.",
}

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
        errorMessages[joinError.message] ??
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
