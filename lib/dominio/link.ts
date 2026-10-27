import { z } from "zod"

import { LINKS_TEXTO_MAX } from "@/lib/dominio/limites"

/**
 * Texto cru do textarea: um link por linha. O limite é de bytes/caracteres
 * brutos e vale antes do parse, para não processar uma entrada gigante.
 */
export const linksTexto = z
  .string()
  .max(
    LINKS_TEXTO_MAX,
    `O texto dos links é muito grande (máximo de ${LINKS_TEXTO_MAX / 1024} KB).`
  )
  .optional()
  .default("")
