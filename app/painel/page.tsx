import { notFound } from "next/navigation"

import { ExplorerPage } from "@/components/painel/explorer/explorer-page"
import { loadExplorerData } from "@/lib/painel/explorer-data"

export default async function Page() {
  const data = await loadExplorerData(null)
  if (!data) notFound()

  return <ExplorerPage data={data} />
}
