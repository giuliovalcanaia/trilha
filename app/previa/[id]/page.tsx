import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, EyeIcon, ShuffleIcon } from "lucide-react"

import {
  ClickableCard,
  type ActivityStatus,
} from "@/components/aluno/clickable-card"
import { StudentActivityHeader } from "@/components/aluno/student-activity-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader } from "@/components/ui/card"
import { requireProfessor } from "@/lib/auth/professor"
import { formatarData } from "@/lib/format"

const statusLabels: Record<string, string> = {
  rascunho: "Encerrada",
  publicada: "Ativa",
  arquivada: "Arquivada",
}

export const metadata: Metadata = {
  title: "Pré-visualização da atividade",
  robots: { index: false, follow: false },
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const atividadeId = Number(id)

  if (!Number.isInteger(atividadeId) || atividadeId <= 0) notFound()

  const { supabase } = await requireProfessor()

  const { data: atividade } = await supabase
    .from("atividades")
    .select("id, titulo, subtitulo, status, embaralhar_links")
    .eq("id", atividadeId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!atividade) notFound()

  const [{ data: links }, { data: aplicacao }] = await Promise.all([
    supabase
      .from("links")
      .select("id, titulo, href, ordem")
      .eq("atividade_id", atividade.id)
      .order("ordem"),
    supabase
      .from("aplicacoes")
      .select("data")
      .eq("atividade_id", atividade.id)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ])

  // O aluno que acabou de entrar vê o primeiro link aberto e o restante
  // bloqueado. Nada é gravado: a prévia é somente leitura.
  const items = (links ?? []).map((link, index) => ({
    id: link.id,
    titulo: link.titulo,
    href: link.href,
    status: (index === 0 ? "aberta" : "bloqueada") as ActivityStatus,
  }))

  const publicada = atividade.status === "publicada"

  return (
    <div className="min-h-svh">
      <div className="border-b bg-muted/40">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <EyeIcon className="size-4 text-muted-foreground" />
            <span className="font-medium">Pré-visualização</span>
            <Badge variant={publicada ? "default" : "secondary"}>
              {statusLabels[atividade.status] ?? atividade.status}
            </Badge>
            {atividade.embaralhar_links && (
              <Badge variant="outline">
                <ShuffleIcon />
                Ordem aleatória por aluno
              </Badge>
            )}
            <span className="text-muted-foreground">
              Nenhum progresso será registrado.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={`/painel/atividades/${atividade.id}`} />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Voltar para a atividade
          </Button>
        </div>
      </div>

      <div className="mx-auto flex max-w-4xl flex-col space-y-4">
        {!publicada && (
          <Card className="mx-4 mt-4 mb-0">
            <CardHeader>
              <p className="font-medium">Esta atividade está encerrada.</p>
              <CardDescription>
                Os alunos não conseguem entrar enquanto ela estiver encerrada.
                Reabra a atividade na aba Alunos.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <StudentActivityHeader
          titulo={atividade.titulo}
          subtitulo={atividade.subtitulo}
          meta={
            <>
              Visão do aluno
              {aplicacao?.data && (
                <>
                  {" · "}Data da aula: {formatarData(aplicacao.data)}
                </>
              )}
            </>
          }
          concluidas={0}
          total={items.length}
        />

        <div className="m-4 mt-8">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta atividade ainda não tem links.
            </p>
          ) : (
            <div className="space-y-4">
              {items.map((link) => (
                <ClickableCard
                  key={link.id}
                  href={link.href}
                  title={link.titulo}
                  status={link.status}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
