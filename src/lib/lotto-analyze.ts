import type { LottoDraw } from "@/lib/lotto"

export type NumberFrequency = {
  number: number
  mainCount: number
  bonusCount: number
  totalCount: number
}

export type FrequencyRange = "all" | 50 | 100 | 200

export type RecommendStrategy = "hot" | "cold" | "balanced" | "random" | "unique" | "trend"

export type TrendNumberScore = {
  number: number
  score: number
  recentCount: number
  gap: number
  momentum: number
}

export type TrendAnalysis = {
  recentRounds: number[]
  topNumbers: TrendNumberScore[]
  candidates: TrendNumberScore[]
  avgSum: number
  avgOddCount: number
  zoneDistribution: { low: number; mid: number; high: number }
  insights: string[]
}

export type RankMatch = {
  round: number
  date: string
  numbers: number[]
  bonus: number
  matchedCount: number
  bonusMatched: boolean
  rank: number
}

export type CompareSummary = {
  rank1: number
  rank2: number
  rank3: number
  rank4: number
  rank5: number
  none: number
}

export type CompareResult = {
  summary: CompareSummary
  matches: RankMatch[]
}

const RANK_LABELS: Record<number, string> = {
  1: "1등 (6개 일치)",
  2: "2등 (5개+보너스)",
  3: "3등 (5개 일치)",
  4: "4등 (4개 일치)",
  5: "5등 (3개 일치)",
}

export function getRankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? "낙첨"
}

export function filterDrawsByRange(draws: LottoDraw[], range: FrequencyRange): LottoDraw[] {
  if (range === "all") return draws
  return draws.slice(-range)
}

export function computeFrequencies(draws: LottoDraw[]): NumberFrequency[] {
  const counts = Array.from({ length: 45 }, (_, i) => ({
    number: i + 1,
    mainCount: 0,
    bonusCount: 0,
    totalCount: 0,
  }))

  for (const draw of draws) {
    for (const n of draw.numbers) {
      counts[n - 1].mainCount++
      counts[n - 1].totalCount++
    }
    counts[draw.bonus - 1].bonusCount++
    counts[draw.bonus - 1].totalCount++
  }

  return counts
}

export function sortByFrequency(freq: NumberFrequency[], order: "desc" | "asc") {
  return [...freq].sort((a, b) =>
    order === "desc" ? b.totalCount - a.totalCount || a.number - b.number : a.totalCount - b.totalCount || a.number - b.number
  )
}

function shuffle<T>(arr: T[]): T[] {
  const items = [...arr]
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

function pickNumbers(pool: number[], count: number, exclude: number[] = []): number[] {
  const available = pool.filter((n) => !exclude.includes(n))
  const picked: number[] = []
  while (picked.length < count && available.length > 0) {
    const idx = Math.floor(Math.random() * available.length)
    picked.push(available.splice(idx, 1)[0])
  }
  return picked.sort((a, b) => a - b)
}

function splitIntoSets(numbers: number[], setCount: number): number[][] {
  const shuffled = shuffle(numbers)
  const sets: number[][] = []
  for (let i = 0; i < setCount; i++) {
    sets.push(shuffled.slice(i * 6, i * 6 + 6).sort((a, b) => a - b))
  }
  return sets
}

function generateUniqueSets(draws: LottoDraw[], setCount: number): number[][] {
  const freq = computeFrequencies(draws)
  const sorted = sortByFrequency(freq, "desc")
  const hot = sorted.slice(0, 22).map((f) => f.number)
  const cold = sorted.slice(-22).map((f) => f.number)

  const hotPicked = pickNumbers(hot, setCount * 3)
  const coldPicked = pickNumbers(cold, setCount * 3, hotPicked)
  return splitIntoSets([...hotPicked, ...coldPicked], setCount)
}

const RECENT_TREND_COUNT = 10
export const TREND_CANDIDATE_SIZE = 15

function getZone(n: number): "low" | "mid" | "high" {
  if (n <= 15) return "low"
  if (n <= 30) return "mid"
  return "high"
}

function pickWeightedNumbers(
  scored: TrendNumberScore[],
  count: number,
  exclude: number[] = []
): number[] {
  const available = scored.filter((s) => !exclude.includes(s.number))
  const picked: number[] = []
  while (picked.length < count && available.length > 0) {
    const totalWeight = available.reduce((sum, s) => sum + s.score, 0)
    let roll = Math.random() * totalWeight
    let chosenIdx = 0
    for (let i = 0; i < available.length; i++) {
      roll -= available[i].score
      if (roll <= 0) {
        chosenIdx = i
        break
      }
    }
    picked.push(available.splice(chosenIdx, 1)[0].number)
  }
  return picked.sort((a, b) => a - b)
}

function buildTrendSet(
  pool: TrendNumberScore[],
  targetOdd: number,
  targetZones: TrendAnalysis["zoneDistribution"]
): number[] {
  const allowed = new Set(pool.map((s) => s.number))
  let best = pickWeightedNumbers(pool, 6)

  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = pickWeightedNumbers(pool, 6)
    const bestSorted = [...best].sort((a, b) => a - b)
    const candSorted = [...candidate].sort((a, b) => a - b)

    const bestScore = balanceScore(bestSorted, targetOdd, targetZones)
    const candScore = balanceScore(candSorted, targetOdd, targetZones)
    if (candScore < bestScore) best = candidate
  }

  const result = [...best].filter((n) => allowed.has(n))
  if (result.length < 6) {
    const picked = new Set(result)
    const rest = pickWeightedNumbers(
      pool.filter((s) => !picked.has(s.number)),
      6 - result.length
    )
    result.push(...rest)
  }

  return result.slice(0, 6).sort((a, b) => a - b)
}

