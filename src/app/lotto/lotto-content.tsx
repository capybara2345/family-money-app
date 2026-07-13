"use client"

import { useMemo, useState, type ReactNode } from "react"
import { signOut } from "next-auth/react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import {
  BarChart3,
  Dices,
  History,
  LogOut,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
  Brain,
} from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import { AppNav } from "@/components/app-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { LottoDraw } from "@/lib/lotto"
import {
  analyzeRecentTrend,
  compareNumbers,
  computeFrequencies,
  filterDrawsByRange,
  frequencyRangeMeta,
  generateRecommendedNumbers,
  getRankLabel,
  parseNumberInput,
  recommendStrategyMeta,
  sortByFrequency,
  type FrequencyRange,
  type RecommendStrategy,
} from "@/lib/lotto-analyze"
import { cn } from "@/lib/utils"

type LottoMeta = {
  updatedAt: string
  maxRound: number
  count: number
}

const BALL_COLORS = {
  bonus: "bg-emerald-500 text-white",
  range1: "bg-yellow-400 text-yellow-950",
  range2: "bg-sky-500 text-white",
  range3: "bg-rose-500 text-white",
  range4: "bg-zinc-500 text-white",
  range5: "bg-emerald-500 text-white",
}

function ballColor(n: number) {
  if (n <= 10) return BALL_COLORS.range1
  if (n <= 20) return BALL_COLORS.range2
  if (n <= 30) return BALL_COLORS.range3
  if (n <= 40) return BALL_COLORS.range4
  return BALL_COLORS.range5
}

export function LottoBall({
  n,
  bonus = false,
  size = "md",
  highlight = false,
}: {
  n: number
  bonus?: boolean
  size?: "sm" | "md"
  highlight?: boolean
}) {
  const sizeClass = size === "sm" ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm"
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold",
        sizeClass,
        bonus ? BALL_COLORS.bonus : ballColor(n),
        highlight && "ring-2 ring-violet-500 ring-offset-1 ring-offset-background"
      )}
    >
      {n}
    </span>
  )
}

function DrawDetail({ draw }: { draw: LottoDraw }) {
  return (
    <div className="rounded-lg border p-4 space-y-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{draw.round}회차</span>
        <span className="text-sm text-zinc-500">{draw.date}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {draw.numbers.map((n) => (
          <LottoBall key={n} n={n} />
        ))}
        <span className="text-zinc-400">+</span>
        <LottoBall n={draw.bonus} bonus />
      </div>
      {(draw.firstPrize || draw.firstWinners || draw.totalSales) && (
        <div className="grid gap-1 text-xs text-zinc-500 sm:grid-cols-3">
          {draw.firstWinners != null && (
            <span>1등 {draw.firstWinners.toLocaleString("ko-KR")}명</span>
          )}
          {draw.firstPrize != null && draw.firstPrize > 0 && (
            <span>1등 당첨금 {draw.firstPrize.toLocaleString("ko-KR")}원</span>
          )}
          {draw.totalSales != null && (
            <span>판매액 {draw.totalSales.toLocaleString("ko-KR")}원</span>
          )}
        </div>
      )}
    </div>
  )
}

