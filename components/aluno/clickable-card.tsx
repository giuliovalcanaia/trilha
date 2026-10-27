"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CheckCircle2,
  Lock,
  LucideMousePointerClick,
  LucideRotateCcw,
} from "lucide-react"

export type ActivityStatus = "aberta" | "fazendo" | "concluida" | "bloqueada"

interface ClickableCardProps {
  href: string
  title: string
  status?: ActivityStatus
  children?: React.ReactNode
  footer?: React.ReactNode
  onBeforeNavigate?: () => Promise<void> | void
}

const statusStyles: Record<
  ActivityStatus,
  {
    card: string
    badge: string
    label: string
    disabled: boolean
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  aberta: {
    card: "border-blue-500/40 bg-blue-500/5 hover:border-blue-500 hover:scale-[1.03] active:scale-[1.02]",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    label: "Aberto",
    disabled: false,
    icon: LucideMousePointerClick,
  },
  fazendo: {
    card: "border-amber-500/40 bg-amber-500/5 hover:border-amber-500 hover:scale-[1.03] active:scale-[1.02]",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    label: "Em execução",
    disabled: false,
    icon: LucideRotateCcw,
  },
  concluida: {
    card: "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500 opacity-80 cursor-not-allowed",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    label: "Fechado",
    disabled: true,
    icon: CheckCircle2,
  },
  bloqueada: {
    card: "border-zinc-300 bg-zinc-100/50 dark:border-zinc-800 dark:bg-zinc-900/30 opacity-60 transition-none cursor-not-allowed",
    badge: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    label: "Bloqueado",
    disabled: true,
    icon: Lock,
  },
}

export function ClickableCard({
  href,
  title,
  status = "aberta",
  children,
  footer,
  onBeforeNavigate,
}: ClickableCardProps) {
  const currentStatus = statusStyles[status]
  const StatusIcon = currentStatus.icon
  const [navigating, setNavigating] = useState(false)
  const router = useRouter()

  // O link abre em outra aba (o navegador cuida disso pelo `target="_blank"`
  // do <a>, então não há bloqueio de pop-up). O progresso é marcado em seguida
  // e, ao voltar para esta aba, o cartão já aparece como "Em execução".
  async function handleClick() {
    if (!onBeforeNavigate) return

    setNavigating(true)

    try {
      await onBeforeNavigate()
      router.refresh()
    } finally {
      setNavigating(false)
    }
  }

  return (
    <Card
      className={`relative transition-all duration-300 ease-out active:shadow-sm active:duration-75 ${currentStatus.card}`}
    >
      <a
        href={currentStatus.disabled ? undefined : href}
        target={currentStatus.disabled ? undefined : "_blank"}
        rel="noopener noreferrer"
        tabIndex={currentStatus.disabled ? -1 : 0}
        aria-disabled={currentStatus.disabled}
        aria-busy={navigating}
        aria-label={`${title} - Status: ${currentStatus.label}`}
        onClick={currentStatus.disabled ? undefined : handleClick}
        className={`absolute inset-0 z-10 ${
          currentStatus.disabled ? "pointer-events-none" : "cursor-pointer"
        }`}
      />

      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <span
          className={`z-0 inline-flex items-center justify-center rounded-full p-1.5 ${currentStatus.badge}`}
          title={currentStatus.label}
        >
          <StatusIcon className="h-4 w-4" />
          <span className="sr-only">{currentStatus.label}</span>
        </span>
      </CardHeader>

      {children && <CardContent>{children}</CardContent>}

      {footer && <CardContent className="relative z-20">{footer}</CardContent>}
    </Card>
  )
}
