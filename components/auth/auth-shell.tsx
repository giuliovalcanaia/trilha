import { CheckCircle2Icon, GalleryVerticalEndIcon } from "lucide-react"
import Link from "next/link"

const destaques = [
  "Monte atividades com links em sequência.",
  "Compartilhe um código de entrada com a turma.",
  "Acompanhe o progresso dos alunos em tempo real.",
]

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <Link href="/" className="flex items-center gap-2 font-medium">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEndIcon className="size-4" />
          </span>
          Trilha
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,oklch(1_0_0/0.16),transparent_55%)]"
        />
        <div className="relative space-y-4">
          <p className="text-xs font-medium tracking-[0.2em] uppercase opacity-70">
            Trilha
          </p>
          <h2 className="max-w-sm text-3xl leading-tight font-semibold">
            Atividades em sequência, acompanhamento em tempo real.
          </h2>
          <p className="max-w-sm text-sm opacity-80">
            Organize suas aulas em pastas, publique com um código e veja cada
            aluno avançar link por link.
          </p>
        </div>

        <ul className="relative space-y-3 text-sm">
          {destaques.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 opacity-80" />
              <span className="opacity-90">{item}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
