"use client"

import { useState } from "react"
import type { LottoDraw } from "@/lib/lotto"
import type { PensionDraw } from "@/lib/pension"
import { LottoContent } from "./lotto-content"
import { PensionContent } from "./pension-content"
import { GameSwitcher } from "./game-switcher"

type LottoMeta = { updatedAt: string; maxRound: number; count: number }

export function LottoPageClient({
  lottoDraws,
  lottoMeta,
  pensionDraws,
  pensionMeta,
}: {
  lottoDraws: LottoDraw[]
  lottoMeta: LottoMeta
  pensionDraws: PensionDraw[]
  pensionMeta: LottoMeta
}) {
  const [game, setGame] = useState<"lotto" | "pension">("lotto")
  const switcher = <GameSwitcher active={game} onChange={setGame} />

  if (game === "pension") {
    return <PensionContent draws={pensionDraws} meta={pensionMeta} gameSwitcher={switcher} />
  }

  return <LottoContent draws={lottoDraws} meta={lottoMeta} gameSwitcher={switcher} />
}
