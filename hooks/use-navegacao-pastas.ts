"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

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
 * exemplo, numa atividade ou na lixeira), usa a navegação normal do router e
 * guarda em `navegando` qual pasta está carregando, para a sidebar mostrar
 * spinner em vez de parecer que o clique falhou.
 */
export function useNavegacaoPastas() {
  const pathname = usePathname()
  const router = useRouter()
  const [navegando, setNavegando] = useState<{
    pastaId: number | null
    rota: string
  } | null>(null)

  // Mesmo padrão do explorador: ajuste no render, não em efeito.
  if (navegando && navegando.rota !== pathname) {
    setNavegando(null)
  }

  function navegar(pastaId: number | null, opcoes?: { replace?: boolean }) {
    const url = urlDaPasta(pastaId)

    if (!rotaDoExplorador(pathname)) {
      setNavegando({ pastaId, rota: pathname })
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

  /**
   * Aquece o destino quando a navegação vai passar pelo servidor. Dentro do
   * explorador não faz sentido: a troca já é local.
   */
  function prefetch(pastaId: number | null) {
    if (rotaDoExplorador(pathname)) return
    router.prefetch(urlDaPasta(pastaId))
  }

  return {
    pastaAtualId: pastaIdDaRota(pathname),
    navegar,
    navegando,
    prefetch,
  }
}
