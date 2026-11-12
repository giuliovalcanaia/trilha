import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ShuffleIcon } from "lucide-react"

import {
  alternarAtividade,
  updateActivityPassword,
  updateAtividade,
} from "@/app/painel/actions/atividade"
import { ActionForm } from "@/components/painel/action-form"
import { AlunoDisclosure } from "@/components/painel/aluno-disclosure"
import { AtividadeCabecalho } from "@/components/painel/atividade-cabecalho"
import { AtividadeTabsList } from "@/components/painel/atividade-tabs-list"
import { AtividadeTempoReal } from "@/components/painel/atividade-tempo-real"
import { ConcluirEtapaForm } from "@/components/painel/concluir-etapa-form"
import { ExpelStudentButton } from "@/components/painel/expel-student-button"
import { LinkAtividadeCopiavel } from "@/components/painel/link-atividade-copiavel"
import { LinksDraftProvider } from "@/components/painel/links-draft"
import { LinksEditorTextarea } from "@/components/painel/links-editor-textarea"
import { LinksProtectedTabs } from "@/components/painel/links-protected-tabs"
import { LinksSaveForm } from "@/components/painel/links-save-form"
import { PreviewActivityButton } from "@/components/painel/preview-activity-button"
import { ProgressoAlunoForm } from "@/components/painel/progresso-aluno-form"
import { ReleaseConnectionButton } from "@/components/painel/release-connection-button"
import { SenhaField } from "@/components/painel/senha-field"
import { ShuffleLinksCard } from "@/components/painel/shuffle-links-card"
import { SubmitButton } from "@/components/painel/submit-button"
import { TrashActivityButton } from "@/components/painel/trash-activity-button"
import { UnsavedChangesGuard } from "@/components/painel/unsaved-changes-guard"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TabsContent } from "@/components/ui/tabs"
import { getAtividadeEditor } from "@/lib/data/atividade"
import { ordenarLinksDoAluno } from "@/lib/dominio/ordem-links"
import { ROTULOS_ATIVIDADE } from "@/lib/dominio/status"
import { formatarData } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Atividade",
  robots: { index: false, follow: false },
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const [{ id }, { aba }] = await Promise.all([params, searchParams])
  const atividadeId = Number(id)
  const abaInicial = aba === "alunos" ? aba : "configuracoes"

  if (!Number.isInteger(atividadeId) || atividadeId <= 0) notFound()

  const supabase = await createClient()
  const dados = await getAtividadeEditor(supabase, atividadeId)

  if (!dados) notFound()

  const {
    atividade,
    pasta,
    senha,
    links,
    aplicacoes,
    participacoes,
    progresso,
  } = dados

  const progressoPorParticipacaoLink = new Map(
    progresso.map((row) => [`${row.participacao_id}:${row.link_id}`, row])
  )

  // Cada aluno pode ter uma sequência própria (embaralhamento), então o
  // progresso é agrupado por participação para ordenar a lista dele.
  const progressoPorParticipacao = new Map<number, typeof progresso>()
  for (const row of progresso) {
    const lista = progressoPorParticipacao.get(row.participacao_id) ?? []
    lista.push(row)
    progressoPorParticipacao.set(row.participacao_id, lista)
  }

  const participacoesPorAplicacao = new Map<number, typeof participacoes>()
  for (const participacao of participacoes) {
    const lista = participacoesPorAplicacao.get(participacao.aplicacao_id) ?? []
    lista.push(participacao)
    participacoesPorAplicacao.set(participacao.aplicacao_id, lista)
  }

  const publicada = atividade.status === "publicada"
  const totalAlunos = participacoes.length
  const voltarHref = pasta ? `/painel/pastas/${pasta.id}` : "/painel"

  return (
    <LinksDraftProvider
      key={`${atividade.id}:${abaInicial}`}
      initialValue={links.map((link) => link.href).join("\n")}
      initialTab={abaInicial}
    >
      <AtividadeTempoReal atividadeId={atividade.id} />
      <div className="w-full space-y-6">
        <AtividadeCabecalho
          voltarHref={voltarHref}
          dados={{
            modo: "editar",
            atividadeId: atividade.id,
            titulo: atividade.titulo,
            subtitulo: atividade.subtitulo,
            action: updateAtividade,
          }}
          meta={
            <>
              <span>Pasta: {pasta?.nome ?? "Sem pasta"}</span>
              <span>Alunos: {totalAlunos}</span>
              <span>Links: {links.length}</span>
            </>
          }
          acoes={
            <TrashActivityButton
              id={atividade.id}
              nome={atividade.titulo}
              redirectTo={voltarHref}
            />
          }
        />

        <LinksProtectedTabs className="gap-4">
          <AtividadeTabsList modo="editar" alunosCount={totalAlunos} />

          <TabsContent value="alunos" className="space-y-3">
            {aplicacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Esta atividade não tem um código de entrada.
              </p>
            ) : (
              aplicacoes.map((aplicacao, index) => {
                const alunos = participacoesPorAplicacao.get(aplicacao.id) ?? []
                const aberta = aplicacao.status === "aberta"
                const ativa = publicada && aberta

                return (
                  <Card key={aplicacao.id}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle>
                              {aplicacoes.length > 1
                                ? `Entrada ${index + 1}`
                                : "Código de entrada"}
                            </CardTitle>
                            <Badge variant={ativa ? "default" : "secondary"}>
                              {ativa
                                ? ROTULOS_ATIVIDADE.publicada
                                : ROTULOS_ATIVIDADE.rascunho}
                            </Badge>
                            {ativa && (
                              <Badge variant="outline">
                                <span
                                  className="size-1.5 rounded-full bg-emerald-500"
                                  aria-hidden
                                />
                                Ao vivo
                              </Badge>
                            )}
                          </div>
                          <CardDescription>
                            Criada em {formatarData(aplicacao.data)} ·{" "}
                            {alunos.length} aluno(s)
                          </CardDescription>
                          <CardDescription>
                            Encerrar a atividade invalida este código e a tira
                            do ar para os alunos.
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <LinkAtividadeCopiavel codigo={aplicacao.codigo} />
                          <ActionForm action={alternarAtividade}>
                            <input
                              type="hidden"
                              name="id"
                              value={atividade.id}
                            />
                            <input
                              type="hidden"
                              name="ativa"
                              value={ativa ? "0" : "1"}
                            />
                            <SubmitButton
                              variant={ativa ? "outline" : "default"}
                              size="sm"
                              pendingLabel="Salvando..."
                            >
                              {ativa
                                ? "Encerrar atividade"
                                : "Reabrir atividade"}
                            </SubmitButton>
                          </ActionForm>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {alunos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhum aluno entrou ainda. Compartilhe o código{" "}
                          {aplicacao.codigo}.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {alunos.map((aluno) => {
                            const progressoDoAluno =
                              progressoPorParticipacao.get(aluno.id) ?? []
                            const linksDoAluno = ordenarLinksDoAluno(
                              links,
                              progressoDoAluno
                            )
                            const ordemSorteada = progressoDoAluno.some(
                              (row) => row.ordem_embaralhada !== null
                            )

                            // A etapa atual é a primeira não concluída na
                            // sequência do aluno — a mesma que a tela dele
                            // mostra como aberta/em andamento.
                            const etapaAtual = linksDoAluno.find(
                              (link) =>
                                progressoPorParticipacaoLink.get(
                                  `${aluno.id}:${link.id}`
                                )?.status !== "concluida"
                            )
                            const indiceDaEtapa = etapaAtual
                              ? linksDoAluno.indexOf(etapaAtual) + 1
                              : -1
                            const progressoDaEtapa = etapaAtual
                              ? progressoPorParticipacaoLink.get(
                                  `${aluno.id}:${etapaAtual.id}`
                                )
                              : undefined

                            return (
                              <div
                                key={aluno.id}
                                className="rounded-lg border p-3"
                              >
                                <AlunoDisclosure
                                  nome={aluno.nome}
                                  acoes={
                                    <ExpelStudentButton
                                      atividadeId={atividade.id}
                                      participacaoId={aluno.id}
                                      nome={aluno.nome}
                                    />
                                  }
                                  acao={
                                    links.length === 0 ? null : etapaAtual &&
                                      indiceDaEtapa > 0 ? (
                                      <ConcluirEtapaForm
                                        key={etapaAtual.id}
                                        atividadeId={atividade.id}
                                        participacaoId={aluno.id}
                                        linkId={etapaAtual.id}
                                        indice={indiceDaEtapa}
                                        titulo={etapaAtual.titulo}
                                        pontuacao={
                                          progressoDaEtapa?.pontuacao ?? null
                                        }
                                      />
                                    ) : (
                                      <p className="mt-3 text-xs text-muted-foreground">
                                        Todas as etapas concluídas. Abra o aluno
                                        para revisar as notas.
                                      </p>
                                    )
                                  }
                                  detalhe={
                                    <>
                                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3">
                                        <div className="flex items-center gap-2">
                                          <Badge
                                            variant={
                                              aluno.conexao_estudante_id
                                                ? "default"
                                                : "secondary"
                                            }
                                          >
                                            {aluno.conexao_estudante_id
                                              ? "Conectado"
                                              : "Sem conexão"}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground">
                                            {aluno.conexao_estudante_id
                                              ? "Uma sessão está com este nome."
                                              : "Nenhuma sessão está com este nome."}
                                          </span>
                                        </div>
                                        <ReleaseConnectionButton
                                          atividadeId={atividade.id}
                                          participacaoId={aluno.id}
                                          nome={aluno.nome}
                                          conectado={
                                            aluno.conexao_estudante_id !== null
                                          }
                                        />
                                      </div>
                                      {ordemSorteada && (
                                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <ShuffleIcon className="size-3" />
                                          Ordem sorteada para este aluno.
                                        </p>
                                      )}
                                      {linksDoAluno.map((link, index) => {
                                        const row =
                                          progressoPorParticipacaoLink.get(
                                            `${aluno.id}:${link.id}`
                                          )

                                        return (
                                          <ProgressoAlunoForm
                                            key={link.id}
                                            atividadeId={atividade.id}
                                            participacaoId={aluno.id}
                                            linkId={link.id}
                                            indice={index + 1}
                                            titulo={link.titulo}
                                            status={row?.status ?? "bloqueada"}
                                            pontuacao={row?.pontuacao ?? null}
                                          />
                                        )
                                      })}
                                    </>
                                  }
                                />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}
          </TabsContent>

          <TabsContent value="configuracoes" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O título e o subtítulo desta atividade ficam no topo da página —
              clique neles para editar.
            </p>

            <Card>
              <CardHeader>
                <CardTitle>Links</CardTitle>
                <CardDescription>
                  A ordem das linhas é a ordem original, usada na
                  pré-visualização e por quem entrou antes do embaralhamento. Na
                  aba Alunos, cada aluno aparece na sequência que vê na tela.
                  Salve para aplicar as mudanças.
                </CardDescription>
                <CardAction>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <PreviewActivityButton atividadeId={atividade.id} />
                    <LinksSaveForm atividadeId={atividade.id} />
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent>
                <LinksEditorTextarea />
              </CardContent>
            </Card>

            <ShuffleLinksCard
              atividadeId={atividade.id}
              embaralharLinks={atividade.embaralhar_links}
              totalAlunos={totalAlunos}
            />

            <Card>
              <CardHeader>
                <CardTitle>Senha de liberação</CardTitle>
                <CardDescription>
                  {senha
                    ? senha.senha_texto
                      ? "A senha está definida. Ela vale para todos os alunos desta atividade."
                      : "A senha foi definida antes de a exibição ser habilitada. Defina uma nova senha para vê-la aqui."
                    : "Nenhuma senha definida. O aluno não consegue concluir os links sem ela."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ActionForm
                  action={updateActivityPassword}
                  className="flex flex-col gap-4"
                >
                  <input
                    type="hidden"
                    name="atividade_id"
                    value={atividade.id}
                  />
                  <SenhaField
                    id="nova-senha"
                    label="Nova senha"
                    initialValue={senha?.senha_texto ?? ""}
                  />
                  <div className="flex justify-end">
                    <SubmitButton pendingLabel="Salvando...">
                      {senha ? "Salvar senha" : "Definir senha"}
                    </SubmitButton>
                  </div>
                </ActionForm>
              </CardContent>
            </Card>
          </TabsContent>
        </LinksProtectedTabs>
      </div>
      <UnsavedChangesGuard />
    </LinksDraftProvider>
  )
}
