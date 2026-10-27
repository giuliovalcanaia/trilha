import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div
      className="m-4 max-w-5xl space-y-4"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando o painel…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, indice) => (
          <Skeleton key={indice} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