function balanceScore(
  nums: number[],
  targetOdd: number,
  targetZones: TrendAnalysis["zoneDistribution"]
): number {
  const oddCount = nums.filter((n) => n % 2 === 1).length
  const zones = { low: 0, mid: 0, high: 0 }
  nums.forEach((n) => zones[getZone(n)]++)
  return (
    Math.abs(oddCount - targetOdd) * 2 +
    Math.abs(zones.low - targetZones.low) +
    Math.abs(zones.mid - targetZones.mid) +
    Math.abs(zones.high - targetZones.high)
  )
}

export function analyzeRecentTrend(draws: LottoDraw[]): TrendAnalysis {
  const recent = draws.slice(-RECENT_TREND_COUNT)
  const latestRound = draws[draws.length - 1]?.round ?? 0
  const lastSeen = new Array(45).fill(0)

  for (const draw of draws) {
    for (const n of draw.numbers) lastSeen[n - 1] = draw.round
    lastSeen[draw.bonus - 1] = draw.round
  }

  const recentCount = new Array(45).fill(0)
  const historicalCount = computeFrequencies(draws)

  for (const draw of recent) {
    for (const n of draw.numbers) recentCount[n - 1]++
    recentCount[draw.bonus - 1] += 0.5
  }

  const maxRecent = Math.max(...recentCount, 1)

  const topNumbers: TrendNumberScore[] = Array.from({ length: 45 }, (_, i) => {
    const number = i + 1
    const gap = latestRound - lastSeen[i]
    const rc = recentCount[i]
    const hist = historicalCount[i].totalCount

    const momentum = (rc / maxRecent) * 30
    const overdue = gap >= 4 && gap <= 15 ? 25 * (1 - Math.abs(gap - 8) / 8) : 0
    const acceleration =
      hist > 0 ? Math.min(20, Math.max(0, (rc / RECENT_TREND_COUNT - hist / draws.length) * 200)) : 0
    const pairBoost = recent.reduce((sum, draw) => {
      const inDraw = [...draw.numbers, draw.bonus]
      return inDraw.includes(number) ? sum + inDraw.length - 1 : sum
    }, 0)
    const pairScore = Math.min(15, pairBoost * 1.5)
    const zoneBonus = getZoneBonus(number, recent)

    const score = momentum + overdue + acceleration + pairScore + zoneBonus
    return { number, score, recentCount: rc, gap, momentum }
  }).sort((a, b) => b.score - a.score)

  const sums = recent.map((d) => d.numbers.reduce((s, n) => s + n, 0))
  const avgSum = Math.round(sums.reduce((s, v) => s + v, 0) / sums.length)
  const oddCounts = recent.map((d) => d.numbers.filter((n) => n % 2 === 1).length)
  const avgOddCount = Math.round(oddCounts.reduce((s, v) => s + v, 0) / oddCounts.length)

  const zoneDistribution = { low: 0, mid: 0, high: 0 }
  for (const draw of recent) {
    for (const n of draw.numbers) zoneDistribution[getZone(n)]++
  }
  const totalZone = zoneDistribution.low + zoneDistribution.mid + zoneDistribution.high
  const lowTarget = Math.round((zoneDistribution.low / totalZone) * 6)
  const midTarget = Math.round((zoneDistribution.mid / totalZone) * 6)
  const normalizedZones = {
    low: lowTarget,
    mid: midTarget,
    high: Math.max(0, 6 - lowTarget - midTarget),
  }

  const candidates = topNumbers.slice(0, TREND_CANDIDATE_SIZE)

  const insights: string[] = [
    `최근 ${recent.length}회차 평균 합계: ${avgSum} (권장 범위 ${avgSum - 30}~${avgSum + 30})`,
    `최근 홀수 개수 평균: ${avgOddCount}개`,
    `AI 후보군 ${TREND_CANDIDATE_SIZE}개: ${candidates.map((t) => t.number).join(", ")}`,
  ]

  if (topNumbers[0].recentCount >= 3) {
    insights.push(`최근 모멘텀 강한 번호: ${topNumbers.filter((t) => t.recentCount >= 2).slice(0, 5).map((t) => t.number).join(", ")}`)
  }
  const overdueNums = topNumbers.filter((t) => t.gap >= 6 && t.gap <= 12).slice(0, 5)
  if (overdueNums.length > 0) {
    insights.push(`출현 주기 도래 번호: ${overdueNums.map((t) => t.number).join(", ")}`)
  }

  return {
    recentRounds: recent.map((d) => d.round),
    topNumbers,
    candidates,
    avgSum,
    avgOddCount,
    zoneDistribution: normalizedZones,
    insights,
  }
}

