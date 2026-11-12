import { test, expect, type Page } from "@playwright/test"

/**
 * Editar o nome do aluno.
 *
 * O aluno corrige o próprio nome pelo título da atividade; o professor corrige
 * pela aba Alunos. A tela do aluno acompanha a mudança do professor sem
 * recarregar a página.
 */

const PROFESSOR = { email: "professor@trilha.test", senha: "senha123" }
const CODIGO = "TESTE1"
const NOME_INICIAL = "Nome Antigo"
const NOME_DO_ALUNO = "Nome Novo"
const NOME_DO_PROFESSOR = "Nome Editado"

async function esperarHidratacao(page: Page) {
  await page.waitForFunction(() => {
    const form = document.querySelector("form")
    return (
      !!form &&
      Object.keys(form).some((chave) => chave.startsWith("__reactProps$"))
    )
  })
}

async function entrarComoAluno(page: Page, nome: string) {
  await page.goto("/")
  await esperarHidratacao(page)
  await page.locator('input[name="codigoAula"]').fill(CODIGO)
  await page.getByRole("button", { name: "Entrar" }).click()
  await page.waitForURL(`**/aluno?codigo=${CODIGO}`)

  await esperarHidratacao(page)
  await page.getByPlaceholder("Digite aqui").fill(nome)
  await page.getByRole("button", { name: "Pronto" }).click()
  await page.waitForURL("**/atividade**")
}

async function abrirAlunos(page: Page) {
  await page.goto("/login")
  await esperarHidratacao(page)
  await page.getByLabel("E-mail").fill(PROFESSOR.email)
  await page.getByLabel("Senha").fill(PROFESSOR.senha)
  await page.getByRole("button", { name: "Entrar" }).click()
  await page.waitForURL("**/painel")

  await page.getByRole("option", { name: "Aulas", exact: true }).dblclick()
  await page
    .getByRole("option", { name: "Daily Routines", exact: true })
    .dblclick()
  await page.waitForURL(/\/painel\/atividades\/\d+$/)
  await page.getByRole("tab", { name: /^Alunos/ }).click()
}

test("aluno e professor editam o nome, e a tela do aluno acompanha", async ({
  page,
  browser,
}) => {
  const contextoAluno = await browser.newContext()
  const aluno = await contextoAluno.newPage()

  await entrarComoAluno(aluno, NOME_INICIAL)
  const cabecalho = aluno.getByRole("heading")
  await expect(cabecalho).toContainText(NOME_INICIAL)

  // 1. O aluno edita o próprio nome no título.
  await aluno.locator("header h1 button").click()
  const campo = aluno.getByLabel("Nome do aluno")
  await campo.fill(NOME_DO_ALUNO)
  await campo.press("Enter")

  await expect(cabecalho).toContainText(NOME_DO_ALUNO)
  await expect(cabecalho).not.toContainText(NOME_INICIAL)

  // 2. O professor renomeia pela aba Alunos.
  await abrirAlunos(page)
  await page
    .getByRole("button", { name: `Editar nome de ${NOME_DO_ALUNO}` })
    .click()

  const dialogo = page.getByRole("dialog", { name: "Editar nome do aluno" })
  await dialogo.getByLabel("Nome").fill(NOME_DO_PROFESSOR)
  await dialogo.getByRole("button", { name: "Salvar" }).click()

  await expect(dialogo).toBeHidden()
  await expect(
    page.locator("button[aria-expanded]", { hasText: NOME_DO_PROFESSOR })
  ).toBeVisible()

  // 3. A tela do aluno recebe o nome novo pelo Realtime, sem reload.
  await expect(cabecalho).toContainText(NOME_DO_PROFESSOR, { timeout: 20_000 })

  await aluno.close()
  await contextoAluno.close()
})

test("edição no lugar salva sozinho, mantém o foco e não move o layout", async ({
  browser,
}) => {
  const contexto = await browser.newContext()
  const aluno = await contexto.newPage()

  await entrarComoAluno(aluno, "Ana Auto")

  const cabecalho = aluno.locator("header h1")
  const botaoDoNome = aluno.locator("header h1 button")
  const subtitulo = aluno.locator("header p").first()

  const alturaAntes = await cabecalho.boundingBox()
  const subtituloAntes = await subtitulo.boundingBox()

  await botaoDoNome.click()
  const campo = aluno.getByLabel("Nome do aluno")
  await expect(campo).toBeFocused()

  // Abrir a edição não pode mexer na altura do título nem empurrar o que vem
  // abaixo (era o que acontecia com um <input>).
  const alturaDepois = await cabecalho.boundingBox()
  const subtituloDepois = await subtitulo.boundingBox()
  expect(Math.round(alturaDepois?.height ?? 0)).toBe(
    Math.round(alturaAntes?.height ?? 0)
  )
  expect(Math.round(alturaDepois?.y ?? 0)).toBe(Math.round(alturaAntes?.y ?? 0))
  expect(Math.round(subtituloDepois?.y ?? 0)).toBe(
    Math.round(subtituloAntes?.y ?? 0)
  )

  // Digita devagar, para no meio e espera o salvamento automático: o campo
  // continua aberto e com o foco, e o texto novo já está no servidor.
  await aluno.keyboard.type(" Silva")
  await aluno.waitForTimeout(6000)

  await expect(campo).toBeFocused()
  await expect(cabecalho).toContainText("Ana Auto Silva")

  // Esc fecha a edição; o nome exibido vem do servidor, então isto prova que
  // o salvamento automático gravou de verdade.
  await campo.press("Escape")
  await expect(botaoDoNome).toHaveText("Ana Auto Silva")

  // Sair do campo (clique fora) também salva e fecha.
  await botaoDoNome.click()
  await aluno.getByLabel("Nome do aluno").fill("Ana Blur")
  await aluno.locator("header p").first().click()
  await expect(botaoDoNome).toHaveText("Ana Blur")

  // Esc descarta o que estava sendo digitado e mantém o nome salvo.
  await botaoDoNome.click()
  const campoCancelado = aluno.getByLabel("Nome do aluno")
  await campoCancelado.fill("Não Salvar")
  await campoCancelado.press("Escape")
  await expect(botaoDoNome).toHaveText("Ana Blur")

  await aluno.close()
  await contexto.close()
})