export function LottoContent({
  draws,
  meta,
  gameSwitcher,
}: {
  draws: LottoDraw[]
  meta: LottoMeta
  gameSwitcher?: ReactNode
}) {
  const [searchRound, setSearchRound] = useState(String(meta.maxRound))
  const [freqRange, setFreqRange] = useState<FrequencyRange>("all")
  const [strategy, setStrategy] = useState<RecommendStrategy>("balanced")
  const [recommended, setRecommended] = useState<number[][]>([])
  const [compareInput, setCompareInput] = useState("")
  const [compareError, setCompareError] = useState("")
  const [activeTab, setActiveTab] = useState("lookup")

  const selectedDraw = useMemo(() => {
    const round = Number(searchRound)
    if (!Number.isInteger(round) || round < 1) return undefined
    return draws.find((d) => d.round === round)
  }, [draws, searchRound])

  const latestDraw = draws[draws.length - 1]

  const filteredDraws = useMemo(
    () => filterDrawsByRange(draws, freqRange),
    [draws, freqRange]
  )

  const frequencies = useMemo(() => computeFrequencies(filteredDraws), [filteredDraws])
  const hotNumbers = useMemo(() => sortByFrequency(frequencies, "desc").slice(0, 10), [frequencies])
  const coldNumbers = useMemo(() => sortByFrequency(frequencies, "asc").slice(0, 10), [frequencies])
  const maxFreq = useMemo(() => Math.max(...frequencies.map((f) => f.totalCount), 1), [frequencies])

  const compareResult = useMemo(() => {
    const nums = parseNumberInput(compareInput)
    if (!nums) return null
    return compareNumbers(draws, nums)
  }, [draws, compareInput])

  const comparedNumbers = useMemo(() => parseNumberInput(compareInput), [compareInput])

  const trendAnalysis = useMemo(
    () => (strategy === "trend" ? analyzeRecentTrend(draws) : null),
    [draws, strategy]
  )

  const handleRecommend = () => {
    setRecommended(generateRecommendedNumbers(draws, strategy, 5))
  }

  const handleCompare = () => {
    const nums = parseNumberInput(compareInput)
    if (!nums) {
      setCompareError("1~45 사이 서로 다른 번호 6개를 입력해주세요. (예: 3, 7, 12, 21, 33, 44)")
      return
    }
    setCompareError("")
  }

  const handleCompareFromRecommend = (nums: number[]) => {
    setCompareInput(nums.join(", "))
    setCompareError("")
    setActiveTab("compare")
  }

  return (
    <AuthGate>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <header className="border-b bg-white dark:bg-zinc-900 dark:border-zinc-800">
          <div className="mx-auto max-w-6xl px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Dices className="h-6 w-6 shrink-0 text-violet-500" />
                <div>
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight">복권 분석기</h1>
                  {gameSwitcher && <div className="mt-2">{gameSwitcher}</div>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <AppNav />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  title="로그아웃"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6 space-y-4">
          <Card>
            <CardContent className="pt-4 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">1회차 ~ {meta.maxRound}회차</Badge>
              <Badge variant="outline">{meta.count.toLocaleString("ko-KR")}회차</Badge>
              <span className="text-zinc-500">
                갱신 {format(new Date(meta.updatedAt), "M/d HH:mm", { locale: ko })}
              </span>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full flex-wrap h-auto gap-1">
              <TabsTrigger value="lookup" className="gap-1">
                <Search className="h-3.5 w-3.5" />
                회차 조회
              </TabsTrigger>
              <TabsTrigger value="frequency" className="gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                빈도 분석
              </TabsTrigger>
              <TabsTrigger value="recommend" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                번호 추천
              </TabsTrigger>
              <TabsTrigger value="compare" className="gap-1">
                <History className="h-3.5 w-3.5" />
                당첨 비교
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lookup" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">회차 조회</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={meta.maxRound}
                      value={searchRound}
                      onChange={(e) => setSearchRound(e.target.value)}
                      placeholder="회차 입력"
                    />
                    <Button
                      variant="outline"
                      className="shrink-0"
                      onClick={() => latestDraw && setSearchRound(String(latestDraw.round))}
                    >
                      최신
                    </Button>
                  </div>
                  {selectedDraw ? (
                    <DrawDetail draw={selectedDraw} />
                  ) : (
                    <p className="text-sm text-zinc-500">해당 회차 데이터가 없습니다.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">최근 10회차</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {draws
                    .slice(-10)
                    .reverse()
                    .map((draw) => (
                      <button
                        key={draw.round}
                        type="button"
                        className="w-full rounded-lg border px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                        onClick={() => setSearchRound(String(draw.round))}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-sm font-medium">{draw.round}회</span>
                          <span className="text-xs text-zinc-500">{draw.date}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {draw.numbers.map((n) => (
                            <LottoBall key={`${draw.round}-${n}`} n={n} size="sm" />
                          ))}
                          <span className="text-zinc-400 text-xs">+</span>
                          <LottoBall n={draw.bonus} bonus size="sm" />
                        </div>
                      </button>
                    ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="frequency" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">번호 출현 빈도</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(frequencyRangeMeta) as FrequencyRange[]).map((key) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant={freqRange === key ? "default" : "outline"}
                        onClick={() => setFreqRange(key)}
                      >
                        {frequencyRangeMeta[key]}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {filteredDraws.length}회차 기준 · 메인 번호 + 보너스 번호 출현 합산
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-rose-600 dark:text-rose-400">
                        🔥 자주 나온 번호 TOP 10
                      </h3>
                      {hotNumbers.map((f, i) => (
                        <div key={f.number} className="flex items-center gap-2 text-sm">
                          <span className="w-5 text-zinc-400">{i + 1}</span>
                          <LottoBall n={f.number} size="sm" />
                          <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-rose-400"
                              style={{ width: `${(f.totalCount / maxFreq) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 w-16 text-right">
                            {f.totalCount}회
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-sky-600 dark:text-sky-400">
                        ❄️ 적게 나온 번호 TOP 10
                      </h3>
                      {coldNumbers.map((f, i) => (
                        <div key={f.number} className="flex items-center gap-2 text-sm">
                          <span className="w-5 text-zinc-400">{i + 1}</span>
                          <LottoBall n={f.number} size="sm" />
                          <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-sky-400"
                              style={{ width: `${(f.totalCount / maxFreq) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 w-16 text-right">
                            {f.totalCount}회
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-9 gap-2 pt-2">
                    {frequencies.map((f) => (
                      <div
                        key={f.number}
                        className="flex flex-col items-center gap-1 rounded-md border p-1.5 dark:border-zinc-800"
                      >
                        <LottoBall n={f.number} size="sm" />
                        <span className="text-[10px] text-zinc-500">{f.totalCount}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommend" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">번호 추천</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-zinc-500">
                    통계 기반 추천이며 당첨을 보장하지 않습니다. 재미로만 참고해주세요.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {(Object.keys(recommendStrategyMeta) as RecommendStrategy[]).map((key) => (
                      <Button
                        key={key}
                        type="button"
                        variant={strategy === key ? "default" : "outline"}
                        className="h-auto flex-col gap-0.5 py-2.5 text-xs"
                        onClick={() => setStrategy(key)}
                      >
                        <span className="font-medium">{recommendStrategyMeta[key].label}</span>
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500">{recommendStrategyMeta[strategy].description}</p>

                  {strategy === "trend" && trendAnalysis && (
                    <div className="rounded-lg border bg-violet-50/50 p-3 space-y-2 dark:border-violet-900/50 dark:bg-violet-950/20">
                      <div className="flex items-center gap-2 text-sm font-medium text-violet-700 dark:text-violet-300">
                        <Brain className="h-4 w-4" />
                        AI 분석 요약 (최근 {trendAnalysis.recentRounds.length}회차)
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        {trendAnalysis.recentRounds[0]}~
                        {trendAnalysis.recentRounds[trendAnalysis.recentRounds.length - 1]}회차 기준
                      </p>
                      <ul className="space-y-1">
                        {trendAnalysis.insights.map((line) => (
                          <li key={line} className="text-xs text-zinc-600 dark:text-zinc-400">
                            · {line}
                          </li>
                        ))}
                      </ul>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          AI 후보군 (상위 {trendAnalysis.candidates.length}개)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {trendAnalysis.candidates.map((t) => (
                            <div key={t.number} className="flex items-center gap-1">
                              <LottoBall n={t.number} size="sm" />
                              <span className="text-[10px] text-zinc-500">{Math.round(t.score)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <Button className="gap-1" onClick={handleRecommend}>
                    <RefreshCw className="h-4 w-4" />
                    5세트 생성
                  </Button>

                  {recommended.length > 0 && (
                    <div className="space-y-3">
                      {recommended.map((nums, i) => (
                        <div
                          key={`${strategy}-${i}-${nums.join("-")}`}
                          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 dark:border-zinc-800"
                        >
                          <Badge variant="outline" className="text-[10px]">
                            {i + 1}번
                          </Badge>
                          {nums.map((n) => (
                            <LottoBall
                              key={n}
                              n={n}
                              highlight={
                                strategy === "trend" &&
                                trendAnalysis?.candidates.some((c) => c.number === n)
                              }
                            />
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="ml-auto h-8 text-xs gap-1"
                            onClick={() => handleCompareFromRecommend(nums)}
                          >
                            <History className="h-3.5 w-3.5" />
                            당첨 비교
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compare" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4" />
                    당첨 이력 비교
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>내 번호 (6개)</Label>
                    <Input
                      value={compareInput}
                      onChange={(e) => {
                        setCompareInput(e.target.value)
                        setCompareError("")
                      }}
                      placeholder="예: 3, 7, 12, 21, 33, 44"
                    />
                    {compareError && <p className="text-xs text-rose-500">{compareError}</p>}
                  </div>
                  <Button onClick={handleCompare}>전체 회차와 비교</Button>

                  {comparedNumbers && compareResult && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {comparedNumbers.map((n) => (
                          <LottoBall key={n} n={n} highlight />
                        ))}
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {([
                          ["rank1", "1등", compareResult.summary.rank1],
                          ["rank2", "2등", compareResult.summary.rank2],
                          ["rank3", "3등", compareResult.summary.rank3],
                          ["rank4", "4등", compareResult.summary.rank4],
                          ["rank5", "5등", compareResult.summary.rank5],
                          ["none", "낙첨", compareResult.summary.none],
                        ] as const).map(([key, label, count]) => (
                          <div
                            key={key}
                            className="rounded-lg border px-2 py-2 text-center dark:border-zinc-800"
                          >
                            <div className="text-lg font-bold">{count}</div>
                            <div className="text-[10px] text-zinc-500">{label}</div>
                          </div>
                        ))}
                      </div>

                      {compareResult.matches.length > 0 ? (
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">
                            당첨 이력 ({compareResult.matches.length}회)
                          </h3>
                          <div className="max-h-80 overflow-y-auto space-y-2">
                            {compareResult.matches.slice(0, 50).map((m) => (
                              <div
                                key={m.round}
                                className="rounded-lg border px-3 py-2 dark:border-zinc-800"
                              >
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  <Badge
                                    variant={m.rank <= 2 ? "default" : "secondary"}
                                    className="text-[10px]"
                                  >
                                    {getRankLabel(m.rank)}
                                  </Badge>
                                  <span className="text-sm font-medium">{m.round}회</span>
                                  <span className="text-xs text-zinc-500">{m.date}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {m.numbers.map((n) => (
                                    <LottoBall
                                      key={n}
                                      n={n}
                                      size="sm"
                                      highlight={comparedNumbers.includes(n)}
                                    />
                                  ))}
                                  <span className="text-zinc-400 text-xs">+</span>
                                  <LottoBall
                                    n={m.bonus}
                                    bonus
                                    size="sm"
                                    highlight={comparedNumbers.includes(m.bonus)}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          {compareResult.matches.length > 50 && (
                            <p className="text-xs text-zinc-500">
                              상위 50건만 표시합니다. (총 {compareResult.matches.length}건)
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">
                          3개 이상 일치한 회차가 없습니다.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AuthGate>
  )
}
