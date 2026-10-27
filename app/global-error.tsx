"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          alignItems: "center",
          background: "Canvas",
          color: "CanvasText",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "1rem",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>
            Algo deu errado
          </h1>
          <p style={{ lineHeight: 1.6, opacity: 0.75 }}>
            Não foi possível carregar o aplicativo. Tente novamente.
          </p>
          {error.digest ? (
            <p style={{ fontSize: "0.75rem", opacity: 0.5 }}>
              Código do erro: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "CanvasText",
              border: 0,
              borderRadius: "0.5rem",
              color: "Canvas",
              cursor: "pointer",
              fontWeight: 600,
              marginTop: "1.25rem",
              padding: "0.6rem 1rem",
            }}
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  )
}
