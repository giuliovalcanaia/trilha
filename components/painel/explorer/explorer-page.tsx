"use client"

import * as React from "react"
import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { FolderIcon, FolderPlusIcon, PlusIcon, SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import {
  duplicateAtividade,
  duplicatePasta,
  moveItem,
  setAtividadeAtiva,
  type ActionResult,
} from "@/app/painel/actions"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  NewFolderDialog,
  MoveDialog,
  RenameDialog,
  TrashConfirm,
  TrashSelecionadosConfirm,
} from "@/components/painel/explorer/explorer-dialogs"
import { ExplorerItemView } from "@/components/painel/explorer/explorer-item"
import { FolderShareBar } from "@/components/painel/folder-share-bar"
import {
  ExplorerToolbar,
  targetKey,
} from "@/components/painel/explorer/explorer-toolbar"
import {
  ehOrdemExplorer,
  isPasta,
  nomeDoItem,
  type ExplorerItem,
  type OrdemExplorer,
} from "@/components/painel/explorer/explorer-types"
import { toast } from "@/components/ui/toast"
import type { ExplorerData } from "@/lib/painel/explorer-data"
import { pastaBreadcrumb, pastaDescendantIds } from "@/lib/pastas"
import { itemKey } from "@/lib/selecao"
import { useSelecao } from "@/components/painel/selecao-context"
import { cn } from "@/lib/utils"

const DRAG_MIME = "application/x-painel-item"

type DialogState =
  | { kind: "nova-pasta"; parentId: number | null }
  | { kind: "renomear"; item: ExplorerItem }
  | { kind: "mover"; item: ExplorerItem }
  | { kind: "lixeira"; item: ExplorerItem }
  | { kind: "lixeira-selecao" }
  | null

function normalizar(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
}

