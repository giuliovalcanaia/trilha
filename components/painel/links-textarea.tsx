import { Textarea } from "@/components/ui/textarea"
import { LINKS_TEXTO_MAX } from "@/lib/dominio/limites"

type LinksTextareaProps = {
  id?: string
  form?: string
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
}

/**
 * Lista de links da atividade: um link por linha, na ordem em que o aluno deve
 * fazer. Linhas em branco e marcadores de lista são ignorados no servidor.
 */
export function LinksTextarea({
  id = "links-texto",
  form,
  defaultValue,
  value,
  onChange,
  disabled = false,
  autoFocus = false,
}: LinksTextareaProps) {
  return (
    <Textarea
      id={id}
      name="links_texto"
      form={form}
      value={value}
      defaultValue={value === undefined ? defaultValue : undefined}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      disabled={disabled}
      maxLength={LINKS_TEXTO_MAX}
      rows={10}
      autoFocus={autoFocus}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
      placeholder={
        "https://exemplo.com/exercicio-1\n\nhttps://exemplo.com/exercicio-2"
      }
      className="max-h-[60vh] min-h-56 overflow-y-auto font-mono text-sm leading-relaxed"
    />
  )
}
