import { redirect } from "next/navigation"

import { StudentActivityHeader } from "@/components/student-activity-header"
import { StudentActivityRealtime } from "@/components/student-activity-realtime"
import { StudentLinkList } from "@/components/student-link-list"
import type { ActivityStatus } from "@/components/clickable-card"
import { Card, CardDescription, CardHeader } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

const statuses: ActivityStatus[] = [
  "aberta",
  "fazendo",
  "concluida",
  "bloqueada",
]

function toStatus(value: string): ActivityStatus {
  return statuses.find((status) => status === value) ?? "bloqueada"
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>
}) {
  const { codigo } = await searchParams
  const codigoEntrada = codigo?.trim().toUpperCase()

  if (!codigoEntrada) redirect("/")

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (!userId) {
    redirect(`/aluno?codigo=${encodeURIComponent(codigoEntrada)}`)
  }

  const { data: estudante } = await supabase
    .from("estudantes")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (!estudante) {
    redirect(`/aluno?codigo=${encodeURIComponent(codigoEntrada)}`)
  }

  const { data: aplicacao } = await supabase
    .from("aplicacoes")
    .select("id, atividade_id, status, data")
    .eq("codigo", codigoEntrada)
    .maybeSingle()

  if (!aplicacao) {
    redirect(`/aluno?codigo=${encodeURIComponent(codigoEntrada)}`)
  }

  const { data: participacao } = await supabase
    .from("participacoes")
    .select("id, nome, iniciado_em, concluido_em, expulso_em")
    .eq("aplicacao_id", aplicacao.id)
    .eq("estudante_id", estudante.id)
    .maybeSingle()

  if (!participacao) {
    redirect(`/aluno?codigo=${encodeURIComponent(codigoEntrada)}`)
  }

  if (participacao.expulso_em) {
    redirect(`/aluno?codigo=${encodeURIComponent(codigoEntrada)}&expulso=1`)
  }

  const tempoReal = (
    <StudentActivityRealtime
      participacaoId={participacao.id}
      aplicacaoId={aplicacao.id}
    />
  )

  const { data: atividade } = await supabase
    .from("atividades")
    .select("id, titulo, subtitulo, status")
    .eq("id", aplicacao.atividade_id)
    .maybeSingle()

  // A entrada encerrada continua visível para o aluno (a RLS não filtra por
  // status), então esta checagem vem antes da atividade: depois de encerrar,
  // a atividade deixa de ser visível pela policy de SELECT.
  if (aplicacao.status === "encerrada") {
    return (
      <div className="mx-auto flex max-w-4xl flex-col p-4">
        {tempoReal}
        <Card>
          <CardHeader>
            <p className="font-medium">Atividade encerrada.</p>
            <CardDescription>
              O professor encerrou esta atividade. Fale com ele para mais
              informações.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!atividade) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col p-4">
        <Card>
          <CardHeader>
            <p className="font-medium">
              Atividade não encontrada ou indisponível.
            </p>
            <CardDescription>
              Confira o código com o professor. A atividade pode ter sido
              fechada ou o código pode ser de outra atividade.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (atividade.status !== "publicada") {
    return (
      <div className="mx-auto flex max-w-4xl flex-col p-4">
        {tempoReal}
        <Card>
          <CardHeader>
            <p className="font-medium">Atividade indisponível.</p>
            <CardDescription>
              O professor fechou esta atividade. Fale com ele para mais
              informações.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const [{ data: links }, { data: progresso }] = await Promise.all([
    supabase
      .from("links")
      .select("id, titulo, href, ordem")
      .eq("atividade_id", atividade.id)
      .order("ordem", { ascending: true }),
    supabase
      .from("progresso_estudante")
      .select("link_id, status, ordem_embaralhada")
      .eq("participacao_id", participacao.id),
  ])

  const statusByLink = new Map(
    (progresso ?? []).map((row) => [row.link_id, toStatus(row.status)])
  )

  // Quando o professor ativou o embaralhamento, a sequência do aluno vive em
  // `progresso_estudante.ordem_embaralhada`; a ordem canônica dos links não é
  // usada nesse caso. A lista pode continuar na ordem canônica para quem
  // entrou antes da opção ser ligada.
  const ordemPorLink = new Map(
    (progresso ?? []).map((row) => [row.link_id, row.ordem_embaralhada])
  )
  const embaralhada = (progresso ?? []).some(
    (row) => row.ordem_embaralhada !== null
  )

  const linksNaOrdemDoAluno = embaralhada
    ? [...(links ?? [])].sort(
        (a, b) =>
          (ordemPorLink.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (ordemPorLink.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      )
    : (links ?? [])

  const items = linksNaOrdemDoAluno.map((link) => ({
    id: link.id,
    titulo: link.titulo,
    href: link.href,
    status: statusByLink.get(link.id) ?? "bloqueada",
  }))

  const concluidas = items.filter((item) => item.status === "concluida").length

  return (
    <div className="mx-auto flex max-w-4xl flex-col space-y-4">
      {tempoReal}
      <StudentActivityHeader
        titulo={`${atividade.titulo} - ${participacao.nome}`}
        subtitulo={atividade.subtitulo}
        meta={
          aplicacao.data && (
            <>
              Data da aula:{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
              }).format(new Date(`${aplicacao.data}T12:00:00`))}
            </>
          )
        }
        concluidas={concluidas}
        total={items.length}
      />

      <div className="m-4 mt-8">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta atividade ainda não tem links.
          </p>
        ) : (
          <StudentLinkList aplicacaoId={aplicacao.id} links={items} />
        )}
      </div>
    </div>
  )
}
