import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { Toaster } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// `NEXT_PUBLIC_SITE_URL` permite apontar para um domínio próprio; na Vercel o
// domínio de produção já vem em `VERCEL_PROJECT_PRODUCTION_URL`.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")

const descricao =
  "Monte atividades em sequência, compartilhe o código de entrada e acompanhe o progresso dos alunos em tempo real."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Trilha",
  title: {
    default: "Trilha",
    template: "%s · Trilha",
  },
  description: descricao,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Trilha",
    title: "Trilha",
    description: descricao,
  },
  twitter: {
    card: "summary_large_image",
    title: "Trilha",
    description: descricao,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
