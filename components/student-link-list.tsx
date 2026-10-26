"use client"

import { markLinkAsStarted } from "@/app/atividade/actions"
import { ClickableCard, type ActivityStatus } from "@/components/clickable-card"
import { InlinePasswordForm } from "@/components/inline-password-form"

export type StudentLink = {
  id: number
  titulo: string
  href: string
  status: ActivityStatus
}

export function StudentLinkList({
  aplicacaoId,
  links,
}: {
  aplicacaoId: number
  links: StudentLink[]
}) {
  return (
    <div className="space-y-4">
      {links.map((link) => (
        <ClickableCard
          key={link.id}
          href={link.href}
          title={link.titulo}
          status={link.status}
          footer={
            link.status === "fazendo" ? (
              <InlinePasswordForm
                aplicacaoId={aplicacaoId}
                linkId={link.id}
                titulo={link.titulo}
              />
            ) : undefined
          }
          onBeforeNavigate={
            link.status === "aberta" || link.status === "fazendo"
              ? async () => {
                  await markLinkAsStarted(aplicacaoId, link.id)
                }
              : undefined
          }
        />
      ))}
    </div>
  )
}
