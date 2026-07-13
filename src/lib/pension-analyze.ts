import type { PensionDraw } from "@/lib/pension"
import { padPensionNumber, splitDigits } from "@/lib/pension"

export type PensionFrequencyRange = "all" | 50 | 100 | 200

export type PensionRecommendStrategy =
  | "hot"
  | "cold"
  | "balanced"
  | "random"
  | "unique"
  | "trend"

export type DigitFrequency = {
  digit: number
  count: number
}

export type PositionFrequency = {
  position: number
  label: string
  digits: DigitFrequency[]
}

export type GroupFrequency = {
  group: number
  count: number
}

export type PensionTicket = {
  group: number
  number: string
}

export type PensionRankMatch = {
  round: number
  date: string
  group: number
  number: string
  bonus: string
  rank: number
  suffixMatch: number
}

export type PensionCompareSummary = {
  rank1: number
  rank2: number
  rank3: number
  rank4: number
  rank5: number
  rank6: number
  rank7: number
  none: number
}

export type PensionCompareResult = {
  summary: PensionCompareSummary
  matches: PensionRankMatch[]
}

export type PensionTrendAnalysis = {
  recentRounds: number[]
  candidates: PensionTicket[]
  groupFreq: GroupFrequency[]
  insights: string[]
}

const RANK_LABELS: Record<number, string> = {
  1: "1등 (조+6자리 일치)",
  2: "2등 (6자리 일치)",
  3: "3등 (끝 5자리)",
  4: "4등 (끝 4자리)",
  5: "5등 (끝 3자리)",
  6: "6등 (끝 2자리)",
  7: "7등 (끝 1자리)",
}

const DIGIT_LABELS = ["십만", "만", "천", "백", "십", "일"]
const RECENT_TREND_COUNT = 20
/** 자리별 후보: 최근 N회차에서 이 횟수 이하로만 나온 숫자 (0=미출현, 1=1회 출현) */
const TREND_DIGIT_MAX_COUNT = 1
export const PENSION_CANDIDATE_SIZE = 5

export function getPensionRankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? "낙첨"
}

export function filterPensionDrawsByRange(
  draws: PensionDraw[],
  range: PensionFrequencyRange
): PensionDraw[] {
  if (range === "all") return draws
  return draws.slice(-range)
}

export function suffixMatchLength(a: string, b: string): number {
  const left = padPensionNumber(a)
  const right = padPensionNumber(b)
  let count = 0
  for (let i = 5; i >= 0; i--) {
    if (left[i] === right[i]) count++
    else break
  }
  return count
}

export function getPensionRank(group: number, number: string, draw: PensionDraw): number {
  const suffix = suffixMatchLength(number, draw.number)
  const sameGroup = group === draw.group
  if (suffix === 6 && sameGroup) return 1
  if (suffix === 6) return 2
  if (suffix === 5) return 3
  if (suffix === 4) return 4
  if (suffix === 3) return 5
  if (suffix === 2) return 6
  if (suffix === 1) return 7
  return 0
}

function getRareDigitsByPosition(positionFreq: PositionFrequency[]): number[][] {
  return positionFreq.map((pos) =>
    pos.digits.filter((d) => d.count <= TREND_DIGIT_MAX_COUNT).map((d) => d.digit)
  )
}

function buildRareDigitNumber(
  positionFreq: PositionFrequency[],
  rareByPos: number[][]
): string {
  const digits: number[] = []
  for (let p = 0; p < positionFreq.length; p++) {
    let pool = rareByPos[p]
    if (pool.length === 0) {
      const sorted = [...positionFreq[p].digits].sort((a, b) => a.count - b.count)
      pool = sorted.slice(0, 3).map((d) => d.digit)
    }
    digits.push(pickDigit(pool))
  }
  return digits.join("")
}

function generateRareDigitTickets(draws: PensionDraw[], setCount: number): PensionTicket[] {
  const recent = draws.slice(-RECENT_TREND_COUNT)
  const groupFreq = computeGroupFrequencies(recent)
  const positionFreq = computePositionFrequencies(recent)
  const rareByPos = getRareDigitsByPosition(positionFreq)
  const used = new Set<string>()
  const tickets: PensionTicket[] = []

  for (let i = 0; i < setCount; i++) {
    let number = ""
    for (let attempt = 0; attempt < 50; attempt++) {
      number = buildRareDigitNumber(positionFreq, rareByPos)
      if (!used.has(number)) break
    }
    used.add(number)
    tickets.push({
      group: pickGroup(groupFreq, "balanced"),
      number,
    })
  }
  return tickets
}

