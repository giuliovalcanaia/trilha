import { test, expect, type Locator, type Page } from "@playwright/test"

/**
 * Fluxo único de ponta a ponta:
 *
 * professor cria a atividade → aluno entra com o código → abre o link e conclui
 * com a senha → professor vê o progresso → professor encerra a atividade.
 *
 * As credenciais vêm de `supabase/seed.sql`, e o `e2e/global.setup.ts` reseta o
 * banco antes da suíte.
 */

const PROFESSOR = { email: "professor@trilha.test", senha: "senha123" }
const TITULO = "Aula E2E"
const SENHA_ATIVIDADE = "aula123"
const NOME_ALUNO = "Aluno E2E"

// Portas fechadas de propósito: o link abre e falha na hora, sem depender de
// internet, e os hosts privados fazem o `lookupLinkTitles` cair no nome do host.
const LINK_1 = "http://127.0.0.1:9099/exercicio-1"
const LINK_2 = "http://localhost:9099/exercicio-2"
const LINK_3 = "http://127.0.0.2:9098/exercicio-3"

/**
 * O cartão do link é um `<a>` com `aria-label="<título> - Status: <rótulo>"`.
 * Cartão bloqueado/concluído fica sem `href`, então não tem role `link` — por
 * isso a busca é pelo aria-label, não por `getByRole("link")`.
 */
function cardDoLink(page: Page, titulo: string, status: string): Locator {
  return page.locator(`[aria-label="${titulo} - Status: ${status}"]`)
}

async function esperarHidratacao(page: Page) {
  // Em `next dev` a página chega antes do bundle hidratar. Sem esta espera o
  // clique no botão vira um GET nativo do formulário (e recarrega /login?).
  // O React marca o nó hidratado com uma propriedade `__reactProps$…`.
  await page.waitForFunction(() => {
    const form = document.querySelector("form")
    return (
      !!form &&
      Object.keys(form).some((chave) => chave.startsWith("__reactProps$"))
    )
  })
}

async function irPara(page: Page, url: string) {
  await page.goto(url)
  await esperarHidratacao(page)
}

async function loginProfessor(page: Page) {
  await irPara(page, "/login")
  await page.getByLabel("E-mail").fill(PROFESSOR.email)
  await page.getByLabel("Senha").fill(PROFESSOR.senha)
  await page.getByRole("button", { name: "Entrar" }).click()
  await page.waitForURL("**/painel")
}

async function abrirAbaAlunos(page: Page) {
  await page.getByRole("tab", { name: /^Alunos/ }).click()
}

/**
 * Abre o link (a página do exercício abre em outra aba), preenche nota e senha
 * e conclui. A aba do exercício é fechada em seguida; a porta está fechada, o
 * conteúdo dela não importa para o teste.
 */
async function concluirLink(page: Page, titulo: string, nota?: string) {
  const [abaDoLink] = await Promise.all([
    page.context().waitForEvent("page"),
    cardDoLink(page, titulo, "Aberto").click(),
  ])

  await abaDoLink.close().catch(() => {})

  if (nota) await page.getByLabel(/^Nota/).fill(nota)
  await page
    .locator("[data-inline-password]:not(:disabled)")
    .fill(SENHA_ATIVIDADE)
  await page.getByRole("button", { name: `Concluir ${titulo}` }).click()

  await expect(cardDoLink(page, titulo, "Fechado")).toBeVisible()
}

