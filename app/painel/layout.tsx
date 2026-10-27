import { AppSidebar } from "@/components/layout/app-sidebar"
import { SelecaoProvider } from "@/components/painel/selecao-context"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { requireProfessor } from "@/lib/auth/professor"
import { pastasComRaizesVisiveis } from "@/lib/dominio/pastas"

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Sem sessão vai para /login; aluno anônimo volta para a entrada. O
  // `requireProfessor` nunca manda um aluno anônimo para /login, para não
  // criar loop com o proxy.
  const { supabase, professor, email } = await requireProfessor()

  const [
    { data: pastas },
    { count: pastasNaLixeira },
    { count: atividadesNaLixeira },
    { data: atividadePastas },
  ] = await Promise.all([
    supabase
      .from("pastas")
      .select("id, nome, parent_id")
      .is("deleted_at", null)
      .order("nome"),
    supabase
      .from("pastas")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    supabase
      .from("atividades")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    supabase
      .from("atividades")
      .select("id, pasta_id")
      .is("deleted_at", null)
      .not("pasta_id", "is", null),
  ])

  const pastasVisiveis = pastasComRaizesVisiveis(pastas ?? [])

  return (
    <SelecaoProvider pastas={pastasVisiveis}>
      <SidebarProvider>
        <AppSidebar
          professor={professor}
          email={email}
          pastas={pastasVisiveis}
          atividadePastas={atividadePastas ?? []}
          trashCount={(pastasNaLixeira ?? 0) + (atividadesNaLixeira ?? 0)}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>Painel</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </SelecaoProvider>
  )
}
