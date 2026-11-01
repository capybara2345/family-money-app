"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toggleTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn("h-8 w-8 shrink-0", className)}
      onClick={toggleTheme}
      title="화면 테마 전환"
      aria-label="화면 테마 전환"
    >
      <Sun className="hidden dark:block" aria-hidden />
      <Moon className="dark:hidden" aria-hidden />
    </Button>
  )
}
