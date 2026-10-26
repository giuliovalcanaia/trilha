# AGENTS.md

## Layout

- The Next.js app lives at the repo root (`/home/giulio/aula-ingles`). Run every command from here.
- npm only (`package-lock.json`). Node >= 20 is required by the `cn` package.
- Supabase packages are installed. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` belong in `.env.local` at the repo root; never commit that file.

## Commands

- `npm run dev` — Next.js dev server (Turbopack).
- `npm run typecheck` — `tsc --noEmit`. Passes on the current tree.
- `npm run build` — production build; also runs the TypeScript check. Passes on the current tree.
- `npm run format` — Prettier for `**/*.{ts,tsx}` only (no semicolons, double quotes, 2 spaces, sorted Tailwind classes).
- `npm run lint` is currently broken before linting any file: ESLint 10.10 crashes with `eslint-config-next`'s `eslint-plugin-react` 7.37.5 (supports ESLint <= 9). Do not treat this as a regression in your change; verify with `typecheck` + `build`. Fixing it means pinning `eslint` to `^9`, not changing app code.
- There is no test runner or test directory. Do not invent Jest/Vitest/Playwright commands.

## Environments

- **Local (desenvolvimento)**: stack completo do Supabase via CLI + Docker (`npx supabase start`): API em `54321`, banco em `54322`, Studio em `54323`. O app roda em `localhost:5151` (`npm run dev`). `.env.local` aponta para esse stack.
- **Produção**: projeto hospedado `fmhzbhiithwmbjfvblhw` (São Paulo, `sa-east-1`, Postgres 17), usado pelo deploy da Vercel a partir do branch `main`. As chaves de produção ficam só na Vercel e no gerenciador de senhas — nunca em arquivo versionado nem em `.env.local`.
- **Staging (preview)**: projeto hospedado `bzhhteracwpldavzjhga` (São Paulo, `sa-east-1`), usado pelas envs de **Preview** da Vercel (branch `dev`). Tem as mesmas migrations + `seed.sql` aplicados. A CLI conecta pelo pooler `aws-1-sa-east-1.pooler.supabase.com` — o host direto `db.<ref>.supabase.co` só resolve IPv6 e é recusado nesta máquina. A URI completa está em `~/.config/trilha/staging.env` (fora do repo). Previews ficam atrás do Vercel Authentication (SSO); produção é pública.

Branches: `main` = produção (Production Branch na Vercel), `dev` = desenvolvimento (preview), `legacy` = app antigo em JS puro, arquivado. Trabalhe em `dev`; quando estiver estável, `git switch main && git merge --ff-only dev && git push`.

### Banco local

- `npx supabase start` sobe o stack; `npx supabase db reset` recria o schema aplicando todas as migrations e roda `supabase/seed.sql`.
- `supabase/config.toml` já vem com `enable_anonymous_sign_ins = true` e `anonymous_users = 300`. O login anônimo precisa estar ligado, senão `signInAnonymously()` falha com `anonymous_provider_disabled`.
- O seed cria um professor de teste e uma atividade publicada com código de entrada; os valores estão nos comentários do topo de `supabase/seed.sql` (professor `professor@trilha.test` / `senha123`, entrada `TESTE1`, senha de liberação `aula123`).
- `npx supabase status` imprime URL e chaves do stack local; `npx supabase stop` encerra os containers (o banco local é preservado entre execuções).
- **Nunca aponte `.env.local` para o projeto de produção**: o ambiente local passaria a gravar dados reais.

### Migrations e deploy do banco

1. `npx supabase migration new <nome>` cria o arquivo com o timestamp correto.
2. `npx supabase db reset` para validar localmente.
3. Commit em `dev` e merge em `main`.
4. `npx supabase link --project-ref fmhzbhiithwmbjfvblhw` (uma vez; pede a senha do banco).
5. `npx supabase migration list --linked` e `npx supabase db push --dry-run` antes do `npx supabase db push`.
6. Regenere `lib/supabase/database.types.ts` pelo MCP/dashboard depois do push.

Nunca rode `db reset` contra o projeto remoto. Migrations aplicadas via MCP recebem o timestamp atual como versão — renomeie o arquivo local para casar, ou prefira o fluxo acima.

Para aplicar no staging (sem `link`, direto pela URI em `~/.config/trilha/staging.env`):

```bash
npx supabase db push --db-url "<SUPABASE_STAGING_DB_URL>" [--include-seed]
```

## Stack quirks

- Next.js 16.3.4 App Router + React 19.2.8. Before writing Next-specific code, read the bundled docs under `node_modules/next/dist/docs/`; v16 APIs and conventions differ from older training data.
- Tailwind CSS v4: no `tailwind.config.*`; theme tokens live in `app/globals.css` and are imported via `@import "tailwindcss"`.
- shadcn/ui uses the `base-nova` style on `@base-ui/react`, not Radix. Add components with `npx shadcn@latest add <name>`; config is in `components.json`. Treat `components/ui/*` as generated.
- Use `cn` via `@/lib/utils`; it re-exports the `cn` package. `clsx`/`tailwind-merge` are not installed.
- Path alias `@/*` maps to the project root (`./*`), not a `src/` directory.
- Client components require `"use client"`; most `app/*/page.tsx` files are currently server components.
- `instrumentation-client.ts` (raiz) faz um patch **dev-only** em `performance.measure` para silenciar o `TypeError: 'Page' cannot have a negative time stamp` que o React dispara quando um Server Component chama `redirect()`/`notFound()` (vercel/next.js#86060). É instrumentação de desenvolvimento; a build de produção não roda esse código. Remover quando o upstream for corrigido.

## Current state

- Auth is wired: teacher e-mail/password via `/signup` + `/login`, and students through Supabase anonymous sign-ins.
- E-mail confirmation is **off** in the Supabase project (built-in mailer is limited to 2 e-mails/hour, no custom SMTP): `signUp` returns a session and `/signup` goes straight to `/painel`. `/auth/confirm` and `/auth/error` are dormant; re-enable confirmation and the no-session branch in `components/signup-form.tsx` together if that ever changes.
- The Supabase schema is in `snake_case` (`professores`, `turmas`, `pastas`, `atividades`, `links`, `estudantes`, `aplicacoes`, `participacoes`, `progresso_estudante`, `atividade_senhas`) with RLS on every table. Migrations live in `supabase/migrations/`; the plan that produced the first ones is `/home/giulio/.opencode/plan/supabase-auth-plan.md`.
- The Supabase project is in **São Paulo (`sa-east-1`)** (`fmhzbhiithwmbjfvblhw`); `supabase/config.toml` is committed for the CLI. The Supabase MCP in this environment points at this project, so `apply_migration`, `execute_sql` and `generate_typescript_types` can be used. Fluxo de migrations, branches e ambientes: ver **Environments** acima.
- Supabase clients: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (`await cookies()`), `lib/supabase/proxy.ts` + root `proxy.ts` (session refresh, Next 16 proxy convention). Use `getClaims()` on the server, never `getSession()`.
- O login do professor expira **24h após o início da sessão** (contagem fixa, não por inatividade). A checagem fica em `lib/supabase/proxy.ts`, só em rotas `/painel*` e `/previa*`: compara `now()` com `public.session_started_at()` (RPC `security definer` que lê `auth.sessions.created_at` da própria sessão, via `session_id` do JWT) e, ao expirar, faz `signOut()` + limpa os cookies `sb-*` + redireciona para `/login?expirado=1`. Se a RPC falhar, é fail-open. Sessões anônimas dos alunos não expiram — não use `[auth.sessions] timebox` nem `config.toml`, que valem para todas as sessões (e, no caso do aluno, um novo login anônimo cria outro `estudante`/`participacao`, zerando o progresso).
- Authorization helpers are in the `private` schema (`private.current_professor_id()`, `private.professor_owns_*`, `private.estudante_participa_*`, etc.). The ownership helpers are `security definer` and exist to avoid RLS recursion between `atividades`, `aplicacoes`, `participacoes` and `progresso_estudante` — policies must use them instead of joining those tables directly. Student writes go through the `join_activity`, `update_my_progress` and `complete_link` RPCs. Teacher writes go through `set_activity_password`, `set_student_progress` and `reorder_links` plus direct table updates allowed by RLS (including saving links in bulk). The join code is checked on `/` through `validate_join_code`, granted to `anon`.
- Database types are generated: `lib/supabase/database.types.ts`. Regenerate after schema changes instead of editing by hand — but note the CLI generator (`supabase gen types`) emits a different format than the dashboard generator used for the current file, so prefer the dashboard/MCP generator when it is pointed at the right project.
- Routes: `/` join-code entry, `/aluno` student name entry, `/atividade` student activity view, `/previa/[id]` pré-visualização do professor (abre em outra aba, sem gravar progresso), `/painel` explorador de atividades/pastas (session + professor gate in `app/painel/layout.tsx`), `/painel/pastas/[id]` conteúdo de uma pasta, `/painel/lixeira`, `/painel/atividades/nova`, `/painel/atividades/[id]`, `/login`, `/signup`, `/auth/confirm`, `/auth/error`. `/painel/pastas` redireciona para `/painel`.
- The teacher dashboard is an explorer (`components/painel/explorer/`) with folder tree in `components/app-sidebar.tsx` + `components/nav-projects.tsx`, context menus, drag and drop, and a trash page. `app/painel/actions.ts` holds the CRUD/trash/duplicate server actions; forms use the `ActionForm`/`SubmitButton`/`ConfirmAction` helpers in `components/painel/`.
- Seleção existe só no explorador, compartilhada via `components/painel/selecao-context.tsx` (montado em `app/painel/layout.tsx`); a árvore da sidebar é só navegação e não guarda seleção: um clique seleciona, duplo clique abre, `Ctrl`/`Cmd` alterna, `Shift` seleciona intervalo; selecionar uma pasta inclui as subpastas dela e clicar fora dos itens limpa a seleção. A árvore da sidebar é retrátil (`flattenPastasVisiveis` em `lib/pastas.ts`): um clique expande/recolhe os filhos diretos e abre a pasta no explorador; ao navegar, só o caminho da pasta atual fica aberto (voltar um nível recolhe as subpastas). Acima das pastas raiz há um nó sintético `home` (sem linha no banco), que agrupa todas elas e navega para `/painel`. `Delete` move a seleção para a lixeira numa única leva (`trash_items`). `lib/selecao.ts` tem `itemKey`/`intervalo`/`separarChaves`. Por enquanto a seleção é só visual (nenhuma ação em lote além da lixeira).
- Exclusão é reversível: `pastas` e `atividades` têm `deleted_at` + `trash_id`; excluir uma pasta manda o conteúdo junto para a lixeira. Restauração e exclusão definitiva passam pelas RPCs `restore_trash`, `purge_trash` e `empty_trash`. Duplicação (`duplicate_pasta`, `duplicate_atividade`) copia só conteúdo (links + senha), gera uma nova entrada (código novo) e não copia progresso; a cópia nasce ativa, como qualquer atividade criada.
- Model: an **atividade** is the content (links + password + folder). Cada atividade tem uma única **entrada**: uma linha em `aplicacoes` (com `turma_id = null`) criada automaticamente com a atividade, que guarda o código de entrada e a data de criação. `turmas` continua no schema para uma versão futura, mas nada no app a usa. A student joins with the entry code; the name/nick they type is stored on `participacoes.nome`, so each activity has its own roster. Progress is keyed by `participacao_id` + `link_id`.
- Activity lifecycle: a atividade nasce **ativa** — `atividades.status = 'publicada'` + `publicada_em`, e a entrada em `aplicacoes` criada junto já é `aberta`. O professor encerra/reabre tudo de uma vez pelo botão da aba Alunos (ou pelo menu do explorador), que chama a RPC `set_atividade_ativa`: encerrar = `rascunho` + `publicada_em = null` + entradas `encerradas`; reabrir = `publicada` + `publicada_em = now()` + entradas `abertas`. Não há mais publicar separado de abrir/encerrar, nem exigência de link para publicar (a atividade pode nascer vazia). `validate_join_code` exige atividade publicada **e** entrada aberta, então encerrar invalida o código; `complete_link` só olha a entrada. A senha é bcrypt-hashed em `atividade_senhas` (set via `set_activity_password`) e é compartilhada por todas as entradas da atividade.
- Criação e edição usam o mesmo editor (`AtividadeCabecalho` + `AtividadeTabsList`): abas **Configurações → Alunos**, abrindo em Configurações. Na criação, `Alunos` aparece desabilitada (o código de entrada só existe depois de criar) e há um único botão “Criar atividade”; ao criar, o app redireciona para `/painel/atividades/[id]`. A aba Configurações traz o card de links (textarea) acima do card de senha; o botão `Salvar links` fica nele, ao lado de `Pré-visualizar`, e o topo mostra só `Excluir`; encerrar/reabrir a atividade fica na aba Alunos, junto do código de entrada.
- Título e subtítulo são editados no próprio cabeçalho (`AtividadeDadosInline`), tanto na criação quanto na edição: clique no texto, Enter ou sair do campo salva, Esc descarta. Na edição cada campo salva sozinho via `updateAtividade` (que atualiza só os campos enviados no `FormData`) e a aba Configurações fica só com a senha de liberação; na criação os valores vão em inputs ocultos do formulário.
- A senha de liberação também é gravada em texto em `atividade_senhas.senha_texto` (a validação continua usando `senha_hash`), para o professor poder consultá-la na aba Configurações. A policy de `atividade_senhas` restringe a leitura ao dono da atividade; atividades criadas antes da migration `20261022194512_atividade_senha_visivel.sql` ficam com `senha_texto = null` e precisam definir uma nova senha para exibi-la. `duplicate_atividade`/`duplicate_pasta` copiam a coluna.
- Student progress: clicking a link marks it `fazendo` via `update_my_progress`; to finish it the student types the activity password in `components/inline-password-form.tsx`, rendered inline no rodapé do cartão em andamento (campo mascarado com `-webkit-text-security`, sem `type="password"` para o Chrome não oferecer salvar senha). O campo recebe foco ao voltar para a aba (`visibilitychange`, só o primeiro campo habilitado) e, em senha incorreta, mostra o erro inline e bloqueia novas tentativas por 3s. `complete_link` marks the current link `concluida`, opens the next one and sets `participacoes.concluido_em` when everything is done. Teachers can override status and set `pontuacao` per participation/link through `set_student_progress`. Na aba Alunos, a situação é salva assim que o select muda; salvar uma nota não vazia conclui o link e abre a próxima etapa `bloqueada`, como no fluxo do aluno. `links.ordem` is unique per activity and reordered only through `reorder_links`.
- A tela do aluno também escuta Realtime: `components/student-activity-realtime.tsx` assina `progresso_estudante` (filtrado por `participacao_id`) e `aplicacoes` (filtrado por `id`) e chama `router.refresh()`. Assim, mudanças de status/nota feitas pelo professor e o encerramento/reabertura da atividade aparecem sem recarregar a página. As tabelas estão na publication `supabase_realtime`.
- Anonymous sign-ins must stay enabled in every Supabase project (dashboard: Authentication > Sign In / Providers; local: `enable_anonymous_sign_ins` em `supabase/config.toml`), otherwise `signInAnonymously()` fails with `anonymous_provider_disabled`. O rate limit padrão (30 logins anônimos por hora por IP) estoura com uma turma inteira no mesmo Wi-Fi — suba em Authentication > Rate Limits.
- User-facing copy is Brazilian Portuguese; keep new UI text in pt-BR.
- Progress statuses are `"aberta" | "fazendo" | "concluida" | "bloqueada"` in `components/clickable-card.tsx`. Activity status is `"rascunho" | "publicada" | "arquivada"` on `atividades.status` and application status is `"aberta" | "encerrada"` on `aplicacoes.status`; os dois andam juntos (rascunho ↔ encerrada, publicada ↔ aberta) e o valor `arquivada` não é usado pelo app.
- Dark mode is class-based via `next-themes`; pressing `d` outside form fields toggles it (`components/theme-provider.tsx`).

## Conventions

- TypeScript `strict` is enabled.
- URLs de links passam por `normalizeHttpUrl` (`lib/links.ts`): aceitam `google.com`, `www.google.com` e `https://...` (o esquema é assumido como `https`). Campos de URL usam `type="text"` + `inputMode="url"`, não `type="url"`, para o navegador não bloquear endereços sem esquema.
- A edição dos links da atividade é um textarea (`components/painel/links-textarea.tsx`): um link por linha, na ordem em que o aluno deve fazer. Linhas em branco e marcadores de lista são ignorados; a ordem das linhas é a ordem final. Ao salvar, `updateLinks` concilia a lista com os links existentes por `href` (preservando ids e progresso), busca títulos automaticamente (`lookupLinkTitles` em `lib/link-preview.ts`, com timeout de 6s, limite de 512 KB, até 4 redirects e bloqueio de hosts privados) e finaliza a ordem via `reorder_links`. O rascunho fica em `LinksDraftProvider`; `LinksProtectedTabs` intercepta a troca de abas e `UnsavedChangesGuard` intercepta links internos e botões de navegação da sidebar (`data-nav-href`) com um AlertDialog quando há alterações não salvas (fechar/atualizar a aba usa o `beforeunload` nativo) e o botão `Salvar links` usa a variante primária (azul).
- A pré-visualização da atividade é aberta em outra aba pelo botão do card de links em Configurações (`components/painel/preview-activity-button.tsx`) em `/previa/[id]`. Ela reproduz a visão do aluno com o primeiro link aberto e os demais bloqueados, mas não grava progresso. O botão avisa quando há links não salvos: a prévia sempre mostra a última versão salva.
- Consultas do aluno a `participacoes`/`progresso_estudante` devem filtrar explicitamente pelo próprio `estudante_id`/`participacao_id`. Não confie só na RLS para `maybeSingle()`: uma policy permissiva faz o PostgREST devolver `PGRST116` (várias linhas) e a página trata como “sem registro”, devolvendo o aluno para `/aluno`.
- Match Prettier output: no semicolons, double quotes, 2-space indent, 80 columns. Run `npm run format` before finishing.
- `.next/`, `next-env.d.ts`, and `*.tsbuildinfo` are generated/ignored; never edit them by hand.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
