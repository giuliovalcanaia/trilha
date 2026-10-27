export type ActionResult = {
  error: string | null
  success?: string | null
  trashId?: string | null
}

export function fail(error: string): ActionResult {
  return { error }
}

export function ok(success: string, trashId?: string): ActionResult {
  return { error: null, success, trashId }
}
