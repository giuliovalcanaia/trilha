"use client"

import { usePathname, useRouter } from "next/navigation"

/** Extrai o id da pasta de uma URL do explorador (`/painel` ou `/painel/pastas/1`). */
export function pastaIdDaRota(pathname: string): number | null {
  if (pathname === "/painel") return null

  const match = pathname.match(/^\/painel\/pastas\/(\d+)(?:\/|$)/)
  return match ? Number(match[1]) : null
}

export function urlDaPasta(pastaId: number | null) {
  return pastaId === null ? "/painel" : `/painel/pastas/${pastaId}`
}

function rotaDoExplorador(pathname: string) {
  return pathname === "/painel" || pathname.startsWith("/painel/pastas/")
}

/**
 * Troca de pasta sem nova requisição ao servidor.
 *
 * Dentro do explorador, atualiza a URL pela History API nativa — o Next 16
 * sincroniza `usePathname` sem iniciar uma transição de rota. Fora dele (por
 * exemplo, numa atividade), usa a navegação normal do router.
 */
export function useNavegacaoPastas() {
  const pathname = usePathname()
  const router = useRouter()

  function navegar(pastaId: number | null, opcoes?: { replace?: boolean }) {
    const url = urlDaPasta(pastaId)

    if (!rotaDoExplorador(pathname)) {
      router.push(url)
      return
    }

    if (window.location.pathname === url) return

    window.history[opcoes?.replace ? "replaceState" : "pushState"](
      null,
      "",
      url
    )
  }

  return {
    pastaAtualId: pastaIdDaRota(pathname),
    navegar,
  }
}
