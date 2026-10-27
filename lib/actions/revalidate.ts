import { revalidatePath } from "next/cache"

export function revalidatePainel(extra?: string) {
  revalidatePath("/painel", "layout")
  revalidatePath("/painel/lixeira")
  if (extra) revalidatePath(extra)
}
