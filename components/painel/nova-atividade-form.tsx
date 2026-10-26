"use client"

import { useState } from "react"

import type { ActionResult } from "@/app/painel/actions"
import { ActionForm } from "@/components/painel/action-form"
import { AtividadeCabecalho } from "@/components/painel/atividade-cabecalho"
import { AtividadeTabsList } from "@/components/painel/atividade-tabs-list"
import { LinksTextarea } from "@/components/painel/links-textarea"
import { SenhaField } from "@/components/painel/senha-field"
import { ShuffleLinksField } from "@/components/painel/shuffle-links-field"
import { SubmitButton } from "@/components/painel/submit-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"

type NovaAtividadeFormProps = {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>
  pastaId: number | null
  pastaNome: string | null
  voltarHref: string
}

export function NovaAtividadeForm({
  action,
  pastaId,
  pastaNome,
  voltarHref,
}: NovaAtividadeFormProps) {
  const [aba, setAba] = useState("configuracoes")

  return (
    <ActionForm
      action={action}
      className="flex flex-col gap-6"
      onError={(error) => {
        if (error === "Informe o título da atividade.") {
          document.getElementById("titulo-atividade")?.focus()
        }
      }}
    >
      <input type="hidden" name="pasta_id" value={pastaId ?? ""} />

      <AtividadeCabecalho
        voltarHref={voltarHref}
        dados={{ modo: "criar" }}
        meta={<span>Pasta: {pastaNome ?? "Sem pasta"}</span>}
        acoes={
          <SubmitButton pendingLabel="Criando...">Criar atividade</SubmitButton>
        }
      />

      <Tabs
        value={aba}
        onValueChange={(value) => setAba(String(value))}
        className="gap-4"
      >
        <AtividadeTabsList modo="criar" />

        <TabsContent value="configuracoes" keepMounted className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O título e o subtítulo ficam no topo da página — clique neles para
            editar. A atividade já nasce ativa, com o código de entrada aberto.
            Para tirá-la do ar depois, use “Encerrar atividade” na aba Alunos.
          </p>

          <Card>
            <CardHeader>
              <CardTitle>Links</CardTitle>
              <CardDescription>
                Um link por linha, na ordem em que o aluno deve fazer. Você pode
                criar a atividade vazia e completar os links depois.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LinksTextarea id="links-nova-atividade" />
            </CardContent>
          </Card>

          <ShuffleLinksField />

          <Card>
            <CardHeader>
              <CardTitle>Senha de liberação</CardTitle>
              <CardDescription>
                A senha vale para todos os alunos desta atividade.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SenhaField label="Senha" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </ActionForm>
  )
}
