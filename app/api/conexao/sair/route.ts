import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const corpoSchema = z.object({
  aplicacaoId: z.number().int().positive(),
})

/**
 * Aviso de saída da aba do aluno (`navigator.sendBeacon` no `pagehide`).
 *
 * O beacon não consegue mandar o header `Authorization`, então a rota lê a
 * sessão dos cookies e chama `agendar_desconexao`. O RPC só mexe na conexão
 * do próprio aluno, então não há nada além da sessão para autorizar.
 *
 * Erros são silenciosos de propósito: o batimento da tela também expira a
 * conexão, e um beacon perdido não pode virar erro visível no navegador.
 */
export async function POST(request: NextRequest) {
  const parsed = corpoSchema.safeParse(await request.json().catch(() => null))

  if (!parsed.success) {
    return new NextResponse(null, { status: 400 })
  }

  const supabase = await createClient()

  await supabase.rpc("agendar_desconexao", {
    p_aplicacao_id: parsed.data.aplicacaoId,
  })

  return new NextResponse(null, { status: 204 })
}
