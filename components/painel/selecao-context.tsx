"use client"

import * as React from "react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { pastaDescendantIds, type PastaRow } from "@/lib/dominio/pastas"
import { intervalo, itemKey } from "@/lib/dominio/selecao"

const SELETOR_INTERATIVO = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='button']",
  "[role='menuitem']",
  "[role='menu']",
  "[role='dialog']",
  "[role='alertdialog']",
  "[data-selecionavel]",
].join(", ")

type SelecionarOptions = {
  ctrl?: boolean
  shift?: boolean
  ordem: string[]
}

type SelecaoContextValue = {
  selecionados: Set<string>
  selecionar: (key: string, options: SelecionarOptions) => void
  definir: (keys: string[]) => void
  limpar: () => void
}

const SelecaoContext = createContext<SelecaoContextValue | null>(null)

export function SelecaoProvider({
  pastas,
  children,
}: {
  pastas: PastaRow[]
  children: React.ReactNode
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const ancora = useRef<string | null>(null)

  // Selecionar uma pasta seleciona também as subpastas dela.
  const descendentesPorPasta = useMemo(() => {
    const mapa = new Map<string, string[]>()

    for (const pasta of pastas) {
      mapa.set(
        itemKey({ tipo: "pasta", id: pasta.id }),
        [...pastaDescendantIds(pastas, pasta.id)].map((id) =>
          itemKey({ tipo: "pasta", id })
        )
      )
    }

    return mapa
  }, [pastas])

  const expandir = useCallback(
    (keys: Iterable<string>) => {
      const resultado = new Set<string>()

      for (const key of keys) {
        const grupo = descendentesPorPasta.get(key)

        if (!grupo) {
          resultado.add(key)
          continue
        }

        for (const descendente of grupo) {
          resultado.add(descendente)
        }
      }

      return resultado
    },
    [descendentesPorPasta]
  )

  const limpar = useCallback(() => {
    ancora.current = null
    setSelecionados((anterior) => (anterior.size === 0 ? anterior : new Set()))
  }, [])

  // Clique fora dos itens (e fora de controles) limpa a seleção.
  useEffect(() => {
    function aoApontar(event: PointerEvent) {
      const alvo = event.target as HTMLElement | null
      if (!alvo || alvo.closest(SELETOR_INTERATIVO)) return
      limpar()
    }

    document.addEventListener("pointerdown", aoApontar)
    return () => document.removeEventListener("pointerdown", aoApontar)
  }, [limpar])

  const definir = useCallback(
    (keys: string[]) => {
      setSelecionados(expandir(keys))
    },
    [expandir]
  )

  const selecionar = useCallback(
    (key: string, { ctrl, shift, ordem }: SelecionarOptions) => {
      if (shift) {
        const base = ancora.current ?? key
        ancora.current = base
        const faixa = intervalo(ordem, base, key)

        setSelecionados((anterior) =>
          expandir(ctrl ? [...anterior, ...faixa] : faixa)
        )
        return
      }

      const grupo = expandir([key])

      if (ctrl) {
        ancora.current = key
        setSelecionados((anterior) => {
          const proximo = new Set(anterior)

          if (proximo.has(key)) {
            for (const item of grupo) proximo.delete(item)
          } else {
            for (const item of grupo) proximo.add(item)
          }

          return proximo
        })
        return
      }

      ancora.current = key
      setSelecionados((anterior) =>
        anterior.size === grupo.size &&
        [...grupo].every((item) => anterior.has(item))
          ? anterior
          : grupo
      )
    },
    [expandir]
  )

  const value = useMemo(
    () => ({ selecionados, selecionar, definir, limpar }),
    [selecionados, selecionar, definir, limpar]
  )

  return (
    <SelecaoContext.Provider value={value}>{children}</SelecaoContext.Provider>
  )
}

export function useSelecao() {
  const contexto = useContext(SelecaoContext)

  if (!contexto) {
    throw new Error("useSelecao precisa ser usado dentro de SelecaoProvider")
  }

  return contexto
}
