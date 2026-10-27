import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { getProfessor } from "@/lib/auth/professor"

export const metadata: Metadata = {
  title: "Entrar",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expirado?: string }>
}) {
  const { expirado } = await searchParams
  const sessaoExpirada = expirado === "1"

  // Evita loop de redirect caso o cookie de sessão ainda não tenha sido
  // removido quando a sessão expira.
  if (!sessaoExpirada && (await getProfessor())) redirect("/painel")

  return (
    <AuthShell>
      <LoginForm expirado={sessaoExpirada} />
    </AuthShell>
  )
}
