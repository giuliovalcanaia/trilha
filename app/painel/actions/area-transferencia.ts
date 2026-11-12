"use server"

import { fail, type ActionResult } from "@/lib/actions/result"
import { withProfessorCall } from "@/lib/actions/with-professor"
import { colarSchema } from "@/lib/dominio/area-transferencia"
import { transferir } from "@/lib/painel/transferencia"

export async function colarItens(input: unknown): Promise<ActionResult> {
  return withProfessorCall("colarItens", async (professor) => {
    const parsed = colarSchema.safeParse(input)

    if (!parsed.success) {
      return fail("Itens inválidos para colar.", "validacao")
    }

    return transferir(professor, parsed.data)
  })
}
