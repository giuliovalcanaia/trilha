"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavProjects } from "@/components/layout/nav-projects"
import { NavUser } from "@/components/layout/nav-user"
import { TeamSwitcher } from "@/components/layout/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { GalleryVerticalEndIcon, Trash2Icon } from "lucide-react"

import { type AtividadePastaRow, type PastaRow } from "@/lib/dominio/pastas"

type Professor = {
  id: number
  nome: string
}

export function AppSidebar({
  professor,
  email,
  pastas,
  atividadePastas,
  trashCount,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  professor: Professor
  email?: string
  pastas: PastaRow[]
  atividadePastas: AtividadePastaRow[]
  trashCount: number
}) {
  const pathname = usePathname()

  const teams = [
    {
      name: "Trilha",
      logo: <GalleryVerticalEndIcon />,
      plan: "Professor",
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavProjects
          key={pathname}
          pastas={pastas}
          atividadePastas={atividadePastas}
        />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={pathname.startsWith("/painel/lixeira")}
              tooltip="Lixeira"
              render={<Link href="/painel/lixeira" />}
            >
              <Trash2Icon />
              <span>Lixeira</span>
            </SidebarMenuButton>
            {trashCount > 0 && (
              <SidebarMenuBadge>{trashCount}</SidebarMenuBadge>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser
          user={{
            name: professor.nome,
            email: email ?? "sem e-mail",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
