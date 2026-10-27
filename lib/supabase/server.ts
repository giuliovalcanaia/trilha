import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { cache } from "react"

import { env } from "@/lib/env"
import type { Database } from "./database.types"

/**
 * Um cliente por requisição. O `cache` do React deduplica chamadas feitas por
 * layout, page e server actions dentro da mesma requisição.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component: o proxy renova a sessão.
          }
        },
      },
    }
  )
})

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>
