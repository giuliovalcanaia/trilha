"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)

    if (!nome.trim()) {
      setError("Informe o seu nome.")
      return
    }

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.")
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.")
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: nome.trim() },
      },
    })

    if (signUpError) {
      setLoading(false)
      setError(
        signUpError.code === "user_already_exists"
          ? "Este e-mail já tem uma conta. Use o login para entrar."
          : "Não foi possível criar a conta. Verifique os dados e tente novamente."
      )
      return
    }

    router.push("/painel")
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Crie sua conta</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Preencha o formulário para criar a sua conta de professor
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="name">Nome completo</FieldLabel>
          <Input
            id="name"
            type="text"
            placeholder="Fulano de Tal"
            required
            className="bg-background"
            autoFocus
            autoComplete="name"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            disabled={loading}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="fulano@email.com"
            required
            className="bg-background"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            className="bg-background"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
          />
          <FieldDescription>
            Precisa ter pelo menos 8 caracteres.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">Confirmar senha</FieldLabel>
          <Input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            className="bg-background"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={loading}
          />
          <FieldDescription>Por favor confirme a sua senha.</FieldDescription>
        </Field>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
          <FieldDescription className="text-center">
            Já tem uma conta?{" "}
            <a href="/login" className="underline underline-offset-4">
              Entre
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
