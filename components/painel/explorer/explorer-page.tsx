"use client"

import * as React from "react"
import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  FolderIcon,
  FolderPlusIcon,
  PlusIcon,
  SearchIcon,
  Share2Icon,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import {
  duplicateAtividade,
  setAtividadeAtiva,
} from "@/app/painel/actions/atividade"
import { duplicatePasta, moveItem } from "@/app/painel/actions/pasta"
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
import { FolderShareDialog } from "@/components/painel/explorer/folder-share-dialog"
import {
  ExplorerToolbar,
  targetKey,
} from "@/components/painel/explorer/explorer-toolbar"
import {
  isPasta,
  nomeDoItem,
  ORDENS_EXPLORER,
  type ExplorerItem,
  type OrdemExplorer,
} from "@/components/painel/explorer/explorer-types"
import { toast } from "@/components/ui/toast"
import type { ActionResult } from "@/lib/actions/result"
import { pastaBreadcrumb, pastaDescendantIds } from "@/lib/dominio/pastas"
import { itemKey } from "@/lib/dominio/selecao"
import type { ExplorerData } from "@/lib/painel/explorer-data"
import { useSelecao } from "@/components/painel/selecao-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { useNavegacaoPastas } from "@/hooks/use-navegacao-pastas"
import { useStoredPreference } from "@/hooks/use-stored-preference"
import { cn } from "@/lib/utils"

const DRAG_MIME = "application/x-painel-item"
const VIEWS = ["lista", "grade"] as const

/** URL do editor; o prefetch precisa bater com o que o `abrir` navega. */
function urlDaAtividade(id: number) {
  return `/painel/atividades/${id}?aba=configuracoes`
}

type DialogState =
  | { kind: "nova-pasta"; parentId: number | null }
  | { kind: "renomear"; item: ExplorerItem }
  | { kind: "mover"; item: ExplorerItem }
  | { kind: "compartilhar"; pastaId: number; nome: string }
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
  const pathname = usePathname()
  const { pastaAtualId, navegar } = useNavegacaoPastas()
  const isMobile = useIsMobile()
  const { selecionados, selecionar, definir, limpar } = useSelecao()
  const [view, setView] = useStoredPreference("painel:view", VIEWS, "lista")
  const [ordem, setOrdem] = useStoredPreference(
    "painel:ordem",
    ORDENS_EXPLORER,
    "nome-asc"
  )
  const [query, setQuery] = useState("")
  const [pastaAnterior, setPastaAnterior] = useState(pastaAtualId)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [dragging, setDragging] = useState<ExplorerItem | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // Atividade cujo editor está sendo carregado. O cartão mostra spinner no
  // mesmo instante do clique, antes de o esqueleto da rota chegar. A rota de
  // origem fica guardada para não deixar o spinner preso se a navegação não
  // completar.
  const [abrindo, setAbrindo] = useState<{ id: number; rota: string } | null>(
    null
  )

  // Mesmo padrão do `pastaAnterior`: ajuste no render, não em efeito.
  if (abrindo && abrindo.rota !== pathname) {
    setAbrindo(null)
  }

  // A pasta mudou via History API (sem remontar o componente): a busca some,
  // como se a tela tivesse sido trocada.
  if (pastaAnterior !== pastaAtualId) {
    setPastaAnterior(pastaAtualId)
    setQuery("")
  }

  const pastaAtual = useMemo(
    () =>
      pastaAtualId === null
        ? null
        : (data.pastas.find((pasta) => pasta.id === pastaAtualId) ?? null),
    [data.pastas, pastaAtualId]
  )

  const breadcrumb = useMemo(
    () => pastaBreadcrumb(data.pastas, pastaAtualId),
    [data.pastas, pastaAtualId]
  )

  const pastasAtuais = useMemo(
    () => data.pastas.filter((pasta) => pasta.parent_id === pastaAtualId),
    [data.pastas, pastaAtualId]
  )

  const atividadesAtuais = useMemo(
    () =>
      data.todasAtividades.filter(
        (atividade) => atividade.pasta_id === pastaAtualId
      ),
    [data.todasAtividades, pastaAtualId]
  )

  const itens = useMemo<ExplorerItem[]>(
    () => [
      ...pastasAtuais.map((pasta) => ({
        ...pasta,
        tipo: "pasta" as const,
      })),
      ...atividadesAtuais.map((atividade) => ({
        ...atividade,
        tipo: "atividade" as const,
      })),
    ],
    [pastasAtuais, atividadesAtuais]
  )

  // Mesma lista, mas com todas as pastas e atividades do professor — usada
  // enquanto há um termo de busca.
  const itensGlobais = useMemo<ExplorerItem[]>(
    () => [
      ...data.pastas.map((pasta) => ({
        ...pasta,
        tipo: "pasta" as const,
      })),
      ...data.todasAtividades.map((atividade) => ({
        ...atividade,
        tipo: "atividade" as const,
      })),
    ],
    [data.pastas, data.todasAtividades]
  )

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
    window.scrollTo({ top: 0 })
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
      navegar(item.id)
      return
    }
    setAbrindo({ id: item.id, rota: pathname })
    router.push(urlDaAtividade(item.id))
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
  }

  function alterarOrdem(nova: OrdemExplorer) {
    setOrdem(nova)
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
        breadcrumb={breadcrumb}
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

      {visiveis.length === 0 ? (
        <EmptyExplorer
          buscando={termo.length > 0}
          pastaAtualNome={pastaAtual?.nome ?? null}
          onNewFolder={() =>
            setDialog({ kind: "nova-pasta", parentId: pastaAtualId })
          }
          newActivityHref={newActivityHref}
          extra={novoItem}
          onShare={
            pastaAtual
              ? () =>
                  setDialog({
                    kind: "compartilhar",
                    pastaId: pastaAtual.id,
                    nome: pastaAtual.nome,
                  })
              : undefined
          }
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
              abrirComUmClique={isMobile}
              abrindo={!isPasta(item) && abrindo?.id === item.id}
              onPrefetch={
                isPasta(item)
                  ? undefined
                  : () => router.prefetch(urlDaAtividade(item.id))
              }
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
              onShare={() => {
                if (isPasta(item)) {
                  setDialog({
                    kind: "compartilhar",
                    pastaId: item.id,
                    nome: item.nome,
                  })
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

      {dialog?.kind === "compartilhar" && (
        <FolderShareDialog
          open
          pastaId={dialog.pastaId}
          nome={dialog.nome}
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
  onShare,
}: {
  buscando: boolean
  pastaAtualNome: string | null
  onNewFolder: () => void
  newActivityHref: string
  extra: React.ReactNode
  onShare?: () => void
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
          {onShare && (
            <ContextMenuItem onClick={onShare}>
              <Share2Icon />
              Compartilhar esta pasta
            </ContextMenuItem>
          )}
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}
