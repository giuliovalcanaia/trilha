import { test, expect, type Page } from "@playwright/test"

/**
 * "Sair" da atividade.
 *
 * O aluno que entrou com o nome errado (ou quer trocar de nome) libera a
 * própria conexão pelo botão do cabeçalho, volta para a grade de nomes e
 * reassume o mesmo nome com o progresso intacto.
 */

const CODIGO = "TESTE1"
const NOME = "Sair Teste"

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

test("sai da atividade e reassume o nome com o progresso salvo", async ({
  page,
}) => {
  await entrarComoAluno(page, NOME)
  await expect(page.locator("header h1")).toContainText(NOME)

  // Começa o primeiro link, para haver progresso a preservar.
  await page.locator('[aria-label*="Status: Aberto"]').first().click()
  await page.locator("input[data-inline-password]").first().waitFor()

  // O botão fica no cabeçalho fixo, ao lado do nome.
  await page.getByRole("button", { name: "Sair" }).click()
  await page.getByRole("alertdialog").waitFor()
  await page.getByRole("button", { name: "Sair", exact: true }).last().click()

  await page.waitForURL(`**/aluno/continuar?codigo=${CODIGO}`)

  // O nome ficou livre e pode ser retomado na hora.
  const cartao = page.getByRole("button", { name: `Continuar como ${NOME}` })
  await expect(cartao).toBeEnabled()
  await expect(page.getByText("Em uso")).toHaveCount(0)
  await cartao.click()

  await page.waitForURL("**/atividade**")
  await expect(page.locator("header h1")).toContainText(NOME)
  await expect(
    page.locator('[aria-label*="Status: Em execução"]').first()
  ).toBeVisible()
})
