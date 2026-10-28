import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"

import { chromium } from "@playwright/test"

/**
 * Gera as imagens do README (PNG + GIF) a partir de um cenário de demonstração.
 *
 * Pré-requisitos: Docker (stack do Supabase) e o seed aplicado. O script:
 *   1. roda `supabase db reset` (parte do seed);
 *   2. aplica `scripts/demo.sql` no banco local;
 *   3. sobe a build de produção na porta 3311;
 *   4. captura as telas com o tema claro e espera a hidratação antes de clicar;
 *   5. converte os vídeos em GIF com `ffmpeg` (paleta, ~10 fps).
 *
 * Uso: `npm run docs:images`. As imagens ficam em `docs/images/`.
 */

const RAIZ = process.cwd()
const PORTA = Number(process.env.CAPTURAS_PORTA ?? 3311)
const BASE = `http://localhost:${PORTA}`
const SAIDA = join(RAIZ, "docs", "images")
const VIDEO_DIR = join(RAIZ, ".capturas")

const ALUNO = "Ana Beatriz"
const SENHA = "aula123"
const CODIGO_ANDAMENTO = "DEMO01"
const CODIGO_GIF = "DEMO02"

function rodar(comando, argumentos, opcoes = {}) {
  execFileSync(comando, argumentos, {
    cwd: RAIZ,
    stdio: "inherit",
    ...opcoes,
  })
}

function idDoProjeto() {
  const config = readFileSync(join(RAIZ, "supabase", "config.toml"), "utf8")
  const encontrado = /project_id\s*=\s*"([^"]+)"/.exec(config)
  if (!encontrado) throw new Error("não achei project_id em supabase/config.toml")
  return encontrado[1]
}

function prepararBanco() {
  console.log("\n▸ resetando o banco com o seed…")
  rodar("npx", ["supabase", "db", "reset"])

  console.log("▸ aplicando o cenário de demonstração…")
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      `supabase_db_${idDoProjeto()}`,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: readFileSync(join(RAIZ, "scripts", "demo.sql")),
      stdio: ["pipe", "inherit", "inherit"],
    }
  )
}

