"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import {
  ChevronRightIcon,
  FolderIcon,
  HouseIcon,
  LoaderCircleIcon,
} from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  flattenPastasVisiveis,
  pastaBreadcrumb,
  type AtividadePastaRow,
  type PastaRow,
} from "@/lib/dominio/pastas"
import { useNavegacaoPastas } from "@/hooks/use-navegacao-pastas"
import { cn } from "@/lib/utils"

export function NavProjects({
  pastas,
  atividadePastas,
}: {
  pastas: PastaRow[]
  atividadePastas: AtividadePastaRow[]
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { navegar, navegando, prefetch } = useNavegacaoPastas()
  const { isMobile, setOpenMobile } = useSidebar()

  function navegarPasta(pastaId: number | null) {
    navegar(pastaId)
    if (isMobile) setOpenMobile(false)
  }

  const pastaDaAtividade = useMemo(
    () =>
      new Map(
        atividadePastas.map((atividade) => [atividade.id, atividade.pasta_id])
      ),
    [atividadePastas]
  )

  const pastaAtualId = useMemo(() => {
    const pastaMatch = pathname.match(/^\/painel\/pastas\/(\d+)/)
    if (pastaMatch) return Number(pastaMatch[1])

    // Numa atividade, mantém aberto o caminho da pasta que a contém.
    const atividadeMatch = pathname.match(/^\/painel\/atividades\/(\d+)/)
    if (atividadeMatch) {
      return pastaDaAtividade.get(Number(atividadeMatch[1])) ?? null
    }

    // Na criação, a pasta de destino vem em ?pasta=<id>.
    if (pathname === "/painel/atividades/nova") {
      const pastaId = Number(searchParams.get("pasta"))
      return Number.isInteger(pastaId) && pastaId > 0 ? pastaId : null
    }

    return null
  }, [pathname, pastaDaAtividade, searchParams])

  // Já começa com o caminho da pasta atual aberto, sem um recolhimento inicial
  // quando a página é carregada direto (por exemplo, ao abrir uma atividade).
  const [expandidas, setExpandidas] = useState<Set<number>>(
    () =>
      new Set(pastaBreadcrumb(pastas, pastaAtualId).map((pasta) => pasta.id))
  )
  const [homeAberta, setHomeAberta] = useState(true)

  const arvore = homeAberta ? flattenPastasVisiveis(pastas, expandidas) : []
  const homeTemFilhos = pastas.length > 0

  const comFilhos = useMemo(
    () =>
      new Set(
        pastas.flatMap((pasta) =>
          pasta.parent_id === null ? [] : [pasta.parent_id]
        )
      ),
    [pastas]
  )

  function alternarPasta(id: number) {
    setExpandidas((anterior) => {
      const proximo = new Set(anterior)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  function alternarHome() {
    setHomeAberta((anterior) => !anterior)
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Pastas</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              data-nav-href="/painel"
              isActive={pathname === "/painel"}
              tooltip="home"
              aria-expanded={homeTemFilhos ? homeAberta : undefined}
              aria-busy={navegando?.pastaId === null || undefined}
              style={{ paddingLeft: "8px" }}
              onMouseEnter={() => prefetch(null)}
              onFocus={() => prefetch(null)}
              onClick={(event) => {
                if (event.detail === 1 && homeTemFilhos) {
                  if (pathname === "/painel") alternarHome()
                  else setHomeAberta(true)
                }

                navegarPasta(null)
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "ArrowRight" &&
                  homeTemFilhos &&
                  !homeAberta
                ) {
                  event.preventDefault()
                  setHomeAberta(true)
                  return
                }

                if (event.key === "ArrowLeft" && homeTemFilhos && homeAberta) {
                  event.preventDefault()
                  setHomeAberta(false)
                }
              }}
            >
              {homeTemFilhos ? (
                <ChevronRightIcon
                  className={cn(
                    "shrink-0 transition-transform",
                    homeAberta && "rotate-90"
                  )}
                />
              ) : (
                <span className="size-4 shrink-0" aria-hidden="true" />
              )}
              {navegando?.pastaId === null ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden />
              ) : (
                <HouseIcon />
              )}
              <span className="truncate">home</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {arvore.map((pasta) => {
            const url = `/painel/pastas/${pasta.id}`
            const temFilhos = comFilhos.has(pasta.id)
            const aberta = expandidas.has(pasta.id)

            return (
              <SidebarMenuItem key={pasta.id}>
                <SidebarMenuButton
                  type="button"
                  data-nav-href={url}
                  isActive={pastaAtualId === pasta.id}
                  tooltip={pasta.nome}
                  aria-expanded={temFilhos ? aberta : undefined}
                  aria-busy={navegando?.pastaId === pasta.id || undefined}
                  style={{
                    paddingLeft: `${8 + (pasta.depth + 1) * 14}px`,
                  }}
                  onMouseEnter={() => prefetch(pasta.id)}
                  onFocus={() => prefetch(pasta.id)}
                  onClick={(event) => {
                    if (event.detail === 1 && temFilhos) {
                      alternarPasta(pasta.id)
                    }

                    navegarPasta(pasta.id)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight" && temFilhos && !aberta) {
                      event.preventDefault()
                      alternarPasta(pasta.id)
                      return
                    }

                    if (event.key === "ArrowLeft" && temFilhos && aberta) {
                      event.preventDefault()
                      alternarPasta(pasta.id)
                    }
                  }}
                >
                  {temFilhos ? (
                    <ChevronRightIcon
                      className={cn(
                        "shrink-0 transition-transform",
                        aberta && "rotate-90"
                      )}
                    />
                  ) : (
                    <span className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  {navegando?.pastaId === pasta.id ? (
                    <LoaderCircleIcon className="animate-spin" aria-hidden />
                  ) : (
                    <FolderIcon />
                  )}
                  <span className="truncate">{pasta.nome}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroup>
    </>
  )
}
