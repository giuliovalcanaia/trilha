import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/**
 * Bloco cinza dos esqueletos de rota (`loading.tsx`).
 *
 * Centraliza o `motion-reduce` (quem pediu menos movimento não vê pulsação); as
 * medidas continuam em cada esqueleto, que precisa imitar a tela de verdade.
 */
export function Bloco({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn("motion-reduce:animate-none", className)}
      aria-hidden
    />
  )
}
