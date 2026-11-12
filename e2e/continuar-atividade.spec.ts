import { test, expect, type Page } from "@playwright/test"

/**
 * Continuar a atividade de outro dia.
 *
 * Usa o seed: a atividade "Daily Routines" (código TESTE1) já tem a Maria, mas
 * sem conexão. O primeiro aluno assume o nome; o segundo vê o nome esmaecido
 * e desabilitado até o professor derrubar a conexão, sem perder o progresso.
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

async function abrirListaDeNomes(page: Page) {
  await page.goto("/")
  await esperarHidratacao(page)
  await page.locator('input[name="codigoAula"]').fill(CODIGO)
  await page.getByRole("button", { name: "Entrar" }).click()
  await page.waitForURL(`**/aluno?codigo=${CODIGO}`)

  await page.getByRole("link", { name: "Continuar atividade" }).click()
  await page.waitForURL(`**/aluno/continuar?codigo=${CODIGO}`)
}

test("nome conectado fica indisponível até o professor derrubar", async ({
  page,
  browser,
}) => {
  const contextoA = await browser.newContext()
  const contextoB = await browser.newContext()
  const alunoA = await contextoA.newPage()
  const alunoB = await contextoB.newPage()

  // 1. Os dois alunos abrem a lista de nomes; Maria ainda está disponível.
  await abrirListaDeNomes(alunoA)
  await abrirListaDeNomes(alunoB)

  const mariaA = alunoA.getByRole("button", {
    name: `Continuar como ${NOME}`,
  })
  const mariaB = alunoB.getByRole("button", {
    name: `Continuar como ${NOME}`,
  })

  await expect(mariaA).toBeEnabled()
  await expect(mariaB).toBeEnabled()

  // 2. O aluno A assume o nome e cai direto na atividade.
  await mariaA.click()
  await alunoA.waitForURL(`**/atividade?codigo=${CODIGO}`)
  await expect(
    alunoA.getByRole("heading", { name: `Daily Routines - ${NOME}` })
  ).toBeVisible()

  // 3. O aluno B vê o nome esmaecido e desabilitado, sem conseguir clicar.
  await expect(mariaB).toBeDisabled({ timeout: 20_000 })
  await expect(alunoB.getByText("Em uso", { exact: true })).toBeVisible()

  // 4. Professor derruba a conexão de Maria.
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

  // 5. O aluno B vê Maria liberada e assume o nome.
  await expect(mariaB).toBeEnabled({ timeout: 20_000 })
  await expect(alunoB.getByText("Em uso", { exact: true })).toHaveCount(0)
  await mariaB.click()
  await alunoB.waitForURL(`**/atividade?codigo=${CODIGO}`)
  await expect(
    alunoB.getByRole("heading", { name: `Daily Routines - ${NOME}` })
  ).toBeVisible()

  // 6. O aluno A perde a conexão na hora, sem reload: cai na tela de
  // continuar, com o aviso, e pode escolher o nome de novo (ou usar Voltar
  // para entrar com um nome novo).
  await alunoA.waitForURL(`**/aluno/continuar?codigo=${CODIGO}&desconectado=1`)
  await expect(
    alunoA.getByText("Conexão encerrada", { exact: true })
  ).toBeVisible()
  await expect(alunoA.getByRole("link", { name: "Voltar" })).toBeVisible()
  // Maria está com o aluno B, então a grade aparece com o nome indisponível.
  await expect(
    alunoA.getByRole("button", { name: `Continuar como ${NOME}` })
  ).toBeDisabled()

  // Fecha as abas antes dos contextos para o beacon de saída rodar e a Maria
  // não ficar presa no banco local depois do teste.
  await alunoA.close()
  await alunoB.close()
  await contextoA.close()
  await contextoB.close()
})
