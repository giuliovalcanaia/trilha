import { ImageResponse } from "next/og"

export const alt =
  "Trilha — atividades em sequência, progresso em tempo real dos alunos"

export const size = { width: 1200, height: 630 }

export const contentType = "image/png"

const passos = [
  {
    titulo: "Daily Routines",
    status: "Concluído",
    cor: "#047857",
    fundo: "#ecfdf5",
    borda: "#a7f3d0",
  },
  {
    titulo: "Simple Past",
    status: "Em andamento",
    cor: "#b45309",
    fundo: "#fffbeb",
    borda: "#fde68a",
  },
  {
    titulo: "Listening Practice",
    status: "Bloqueado",
    cor: "#64748b",
    fundo: "#f1f5f9",
    borda: "#e2e8f0",
  },
]

/**
 * Imagem do link compartilhado (WhatsApp, Twitter/X, Slack...).
 *
 * Segue o tema claro do app. É gerada no build (`ImageResponse`) e fica em
 * cache, então não pesa no runtime.
 */
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "64px 72px",
        background: "#f8fafc",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "#2563eb",
            color: "#ffffff",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          T
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: -0.5,
          }}
        >
          Trilha
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          gap: 44,
          marginTop: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 48,
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.15,
              letterSpacing: -1.2,
            }}
          >
            Atividades em sequência,
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 48,
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.15,
              letterSpacing: -1.2,
            }}
          >
            progresso em tempo real.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 26,
              color: "#475569",
              lineHeight: 1.4,
            }}
          >
            Monte a trilha de links, compartilhe o código e acompanhe cada
            aluno.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            width: 336,
          }}
        >
          {passos.map((passo) => (
            <div
              key={passo.titulo}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 20px",
                borderRadius: 16,
                border: `2px solid ${passo.borda}`,
                background: passo.fundo,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                {passo.titulo}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 16,
                  fontWeight: 600,
                  color: passo.cor,
                }}
              >
                {passo.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 22,
          color: "#64748b",
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>Next.js · Supabase · RLS</div>
        <div style={{ display: "flex" }}>o aluno entra sem conta</div>
      </div>
    </div>,
    size
  )
}
