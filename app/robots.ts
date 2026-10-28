import type { MetadataRoute } from "next"

/**
 * O Trilha não tem conteúdo público para indexar: a entrada é um formulário de
 * código, o painel exige sessão de professor e a atividade exige o código da
 * turma. Crawlers ganham pouco e só atrapalham (cada visita anônima cria uma
 * sessão no Supabase).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/painel",
          "/atividade",
          "/aluno",
          "/previa",
          "/login",
          "/signup",
          "/auth",
        ],
      },
    ],
  }
}
