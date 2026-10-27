"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import type { ActionResult } from "@/app/painel/actions"
import { toast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

type AtividadeDadosInlineProps = {
  titulo?: string
  subtitulo?: string | null
} & (
  | {
      modo: "criar"
    }
  | {
      modo: "editar"
      atividadeId: number
      action: (state: ActionResult, formData: FormData) => Promise<ActionResult>
    }
)

/** Texto de uma linha só, sem espaços ou quebras sobrando. */
function textoLimpo(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

/**
 * Título e subtítulo editáveis no próprio cabeçalho da atividade.
 *
 * Na edição, cada campo salva sozinho ao perder o foco (ou no Enter) e o Esc
 * descarta. Na criação, o valor vai para inputs ocultos do formulário pai.
 */
export function AtividadeDadosInline(props: AtividadeDadosInlineProps) {
  const tituloSalvo = textoLimpo(props.titulo)
  const subtituloSalvo = textoLimpo(props.subtitulo)
  const criando = props.modo === "criar"
  const edicao = props.modo === "editar" ? props : null
  const router = useRouter()
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const subtituloRef = useRef<HTMLParagraphElement>(null)
  const [rascunho, setRascunho] = useState({
    titulo: tituloSalvo,
    subtitulo: subtituloSalvo,
  })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (criando) tituloRef.current?.focus()
  }, [criando])

  // Alinha o DOM ao valor gravado quando o servidor revalida a página, sem
  // atrapalhar quem está digitando.
  useEffect(() => {
    const titulo = tituloRef.current
    if (titulo && document.activeElement !== titulo) {
      titulo.textContent = tituloSalvo
    }

    const subtitulo = subtituloRef.current
    if (subtitulo && document.activeElement !== subtitulo) {
      subtitulo.textContent = subtituloSalvo
    }
  }, [subtituloSalvo, tituloSalvo])

  function ler(el: HTMLElement | null) {
    return textoLimpo(el?.innerText)
  }

  function restaurar() {
    if (tituloRef.current) tituloRef.current.textContent = tituloSalvo
    if (subtituloRef.current) subtituloRef.current.textContent = subtituloSalvo
    if (criando) setRascunho({ titulo: tituloSalvo, subtitulo: subtituloSalvo })
  }

  function sincronizarRascunho() {
    if (!criando) return

    setRascunho({
      titulo: ler(tituloRef.current),
      subtitulo: ler(subtituloRef.current),
    })
  }

  function salvar(campo: "titulo" | "subtitulo") {
    if (!edicao) return

    const elemento =
      campo === "titulo" ? tituloRef.current : subtituloRef.current
    const texto = ler(elemento)
    const gravado = campo === "titulo" ? tituloSalvo : subtituloSalvo

    if (campo === "titulo" && !texto) {
      restaurar()
      toast.add({
        type: "error",
        title: "O título não pode ficar vazio.",
      })
      return
    }

    if (texto === gravado) return

    if (elemento) elemento.textContent = texto

    const formData = new FormData()
    formData.set("id", String(edicao.atividadeId))
    formData.set(campo, texto)

    startTransition(async () => {
      const result = await edicao.action({ error: null }, formData)

      if (result.error) {
        toast.add({ type: "error", title: result.error })
        restaurar()
        return
      }

      router.refresh()
    })
  }

  function aoTeclar(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      restaurar()
      event.currentTarget.blur()
      return
    }

    if (event.key !== "Enter") return
    event.preventDefault()

    if (!criando) {
      event.currentTarget.blur()
      return
    }

    if (event.currentTarget === tituloRef.current) {
      subtituloRef.current?.focus()
      return
    }

    event.currentTarget.blur()
  }

  function aoSair(event: React.FocusEvent<HTMLElement>) {
    sincronizarRascunho()
    salvar(event.currentTarget === tituloRef.current ? "titulo" : "subtitulo")
  }

  function aoColar(event: React.ClipboardEvent<HTMLElement>) {
    event.preventDefault()
    const texto = textoLimpo(event.clipboardData.getData("text/plain"))
    if (!texto) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    range.deleteContents()

    const node = document.createTextNode(texto)
    range.insertNode(node)
    range.setStartAfter(node)
    range.collapse(true)

    selection.removeAllRanges()
    selection.addRange(range)
    sincronizarRascunho()
  }

  const classesBase = cn(
    "-mx-1.5 rounded-md transition-colors outline-none",
    "hover:bg-accent/60 focus-visible:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring",
    "empty:before:text-muted-foreground/60 empty:before:content-[attr(data-placeholder)]"
  )

  return (
    <>
      {criando && (
        <>
          <input type="hidden" name="titulo" value={rascunho.titulo} />
          <input type="hidden" name="subtitulo" value={rascunho.subtitulo} />
        </>
      )}

      <h1
        id="titulo-atividade"
        ref={tituloRef}
        role="textbox"
        aria-label="Título da atividade"
        aria-multiline={false}
        aria-required
        aria-busy={isPending || undefined}
        tabIndex={0}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder="Título da atividade"
        title="Clique para editar"
        className={cn(
          classesBase,
          "min-w-12 px-1.5 py-0.5 text-2xl font-semibold tracking-tight sm:text-3xl"
        )}
        onInput={sincronizarRascunho}
        onKeyDown={aoTeclar}
        onBlur={aoSair}
        onPaste={aoColar}
      >
        {tituloSalvo || undefined}
      </h1>

      <p
        ref={subtituloRef}
        role="textbox"
        aria-label="Subtítulo da atividade"
        aria-multiline={false}
        aria-busy={isPending || undefined}
        tabIndex={0}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Adicionar subtítulo (opcional)"
        title="Clique para editar"
        className={cn(
          classesBase,
          "min-h-6 px-1.5 py-0.5 text-sm text-muted-foreground"
        )}
        onInput={sincronizarRascunho}
        onKeyDown={aoTeclar}
        onBlur={aoSair}
        onPaste={aoColar}
      >
        {subtituloSalvo || undefined}
      </p>
    </>
  )
}
