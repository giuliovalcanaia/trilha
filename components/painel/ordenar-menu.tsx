"use client"

import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type OpcaoOrdenacao<T extends string> = {
  value: T
  label: string
  /** Campo exibido no botão (“Nome”, “Data”, “Movido”). */
  campo: string
  crescente: boolean
}

/**
 * Menu de ordenação do explorador e da lixeira.
 *
 * O botão reserva a largura de todos os campos (`opcoes`) para não mudar de
 * tamanho ao trocar entre nome e data.
 */
export function OrdenarMenu<T extends string>({
  valor,
  opcoes,
  onValueChange,
}: {
  valor: T
  opcoes: readonly OpcaoOrdenacao<T>[]
  onValueChange: (valor: T) => void
}) {
  const atual = opcoes.find((opcao) => opcao.value === valor) ?? opcoes[0]
  const campos = [...new Set(opcoes.map((opcao) => opcao.campo))]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={`Ordenar por ${atual.label}`}
          />
        }
      >
        {atual.crescente ? (
          <ArrowUpIcon data-icon="inline-start" />
        ) : (
          <ArrowDownIcon data-icon="inline-start" />
        )}
        <span className="hidden sm:inline">Ordenar: </span>
        <span className="grid text-left">
          {campos.map((campo) => (
            <span
              key={campo}
              className="invisible col-start-1 row-start-1"
              aria-hidden
            >
              {campo}
            </span>
          ))}
          <span className="col-start-1 row-start-1">{atual.campo}</span>
        </span>
        <ChevronDownIcon
          data-icon="inline-end"
          className="text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={valor}
            onValueChange={(value) => onValueChange(value as T)}
          >
            {opcoes.map((opcao) => (
              <DropdownMenuRadioItem key={opcao.value} value={opcao.value}>
                {opcao.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
