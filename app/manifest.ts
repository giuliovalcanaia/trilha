import type { MetadataRoute } from "next"

/**
 * Manifest de instalação (PWA). Não declaramos service worker: o app depende
 * do servidor em todas as telas, então o escopo aqui é só permitir instalar —
 * sem cache offline, o navegador mostra a página de erro dele quando a rede cai.
 *
 * `theme_color` aceita um valor único (não varia com o tema): usamos preto,
 * que não destoa em nenhum dos dois esquemas.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Trilha",
    short_name: "Trilha",
    description:
      "Monte atividades em sequência, compartilhe o código de entrada e acompanhe o progresso dos alunos em tempo real.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    categories: ["education"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Fundo cheio: o Android recorta o ícone maskable numa forma própria e
        // só garante o círculo interno (80%), por isso o glifo vem menor.
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
