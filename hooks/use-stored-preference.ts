"use client"

import { useCallback, useSyncExternalStore } from "react"

const STORAGE_EVENT = "trilha:preferencia"

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(STORAGE_EVENT, onChange)

  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(STORAGE_EVENT, onChange)
  }
}

/**
 * Preferência simples salva no `localStorage` (visão do explorador, ordenação).
 *
 * `useSyncExternalStore` evita o efeito de hidratação: o servidor e o primeiro
 * render no cliente usam o padrão, e o valor salvo entra logo depois.
 */
export function useStoredPreference<T extends string>(
  key: string,
  valores: readonly T[],
  padrao: T
): [T, (valor: T) => void] {
  const valor = useSyncExternalStore(
    subscribe,
    () => {
      const salvo = window.localStorage.getItem(key)
      return salvo && valores.includes(salvo as T) ? (salvo as T) : padrao
    },
    () => padrao
  )

  const definir = useCallback(
    (novo: T) => {
      window.localStorage.setItem(key, novo)
      window.dispatchEvent(new Event(STORAGE_EVENT))
    },
    [key]
  )

  return [valor, definir]
}
