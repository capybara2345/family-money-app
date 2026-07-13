import type { PensionDraw, PensionDrawsData } from "@/lib/pension"
import pensionDrawsJson from "@/data/pension-draws.json"

const data = pensionDrawsJson as PensionDrawsData

export function getPensionDrawsData(): PensionDrawsData {
  return data
}

export function getAllPensionDraws(): PensionDraw[] {
  return data.draws
}

export function getPensionDraw(round: number): PensionDraw | undefined {
  return data.draws.find((d) => d.round === round)
}

export function getPensionDataMeta() {
  return {
    updatedAt: data.updatedAt,
    maxRound: data.maxRound,
    count: data.draws.length,
  }
}
