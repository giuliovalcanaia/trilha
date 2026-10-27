"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/toast"
import { createClient } from "@/lib/supabase/client"

export function JoinCodeForm() {
  const router = useRouter()
  const [codigo, setCodigo] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const value = codigo.trim().toUpperCase()

    if (!value) {
      toast.add({ type: "warning", title: "Informe o código da atividade." })
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { data: valido, error: validateError } = await supabase.rpc(
      "validate_join_code",
      { p_codigo: value }
    )

    if (validateError) {
      setLoading(false)
      toast.add({
        type: "error",
        title: "Não foi possível validar o código.",
        description: "Tente novamente.",
      })
      return
    }

    if (!valido) {
      setLoading(false)
      toast.add({
        type: "error",
        title: "Código inválido",
        description: "Confira o código com o professor.",
      })
      return
    }

    router.push(`/aluno?codigo=${encodeURIComponent(value)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Field orientation="horizontal">
        <Input
          type="text"
          name="codigoAula"
          placeholder="Digite aqui"
          autoFocus
          autoComplete="one-time-code"
          spellCheck={false}
          autoCapitalize="characters"
          value={codigo}
          onChange={(event) => setCodigo(event.target.value)}
          disabled={loading}
          className="uppercase placeholder:normal-case"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "Verificando..." : "Entrar"}
        </Button>
      </Field>
    </form>
  )
}