function getZoneBonus(number: number, recent: LottoDraw[]): number {
  const zone = getZone(number)
  const counts = { low: 0, mid: 0, high: 0 }
  for (const draw of recent) {
    for (const n of draw.numbers) counts[getZone(n)]++
  }
  const total = counts.low + counts.mid + counts.high
  const share = counts[zone] / total
  return share < 0.28 ? 8 : share > 0.4 ? 2 : 5
}

function generateTrendSets(draws: LottoDraw[], setCount: number): number[][] {
  const analysis = analyzeRecentTrend(draws)
  const pool = analysis.candidates
  const sets: number[][] = []

  for (let i = 0; i < setCount; i++) {
    sets.push(buildTrendSet(pool, analysis.avgOddCount, analysis.zoneDistribution))
  }

  return sets
}

export function generateRecommendedNumbers(
  draws: LottoDraw[],
  strategy: RecommendStrategy,
  setCount = 1
): number[][] {
  if (strategy === "unique") {
    return generateUniqueSets(draws, setCount)
  }
  if (strategy === "trend") {
    return generateTrendSets(draws, setCount)
  }

  const freq = computeFrequencies(draws)
  const sorted = sortByFrequency(freq, "desc")
  const hot = sorted.slice(0, 15).map((f) => f.number)
  const cold = sorted.slice(-15).map((f) => f.number)
  const all = Array.from({ length: 45 }, (_, i) => i + 1)

  const sets: number[][] = []
  for (let i = 0; i < setCount; i++) {
    if (strategy === "random") {
      sets.push(pickNumbers(all, 6))
      continue
    }
    if (strategy === "hot") {
      sets.push(pickNumbers(hot, 6))
      continue
    }
    if (strategy === "cold") {
      sets.push(pickNumbers(cold, 6))
      continue
    }
    // balanced: 3 hot + 3 cold
    const partHot = pickNumbers(hot, 3)
    const partCold = pickNumbers(cold, 3, partHot)
    sets.push([...partHot, ...partCold].sort((a, b) => a - b))
  }
  return sets
}

export function getMatchRank(matchedCount: number, bonusMatched: boolean): number {
  if (matchedCount === 6) return 1
  if (matchedCount === 5 && bonusMatched) return 2
  if (matchedCount === 5) return 3
  if (matchedCount === 4) return 4
  if (matchedCount === 3) return 5
  return 0
}

export function compareNumbers(draws: LottoDraw[], numbers: number[]): CompareResult {
  const picked = [...new Set(numbers)].sort((a, b) => a - b)
  const summary: CompareSummary = { rank1: 0, rank2: 0, rank3: 0, rank4: 0, rank5: 0, none: 0 }
  const matches: RankMatch[] = []

  for (const draw of draws) {
    const matchedCount = draw.numbers.filter((n) => picked.includes(n)).length
    const bonusMatched = picked.includes(draw.bonus)
    const rank = getMatchRank(matchedCount, bonusMatched)

    if (rank === 1) summary.rank1++
    else if (rank === 2) summary.rank2++
    else if (rank === 3) summary.rank3++
    else if (rank === 4) summary.rank4++
    else if (rank === 5) summary.rank5++
    else summary.none++

    if (rank > 0) {
      matches.push({
        round: draw.round,
        date: draw.date,
        numbers: [...draw.numbers],
        bonus: draw.bonus,
        matchedCount,
        bonusMatched,
        rank,
      })
    }
  }

  matches.sort((a, b) => a.rank - b.rank || b.round - a.round)
  return { summary, matches }
}

export function parseNumberInput(input: string): number[] | null {
  const nums = input
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 45)

  if (nums.length !== 6) return null
  if (new Set(nums).size !== 6) return null
  return nums.sort((a, b) => a - b)
}

export const recommendStrategyMeta: Record<
  RecommendStrategy,
  { label: string; description: string }
> = {
  hot: { label: "자주 나온 번호", description: "역대 출현 빈도가 높은 번호 위주" },
  cold: { label: "적게 나온 번호", description: "역대 출현 빈도가 낮은 번호 위주" },
  balanced: { label: "균형 조합", description: "자주 나온 번호 3개 + 적게 나온 번호 3개" },
  random: { label: "완전 랜덤", description: "1~45 중 무작위 6개" },
  unique: {
    label: "미중복 조합",
    description: "5세트 30개 번호가 서로 겹치지 않음 (자주 나온 15개 + 적게 나온 15개)",
  },
  trend: {
    label: "AI 패턴 예측",
    description: "최근 10회차 모멘텀·주기·구간·홀짝 패턴을 분석해 다음 회차 후보 추천",
  },
}

export const frequencyRangeMeta: Record<FrequencyRange, string> = {
  all: "전체 회차",
  50: "최근 50회",
  100: "최근 100회",
  200: "최근 200회",
}
