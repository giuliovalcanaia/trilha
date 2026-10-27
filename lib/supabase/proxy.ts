import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { env } from "@/lib/env"
import type { Database } from "./database.types"

const PROTECTED_PREFIXES = ["/painel", "/previa"]

// O login do professor dura 24 horas a partir do início da sessão. Alunos
// anônimos não são afetados.
const PROFESSOR_SESSION_TTL_MS = 24 * 60 * 60 * 1000

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isProfessorSessionExpired(startedAt: string | null) {
  if (!startedAt) return false

  const started = Date.parse(startedAt)

  if (Number.isNaN(started)) return false

  return Date.now() - started >= PROFESSOR_SESSION_TTL_MS
}

// Remove os cookies de auth do Supabase (inclusive os fatiados, `.0`, `.1`, ...)
// mesmo quando o signOut não consegue falar com o servidor.
function deleteSupabaseCookies(request: NextRequest, response: NextResponse) {
  request.cookies
    .getAll()
    .filter((cookie) => cookie.name.startsWith("sb-"))
    .forEach((cookie) => response.cookies.delete(cookie.name))
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          response = NextResponse.next({ request })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Renova a sessão (se necessário) e valida o JWT. Não usar getSession() aqui.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  // Expiração do login do professor: 24h contadas do início da sessão.
  // Falha na RPC não derruba o professor (fail-open).
  if (claims && isProtectedPath(request.nextUrl.pathname)) {
    const { data: sessionStartedAt } = await supabase.rpc("session_started_at")

    if (isProfessorSessionExpired(sessionStartedAt ?? null)) {
      await supabase.auth.signOut()

      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.search = ""
      url.searchParams.set("expirado", "1")

      const redirectResponse = NextResponse.redirect(url)
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      deleteSupabaseCookies(request, redirectResponse)

      return redirectResponse
    }
  }

  if (!claims && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""

    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })

    return redirectResponse
  }

  // A resposta pode carregar cookies de sessão: nunca deixar em cache.
  response.headers.set("Cache-Control", "private, no-store")
  response.headers.set("Pragma", "no-cache")
  response.headers.set("Expires", "0")

  return response
}
