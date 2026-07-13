"use client"

import { useMemo, useState, type ReactNode } from "react"
import { signOut } from "next-auth/react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import {
  BarChart3,
  Banknote,
  Brain,
  History,
  LogOut,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import { AppNav } from "@/components/app-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PensionDraw } from "@/lib/pension"
import { DIGIT_LABELS, formatPensionTicket, splitDigits } from "@/lib/pension"
import {
  analyzePensionTrend,
  comparePensionTicket,
  computeGroupFrequencies,
  computePositionFrequencies,
  filterPensionDrawsByRange,
  generatePensionTickets,
  getPensionRankLabel,
  parsePensionInput,
  pensionFrequencyRangeMeta,
  pensionRecommendStrategyMeta,
  type PensionFrequencyRange,
  type PensionRecommendStrategy,
  type PensionTicket,
} from "@/lib/pension-analyze"
import { cn } from "@/lib/utils"

type PensionMeta = {
  updatedAt: string
  maxRound: number
  count: number
}

function DigitBall({ digit, highlight = false }: { digit: number; highlight?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white text-sm font-bold",
        highlight && "ring-2 ring-violet-500 ring-offset-1 ring-offset-background"
      )}
    >
      {digit}
    </span>
  )
}

function PensionTicketView({
  group,
  number,
  highlightDigits,
}: {
  group: number
  number: string
  highlightDigits?: number[]
}) {
  const digits = splitDigits(number)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary" className="text-xs px-2">
        {group}조
      </Badge>
      {digits.map((d, i) => (
        <DigitBall key={`${i}-${d}`} digit={d} highlight={highlightDigits?.includes(i)} />
      ))}
    </div>
  )
}

