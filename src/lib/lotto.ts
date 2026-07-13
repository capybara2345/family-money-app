export const LOTTO_MAX_ROUND = 1232

export type LottoDraw = {
  round: number
  date: string
  numbers: [number, number, number, number, number, number]
  bonus: number
  firstPrize?: number
  firstWinners?: number
  totalSales?: number
}

export type LottoDrawsData = {
  updatedAt: string
  maxRound: number
  draws: LottoDraw[]
}

export function formatLottoDate(ymd: string): string {
  if (ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

export function parseDhLotteryItem(item: {
  ltEpsd: number
  tm1WnNo: number
  tm2WnNo: number
  tm3WnNo: number
  tm4WnNo: number
  tm5WnNo: number
  tm6WnNo: number
  bnsWnNo: number
  ltRflYmd: string
  rnk1WnAmt?: number
  rnk1WnNope?: number
  rlvtEpsdSumNtslAmt?: number
}): LottoDraw {
  return {
    round: item.ltEpsd,
    date: formatLottoDate(item.ltRflYmd),
    numbers: [item.tm1WnNo, item.tm2WnNo, item.tm3WnNo, item.tm4WnNo, item.tm5WnNo, item.tm6WnNo],
    bonus: item.bnsWnNo,
    firstPrize: item.rnk1WnAmt || undefined,
    firstWinners: item.rnk1WnNope || undefined,
    totalSales: item.rlvtEpsdSumNtslAmt || undefined,
  }
}

export function getDrawByRound(draws: LottoDraw[], round: number): LottoDraw | undefined {
  return draws.find((d) => d.round === round)
}

export function getLatestDraw(draws: LottoDraw[]): LottoDraw | undefined {
  if (draws.length === 0) return undefined
  return draws.reduce((latest, draw) => (draw.round > latest.round ? draw : latest))
}
