"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  ChevronRightIcon,
  HouseIcon,
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
} from "lucide-react"

import {
  type OpcaoOrdenacao,
  OrdenarMenu,
} from "@/components/painel/ordenar-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { OrdemLixeira } from "@/lib/dominio/lixeira"

const opcoesOrdem: OpcaoOrdenacao<OrdemLixeira>[] = [
  {
    value: "movido-desc",
    label: "Movido em (mais recentes)",
    campo: "Movido",
    crescente: false,
  },
  {
    value: "movido-asc",
    label: "Movido em (mais antigos)",
    campo: "Movido",
    crescente: true,
  },
  { value: "nome-asc", label: "Nome (A–Z)", campo: "Nome", crescente: true },
  { value: "nome-desc", label: "Nome (Z–A)", campo: "Nome", crescente: false },
]

/**
 * Barra da lixeira, com a mesma estrutura da toolbar do explorador: caminho,
 * busca, visão, ordenação e as ações à direita.
 *
 * Sem itens, só o caminho aparece — busca e ordenação em uma lixeira vazia
 * seriam controles sem efeito.
 */
export function TrashToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  ordem,
  onOrdemChange,
  mostrarControles,
  acoes,
}: {
  query: string
  onQueryChange: (value: string) => void
  view: "lista" | "grade"
  onViewChange: (view: "lista" | "grade") => void
  ordem: OrdemLixeira
  onOrdemChange: (ordem: OrdemLixeira) => void
  mostrarControles: boolean
  acoes?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      <nav
        aria-label="Você está aqui"
        className="flex items-center gap-1 overflow-x-auto text-sm"
      >
        <Link
          href="/painel"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <HouseIcon data-icon="inline-start" className="size-3.5" />
          Início
        </Link>
        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 font-medium text-foreground">
          Lixeira
        </span>
      </nav>

      {mostrarControles && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Buscar na lixeira..."
              aria-label="Buscar na lixeira"
              className="pl-8"
            />
          </div>

          <div className="flex items-center rounded-lg border p-0.5">
            <Button
              type="button"
              variant={view === "lista" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Visualizar em lista"
              aria-pressed={view === "lista"}
              onClick={() => onViewChange("lista")}
            >
              <ListIcon />
            </Button>
            <Button
              type="button"
              variant={view === "grade" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Visualizar em grade"
              aria-pressed={view === "grade"}
              onClick={() => onViewChange("grade")}
            >
              <LayoutGridIcon />
            </Button>
          </div>

          <OrdenarMenu
            valor={ordem}
            opcoes={opcoesOrdem}
            onValueChange={onOrdemChange}
          />

          {acoes && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {acoes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
