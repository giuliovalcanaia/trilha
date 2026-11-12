import { test, expect, type Page } from "@playwright/test"

/**
 * Copiar, recortar e colar no explorador do professor.
 *
 * Usa as pastas do `supabase/seed.sql`: "Aulas" na raiz e a atividade
 * "Daily Routines" dentro dela. O `e2e/global.setup.ts` reseta o banco antes da
 * suíte.
 */

const PROFESSOR = { email: "professor@trilha.test", senha: "senha123" }
const PASTA = "Aulas"
const PASTA_COPIA = "Aulas (cópia)"
const ATIVIDADE = "Daily Routines"
const ATIVIDADE_COPIA = "Daily Routines (cópia)"

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
  await page.getByRole("option", { name: PASTA, exact: true }).waitFor()
}

function item(page: Page, nome: string) {
  return page.getByRole("option", { name: nome, exact: true })
}

async function abrirNaRaiz(page: Page) {
  await page
    .getByRole("navigation", { name: "Caminho da pasta" })
    .getByRole("link", { name: "Início" })
    .click()
}

test("copia, recorta e cola pastas e atividades", async ({ page }) => {
  await loginProfessor(page)

  // 1. Ctrl+C na pasta e Ctrl+V na raiz criam uma cópia.
  await item(page, PASTA).click()
  await page.keyboard.press("Control+c")
  await expect(
    page.getByRole("button", { name: /^Colar 1 item nesta pasta$/ })
  ).toBeVisible()

  await page.keyboard.press("Control+v")
  await expect(item(page, PASTA_COPIA)).toBeVisible()

  // 2. Ctrl+X na cópia e Ctrl+V dentro de "Aulas" movem o item.
  await item(page, PASTA_COPIA).click()
  await page.keyboard.press("Control+x")
  await expect(item(page, PASTA_COPIA)).toHaveAttribute(
    "data-recortado",
    "true"
  )

  await item(page, PASTA).dblclick()
  await expect(item(page, ATIVIDADE)).toBeVisible()
  await page.keyboard.press("Control+v")
  await expect(item(page, PASTA_COPIA)).toBeVisible()

  // A cópia não ficou para trás na raiz.
  await abrirNaRaiz(page)
  await expect(item(page, PASTA_COPIA)).toHaveCount(0)

  // 3. Menu de contexto: copiar a atividade e colar dentro de "Aulas".
  await item(page, PASTA).dblclick()
  await item(page, ATIVIDADE).click({ button: "right" })
  await page.getByRole("menuitem", { name: /^Copiar Ctrl\+C$/ }).click()

  await abrirNaRaiz(page)
  await item(page, PASTA).click({ button: "right" })
  await page.getByRole("menuitem", { name: /^Colar dentro Ctrl\+V$/ }).click()

  await item(page, PASTA).dblclick()
  await expect(item(page, ATIVIDADE_COPIA)).toBeVisible()

  // 4. O botão Colar da toolbar cola na pasta atual.
  await item(page, ATIVIDADE).click()
  await page.keyboard.press("Control+c")

  await abrirNaRaiz(page)
  await page.getByRole("button", { name: /^Colar 1 item nesta pasta$/ }).click()
  await expect(item(page, ATIVIDADE_COPIA)).toBeVisible()
})
