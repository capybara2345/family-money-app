"use client"

import type { ReactNode } from "react"

type GameType = "lotto" | "pension"

export function GameSwitcher({
  active,
  onChange,
}: {
  active: GameType
  onChange: (game: GameType) => void
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      <button
        type="button"
        onClick={() => onChange("lotto")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          active === "lotto"
            ? "bg-white text-violet-700 shadow-sm dark:bg-zinc-900 dark:text-violet-300"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
        }`}
      >
        로또 6/45
      </button>
      <button
        type="button"
        onClick={() => onChange("pension")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          active === "pension"
            ? "bg-white text-amber-700 shadow-sm dark:bg-zinc-900 dark:text-amber-300"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
        }`}
      >
        연금복권 720+
      </button>
    </div>
  )
}

export function GameSwitcherSlot({ children }: { children: ReactNode }) {
  return <div className="w-full sm:w-auto">{children}</div>
}