export function ExplorerPage({ data }: { data: ExplorerData }) {
  const router = useRouter()
  const pastaAtualId = data.pastaAtual?.id ?? null
  const { selecionados, selecionar, definir, limpar } = useSelecao()
  const [view, setView] = useState<"lista" | "grade">("lista")
  const [ordem, setOrdem] = useState<OrdemExplorer>("nome-asc")
  const [query, setQuery] = useState("")
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dragging, setDragging] = useState<ExplorerItem | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const salvo = window.localStorage.getItem("painel:view")
    if (salvo === "lista" || salvo === "grade") setView(salvo)
    const ordemSalva = window.localStorage.getItem("painel:ordem")
    if (ehOrdemExplorer(ordemSalva)) setOrdem(ordemSalva)
  }, [])

  const itens = useMemo<ExplorerItem[]>(
    () => [
      ...data.pastasAtuais.map((pasta) => ({
        ...pasta,
        tipo: "pasta" as const,
      })),
      ...data.atividadesAtuais.map((atividade) => ({
        ...atividade,
        tipo: "atividade" as const,
      })),
    ],
    [data.pastasAtuais, data.atividadesAtuais]
  )

  // Mesma lista, mas com todas as pastas e atividades do professor — usada
  // enquanto há um termo de busca.
  const itensGlobais = useMemo<ExplorerItem[]>(() => {
    const subpastas = new Map<number, number>()
    const atividades = new Map<number, number>()

    for (const pasta of data.pastas) {
      if (pasta.parent_id === null) continue
      subpastas.set(pasta.parent_id, (subpastas.get(pasta.parent_id) ?? 0) + 1)
    }

    for (const atividade of data.todasAtividades) {
      if (atividade.pasta_id === null) continue
      atividades.set(
        atividade.pasta_id,
        (atividades.get(atividade.pasta_id) ?? 0) + 1
      )
    }

    return [
      ...data.pastas.map((pasta) => ({
        ...pasta,
        tipo: "pasta" as const,
        pastaCount: subpastas.get(pasta.id) ?? 0,
        atividadeCount: atividades.get(pasta.id) ?? 0,
      })),
      ...data.todasAtividades.map((atividade) => ({
        ...atividade,
        tipo: "atividade" as const,
      })),
    ]
  }, [data.pastas, data.todasAtividades])

  const termo = normalizar(query.trim())
  const visiveis = useMemo(() => {
    const fonte = termo ? itensGlobais : itens
    const filtrados = fonte.filter((item) => {
      if (!termo) return true
      return normalizar(nomeDoItem(item)).includes(termo)
    })

    return [...filtrados].sort((a, b) => {
      // Pastas continuam agrupadas antes das atividades, como nos
      // gerenciadores de arquivos.
      if (isPasta(a) !== isPasta(b)) return isPasta(a) ? -1 : 1

      if (ordem.startsWith("nome")) {
        const comparacao = nomeDoItem(a).localeCompare(nomeDoItem(b), "pt-BR", {
          numeric: true,
          sensitivity: "base",
        })
        return ordem === "nome-asc" ? comparacao : -comparacao
      }

      const comparacao = Date.parse(a.created_at) - Date.parse(b.created_at)
      return ordem === "data-asc" ? comparacao : -comparacao
    })
  }, [itens, itensGlobais, ordem, termo])

  // Caminho de cada pasta, para mostrar onde cada resultado da busca está.
  const caminhos = useMemo(() => {
    if (!termo) return null

    const mapa = new Map<number | null, string>()
    mapa.set(null, "Início")

    for (const pasta of data.pastas) {
      const nomes = pastaBreadcrumb(data.pastas, pasta.id).map(
        (item) => item.nome
      )
      mapa.set(pasta.id, ["Início", ...nomes].join(" / "))
    }

    return mapa
  }, [data.pastas, termo])

  function localDoItem(item: ExplorerItem) {
    if (!caminhos) return undefined
    return caminhos.get(isPasta(item) ? item.parent_id : item.pasta_id)
  }

  const chavesVisiveis = visiveis.map(itemKey)
  const selecionadosVisiveis = chavesVisiveis.filter((key) =>
    selecionados.has(key)
  ).length

  useEffect(() => {
    limpar()
  }, [pastaAtualId, limpar])

  useEffect(() => {
    setQuery("")
  }, [pastaAtualId])

  useEffect(() => {
    limpar()
  }, [query, limpar])

  useEffect(() => {
    function aoTeclar(event: KeyboardEvent) {
      const alvo = event.target as HTMLElement | null

      if (alvo?.closest("input, textarea, select, [contenteditable='true']")) {
        return
      }

      if (event.key === "Escape") {
        limpar()
        return
      }

      if (event.key === "Delete") {
        if (selecionados.size === 0) return
        event.preventDefault()
        setDialog({ kind: "lixeira-selecao" })
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault()
        definir(chavesVisiveis)
      }
    }

    window.addEventListener("keydown", aoTeclar)
    return () => window.removeEventListener("keydown", aoTeclar)
  }, [chavesVisiveis, definir, limpar, selecionados.size])

  const descendentes = useMemo(
    () =>
      dragging?.tipo === "pasta"
        ? pastaDescendantIds(data.pastas, dragging.id)
        : new Set<number>(),
    [dragging, data.pastas]
  )

  const newActivityHref =
    pastaAtualId === null
      ? "/painel/atividades/nova"
      : `/painel/atividades/nova?pasta=${pastaAtualId}`

  function executar(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action()

      if (result.error) {
        toast.add({ type: "error", title: result.error })
        return
      }

      if (result.success) {
        toast.add({ type: "success", title: result.success })
      }

      router.refresh()
    })
  }

  function abrir(item: ExplorerItem) {
    if (isPasta(item)) {
      router.push(`/painel/pastas/${item.id}`)
      return
    }
    router.push(`/painel/atividades/${item.id}?aba=configuracoes`)
  }

  function selecionarItem(
    item: ExplorerItem,
    mods?: { ctrl?: boolean; shift?: boolean }
  ) {
    selecionar(itemKey(item), {
      ctrl: mods?.ctrl,
      shift: mods?.shift,
      ordem: chavesVisiveis,
    })
  }

  function excluir(item: ExplorerItem) {
    if (selecionados.size > 0) {
      setDialog({ kind: "lixeira-selecao" })
      return
    }

    setDialog({ kind: "lixeira", item })
  }

  function duplicar(item: ExplorerItem) {
    executar(() =>
      isPasta(item) ? duplicatePasta(item.id) : duplicateAtividade(item.id)
    )
  }

  function alternarAtiva(item: ExplorerItem) {
    if (isPasta(item)) return
    executar(() => setAtividadeAtiva(item.id, item.status !== "publicada"))
  }

  async function copiarCodigo(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo)
      toast.add({ type: "success", title: `Código ${codigo} copiado.` })
    } catch {
      toast.add({
        type: "error",
        title: "Não foi possível copiar o código.",
      })
    }
  }

  function podeSoltar(destino: number | null) {
    if (!dragging) return false
    if (dragging.tipo === "atividade") return true

    if (destino === dragging.id) return false
    if (destino !== null && descendentes.has(destino)) return false

    return true
  }

  function iniciarArraste(event: React.DragEvent, item: ExplorerItem) {
    setDragging(item)
    event.dataTransfer.setData(
      DRAG_MIME,
      JSON.stringify({ tipo: item.tipo, id: item.id })
    )
    event.dataTransfer.effectAllowed = "move"
  }

  function finalizarArraste() {
    setDragging(null)
    setDragOverKey(null)
  }

  function arrastarSobre(event: React.DragEvent, destino: number | null) {
    if (!podeSoltar(destino)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDragOverKey(targetKey(destino))
  }

  function soltar(event: React.DragEvent, destino: number | null) {
    event.preventDefault()
    setDragOverKey(null)

    const item = dragging
    setDragging(null)

    if (!item || !podeSoltar(destino)) return

    const mesmoLugar =
      (item.tipo === "pasta" && item.parent_id === destino) ||
      (item.tipo === "atividade" && item.pasta_id === destino)

    if (mesmoLugar) return

    executar(() => moveItem(item.tipo, item.id, destino))
  }

  function arrastarSobreItem(event: React.DragEvent, item: ExplorerItem) {
    if (!isPasta(item)) return
    arrastarSobre(event, item.id)
  }

  function soltarEmItem(event: React.DragEvent, item: ExplorerItem) {
    if (!isPasta(item)) return
    soltar(event, item.id)
  }

  function alterarVisao(nova: "lista" | "grade") {
    setView(nova)
    window.localStorage.setItem("painel:view", nova)
  }

  function alterarOrdem(nova: OrdemExplorer) {
    setOrdem(nova)
    window.localStorage.setItem("painel:ordem", nova)
  }

  const novoItem = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setDialog({ kind: "nova-pasta", parentId: pastaAtualId })
        }
      >
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
  )

  return (
    <div
      className={cn("flex w-full flex-col gap-4", isPending && "opacity-80")}
      aria-busy={isPending}
    >
      <ExplorerToolbar
        breadcrumb={data.breadcrumb}
        query={query}
        onQueryChange={setQuery}
        view={view}
        onViewChange={alterarVisao}
        ordem={ordem}
        onOrdemChange={alterarOrdem}
        onNewFolder={() =>
          setDialog({ kind: "nova-pasta", parentId: pastaAtualId })
        }
        newActivityHref={newActivityHref}
        onDragOverTo={arrastarSobre}
        onDropTo={soltar}
        onDragLeave={() => setDragOverKey(null)}
        dragOverKey={dragOverKey}
      />

      {data.pastaAtual && data.compartilhamento && (
        <FolderShareBar
          pastaId={data.pastaAtual.id}
          nome={data.pastaAtual.nome}
          compartilhamento={data.compartilhamento}
        />
      )}

      {visiveis.length === 0 ? (
        <EmptyExplorer
          buscando={termo.length > 0}
          pastaAtualNome={data.pastaAtual?.nome ?? null}
          onNewFolder={() =>
            setDialog({ kind: "nova-pasta", parentId: pastaAtualId })
          }
          newActivityHref={newActivityHref}
          extra={novoItem}
        />
      ) : (
        <div
          role="listbox"
          aria-label="Conteúdo da pasta"
          aria-multiselectable="true"
          className={cn(
            view === "lista"
              ? "flex flex-col gap-2"
              : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}
        >
          {visiveis.map((item) => (
            <ExplorerItemView
              key={`${item.tipo}-${item.id}`}
              item={item}
              view={view}
              selected={selecionados.has(itemKey(item))}
              local={localDoItem(item)}
              onSelect={(mods) => selecionarItem(item, mods)}
              onOpen={() => abrir(item)}
              onNewFolder={() =>
                setDialog({
                  kind: "nova-pasta",
                  parentId: isPasta(item) ? item.id : pastaAtualId,
                })
              }
              onNewActivity={() => {
                if (isPasta(item)) {
                  router.push(`/painel/atividades/nova?pasta=${item.id}`)
                }
              }}
              onRename={() => setDialog({ kind: "renomear", item })}
              onDuplicate={() => duplicar(item)}
              onMove={() => setDialog({ kind: "mover", item })}
              onToggleAtiva={() => alternarAtiva(item)}
              onCopyCode={(codigo) => {
                void copiarCodigo(codigo)
              }}
              onTrash={() => excluir(item)}
              onDragStart={iniciarArraste}
              onDragEnd={finalizarArraste}
              onDragOver={arrastarSobreItem}
              onDragLeave={() => setDragOverKey(null)}
              onDrop={soltarEmItem}
              dropActive={isPasta(item) && dragOverKey === targetKey(item.id)}
              disabledDrop={isPasta(item) && !!dragging && !podeSoltar(item.id)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {selecionadosVisiveis > 0
          ? `${selecionadosVisiveis} de ${visiveis.length} selecionado(s)`
          : `${visiveis.length} item(ns)`}
        {termo ? ` para “${query.trim()}” em todas as pastas` : ""}
      </p>

      {dialog?.kind === "nova-pasta" && (
        <NewFolderDialog
          open
          parentId={dialog.parentId}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
        />
      )}

      {dialog?.kind === "renomear" && (
        <RenameDialog
          open
          item={dialog.item}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
        />
      )}

      {dialog?.kind === "mover" && (
        <MoveDialog
          open
          item={dialog.item}
          pastas={data.pastas}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
        />
      )}

      {dialog?.kind === "lixeira" && (
        <TrashConfirm
          open
          tipo={dialog.item.tipo}
          id={dialog.item.id}
          nome={isPasta(dialog.item) ? dialog.item.nome : dialog.item.titulo}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
        />
      )}

      {dialog?.kind === "lixeira-selecao" && (
        <TrashSelecionadosConfirm
          open
          chaves={[...selecionados]}
          onOpenChange={(open) => {
            if (!open) setDialog(null)
          }}
        />
      )}
    </div>
  )
}

function EmptyExplorer({
  buscando,
  pastaAtualNome,
  onNewFolder,
  newActivityHref,
  extra,
}: {
  buscando: boolean
  pastaAtualNome: string | null
  onNewFolder: () => void
  newActivityHref: string
  extra: React.ReactNode
}) {
  if (buscando) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SearchIcon className="size-5 text-muted-foreground" />
            Nenhum resultado
          </CardTitle>
          <CardDescription>
            Não encontramos pastas ou atividades com esse nome em nenhuma pasta.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderIcon className="size-5 text-muted-foreground" />
              {pastaAtualNome
                ? `A pasta “${pastaAtualNome}” está vazia`
                : "Seu explorador está vazio"}
            </CardTitle>
            <CardDescription>
              Crie uma pasta para organizar ou comece uma nova atividade.
            </CardDescription>
          </CardHeader>
          <CardContent>{extra}</CardContent>
        </Card>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuGroup>
          <ContextMenuItem onClick={onNewFolder}>
            <FolderPlusIcon />
            Nova pasta
          </ContextMenuItem>
          <ContextMenuItem render={<Link href={newActivityHref} />}>
            <PlusIcon />
            Nova atividade
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}
