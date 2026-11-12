import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { EditableStudentName } from "@/components/aluno/editable-student-name"
import { LeaveActivityButton } from "@/components/aluno/leave-activity-button"
import { StudentActivityHeader } from "@/components/aluno/student-activity-header"
import { StudentActivityRealtime } from "@/components/aluno/student-activity-realtime"
import { StudentConnectionHeartbeat } from "@/components/aluno/student-connection-heartbeat"
import { StudentLinkList } from "@/components/aluno/student-link-list"
import { Card, CardDescription, CardHeader } from "@/components/ui/card"
import { getEstudante, getParticipacaoDoAluno } from "@/lib/auth/estudante"
import { getAtividadePublica } from "@/lib/data/atividade"
import { getAplicacaoStatus, getLinksComProgresso } from "@/lib/data/aluno"
import { formatarData } from "@/lib/format"
import { ordenarLinksDoAluno } from "@/lib/dominio/ordem-links"
import { statusProgresso } from "@/lib/dominio/status"

export const metadata: Metadata = {
  title: "Atividade",
  robots: { index: false, follow: false },
}

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
    <>
      <StudentActivityRealtime
        participacaoId={participacao.id}
        aplicacaoId={aplicacao.id}
        codigo={codigoEntrada}
      />
      <StudentConnectionHeartbeat
        aplicacaoId={aplicacao.id}
        codigo={codigoEntrada}
      />
    </>
  )

  const atividade = await getAtividadePublica(supabase, aplicacao.atividade_id)

  // A RLS esconde a atividade assim que ela volta a rascunho, e a entrada
  // passa a "encerrada" no mesmo commit. Como são duas leituras separadas,
  // uma atualização do Realtime pode cair no meio delas e ver a atividade
  // escondida com a entrada ainda aberta. Relê o status antes de dizer que a
  // atividade sumiu.
  const aplicacaoEncerrada =
    aplicacao.status === "encerrada" ||
    (atividade === null &&
      (await getAplicacaoStatus(supabase, aplicacao.id)) === "encerrada")

  // A entrada encerrada continua visível para o aluno (a RLS não filtra por
  // status), então esta checagem vem antes da atividade: depois de encerrar,
  // a atividade deixa de ser visível pela policy de SELECT.
  if (aplicacaoEncerrada) {
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
  const linksNaOrdemDoAluno = ordenarLinksDoAluno(links, progresso)

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
        titulo={atividade.titulo}
        nome={
          <EditableStudentName
            aplicacaoId={aplicacao.id}
            nome={participacao.nome}
          />
        }
        subtitulo={atividade.subtitulo}
        meta={
          aplicacao.data && <>Data da aula: {formatarData(aplicacao.data)}</>
        }
        concluidas={concluidas}
        total={items.length}
        acao={
          <LeaveActivityButton
            aplicacaoId={aplicacao.id}
            codigo={codigoEntrada}
            nome={participacao.nome}
          />
        }
      />

      <div className="m-4 mt-8 mb-[calc(1rem_+_env(safe-area-inset-bottom))]">
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
