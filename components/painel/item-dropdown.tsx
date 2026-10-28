"use client"

import { MoreHorizontalIcon } from "lucide-react"

import type { MenuAction } from "@/components/painel/item-menu"
import { DropdownMenuActions } from "@/components/painel/item-menu"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** Menu `⋯` das linhas e cards do explorador e da lixeira. */
export function ItemDropdown({ actions }: { actions: MenuAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Abrir menu de ações"
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuActions actions={actions} />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
