import { test, expect, type Page } from "@playwright/test"

/**
 * Continuar a atividade de outro dia.
 *
 * Usa o seed: a atividade "Daily Routines" (código TESTE1) já tem a Maria
 * conectada. O aluno assume o nome dela e o professor derruba a conexão sem
 * apagar o progresso.
 */

const PROFESSOR = { email: "professor@trilha.test", senha: "senha123" }
const CODIGO = "TESTE1"
const NOME = "Maria"

async function esperarHidratacao(page: Page) {
  await page.waitForFunction(() => {
    const form = document.querySelector("form")
    return (
      !!form &&
      Object.keys(form).some((chave) => chave.startsWith("__reactProps$"))
    )
  })
}

async function loginProfessor(page: Page) {
  await page.goto("/login")
  await esperarHidratacao(page)
  await page.getByLabel("E-mail").fill(PROFESSOR.email)
  await page.getByLabel("Senha").fill(PROFESSOR.senha)
  await page.getByRole("button", { name: "Entrar" }).click()
  await page.waitForURL("**/painel")
}

test("aluno continua pelo nome e professor derruba a conexão", async ({
  page,
  browser,
}) => {
  const contextoAluno = await browser.newContext()
  const aluno = await contextoAluno.newPage()

  // 1. Aluno entra com o código e vê o botão fixo no canto inferior esquerdo.
  await aluno.goto("/")
  await esperarHidratacao(aluno)
  await aluno.locator('input[name="codigoAula"]').fill(CODIGO)
  await aluno.getByRole("button", { name: "Entrar" }).click()
  await aluno.waitForURL(`**/aluno?codigo=${CODIGO}`)

  const continuar = aluno.getByRole("link", { name: "Continuar atividade" })
  await expect(continuar).toBeVisible()
  await continuar.click()
  await aluno.waitForURL(`**/aluno/continuar?codigo=${CODIGO}`)

  // 2. Maria já está conectada pelo seed: confirma a troca e cai na atividade.
  await aluno.getByRole("button", { name: `Continuar como ${NOME}` }).click()

  const confirmacao = aluno.getByRole("alertdialog")
  await expect(confirmacao).toBeVisible()
  await confirmacao.getByRole("button", { name: "Continuar" }).click()

  await aluno.waitForURL(`**/atividade?codigo=${CODIGO}`)
  await expect(
    aluno.getByRole("heading", { name: `Daily Routines - ${NOME}` })
  ).toBeVisible()

  // 3. Professor abre a atividade e derruba a conexão de Maria.
  await loginProfessor(page)
  await page.getByRole("option", { name: "Aulas", exact: true }).dblclick()
  await page
    .getByRole("option", { name: "Daily Routines", exact: true })
    .dblclick()
  await page.getByRole("tab", { name: /^Alunos/ }).click()

  const linhaDaAluna = page.locator("button[aria-expanded]", {
    hasText: NOME,
  })
  await linhaDaAluna.click()
  await expect(
    page.getByText("Conectado", { exact: true }).first()
  ).toBeVisible()

  await page.getByRole("button", { name: "Derrubar" }).click()
  const confirmacaoProfessor = page.getByRole("alertdialog")
  await confirmacaoProfessor.getByRole("button", { name: "Derrubar" }).click()
  await expect(
    page.getByText("Sem conexão", { exact: true }).first()
  ).toBeVisible()

  // 4. O aluno perde a conexão ao recarregar e volta para a tela de nomes.
  await aluno.reload()
  await aluno.waitForURL(`**/aluno?codigo=${CODIGO}`)
  await expect(
    aluno.getByRole("link", { name: "Continuar atividade" })
  ).toBeVisible()

  // 5. Sem ninguém com o nome, continua direto.
  await aluno.getByRole("link", { name: "Continuar atividade" }).click()
  await aluno.getByRole("button", { name: `Continuar como ${NOME}` }).click()
  await aluno.waitForURL(`**/atividade?codigo=${CODIGO}`)
  await expect(
    aluno.getByRole("heading", { name: `Daily Routines - ${NOME}` })
  ).toBeVisible()

  await contextoAluno.close()
})
