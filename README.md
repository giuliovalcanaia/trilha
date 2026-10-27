# Trilha

Plataforma para montar atividades em sequência e acompanhar o progresso dos
alunos em tempo real.

O professor organiza as atividades em pastas, compartilha um código de entrada e
acompanha em qual etapa cada aluno está. O aluno entra sem conta: digita o nome,
percorre os links na ordem definida e libera cada etapa com a senha da atividade.

## Funcionalidades

- **Explorador de atividades e pastas** com árvore na sidebar, busca global,
  seleção múltipla, arrastar e soltar, renomear, mover e duplicar.
- **Editor de atividade** com links em sequência, senha de liberação, ordem dos
  links e opção de embaralhar a ordem por aluno.
- **Código de entrada** por atividade, com encerramento e reabertura.
- **Área do aluno** sem cadastro, com progresso por link, nota opcional e
  liberação por senha.
- **Acompanhamento em tempo real** dos alunos e do progresso via Supabase
  Realtime.
- **Lixeira reversível** com restauração e exclusão definitiva.
- **Compartilhamento de pastas** entre professores, com acesso de editor.
- **Expulsão de aluno** com reinício do progresso ao entrar de novo.
- **Tema claro/escuro** (tecla `d` fora de campos de formulário).

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, Turbopack) e
  React 19
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
  sobre [Base UI](https://base-ui.com)
- [Supabase](https://supabase.com): Auth (professor por e-mail/senha e aluno
  anônimo), Postgres com RLS e Realtime
- TypeScript estrito, ESLint e Prettier

## Como rodar localmente

Requisitos: **Node.js 20+**, Docker e a CLI do Supabase.

```bash
# 1. dependências
npm install

# 2. stack local do Supabase (API, banco e Studio)
npx supabase start

# 3. variáveis de ambiente
cp .env.example .env.local
# preencha com a URL e a publishable key impressas por `npx supabase status`

# 4. aplica as migrations e o seed
npx supabase db reset

# 5. app
npm run dev
```

A URL do app é impressa no terminal (por padrão, `http://localhost:3000`). O
Supabase local expõe a API em `http://127.0.0.1:54321` e o Studio em
`http://127.0.0.1:54323`.

### Credenciais do seed

O `supabase/seed.sql` cria dados de teste no ambiente local:

| Quem | Credencial |
| --- | --- |
| Professor | `professor@trilha.test` / `senha123` |
| Professor (compartilhamento) | `professor2@trilha.test` / `senha123` |
| Atividade de exemplo | “Daily Routines”, entrada `TESTE1`, liberação `aula123` |

> Essas credenciais só existem no stack local. Nunca rode `supabase db reset`
> contra o projeto remoto.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (com checagem de tipos) |
| `npm run start` | Sobe o build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier em `**/*.{ts,tsx}` |
| `npm run format:check` | Confere a formatação sem alterar arquivos |
| `npm run db:reset` | Recria o banco local com migrations + seed |

## Estrutura

```
app/                     rotas (App Router)
  aluno/                 entrada do aluno
  atividade/             visão do aluno
  painel/                área do professor
    actions.ts           server actions do painel
  previa/                pré-visualização da atividade
components/
  aluno/                 componentes da área do aluno
  auth/                  login, cadastro e shell de autenticação
  layout/                sidebar, navegação, tema
  painel/                componentes do painel
  ui/                    componentes gerados pelo shadcn/ui
hooks/                   hooks reutilizáveis
lib/
  dominio/               regras puras (links, notas, pastas, seleção)
  painel/                carregamento de dados do painel
  supabase/              clientes browser/server e tipos do banco
  env.ts                 validação das variáveis de ambiente
  format.ts              formatação de datas
supabase/
  migrations/            schema, RLS e funções
  seed.sql               dados de teste
```

## Segurança

- **RLS em todas as tabelas públicas**: o isolamento por professor e por aluno
  é aplicado no banco, não só na interface.
- Helpers de autorização no schema `private`, com `security definer` e
  `search_path = ''`.
- **Aluno anônimo** via Supabase Anonymous Sign-Ins; o progresso é vinculado à
  participação daquele aluno naquela entrada.
- Server Actions validam a sessão e os dados; a RLS é a última linha de defesa.
- Senha de liberação com **bcrypt**; a versão em texto fica visível apenas para
  o dono da atividade, para consulta no painel.
- `complete_link` valida a senha antes de gravar qualquer progresso.
- Sessão do professor expira **24 horas** após o início.
- A pré-visualização de links no servidor bloqueia hosts privados e tem limites
  de tempo, tamanho e redirecionamentos (mitigação de SSRF).

## Status e próximos passos

Projeto em desenvolvimento, usado como estudo de caso de Next.js + Supabase.

Próximos passos planejados:

- [ ] Dividir `app/painel/actions.ts` por domínio
- [ ] Validação de formulários com zod e erros tipados
- [ ] Testes de RLS com pgTAP, testes unitários com Vitest e um fluxo E2E com
      Playwright
- [ ] CI no GitHub Actions (lint, typecheck, testes e build)
- [ ] Rate limit server-side na senha da atividade
- [ ] Headers de segurança e `robots.ts`
- [ ] Screenshots e GIF no README

## Licença

MIT.
