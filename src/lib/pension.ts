export const PENSION_MAX_ROUND = 323

export type PensionDraw = {
  round: number
  date: string
  group: number
  number: string
  bonus: string
}

export type PensionDrawsData = {
  updatedAt: string
  maxRound: number
  draws: PensionDraw[]
}

export function formatPensionDate(ymd: string): string {
  if (ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

export function padPensionNumber(value: string | number): string {
  return String(value).padStart(6, "0").slice(-6)
}

export function parsePensionListItem(item: {
  psltEpsd: number
  psltRflYmd: string
  wnBndNo: string
  wnRnkVl: string
  bnsRnkVl: string
}): PensionDraw {
  return {
    round: item.psltEpsd,
    date: formatPensionDate(item.psltRflYmd),
    group: Number(item.wnBndNo),
    number: padPensionNumber(item.wnRnkVl),
    bonus: padPensionNumber(item.bnsRnkVl),
  }
}

export function splitDigits(number: string): number[] {
  return padPensionNumber(number).split("").map(Number)
}

export function formatPensionTicket(group: number, number: string): string {
  return `${group}조 ${padPensionNumber(number)}`
}

export const DIGIT_LABELS = ["십만", "만", "천", "백", "십", "일"] as const
