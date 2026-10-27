import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { test as setup } from "@playwright/test"

const execFileAsync = promisify(execFile)

const OPCOES = { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 }

/**
 * `supabase db reset` recria o schema e aplica o seed (professor de teste,
 * atividade `TESTE1`). O comando reinicia containers e, de vez em quando, o
 * restart falha por conta do Docker — por isso a segunda tentativa.
 */
async function resetarBanco() {
  for (let tentativa = 1; ; tentativa++) {
    try {
      await execFileAsync("npx", ["supabase", "db", "reset"], OPCOES)
      return
    } catch (erro) {
      if (tentativa >= 2) throw erro
      await new Promise((resolve) => setTimeout(resolve, 3_000))
    }
  }
}

setup("reseta o banco local com o seed", async () => {
  setup.setTimeout(240_000)

  try {
    await execFileAsync("npx", ["supabase", "status"], { timeout: 60_000 })
  } catch {
    throw new Error(
      "O Supabase local não está rodando. Rode `npx supabase start`."
    )
  }

  await resetarBanco()
})
