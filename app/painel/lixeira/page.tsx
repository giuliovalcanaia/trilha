import { TrashPage } from "@/components/painel/explorer/trash-page"
import { loadTrash } from "@/lib/data/lixeira"
import { createClient } from "@/lib/supabase/server"

export default async function Page() {
  const supabase = await createClient()
  const groups = await loadTrash(supabase)

  return <TrashPage groups={groups} />
}
