"use client"

import * as React from "react"
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import {
  totalDeItens,
  type ItensTransferencia,
  type ModoTransferencia,
} from "@/lib/dominio/area-transferencia"

export type AreaTransferencia = {
  modo: ModoTransferencia
  itens: ItensTransferencia
  total: number
}

type AreaTransferenciaContextValue = {
  area: AreaTransferencia | null
  definirArea: (modo: ModoTransferencia, itens: ItensTransferencia) => void
  limparArea: () => void
}

const AreaTransferenciaContext =
  createContext<AreaTransferenciaContextValue | null>(null)

/**
 * Área de transferência interna do explorador.
 *
 * Fica no layout do painel para sobreviver à troca de pasta (que é feita no
 * cliente) e à ida até uma atividade e volta. É só memória: recarregar a
 * página limpa a seleção, como em um gerenciador de arquivos.
 */
export function AreaTransferenciaProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [area, setArea] = useState<AreaTransferencia | null>(null)

  const definirArea = useCallback(
    (modo: ModoTransferencia, itens: ItensTransferencia) => {
      const total = totalDeItens(itens)
      setArea(total === 0 ? null : { modo, itens, total })
    },
    []
  )

  const limparArea = useCallback(() => setArea(null), [])

  const value = useMemo(
    () => ({ area, definirArea, limparArea }),
    [area, definirArea, limparArea]
  )

  return (
    <AreaTransferenciaContext.Provider value={value}>
      {children}
    </AreaTransferenciaContext.Provider>
  )
}

export function useAreaTransferencia() {
  const contexto = useContext(AreaTransferenciaContext)

  if (!contexto) {
    throw new Error(
      "useAreaTransferencia precisa ser usado dentro de AreaTransferenciaProvider"
    )
  }

  return contexto
}
