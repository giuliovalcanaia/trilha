import type { Metadata } from "next"
import { TrashPage } from "@/components/painel/lixeira/trash-page"
import { loadTrash } from "@/lib/data/lixeira"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Lixeira",
  robots: { index: false, follow: false },
}

export default async function Page() {
  const supabase = await createClient()
  const groups = await loadTrash(supabase)

  return <TrashPage groups={groups} />
}
