"use client"

import Link from "next/link"
import { useLinkStatus } from "next/link"
import { ArrowLeftIcon, LoaderCircleIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

/** Seta que vira spinner enquanto a rota de destino carrega. */
function StatusVoltar() {
  const { pending } = useLinkStatus()

  return pending ? (
    <LoaderCircleIcon
      data-icon="inline-start"
      className="animate-spin"
      aria-hidden
    />
  ) : (
    <ArrowLeftIcon data-icon="inline-start" />
  )
}

/**
 * "Voltar" do cabeçalho da atividade.
 *
 * O destino (`/painel` ou `/painel/pastas/[id]`) é uma rota dinâmica: o Next
 * mostra o esqueleto do painel assim que a navegação começa, e este spinner
 * cobre o intervalo antes disso. Só funciona porque o `useLinkStatus` está
 * dentro do próprio `<Link>`.
 */
export function VoltarLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      <StatusVoltar />
      Voltar
    </Link>
  )
}
