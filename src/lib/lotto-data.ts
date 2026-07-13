import type { LottoDraw, LottoDrawsData } from "@/lib/lotto"
import lottoDrawsJson from "@/data/lotto-draws.json"

const data = lottoDrawsJson as LottoDrawsData

export function getLottoDrawsData(): LottoDrawsData {
  return data
}

export function getAllLottoDraws(): LottoDraw[] {
  return data.draws
}

export function getLottoDraw(round: number): LottoDraw | undefined {
  return data.draws.find((d) => d.round === round)
}

export function getLottoDataMeta() {
  return {
    updatedAt: data.updatedAt,
    maxRound: data.maxRound,
    count: data.draws.length,
  }
}
