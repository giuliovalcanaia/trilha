"use client"

import { useActionState, useEffect, useRef } from "react"

import type { ActionResult } from "@/lib/actions/result"
import { toast } from "@/components/ui/toast"

type ActionFormProps = {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>
  children: React.ReactNode
  className?: string
  id?: string
  resetOnSuccess?: boolean
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function ActionForm({
  action,
  children,
  className,
  id,
  resetOnSuccess = false,
  onSuccess,
  onError,
}: ActionFormProps) {
  const [state, formAction] = useActionState(action, { error: null })
  const formRef = useRef<HTMLFormElement>(null)
  const handled = useRef<ActionResult | null>(null)

  useEffect(() => {
    if (state === handled.current) return
    handled.current = state

    if (state.error) {
      toast.add({ type: "error", title: state.error })
      onError?.(state.error)
      return
    }

    if (state.success) {
      toast.add({ type: "success", title: state.success })
      if (resetOnSuccess) formRef.current?.reset()
      onSuccess?.()
    }
  }, [state, resetOnSuccess, onSuccess, onError])

  return (
    <form ref={formRef} id={id} action={formAction} className={className}>
      {children}
    </form>
  )
}
