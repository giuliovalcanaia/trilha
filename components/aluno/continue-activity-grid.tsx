"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon, SearchIcon } from "lucide-react"
import type { RealtimeChannel } from "@supabase/supabase-js"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { normalizarBusca } from "@/lib/dominio/busca"
import { mensagemDoErro } from "@/lib/dominio/erros"
import type { AlunoParaContinuar } from "@/lib/data/aluno"
import { formatarDataHora } from "@/lib/format"
import { avisarContinuar, canalContinuar } from "@/lib/supabase/broadcast"
import { createClient } from "@/lib/supabase/client"
import { assinarCanalRealtime } from "@/lib/supabase/realtime"
import { cn } from "@/lib/utils"

const INTERVALO_ATUALIZACAO = 10_000

/**
 * Grade de nomes da aula anterior.
 *
 * Um nome conectado fica esmaecido e desabilitado. O professor libera na hora
 * com "Derrubar", no painel; sem batimento da tela do aluno por 3 minutos a
 * conexão expira sozinha (aba fechada, celular desligado) e o nome volta a
 * ficar disponível. A lista se atualiza por um canal público de broadcast
 * (claim/derrubar/entrada/expulsão avisam) e, como reserva, relê os nomes a
 * cada 10s enquanto a aba está visível.
 */
export function ContinueActivityGrid({
  codigo,
  alunos,
}: {
  codigo: string
  alunos: AlunoParaContinuar[]
}) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [lista, setLista] = useState(alunos)
  const [busca, setBusca] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [enviandoId, setEnviandoId] = useState<number | null>(null)
  // Reaproveita o canal que já está ouvindo a lista para avisar os outros.
  // Criar um segundo canal com o mesmo tópico no mesmo cliente não entrega o
  // broadcast de forma confiável.
  const canalRef = useRef<RealtimeChannel | null>(null)

  const atualizar = useCallback(async () => {
    const { data } = await supabase.rpc("list_activity_students", {
      p_codigo: codigo,
    })

    if (data) setLista(data)
  }, [codigo, supabase])

  useEffect(() => {
    const pararCanal = assinarCanalRealtime(
      supabase,
      canalContinuar(codigo),
      (canal) => {
        canalRef.current = canal

        return canal.on("broadcast", { event: "atualizar" }, () => {
          void atualizar()
        })
      }
    )

    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") void atualizar()
    }, INTERVALO_ATUALIZACAO)

    return () => {
      pararCanal()
      canalRef.current = null
      window.clearInterval(intervalo)
    }
  }, [atualizar, codigo, supabase])

  const termo = normalizarBusca(busca.trim())

  const visiveis = useMemo(() => {
    if (!termo) return lista

    return lista.filter((aluno) =>
      normalizarBusca(aluno.aluno_nome).includes(termo)
    )
  }, [lista, termo])

  // Só mostra o horário de entrada quando o nome se repete: é o que ajuda a
  // diferenciar duas "Maria" na mesma turma.
  const nomesRepetidos = useMemo(() => {
    const contagem = new Map<string, number>()

    for (const aluno of lista) {
      const chave = normalizarBusca(aluno.aluno_nome)
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
    }

    return new Set(
      [...contagem].filter(([, total]) => total > 1).map(([nome]) => nome)
    )
  }, [lista])

  async function continuar(aluno: AlunoParaContinuar) {
    if (enviandoId !== null || aluno.em_uso) return

    setErro(null)
    setEnviandoId(aluno.participacao_id)

    const { data: claims } = await supabase.auth.getClaims()

    if (!claims?.claims) {
      const { error } = await supabase.auth.signInAnonymously()

      if (error) {
        setEnviandoId(null)
        setErro("Não foi possível iniciar a sua sessão. Tente novamente.")
        return
      }
    }

    const { error } = await supabase.rpc("continue_activity", {
      p_codigo: codigo,
      p_participacao_id: aluno.participacao_id,
    })

    if (error) {
      setEnviandoId(null)
      setErro(
        mensagemDoErro(error.code) ??
          "Não foi possível continuar a atividade. Tente novamente."
      )

      if (error.code === "TRL33") void atualizar()
      return
    }

    // Avisa antes de navegar: sem isso as outras listas só mudariam no
    // próximo polling. O canal da própria grade já está assinado; se ele
    // ainda não estiver pronto, cai no canal temporário.
    const canal = canalRef.current

    if (canal) {
      await canal
        .send({ type: "broadcast", event: "atualizar", payload: {} })
        .catch(() => undefined)
    } else {
      await avisarContinuar(supabase, codigo)
    }

    router.push(`/atividade?codigo=${encodeURIComponent(codigo)}`)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      {lista.length > 8 && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar o seu nome..."
            aria-label="Buscar o seu nome"
            autoComplete="off"
            className="pl-8"
          />
        </div>
      )}

      {erro && (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      )}

      {visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum nome encontrado. Volte e digite o seu nome.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visiveis.map((aluno) => {
            const repetido = nomesRepetidos.has(
              normalizarBusca(aluno.aluno_nome)
            )
            const enviando = enviandoId === aluno.participacao_id

            return (
              <button
                key={aluno.participacao_id}
                type="button"
                onClick={() => void continuar(aluno)}
                disabled={aluno.em_uso || enviandoId !== null}
                aria-busy={enviando || undefined}
                aria-label={`Continuar como ${aluno.aluno_nome}`}
                className={cn(
                  "flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border bg-card p-4 text-center text-sm font-medium text-card-foreground transition-colors",
                  "hover:border-foreground/25 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  "disabled:pointer-events-none disabled:opacity-60"
                )}
              >
                <span
                  aria-hidden
                  className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary"
                >
                  {enviando ? (
                    <LoaderCircleIcon className="size-4 animate-spin" />
                  ) : (
                    aluno.aluno_nome.trim().charAt(0).toUpperCase()
                  )}
                </span>
                <span className="line-clamp-2">{aluno.aluno_nome}</span>
                {aluno.em_uso && <Badge variant="secondary">Em uso</Badge>}
                {repetido && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {formatarDataHora(aluno.entrou_em)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
