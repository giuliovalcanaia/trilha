"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type LinksPendingAction =
  { type: "navigate"; href: string } | { type: "tab"; value: string }

type LinksDraftContextValue = {
  value: string
  setValue: (value: string) => void
  dirty: boolean
  abaAtiva: string
  setAbaAtiva: (aba: string) => void
  pendingAction: LinksPendingAction | null
  pedirAcao: (action: LinksPendingAction) => void
  limparAcao: () => void
  descartarRascunho: () => void
  salvando: boolean
  setSalvando: (salvando: boolean) => void
  marcarSalvo: () => void
}

const LinksDraftContext = createContext<LinksDraftContextValue | null>(null)

type LinksDraftProviderProps = {
  initialValue: string
  initialTab?: string
  children: ReactNode
}

/** Rascunho da lista de links compartilhado pelo textarea e pelo card de links. */
export function LinksDraftProvider({
  initialValue,
  initialTab = "alunos",
  children,
}: LinksDraftProviderProps) {
  const [value, setValue] = useState(initialValue)
  const [savedValue, setSavedValue] = useState(initialValue)
  const [abaAtiva, setAbaAtiva] = useState(initialTab)
  const [pendingAction, setPendingAction] = useState<LinksPendingAction | null>(
    null
  )
  const [salvando, setSalvando] = useState(false)

  const context = useMemo<LinksDraftContextValue>(
    () => ({
      value,
      setValue,
      dirty: value !== savedValue,
      abaAtiva,
      setAbaAtiva,
      pendingAction,
      pedirAcao: setPendingAction,
      limparAcao: () => setPendingAction(null),
      descartarRascunho: () => setValue(savedValue),
      salvando,
      setSalvando,
      marcarSalvo: () => setSavedValue(value),
    }),
    [value, savedValue, abaAtiva, pendingAction, salvando]
  )

  return (
    <LinksDraftContext.Provider value={context}>
      {children}
    </LinksDraftContext.Provider>
  )
}

export function useLinksDraft() {
  const context = useContext(LinksDraftContext)

  if (!context) {
    throw new Error("useLinksDraft precisa estar dentro de LinksDraftProvider")
  }

  return context
}