test("professor cria, aluno conclui e professor encerra", async ({
  page,
  browser,
}) => {
  await loginProfessor(page)

  // 1. Professor cria a atividade com três links e senha de liberação.
  await irPara(page, "/painel/atividades/nova")

  // O título é um `contentEditable` com aria-label próprio.
  await page.locator("#titulo-atividade").fill(TITULO)
  await page
    .locator("#links-nova-atividade")
    .fill(`${LINK_1}\n${LINK_2}\n${LINK_3}`)
  await page.locator("#senha").fill(SENHA_ATIVIDADE)
  await page.getByRole("button", { name: "Criar atividade" }).click()

  await page.waitForURL(/\/painel\/atividades\/\d+$/)
  await expect(page.locator("#titulo-atividade")).toHaveText(TITULO)

  // 2. O código de entrada aparece na aba Alunos.
  await abrirAbaAlunos(page)
  const codigo = (
    await page
      .getByRole("button", { name: "Copiar link da atividade" })
      .innerText()
  ).trim()

  expect(codigo).toMatch(/^[A-Z0-9]{6}$/)

  // 3. Aluno anônimo entra com o código. Contexto novo = sem sessão.
  const contextoAluno = await browser.newContext()
  const aluno = await contextoAluno.newPage()

  await irPara(aluno, "/")
  await aluno.locator('input[name="codigoAula"]').fill(codigo)
  await aluno.getByRole("button", { name: "Entrar" }).click()
  await aluno.waitForURL("**/aluno?codigo=*")

  await aluno.locator('input[name="nome"]').fill(NOME_ALUNO)
  await aluno.getByRole("button", { name: "Pronto" }).click()
  await aluno.waitForURL("**/atividade?codigo=*")

  await expect(cardDoLink(aluno, "127.0.0.1", "Aberto")).toBeVisible()
  await expect(cardDoLink(aluno, "localhost", "Bloqueado")).toBeVisible()
  await expect(cardDoLink(aluno, "127.0.0.2", "Bloqueado")).toBeVisible()

  // 4. Aluno conclui o primeiro link com nota e senha.
  await concluirLink(aluno, "127.0.0.1", "8,5")
  await expect(cardDoLink(aluno, "localhost", "Aberto")).toBeVisible()
  await expect(cardDoLink(aluno, "127.0.0.2", "Bloqueado")).toBeVisible()

  // 5. Professor recarrega a página antes de acompanhar: é o cenário que já
  // quebrou o Realtime (o canal assinava antes da sessão ser restaurada do
  // cookie e entrava como `anon`). Daqui em diante nada é recarregado.
  await page.reload()
  await esperarHidratacao(page)
  await abrirAbaAlunos(page)

  const linhaDoAluno = page.locator("button[aria-expanded]", {
    hasText: NOME_ALUNO,
  })
  // A conclusão rápida aponta para a etapa atual do aluno (o rótulo acessível
  // do campo), sem expandir nada.
  await expect(
    page.getByLabel("Nota da etapa 2: localhost", { exact: true })
  ).toBeVisible()

  // 6. Aluno conclui o segundo link (sem nota).
  await concluirLink(aluno, "localhost")

  // 7. Professor vê a etapa avançar sem recarregar.
  await expect(
    page.getByLabel("Nota da etapa 3: 127.0.0.2", { exact: true })
  ).toBeVisible({ timeout: 15_000 })

  // 8. Professor conclui a última etapa pela nota rápida, sem nota.
  const notaRapida = page.getByLabel(/^Nota da etapa/)
  await expect(notaRapida).toHaveValue("")
  await notaRapida
    .locator("xpath=ancestor::form")
    .getByRole("button", { name: "Salvar" })
    .click()

  await expect(page.getByText("Todas as etapas concluídas")).toBeVisible({
    timeout: 15_000,
  })

  // O detalhe continua mostrando etapa por etapa, agora com a última concluída.
  await linhaDoAluno.click()
  const terceiraEtapa = page.locator("form", { hasText: "127.0.0.2" })
  await expect(terceiraEtapa.getByLabel("Situação")).toHaveValue("concluida")
  await expect(terceiraEtapa.getByLabel("Nota")).toHaveValue("")

  // 9. Professor encerra a atividade.
  await page.getByRole("button", { name: "Encerrar atividade" }).click()
  await expect(
    page.getByRole("button", { name: "Reabrir atividade" })
  ).toBeVisible()
  await expect(page.getByText("Encerrada").first()).toBeVisible()

  // 9. O aluno perde o acesso sem recarregar: o encerramento chega pelo
  // Realtime (aplicacoes) e o Server Component é atualizado.
  await expect(aluno.getByText("Atividade encerrada.")).toBeVisible({
    timeout: 15_000,
  })

  await contextoAluno.close()
})
