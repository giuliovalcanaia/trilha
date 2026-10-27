"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderPlusIcon,
  HouseIcon,
  LayoutGridIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { type OrdemExplorer } from "@/components/painel/explorer/explorer-types"
import { type PastaRow } from "@/lib/dominio/pastas"
import { cn } from "@/lib/utils"

const opcoesOrdem: { value: OrdemExplorer; label: string }[] = [
  { value: "nome-asc", label: "Nome (A–Z)" },
  { value: "nome-desc", label: "Nome (Z–A)" },
  { value: "data-desc", label: "Data de criação (mais recentes)" },
  { value: "data-asc", label: "Data de criação (mais antigas)" },
]

export function targetKey(pastaId: number | null) {
  return pastaId === null ? "root" : `pasta:${pastaId}`
}

export function ExplorerToolbar({
  breadcrumb,
  query,
  onQueryChange,
  view,
  onViewChange,
  ordem,
  onOrdemChange,
  onNewFolder,
  newActivityHref,
  onDragOverTo,
  onDropTo,
  onDragLeave,
  dragOverKey,
}: {
  breadcrumb: PastaRow[]
  query: string
  onQueryChange: (value: string) => void
  view: "lista" | "grade"
  onViewChange: (view: "lista" | "grade") => void
  ordem: OrdemExplorer
  onOrdemChange: (ordem: OrdemExplorer) => void
  onNewFolder: () => void
  newActivityHref: string
  onDragOverTo: (event: React.DragEvent, pastaId: number | null) => void
  onDropTo: (event: React.DragEvent, pastaId: number | null) => void
  onDragLeave: () => void
  dragOverKey: string | null
}) {
  return (
    <div className="flex flex-col gap-3">
      <nav
        aria-label="Caminho da pasta"
        className="flex items-center gap-1 overflow-x-auto text-sm"
      >
        <DropTarget
          pastaId={null}
          current={breadcrumb.length === 0}
          active={dragOverKey === targetKey(null)}
          onDragOver={onDragOverTo}
          onDrop={onDropTo}
          onDragLeave={onDragLeave}
        >
          <HouseIcon data-icon="inline-start" className="size-3.5" />
          Início
        </DropTarget>
        {breadcrumb.map((pasta, index) => {
          const current = index === breadcrumb.length - 1
          return (
            <React.Fragment key={pasta.id}>
              <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <DropTarget
                pastaId={pasta.id}
                current={current}
                active={dragOverKey === targetKey(pasta.id)}
                onDragOver={onDragOverTo}
                onDrop={onDropTo}
                onDragLeave={onDragLeave}
              >
                {pasta.nome}
              </DropTarget>
            </React.Fragment>
          )
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar em todas as pastas..."
            aria-label="Buscar em todas as pastas"
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

        <OrdenarMenu ordem={ordem} onOrdemChange={onOrdemChange} />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onNewFolder}>
            <FolderPlusIcon data-icon="inline-start" />
            Nova pasta
          </Button>
          <Link
            href={newActivityHref}
            className={buttonVariants({ variant: "default" })}
          >
            <PlusIcon data-icon="inline-start" />
            Nova atividade
          </Link>
        </div>
      </div>
    </div>
  )
}

function OrdenarMenu({
  ordem,
  onOrdemChange,
}: {
  ordem: OrdemExplorer
  onOrdemChange: (ordem: OrdemExplorer) => void
}) {
  const campo = ordem.startsWith("nome") ? "Nome" : "Data"
  const crescente = ordem.endsWith("asc")
  const opcaoAtual = opcoesOrdem.find((opcao) => opcao.value === ordem)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={`Ordenar por ${opcaoAtual?.label ?? campo}`}
          />
        }
      >
        {crescente ? (
          <ArrowUpIcon data-icon="inline-start" />
        ) : (
          <ArrowDownIcon data-icon="inline-start" />
        )}
        <span className="hidden sm:inline">Ordenar: </span>
        {/* Reserva a largura do maior rótulo para o botão não mudar de tamanho. */}
        <span className="grid text-left">
          <span className="invisible col-start-1 row-start-1" aria-hidden>
            Nome
          </span>
          <span className="invisible col-start-1 row-start-1" aria-hidden>
            Data
          </span>
          <span className="col-start-1 row-start-1">{campo}</span>
        </span>
        <ChevronDownIcon
          data-icon="inline-end"
          className="text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={ordem}
            onValueChange={(value) => onOrdemChange(value as OrdemExplorer)}
          >
            {opcoesOrdem.map((opcao) => (
              <DropdownMenuRadioItem key={opcao.value} value={opcao.value}>
                {opcao.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DropTarget({
  pastaId,
  current,
  active,
  onDragOver,
  onDrop,
  onDragLeave,
  children,
}: {
  pastaId: number | null
  current: boolean
  active: boolean
  onDragOver: (event: React.DragEvent, pastaId: number | null) => void
  onDrop: (event: React.DragEvent, pastaId: number | null) => void
  onDragLeave: () => void
  children: React.ReactNode
}) {
  const className = cn(
    "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors",
    current && "font-medium text-foreground",
    active && "bg-accent text-accent-foreground ring-1 ring-primary/40"
  )

  return (
    <div
      onDragOver={(event) => onDragOver(event, pastaId)}
      onDrop={(event) => onDrop(event, pastaId)}
      onDragLeave={onDragLeave}
      className={className}
    >
      {current ? (
        <span className="inline-flex items-center gap-1">{children}</span>
      ) : (
        <Link
          href={pastaId === null ? "/painel" : `/painel/pastas/${pastaId}`}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {children}
        </Link>
      )}
    </div>
  )
}
