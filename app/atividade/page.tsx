import { redirect } from "next/navigation"

import { StudentActivityHeader } from "@/components/aluno/student-activity-header"
import { StudentActivityRealtime } from "@/components/aluno/student-activity-realtime"
import { StudentLinkList } from "@/components/aluno/student-link-list"
import { Card, CardDescription, CardHeader } from "@/components/ui/card"
import { getEstudante, getParticipacaoDoAluno } from "@/lib/auth/estudante"
import { getAtividadePublica } from "@/lib/data/atividade"
import { getLinksComProgresso } from "@/lib/data/aluno"
import { formatarData } from "@/lib/format"
import { statusProgresso } from "@/lib/dominio/status"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>
}) {
  const { codigo } = await searchParams
  const codigoEntrada = codigo?.trim().toUpperCase()

  if (!codigoEntrada) redirect("/")

  const aluno = await getEstudante()

  if (!aluno) {
    redirect(`/aluno?codigo=${encodeURIComponent(codigoEntrada)}`)
  }

  const dados = await getParticipacaoDoAluno(codigoEntrada)

  if (!dados) {
    redirect(`/aluno?codigo=${encodeURIComponent(codigoEntrada)}`)
  }

  const { supabase, aplicacao, participacao } = dados

  if (participacao.expulso_em) {
    redirect(`/aluno?codigo=${encodeURIComponent(codigoEntrada)}&expulso=1`)
  }

  const tempoReal = (
    <StudentActivityRealtime
      participacaoId={participacao.id}
      aplicacaoId={aplicacao.id}
    />
  )

  const atividade = await getAtividadePublica(supabase, aplicacao.atividade_id)

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

  const { links, progresso } = await getLinksComProgresso(
    supabase,
    atividade.id,
    participacao.id
  )

  const statusByLink = new Map(
    progresso.map((row) => [row.link_id, statusProgresso(row.status)])
  )

  // Quando o professor ativou o embaralhamento, a sequência do aluno vive em
  // `progresso_estudante.ordem_embaralhada`; a ordem canônica dos links não é
  // usada nesse caso. A lista pode continuar na ordem canônica para quem
  // entrou antes da opção ser ligada.
  const ordemPorLink = new Map(
    progresso.map((row) => [row.link_id, row.ordem_embaralhada])
  )
  const embaralhada = progresso.some((row) => row.ordem_embaralhada !== null)

  const linksNaOrdemDoAluno = embaralhada
    ? [...links].sort(
        (a, b) =>
          (ordemPorLink.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (ordemPorLink.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      )
    : links

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
          aplicacao.data && <>Data da aula: {formatarData(aplicacao.data)}</>
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
