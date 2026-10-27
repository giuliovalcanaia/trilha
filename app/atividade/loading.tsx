import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div
      className="mx-auto flex max-w-4xl flex-col gap-4 p-4"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Carregando a atividade…</span>
      <Skeleton className="h-20 rounded-xl" />
      <div className="space-y-4">
        {Array.from({ length: 4 }, (_, indice) => (
          <Skeleton key={indice} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
