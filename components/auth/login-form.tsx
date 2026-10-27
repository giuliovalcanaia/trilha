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

export function LoginForm({
  className,
  expirado = false,
  ...props
}: React.ComponentProps<"form"> & { expirado?: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)
    setInfo(null)
    setNeedsConfirmation(false)
    setLoading(true)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setLoading(false)

      if (
        signInError.code === "email_not_confirmed" ||
        /not confirmed/i.test(signInError.message)
      ) {
        setNeedsConfirmation(true)
        setError("Confirme o seu e-mail antes de entrar.")
        return
      }

      setError("E-mail ou senha inválidos.")
      return
    }

    router.push("/painel")
    router.refresh()
  }

  async function handleResend() {
    setInfo(null)
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })

    setLoading(false)

    if (resendError) {
      setError("Não foi possível reenviar agora. Tente novamente mais tarde.")
      return
    }

    setNeedsConfirmation(false)
    setInfo("Enviamos um novo link de confirmação para o seu e-mail.")
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Entre na sua conta</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Digite o seu e-mail e senha para acessar o painel
          </p>
        </div>
        {expirado && !error && (
          <p
            className="text-center text-sm text-muted-foreground"
            role="status"
          >
            Sua sessão expirou. Entre novamente.
          </p>
        )}
        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="nome@email.com"
            required
            autoFocus
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
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
          />
        </Field>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="text-sm text-muted-foreground" role="status">
            {info}
          </p>
        )}
        {needsConfirmation && (
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={loading}
          >
            Reenviar e-mail de confirmação
          </Button>
        )}
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <FieldDescription className="text-center">
            Não tem uma conta?{" "}
            <a href="/signup" className="underline underline-offset-4">
              Criar conta
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
