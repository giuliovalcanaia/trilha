import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { createClient } from "@/lib/supabase/server"

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

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  if (userId) {
    const { data: professor } = await supabase
      .from("professores")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()

    // Evita loop de redirect caso o cookie de sessão ainda não tenha sido
    // removido quando a sessão expira.
    if (professor && !sessaoExpirada) redirect("/painel")
  }

  return (
    <AuthShell>
      <LoginForm expirado={sessaoExpirada} />
    </AuthShell>
  )
}
