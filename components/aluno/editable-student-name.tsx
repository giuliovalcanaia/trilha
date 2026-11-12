"use client"

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react"
import { LoaderCircleIcon } from "lucide-react"

import { renomearAluno } from "@/app/atividade/actions"
import { mensagemDoErro } from "@/lib/dominio/erros"
import { NOME_ALUNO_MAX } from "@/lib/dominio/limites"

/**
 * Tempo parado, em ms, até o salvamento automático.
 *
 * O salvamento automático **não sai da edição**: manda o nome novo para o
 * Supabase e mantém o cursor onde está. Quem digita devagar (ou se perde
 * procurando uma tecla) continua no campo, sem precisar clicar de novo.
 */
const SALVAR_APOS_MS = 5000

/**
 * Nome do aluno no título da atividade, editável no lugar.
 *
 * Em edição o nome vira um `contenteditable` (e não um `<input>`, que tem
 * métricas próprias e empurrava a linha do título para baixo). Sai da edição
 * ao apertar Enter ou ao clicar fora; Esc descarta.
 */
export function EditableStudentName({
  aplicacaoId,
  nome,
}: {
  aplicacaoId: number
  nome: string
}) {
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const editorRef = useRef<HTMLSpanElement>(null)
  const valorRef = useRef(nome)
  const timerRef = useRef<number | null>(null)
  // Valor com que a edição abriu: os filhos do `contenteditable` nunca mudam
  // durante a edição (o `nome` do servidor pode mudar depois do salvamento
  // automático, e um re-render do texto moveria o cursor).
  const [nomeInicial, setNomeInicial] = useState(nome)
  // Clicou fora enquanto um salvamento automático estava em curso.
  const sairAoTerminarRef = useRef(false)

  // Não deixa o timer do salvamento automático disparar fora da tela.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  // Ao abrir, foca e deixa o cursor no fim do nome (sem selecionar o texto).
  useEffect(() => {
    if (!editando) return

    const editor = editorRef.current
    if (!editor) return

    editor.focus()

    const selecao = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selecao?.removeAllRanges()
    selecao?.addRange(range)
  }, [editando])

  function limparTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function abrir() {
    valorRef.current = nome
    setNomeInicial(nome)
    setErro(null)
    sairAoTerminarRef.current = false
    setEditando(true)
  }

  function cancelar() {
    limparTimer()
    sairAoTerminarRef.current = false
    setEditando(false)
    setErro(null)
  }

  /**
   * `manterEditando` é o salvamento automático: envia o nome sem tirar o foco
   * nem fechar o campo. Enter e o clique fora salvam e fecham.
   */
  function salvar(manterEditando = false) {
    limparTimer()

    // `contenteditable` aceita quebras de linha e espaços repetidos ao colar.
    const limpo = valorRef.current.replace(/\s+/g, " ").trim()

    if (!limpo) {
      setErro(mensagemDoErro("TRL04"))
      return
    }

    if (limpo.length > NOME_ALUNO_MAX) {
      setErro(mensagemDoErro("TRL34"))
      return
    }

    if (limpo === nome) {
      if (!manterEditando) setEditando(false)
      return
    }

    startTransition(async () => {
      const resultado = await renomearAluno(aplicacaoId, limpo)

      if (resultado.error) {
        sairAoTerminarRef.current = false
        setErro(resultado.error)
        return
      }

      setErro(null)

      if (!manterEditando || sairAoTerminarRef.current) {
        sairAoTerminarRef.current = false
        setEditando(false)
      }
    })
  }

  function agendarSalvamento() {
    limparTimer()

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      salvar(true)
    }, SALVAR_APOS_MS)
  }

  function aoDigitar() {
    valorRef.current = editorRef.current?.textContent ?? ""
    if (erro) setErro(null)
    agendarSalvamento()
  }

  function aoSairDoCampo() {
    if (pending) {
      sairAoTerminarRef.current = true
      return
    }

    if (!valorRef.current.trim()) {
      cancelar()
      return
    }

    salvar()
  }

  function aoTeclar(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      salvar()
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      cancelar()
    }
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={abrir}
        title="Editar nome"
        aria-describedby="dica-editar-nome"
        className="inline-flex max-w-full cursor-pointer items-baseline rounded-md text-left underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 break-words">{nome}</span>
      </button>
    )
  }

  return (
    <>
      <span
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Nome do aluno"
        aria-invalid={erro ? true : undefined}
        aria-busy={pending || undefined}
        spellCheck={false}
        autoCapitalize="none"
        onInput={aoDigitar}
        onKeyDown={aoTeclar}
        onBlur={aoSairDoCampo}
        className="cursor-text break-words outline-none"
      >
        {nomeInicial}
      </span>
      {pending && (
        <LoaderCircleIcon
          aria-hidden
          className="ml-1 inline size-4 animate-spin align-baseline text-muted-foreground"
        />
      )}
      {erro && (
        <span
          role="alert"
          className="mt-1 block text-sm font-normal text-destructive"
        >
          {erro}
        </span>
      )}
    </>
  )
}
