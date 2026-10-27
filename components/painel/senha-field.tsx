"use client"

import { useState } from "react"
import { DicesIcon, EyeIcon, EyeOffIcon } from "lucide-react"

import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { SENHA_MAX, SENHA_MIN } from "@/lib/dominio/limites"
import { cn } from "@/lib/utils"

/**
 * Palavras sem acento e com 4 letras ou mais: fáceis de ditar em sala e já
 * dentro do mínimo exigido pela senha.
 */
const PALAVRAS = [
  "azul",
  "banana",
  "barco",
  "bolo",
  "cachorro",
  "cadeira",
  "caju",
  "caneta",
  "carro",
  "casa",
  "castelo",
  "chuva",
  "cinema",
  "copo",
  "coelho",
  "coruja",
  "dado",
  "dedo",
  "doce",
  "escola",
  "estrela",
  "faca",
  "festa",
  "flor",
  "fogo",
  "gato",
  "gelo",
  "janela",
  "jardim",
  "lapis",
  "leite",
  "livro",
  "maca",
  "mesa",
  "molho",
  "mundo",
  "nuvem",
  "olho",
  "onda",
  "ouro",
  "parque",
  "peixe",
  "praia",
  "prato",
  "queda",
  "rato",
  "roda",
  "rosa",
  "sapo",
  "sorvete",
  "tarde",
  "telha",
  "tempo",
  "tigre",
  "vento",
  "verde",
  "vidro",
]

function sortearSenha() {
  const [sorteio] = crypto.getRandomValues(new Uint32Array(1))
  return PALAVRAS[sorteio % PALAVRAS.length]
}

type SenhaFieldProps = {
  id?: string
  name?: string
  label?: string
  initialValue?: string
}

/**
 * Senha de liberação com sorteio de palavras e alternância de visibilidade.
 *
 * Não usa `type="password"` de propósito: o Chrome interpretaria o campo como
 * credencial do site e ofereceria salvar/atualizar a senha do professor. O
 * texto é mascarado via `-webkit-text-security` quando oculto.
 */
export function SenhaField({
  id = "senha",
  name = "senha",
  label = "Senha de liberação",
  initialValue = "",
}: SenhaFieldProps) {
  const [senha, setSenha] = useState(initialValue)
  const [visivel, setVisivel] = useState(initialValue.length > 0)

  function sortear() {
    setSenha(sortearSenha())
    setVisivel(true)
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          name={name}
          type="text"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          minLength={SENHA_MIN}
          maxLength={SENHA_MAX}
          placeholder="Mínimo de 4 caracteres"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          className={cn(!visivel && "[-webkit-text-security:disc]")}
          required
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setVisivel((atual) => !atual)}
          >
            {visivel ? <EyeOffIcon /> : <EyeIcon />}
          </InputGroupButton>
          <InputGroupButton size="xs" onClick={sortear}>
            <DicesIcon data-icon="inline-start" />
            Sortear senha
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}
