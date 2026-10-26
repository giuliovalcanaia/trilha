"use client"

import { useState } from "react"

import { ShuffleLinksCardShell } from "@/components/painel/shuffle-links-card"

/**
 * Variante da opção de embaralhar usada na criação: o valor fica num input
 * oculto e é gravado junto com a atividade no envio do formulário.
 */
export function ShuffleLinksField() {
  const [ativo, setAtivo] = useState(false)

  return (
    <>
      <input
        type="hidden"
        name="embaralhar_links"
        value={ativo ? "true" : "false"}
      />
      <ShuffleLinksCardShell
        id="embaralhar-links-nova-atividade"
        ativo={ativo}
        onChange={setAtivo}
      />
    </>
  )
}
