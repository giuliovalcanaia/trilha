import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth/auth-shell"
import { SignupForm } from "@/components/auth/signup-form"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Criar conta",
}

export default async function SignupPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub

  if (userId) {
    const { data: professor } = await supabase
      .from("professores")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()

    if (professor) redirect("/painel")
  }

  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  )
}
