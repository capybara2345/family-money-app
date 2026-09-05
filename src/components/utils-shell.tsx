"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Wrench, FileText, ChartColumn, KeyRound, LogOut } from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import { AppNav } from "@/components/app-nav"
import {
  FamilyPanelProvider,
  FamilyHeaderActions,
} from "@/components/family-panel"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const subItems = [
  { href: "/utils/md", label: "MD 뷰어", icon: FileText },
  { href: "/utils/chart", label: "그래프 뷰어", icon: ChartColumn },
  { href: "/utils/crypto", label: "암복호화", icon: KeyRound },
]

export function UtilsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AuthGate>
      <FamilyPanelProvider>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
          <header className="border-b bg-white print:hidden dark:bg-zinc-900 dark:border-zinc-800">
            <div className="mx-auto max-w-7xl px-3 sm:px-4 py-3 sm:py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Wrench className="h-6 w-6 shrink-0 text-teal-600" />
                  <div>
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight">유틸</h1>
                    <p className="text-xs text-zinc-500">문서·그래프·암복호화 도구</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <AppNav />
                  <FamilyHeaderActions />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    title="로그아웃"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <nav className="mt-3 flex gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
                {subItems.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-white text-teal-700 shadow-sm dark:bg-zinc-900 dark:text-teal-300"
                          : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6">{children}</main>
        </div>
      </FamilyPanelProvider>
    </AuthGate>
  )
}
