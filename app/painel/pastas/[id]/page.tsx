import { notFound } from "next/navigation"

import { ExplorerPage } from "@/components/painel/explorer/explorer-page"
import { loadExplorerData } from "@/lib/painel/explorer-data"

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const pastaId = Number(id)

  if (!Number.isInteger(pastaId) || pastaId <= 0) notFound()

  const data = await loadExplorerData(pastaId)
  if (!data) notFound()

  return <ExplorerPage data={data} />
}
