import { z } from "zod"

/**
 * Variáveis públicas do Supabase. Falham no boot (build/servidor) em vez de
 * gerar um erro confuso na primeira requisição.
 *
 * As variáveis `NEXT_PUBLIC_*` são inlinadas pelo Next tanto no servidor quanto
 * no navegador, por isso este módulo pode ser importado pelos dois clientes.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: "NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL válida.",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY não foi definida."),
})

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
})

if (!parsed.success) {
  const detalhes = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ")

  throw new Error(
    `Configuração do Supabase inválida (${detalhes}). Confira o arquivo .env.local.`
  )
}

export const env = {
  supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
} as const
