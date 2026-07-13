"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wallet, Map, Dices } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "가계부", icon: Wallet },
  { href: "/places", label: "여행", icon: Map },
  { href: "/lotto", label: "복권", icon: Dices },
]

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-900 dark:text-emerald-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
