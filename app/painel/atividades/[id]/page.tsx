import { notFound } from "next/navigation"

import {
  alternarAtividade,
  updateActivityPassword,
  updateAtividade,
} from "@/app/painel/actions"
import { ActionForm } from "@/components/painel/action-form"
import { AtividadeCabecalho } from "@/components/painel/atividade-cabecalho"
import { AtividadeTabsList } from "@/components/painel/atividade-tabs-list"
import { AtividadeTempoReal } from "@/components/painel/atividade-tempo-real"
import { ExpelStudentButton } from "@/components/painel/expel-student-button"
import { LinkAtividadeCopiavel } from "@/components/painel/link-atividade-copiavel"
import { LinksDraftProvider } from "@/components/painel/links-draft"
import { LinksEditorTextarea } from "@/components/painel/links-editor-textarea"
import { LinksProtectedTabs } from "@/components/painel/links-protected-tabs"
import { LinksSaveForm } from "@/components/painel/links-save-form"
import { PreviewActivityButton } from "@/components/painel/preview-activity-button"
import { ProgressoAlunoForm } from "@/components/painel/progresso-aluno-form"
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
import { formatarData, formatarDataHora } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

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

  const { data: atividade } = await supabase
    .from("atividades")
    .select("id, titulo, subtitulo, pasta_id, status, embaralhar_links")
    .eq("id", atividadeId)
    .is("deleted_at", null)
    .maybeSingle()

  if (!atividade) notFound()

  const [
    { data: pastas },
    { data: senhaComTexto, error: senhaError },
    { data: links },
    { data: aplicacoes },
  ] = await Promise.all([
    supabase
      .from("pastas")
      .select("id, nome, parent_id")
      .is("deleted_at", null)
      .order("nome"),
    supabase
      .from("atividade_senhas")
      .select("atividade_id, senha_texto")
      .eq("atividade_id", atividadeId)
      .maybeSingle(),
    supabase
      .from("links")
      .select("id, titulo, href, ordem")
      .eq("atividade_id", atividadeId)
      .order("ordem"),
    supabase
      .from("aplicacoes")
      .select("id, codigo, data, status")
      .eq("atividade_id", atividadeId)
      .order("created_at"),
  ])

  // Tolerância de rollout: se a migration da senha visível ainda não foi
  // aplicada, segue mostrando apenas que a senha existe.
  let senha: { atividade_id: number; senha_texto: string | null } | null =
    senhaComTexto

  if (senhaError) {
    const { data: senhaSemTexto } = await supabase
      .from("atividade_senhas")
      .select("atividade_id")
      .eq("atividade_id", atividadeId)
      .maybeSingle()

    senha = senhaSemTexto
      ? { atividade_id: senhaSemTexto.atividade_id, senha_texto: null }
      : null
  }

  const aplicacaoIds = (aplicacoes ?? []).map((aplicacao) => aplicacao.id)
  const linkIds = (links ?? []).map((link) => link.id)

  const { data: participacoes } = await supabase
    .from("participacoes")
    .select("id, aplicacao_id, nome, iniciado_em, concluido_em")
    .in("aplicacao_id", aplicacaoIds.length > 0 ? aplicacaoIds : [-1])
    .is("expulso_em", null)
    .order("nome")

  const participacaoIds = (participacoes ?? []).map(
    (participacao) => participacao.id
  )

  const { data: progresso } = await supabase
    .from("progresso_estudante")
    .select("participacao_id, link_id, status, pontuacao")
    .in("participacao_id", participacaoIds.length > 0 ? participacaoIds : [-1])
    .in("link_id", linkIds.length > 0 ? linkIds : [-1])

  const progressoPorParticipacaoLink = new Map(
    (progresso ?? []).map((row) => [
      `${row.participacao_id}:${row.link_id}`,
      row,
    ])
  )

  const participacoesPorAplicacao = new Map<
    number,
    NonNullable<typeof participacoes>
  >()
  for (const participacao of participacoes ?? []) {
    const lista = participacoesPorAplicacao.get(participacao.aplicacao_id) ?? []
    lista.push(participacao)
    participacoesPorAplicacao.set(participacao.aplicacao_id, lista)
  }

  const pasta = (pastas ?? []).find((item) => item.id === atividade.pasta_id)
  const publicada = atividade.status === "publicada"
  const totalAlunos = participacoes?.length ?? 0
  const voltarHref = pasta ? `/painel/pastas/${pasta.id}` : "/painel"

  return (
    <LinksDraftProvider
      key={`${atividade.id}:${abaInicial}`}
      initialValue={(links ?? []).map((link) => link.href).join("\n")}
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
              <span>Links: {(links ?? []).length}</span>
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
            {!aplicacoes || aplicacoes.length === 0 ? (
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
                              {ativa ? "Ativa" : "Encerrada"}
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
                            const concluidos = (links ?? []).filter(
                              (link) =>
                                progressoPorParticipacaoLink.get(
                                  `${aluno.id}:${link.id}`
                                )?.status === "concluida"
                            ).length

                            return (
                              <div
                                key={aluno.id}
                                className="rounded-lg border p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <details className="min-w-0 flex-1">
                                    <summary className="cursor-pointer text-sm">
                                      <span className="font-medium">
                                        {aluno.nome}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {" "}
                                        · {concluidos}/{(links ?? []).length}{" "}
                                        concluídos · início{" "}
                                        {formatarDataHora(aluno.iniciado_em)} ·
                                        fim{" "}
                                        {formatarDataHora(aluno.concluido_em)}
                                      </span>
                                    </summary>
                                    <div className="mt-3 space-y-2">
                                      {(links ?? []).map((link, index) => {
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
                                    </div>
                                  </details>
                                  <ExpelStudentButton
                                    atividadeId={atividade.id}
                                    participacaoId={aluno.id}
                                    nome={aluno.nome}
                                  />
                                </div>
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
                  A ordem das linhas é a ordem original, usada na aba Alunos e
                  na pré-visualização. Com o embaralhamento ativo, cada aluno
                  recebe uma sequência sorteada. Salve para aplicar as mudanças.
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
