"use client"

import * as React from "react"

import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"

export type MenuSubItem = {
  key: string
  label: string
  icon?: React.ReactNode
  onSelect: () => void
}

export type MenuAction =
  | { kind: "separator"; key: string }
  | {
      kind: "item"
      key: string
      label: string
      icon: React.ReactNode
      destructive?: boolean
      shortcut?: string
      onSelect: () => void
    }
  | {
      kind: "sub"
      key: string
      label: string
      icon: React.ReactNode
      items: MenuSubItem[]
    }

export function ContextMenuActions({ actions }: { actions: MenuAction[] }) {
  return actions.map((action) => {
    if (action.kind === "separator") {
      return <ContextMenuSeparator key={action.key} />
    }

    if (action.kind === "sub") {
      return (
        <ContextMenuSub key={action.key}>
          <ContextMenuSubTrigger>
            {action.icon}
            {action.label}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {action.items.map((item) => (
              <ContextMenuItem key={item.key} onClick={item.onSelect}>
                {item.icon}
                {item.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
      )
    }

    return (
      <ContextMenuItem
        key={action.key}
        variant={action.destructive ? "destructive" : "default"}
        onClick={action.onSelect}
      >
        {action.icon}
        {action.label}
        {action.shortcut && (
          <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut>
        )}
      </ContextMenuItem>
    )
  })
}

export function DropdownMenuActions({ actions }: { actions: MenuAction[] }) {
  return actions.map((action) => {
    if (action.kind === "separator") {
      return <DropdownMenuSeparator key={action.key} />
    }

    if (action.kind === "sub") {
      return (
        <DropdownMenuSub key={action.key}>
          <DropdownMenuSubTrigger>
            {action.icon}
            {action.label}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {action.items.map((item) => (
              <DropdownMenuItem key={item.key} onClick={item.onSelect}>
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }

    return (
      <DropdownMenuItem
        key={action.key}
        variant={action.destructive ? "destructive" : "default"}
        onClick={action.onSelect}
      >
        {action.icon}
        {action.label}
        {action.shortcut && (
          <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>
        )}
      </DropdownMenuItem>
    )
  })
}
