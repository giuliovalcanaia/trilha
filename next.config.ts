import type { NextConfig } from "next"

/**
 * Cabeçalhos de segurança aplicados a todas as rotas.
 *
 * A CSP é propositalmente mínima: só `frame-ancestors`, que impede embutir o
 * app em iframe. Uma CSP completa precisaria liberar os scripts inline do Next
 * e o websocket do Supabase Realtime, e aí viraria uma lista de exceções que
 * não protege muito mais do que isso — o ganho real aqui é barrar clickjacking.
 */
const cabecalhosSeguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // X-Frame-Options cobre navegadores antigos; a CSP cobre os atuais.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
]

// Só em produção: o navegador fixa o HTTPS por um ano, o que atrapalharia o
// desenvolvimento local em http.
const cabecalhoHsts = {
  key: "Strict-Transport-Security",
  value: "max-age=31536000; includeSubDomains",
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers:
          process.env.NODE_ENV === "production"
            ? [...cabecalhosSeguranca, cabecalhoHsts]
            : cabecalhosSeguranca,
      },
    ]
  },
}

export default nextConfig
