import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ExplorerPage } from "@/components/painel/explorer/explorer-page"
import { loadExplorerData } from "@/lib/painel/explorer-data"

export const metadata: Metadata = {
  title: "Atividades",
  robots: { index: false, follow: false },
}

export default async function Page() {
  const data = await loadExplorerData(null)
  if (!data) notFound()

  return <ExplorerPage data={data} />
}