async function esperarServidor(url, limiteMs = 180_000) {
  const inicio = Date.now()

  while (Date.now() - inicio < limiteMs) {
    try {
      const resposta = await fetch(url)
      if (resposta.ok) return
    } catch {
      // servidor ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`o app não respondeu em ${url}`)
}

async function esperarHidratacao(page) {
  await page.waitForFunction(() => {
    for (const no of document.querySelectorAll("*")) {
      if (Object.keys(no).some((chave) => chave.startsWith("__reactProps$"))) {
        return true
      }
    }
    return false
  })
}

async function irPara(page, caminho) {
  await page.goto(`${BASE}${caminho}`)
  await esperarHidratacao(page)
}

async function entrarComoProfessor(page) {
  await irPara(page, "/login")
  await page.getByLabel("E-mail").fill("professor@trilha.test")
  await page.getByLabel("Senha").fill("senha123")
  await page.getByRole("button", { name: "Entrar" }).click()
  await page.waitForURL("**/painel")
}

async function digitar(locator, texto, delay = 90) {
  await locator.click()
  await locator.pressSequentially(texto, { delay })
}

async function capturar(page, arquivo) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(200)
  await page.screenshot({ path: join(SAIDA, arquivo) })
  console.log(`  ✓ ${arquivo}`)
}

async function concluirLink(page, { nota, lenta = false } = {}) {
  const senha = page.locator("[data-inline-password]:not(:disabled)")

  if (nota) {
    const campoNota = page.getByLabel(/^Nota/)
    if (lenta) await digitar(campoNota, nota, 130)
    else await campoNota.fill(nota)
    if (lenta) await page.waitForTimeout(1000)
  }

  if (lenta) await digitar(senha, SENHA, 90)
  else await senha.fill(SENHA)
  if (lenta) await page.waitForTimeout(1000)

  await page.getByRole("button", { name: /^Concluir / }).click()
  await page.waitForTimeout(lenta ? 2400 : 1200)
}

async function abrirPrimeiroLink(page, { lenta = false } = {}) {
  // Só o link em aberto é clicável; os concluídos/bloqueados perdem o href.
  await page.locator('a[aria-label$="Status: Aberto"]').first().click()
  await page.waitForTimeout(lenta ? 1800 : 1200)
}

async function entrarNaAtividade(page, codigo, nome, { lenta = false } = {}) {
  await irPara(page, `/aluno?codigo=${codigo}`)
  const campoNome = page.locator('input[name="nome"]')
  if (lenta) await digitar(campoNome, nome, 85)
  else await campoNome.fill(nome)
  await page.getByRole("button", { name: "Pronto" }).click()
  await page.waitForURL(`**/atividade?codigo=${codigo}`)
  await esperarHidratacao(page)
}

async function gravarGif(webm, gif, { inicio = 0, largura = 1100, fps = 13 } = {}) {
  const filtro = [
    inicio > 0 ? `trim=start=${inicio}` : null,
    `setpts=PTS-STARTPTS`,
    `fps=${fps}`,
    `scale=${largura}:-1:flags=lanczos`,
    `split[a][b]`,
    `[a]palettegen=max_colors=256:stats_mode=full[p]`,
    `[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle`,
  ]
    .filter(Boolean)
    .join(",")

  rodar("ffmpeg", ["-y", "-i", webm, "-vf", filtro, "-loop", "0", gif], {
    stdio: "inherit",
  })

  const mb = statSync(gif).size / 1024 / 1024
  console.log(`  ✓ ${gif.split("/").pop()} (${mb.toFixed(1)} MB)`)
}

async function principal() {
  mkdirSync(SAIDA, { recursive: true })
  rmSync(VIDEO_DIR, { recursive: true, force: true })
  mkdirSync(VIDEO_DIR, { recursive: true })

  prepararBanco()

  console.log("\n▸ gerando a build de produção…")
  rodar("npm", ["run", "build"])

  const servidor = spawn("npm", ["run", "start", "--", "-p", String(PORTA)], {
    cwd: RAIZ,
    stdio: ["ignore", "ignore", "inherit"],
  })

  const encerrar = () => {
    if (!servidor.killed) servidor.kill("SIGTERM")
  }
  process.on("exit", encerrar)

  await esperarServidor(BASE)
  console.log(`▸ app no ar em ${BASE}`)

  const browser = await chromium.launch()

  const contextoAluno = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    locale: "pt-BR",
  })
  const aluno = await contextoAluno.newPage()
  aluno.on("popup", (popup) => popup.close())
  await aluno.addInitScript(() => localStorage.setItem("theme", "light"))

  // A aluna da captura entra pelo app e conclui duas etapas: o progresso sai
  // "de verdade", sem seed artificial para a tela dela.
  console.log("\n▸ aluna concluindo duas etapas…")
  await entrarNaAtividade(aluno, CODIGO_ANDAMENTO, ALUNO)
  await abrirPrimeiroLink(aluno)
  await concluirLink(aluno, { nota: "9,5" })
  await abrirPrimeiroLink(aluno)
  await concluirLink(aluno, { nota: "8,0" })

  const contextoProfessor = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    locale: "pt-BR",
  })
  const prof = await contextoProfessor.newPage()
  await prof.addInitScript(() => localStorage.setItem("theme", "light"))
  await prof.addStyleTag({
    content:
      "*,*::before,*::after{transition:none!important;animation:none!important}html{caret-color:transparent!important}",
  })

  console.log("\n▸ capturando telas…")
  await entrarComoProfessor(prof)
  await irPara(prof, "/painel")
  await prof.locator('[role="option"][aria-label="Aulas"]').dblclick()
  await prof.waitForURL("**/painel/pastas/*")
  await prof.locator('[role="option"][aria-label="Unit 3 — Rotina"]').dblclick()
  await prof.waitForURL("**/painel/pastas/*")
  await esperarHidratacao(prof)
  await capturar(prof, "explorador.png")

  await prof
    .locator('[role="option"][aria-label="Daily Routines — review"]')
    .dblclick()
  await prof.waitForURL(/\/painel\/atividades\/\d+/)
  await esperarHidratacao(prof)
  const urlAtividade = prof.url().split("?")[0].replace(BASE, "")

  // O editor tem três cards; uma viewport mais alta evita cortar o de senha.
  await prof.setViewportSize({ width: 1440, height: 1180 })
  await capturar(prof, "atividade-editor.png")
  await prof.setViewportSize({ width: 1440, height: 900 })

  await prof.getByRole("tab", { name: /^Alunos/ }).click()
  await prof.locator("summary", { hasText: ALUNO }).click()
  await capturar(prof, "alunos.png")

  await irPara(aluno, `/atividade?codigo=${CODIGO_ANDAMENTO}`)
  await aluno.evaluate(() => document.fonts.ready)
  await aluno.waitForTimeout(200)
  // Recorta na altura do último cartão: sem a faixa vazia embaixo.
  const alturaAluno = await aluno.evaluate(() => {
    const cartoes = document.querySelectorAll('[data-slot="card"]')
    const ultimo = cartoes[cartoes.length - 1]
    return ultimo ? Math.ceil(ultimo.getBoundingClientRect().bottom + 24) : 720
  })
  await aluno.screenshot({
    path: join(SAIDA, "aluno.png"),
    clip: { x: 0, y: 0, width: 1440, height: Math.min(alturaAluno, 900) },
  })
  console.log("  ✓ aluno.png")

  // ---------- GIF 1: fluxo do aluno ----------
  console.log("\n▸ gravando o fluxo do aluno…")
  const contextoGif = await browser.newContext({
    viewport: { width: 1000, height: 780 },
    colorScheme: "light",
    locale: "pt-BR",
    recordVideo: { dir: VIDEO_DIR, size: { width: 1000, height: 780 } },
  })
  const gifAluno = await contextoGif.newPage()
  gifAluno.on("popup", (popup) => popup.close())
  await gifAluno.addInitScript(() => localStorage.setItem("theme", "light"))
  await gifAluno.addStyleTag({
    content:
      "*{transition:none!important;animation:none!important}html{caret-color:transparent!important}",
  })

  await entrarNaAtividade(gifAluno, CODIGO_GIF, "Bia Ferraz", { lenta: true })
  await gifAluno.waitForTimeout(900)
  await abrirPrimeiroLink(gifAluno, { lenta: true })
  await digitar(
    gifAluno.locator("[data-inline-password]").first(),
    "errada",
    110
  )
  await gifAluno.waitForTimeout(800)
  await gifAluno.getByRole("button", { name: /^Concluir / }).click()
  await gifAluno.getByText("Tentativas restantes: 4.").waitFor({ timeout: 15000 })
  await gifAluno.waitForTimeout(2200)
  await concluirLink(gifAluno, { nota: "9,0", lenta: true })
  await gifAluno.waitForTimeout(2800)

  const videoFluxo = await gifAluno.video().path()
  await contextoGif.close()
  await gravarGif(videoFluxo, join(SAIDA, "fluxo-aluno.gif"), {
    inicio: 0.6,
    largura: 1000,
    fps: 15,
  })

  // ---------- GIF 2: acompanhamento em tempo real ----------
  console.log("\n▸ gravando o acompanhamento em tempo real…")
  const estadoProfessor = await contextoProfessor.storageState()
  const contextoRealtime = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: "light",
    locale: "pt-BR",
    storageState: estadoProfessor,
    recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 800 } },
  })
  const realtime = await contextoRealtime.newPage()
  await realtime.addInitScript(() => localStorage.setItem("theme", "light"))
  await realtime.addStyleTag({
    content:
      "*{transition:none!important;animation:none!important}html{caret-color:transparent!important}",
  })

  // Já autenticado: abre direto a aba Alunos e expande a aluna, para a mudança
  // de 2/4 para 3/4 aparecer sem rolagem.
  await irPara(realtime, `${urlAtividade}?aba=alunos`)
  const linhaTempoReal = realtime.locator("summary", { hasText: ALUNO })
  await linhaTempoReal.waitFor()
  await linhaTempoReal.click()
  await realtime.waitForTimeout(1600)

  await abrirPrimeiroLink(aluno)
  await concluirLink(aluno, { nota: "10,0" })
  await linhaTempoReal.filter({ hasText: "3/4 concluídos" }).waitFor({
    timeout: 20000,
  })
  await realtime.waitForTimeout(1800)

  const videoRealtime = await realtime.video().path()
  await contextoRealtime.close()
  await gravarGif(videoRealtime, join(SAIDA, "tempo-real.gif"), {
    largura: 1280,
    fps: 14,
  })

  await contextoAluno.close()
  await contextoProfessor.close()
  await browser.close()
  encerrar()

  console.log("\n▸ restaurando o banco para o seed…")
  rodar("npx", ["supabase", "db", "reset"])

  const arquivos = ["explorador.png", "atividade-editor.png", "alunos.png", "aluno.png", "fluxo-aluno.gif", "tempo-real.gif"]
  const total = arquivos.reduce((soma, nome) => {
    const caminho = join(SAIDA, nome)
    return soma + (existsSync(caminho) ? statSync(caminho).size : 0)
  }, 0)

  console.log(
    `\n✓ ${arquivos.length} arquivos em docs/images (${(total / 1024 / 1024).toFixed(1)} MB no total)`
  )
}

principal().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