function DrawDetail({ draw }: { draw: PensionDraw }) {
  return (
    <div className="rounded-lg border p-4 space-y-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{draw.round}회차</span>
        <span className="text-sm text-zinc-500">{draw.date}</span>
      </div>
      <div className="space-y-2">
        <div className="text-xs text-zinc-500">1등</div>
        <PensionTicketView group={draw.group} number={draw.number} />
      </div>
      <div className="space-y-2">
        <div className="text-xs text-zinc-500">보너스</div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            보너스
          </Badge>
          {splitDigits(draw.bonus).map((d, i) => (
            <DigitBall key={`b-${i}-${d}`} digit={d} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function PensionContent({
  draws,
  meta,
  gameSwitcher,
}: {
  draws: PensionDraw[]
  meta: PensionMeta
  gameSwitcher?: ReactNode
}) {
  const [searchRound, setSearchRound] = useState(String(meta.maxRound))
  const [freqRange, setFreqRange] = useState<PensionFrequencyRange>("all")
  const [strategy, setStrategy] = useState<PensionRecommendStrategy>("balanced")
  const [recommended, setRecommended] = useState<PensionTicket[]>([])
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
    () => filterPensionDrawsByRange(draws, freqRange),
    [draws, freqRange]
  )
  const groupFreq = useMemo(() => computeGroupFrequencies(filteredDraws), [filteredDraws])
  const positionFreq = useMemo(() => computePositionFrequencies(filteredDraws), [filteredDraws])
  const trendAnalysis = useMemo(
    () => (strategy === "trend" ? analyzePensionTrend(draws) : null),
    [draws, strategy]
  )

  const compareResult = useMemo(() => {
    const ticket = parsePensionInput(compareInput)
    if (!ticket) return null
    return comparePensionTicket(draws, ticket.group, ticket.number)
  }, [draws, compareInput])

  const comparedTicket = useMemo(() => parsePensionInput(compareInput), [compareInput])

  const handleRecommend = () => {
    setRecommended(generatePensionTickets(draws, strategy, 5))
  }

  const handleCompare = () => {
    if (!parsePensionInput(compareInput)) {
      setCompareError('형식: "3조 352814" 또는 "3 352814"')
      return
    }
    setCompareError("")
  }

  const handleCompareFromRecommend = (ticket: PensionTicket) => {
    setCompareInput(`${ticket.group}조 ${ticket.number}`)
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
                <Banknote className="h-6 w-6 shrink-0 text-amber-500" />
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
                    />
                    <Button
                      variant="outline"
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
                        className="w-full rounded-lg border px-3 py-2 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                        onClick={() => setSearchRound(String(draw.round))}
                      >
                        <div className="flex items-center gap-2 mb-2 text-sm">
                          <span className="font-medium">{draw.round}회</span>
                          <span className="text-xs text-zinc-500">{draw.date}</span>
                        </div>
                        <PensionTicketView group={draw.group} number={draw.number} />
                      </button>
                    ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="frequency" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">조·자리별 빈도</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(pensionFrequencyRangeMeta) as PensionFrequencyRange[]).map((key) => (
                      <Button
                        key={key}
                        size="sm"
                        variant={freqRange === key ? "default" : "outline"}
                        onClick={() => setFreqRange(key)}
                      >
                        {pensionFrequencyRangeMeta[key]}
                      </Button>
                    ))}
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">조별 출현</h3>
                    <div className="flex flex-wrap gap-2">
                      {groupFreq.map((g) => (
                        <Badge key={g.group} variant="outline" className="text-xs">
                          {g.group}조 {g.count}회
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {positionFreq.map((pos) => {
                      const max = Math.max(...pos.digits.map((d) => d.count), 1)
                      const top = [...pos.digits].sort((a, b) => b.count - a.count).slice(0, 3)
                      return (
                        <div key={pos.position} className="rounded-lg border p-3 dark:border-zinc-800">
                          <h4 className="text-sm font-medium mb-2">
                            {DIGIT_LABELS[pos.position]} 자리
                          </h4>
                          <div className="space-y-1">
                            {top.map((d) => (
                              <div key={d.digit} className="flex items-center gap-2 text-xs">
                                <DigitBall digit={d.digit} />
                                <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                                  <div
                                    className="h-full rounded-full bg-amber-400"
                                    style={{ width: `${(d.count / max) * 100}%` }}
                                  />
                                </div>
                                <span className="text-zinc-500 w-8 text-right">{d.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
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
                    {(Object.keys(pensionRecommendStrategyMeta) as PensionRecommendStrategy[]).map(
                      (key) => (
                        <Button
                          key={key}
                          type="button"
                          variant={strategy === key ? "default" : "outline"}
                          className="h-auto py-2.5 text-xs"
                          onClick={() => setStrategy(key)}
                        >
                          {pensionRecommendStrategyMeta[key].label}
                        </Button>
                      )
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {pensionRecommendStrategyMeta[strategy].description}
                  </p>

                  {strategy === "trend" && trendAnalysis && (
                    <div className="rounded-lg border bg-amber-50/50 p-3 space-y-2 dark:border-amber-900/50 dark:bg-amber-950/20">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                        <Brain className="h-4 w-4" />
                        AI 분석 요약 (최근 {trendAnalysis.recentRounds.length}회차)
                      </div>
                      <ul className="space-y-1">
                        {trendAnalysis.insights.map((line) => (
                          <li key={line} className="text-xs text-zinc-600 dark:text-zinc-400">
                            · {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button className="gap-1" onClick={handleRecommend}>
                    <RefreshCw className="h-4 w-4" />
                    5세트 생성
                  </Button>

                  {recommended.length > 0 && (
                    <div className="space-y-3">
                      {recommended.map((ticket, i) => (
                        <div
                          key={`${ticket.group}-${ticket.number}-${i}`}
                          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 dark:border-zinc-800"
                        >
                          <Badge variant="outline" className="text-[10px]">
                            {i + 1}번
                          </Badge>
                          <PensionTicketView group={ticket.group} number={ticket.number} />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="ml-auto h-8 text-xs gap-1"
                            onClick={() => handleCompareFromRecommend(ticket)}
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
                    <Label>내 번호</Label>
                    <Input
                      value={compareInput}
                      onChange={(e) => {
                        setCompareInput(e.target.value)
                        setCompareError("")
                      }}
                      placeholder='예: 3조 352814 또는 "3 352814"'
                    />
                    {compareError && <p className="text-xs text-rose-500">{compareError}</p>}
                  </div>
                  <Button onClick={handleCompare}>전체 회차와 비교</Button>

                  {comparedTicket && compareResult && (
                    <div className="space-y-4">
                      <PensionTicketView
                        group={comparedTicket.group}
                        number={comparedTicket.number}
                      />
                      <p className="text-xs text-zinc-500">
                        {formatPensionTicket(comparedTicket.group, comparedTicket.number)}
                      </p>

                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {(
                          [
                            ["rank1", "1등", compareResult.summary.rank1],
                            ["rank2", "2등", compareResult.summary.rank2],
                            ["rank3", "3등", compareResult.summary.rank3],
                            ["rank4", "4등", compareResult.summary.rank4],
                            ["rank5", "5등", compareResult.summary.rank5],
                            ["rank6", "6등", compareResult.summary.rank6],
                            ["rank7", "7등", compareResult.summary.rank7],
                            ["none", "낙첨", compareResult.summary.none],
                          ] as const
                        ).map(([key, label, count]) => (
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
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          <h3 className="text-sm font-medium">
                            당첨 이력 ({compareResult.matches.length}회)
                          </h3>
                          {compareResult.matches.slice(0, 50).map((m) => (
                            <div
                              key={m.round}
                              className="rounded-lg border px-3 py-2 dark:border-zinc-800"
                            >
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <Badge variant="secondary" className="text-[10px]">
                                  {getPensionRankLabel(m.rank)}
                                </Badge>
                                <span className="text-sm font-medium">{m.round}회</span>
                                <span className="text-xs text-zinc-500">{m.date}</span>
                              </div>
                              <PensionTicketView group={m.group} number={m.number} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">당첨 이력이 없습니다.</p>
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
