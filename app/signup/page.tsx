import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthShell } from "@/components/auth/auth-shell"
import { SignupForm } from "@/components/auth/signup-form"
import { getProfessor } from "@/lib/auth/professor"

export const metadata: Metadata = {
  title: "Criar conta",
}

export default async function SignupPage() {
  if (await getProfessor()) redirect("/painel")

  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  )
}