export function computeGroupFrequencies(draws: PensionDraw[]): GroupFrequency[] {
  const counts = [0, 0, 0, 0, 0, 0]
  for (const draw of draws) counts[draw.group]++
  return [1, 2, 3, 4, 5].map((group) => ({ group, count: counts[group] }))
}

export function computePositionFrequencies(draws: PensionDraw[]): PositionFrequency[] {
  return DIGIT_LABELS.map((label, position) => {
    const counts = Array.from({ length: 10 }, (_, digit) => ({ digit, count: 0 }))
    for (const draw of draws) {
      const digits = splitDigits(draw.number)
      counts[digits[position]].count++
    }
    return { position, label, digits: counts }
  })
}

function shuffle<T>(arr: T[]): T[] {
  const items = [...arr]
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

function pickDigit(pool: number[], exclude: number[] = []): number {
  const available = pool.filter((d) => !exclude.includes(d))
  if (available.length === 0) return Math.floor(Math.random() * 10)
  return available[Math.floor(Math.random() * available.length)]
}

function buildNumberFromPositions(
  positionFreq: PositionFrequency[],
  strategy: "hot" | "cold" | "balanced" | "random"
): string {
  const digits: number[] = []
  for (const pos of positionFreq) {
    const sorted = [...pos.digits].sort((a, b) => b.count - a.count)
    const hot = sorted.slice(0, 4).map((d) => d.digit)
    const cold = sorted.slice(-4).map((d) => d.digit)
    if (strategy === "random") {
      digits.push(pickDigit([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))
    } else if (strategy === "hot") {
      digits.push(pickDigit(hot))
    } else if (strategy === "cold") {
      digits.push(pickDigit(cold))
    } else {
      digits.push(pickDigit(digits.length < 3 ? hot : cold))
    }
  }
  return digits.join("")
}

function pickGroup(groupFreq: GroupFrequency[], strategy: "hot" | "cold" | "balanced" | "random"): number {
  const sorted = [...groupFreq].sort((a, b) => b.count - a.count)
  if (strategy === "random") return Math.floor(Math.random() * 5) + 1
  if (strategy === "hot") return sorted[0]?.group ?? 1
  if (strategy === "cold") return sorted[sorted.length - 1]?.group ?? 5
  return sorted[Math.floor(Math.random() * 3)]?.group ?? 3
}

export function analyzePensionTrend(draws: PensionDraw[]): PensionTrendAnalysis {
  const recent = draws.slice(-RECENT_TREND_COUNT)
  const groupFreq = computeGroupFrequencies(recent)
  const positionFreq = computePositionFrequencies(recent)
  const rareByPos = getRareDigitsByPosition(positionFreq)
  const candidates = generateRareDigitTickets(draws, PENSION_CANDIDATE_SIZE)

  const insights = [
    `최근 ${recent.length}회차 기준 조별 출현: ${groupFreq.map((g) => `${g.group}조 ${g.count}회`).join(", ")}`,
    ...positionFreq.map((pos, i) => {
      const rare = rareByPos[i]
      if (rare.length > 0) {
        return `${pos.label}자리 후보: ${rare.join(", ")} (${TREND_DIGIT_MAX_COUNT}회 이하 출현)`
      }
      const coldest = [...pos.digits]
        .sort((a, b) => a.count - b.count)
        .slice(0, 3)
        .map((d) => d.digit)
      return `${pos.label}자리 ${TREND_DIGIT_MAX_COUNT}회 이하 없음 → 적게 나온 숫자(${coldest.join(", ")}) 사용`
    }),
    `저빈도 숫자 조합으로 후보 ${PENSION_CANDIDATE_SIZE}세트 생성`,
  ]

  return { recentRounds: recent.map((d) => d.round), candidates, groupFreq, insights }
}

function generateTrendTickets(draws: PensionDraw[], setCount: number): PensionTicket[] {
  return generateRareDigitTickets(draws, setCount)
}

function generateUniqueTickets(draws: PensionDraw[], setCount: number): PensionTicket[] {
  const groupFreq = computeGroupFrequencies(draws)
  const positionFreq = computePositionFrequencies(draws)
  const usedNumbers = new Set<string>()
  const tickets: PensionTicket[] = []

  for (let i = 0; i < setCount; i++) {
    let number = ""
    for (let attempt = 0; attempt < 20; attempt++) {
      number = buildNumberFromPositions(positionFreq, "balanced")
      if (!usedNumbers.has(number)) break
    }
    usedNumbers.add(number)
    tickets.push({
      group: pickGroup(groupFreq, "balanced"),
      number,
    })
  }
  return tickets
}

export function generatePensionTickets(
  draws: PensionDraw[],
  strategy: PensionRecommendStrategy,
  setCount = 5
): PensionTicket[] {
  if (strategy === "trend") return generateTrendTickets(draws, setCount)
  if (strategy === "unique") return generateUniqueTickets(draws, setCount)

  const groupFreq = computeGroupFrequencies(draws)
  const positionFreq = computePositionFrequencies(draws)
  const digitStrategy =
    strategy === "hot" || strategy === "cold" || strategy === "balanced" || strategy === "random"
      ? strategy
      : "balanced"

  return Array.from({ length: setCount }, () => ({
    group: pickGroup(groupFreq, digitStrategy),
    number: buildNumberFromPositions(positionFreq, digitStrategy),
  }))
}

export function comparePensionTicket(
  draws: PensionDraw[],
  group: number,
  number: string
): PensionCompareResult {
  const padded = padPensionNumber(number)
  const summary: PensionCompareSummary = {
    rank1: 0,
    rank2: 0,
    rank3: 0,
    rank4: 0,
    rank5: 0,
    rank6: 0,
    rank7: 0,
    none: 0,
  }
  const matches: PensionRankMatch[] = []

  for (const draw of draws) {
    const rank = getPensionRank(group, padded, draw)
    const suffixMatch = suffixMatchLength(padded, draw.number)

    if (rank === 1) summary.rank1++
    else if (rank === 2) summary.rank2++
    else if (rank === 3) summary.rank3++
    else if (rank === 4) summary.rank4++
    else if (rank === 5) summary.rank5++
    else if (rank === 6) summary.rank6++
    else if (rank === 7) summary.rank7++
    else summary.none++

    if (rank > 0) {
      matches.push({
        round: draw.round,
        date: draw.date,
        group: draw.group,
        number: draw.number,
        bonus: draw.bonus,
        rank,
        suffixMatch,
      })
    }
  }

  matches.sort((a, b) => a.rank - b.rank || b.round - a.round)
  return { summary, matches }
}

export function parsePensionInput(input: string): PensionTicket | null {
  const trimmed = input.trim()
  const match = trimmed.match(/^([1-5])\s*조?\s*[,.\s-]*(\d{1,6})$/)
  if (match) {
    return { group: Number(match[1]), number: padPensionNumber(match[2]) }
  }
  const parts = trimmed.split(/[,\s]+/).filter(Boolean)
  if (parts.length === 2 && /^[1-5]$/.test(parts[0]) && /^\d{1,6}$/.test(parts[1])) {
    return { group: Number(parts[0]), number: padPensionNumber(parts[1]) }
  }
  return null
}

export const pensionRecommendStrategyMeta: Record<
  PensionRecommendStrategy,
  { label: string; description: string }
> = {
  hot: { label: "자주 나온 패턴", description: "최근 자주 나온 조·자리 숫자 위주" },
  cold: { label: "적게 나온 패턴", description: "최근 적게 나온 조·자리 숫자 위주" },
  balanced: { label: "균형 조합", description: "조·자리별 상위/하위 숫자 균형" },
  random: { label: "완전 랜덤", description: "조와 6자리 무작위" },
  unique: {
    label: "미중복 조합",
    description: "5세트 번호가 서로 겹치지 않음",
  },
  trend: {
    label: "AI 패턴 예측",
    description: "최근 20회차 자리별 0~1회 출현 숫자 조합 + 최근 조 패턴",
  },
}

export const pensionFrequencyRangeMeta: Record<PensionFrequencyRange, string> = {
  all: "전체 회차",
  50: "최근 50회",
  100: "최근 100회",
  200: "최근 200회",
}
