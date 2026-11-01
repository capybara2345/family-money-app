"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { signOut } from "next-auth/react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import Holidays from "date-holidays"
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  GripVertical,
  HeartPulse,
  Loader2,
  LogOut,
  Plus,
  Scale,
  Settings2,
  Trash2,
} from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import { AppNav } from "@/components/app-nav"
import { FamilyHeaderActions, FamilyPanelProvider } from "@/components/family-panel"
import { LiverBmiCard } from "@/components/liver-bmi-card"
import { useFamily } from "@/hooks/use-family"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { findExactFood, searchFoods, type FoodCalorie } from "@/lib/food-calories"
import {
  STRENGTH_ROUTINE,
  applyRecommendedMeals,
  weeklyMenuFor,
} from "@/lib/weekly-menu"
import {
  deleteLiverBodyLog,
  saveLiverBodyLog,
  saveLiverLog,
  saveLiverPlan,
  subscribeLiverBodyLogs,
  subscribeLiverLogs,
  subscribeLiverPlans,
} from "@/lib/firestore-liver"
import {
  WEEKDAY_LABELS,
  completionStreak,
  createDefaultPlan,
  createLocalId,
  dayProgress,
  habitKindMeta,
  mealSlotMeta,
  MEAL_SLOTS,
  monthCompletion,
  scheduledHabits,
  sumMealKcal,
  toDateKey,
  type HabitKind,
  type LiverBodyLog,
  type LiverHabit,
  type LiverLog,
  type LiverMeal,
  type LiverPlan,
  type MealSlot,
} from "@/lib/liver"

const hd = new Holidays("KR")
const PORTIONS = [0.5, 1, 1.5, 2] as const
const HABIT_KINDS = Object.keys(habitKindMeta) as HabitKind[]

function formatKcal(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value))
}

function sanitizeDigits(value: string) {
  return value.replace(/[^\d]/g, "")
}

function friendlySaveError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  if (/permission|insufficient/i.test(message)) {
    return "기록을 저장할 권한이 없습니다. Firestore 규칙 배포가 필요할 수 있습니다."
  }
  return "저장 중 오류가 발생했습니다."
}

function isHabitKind(value: string): value is HabitKind {
  return HABIT_KINDS.includes(value as HabitKind)
}

function logKey(memberId: string, date: string) {
  return `${memberId}_${date}`
}

export default function LiverPage() {
  return (
    <AuthGate>
      <FamilyPanelProvider>
        <LiverContent />
      </FamilyPanelProvider>
    </AuthGate>
  )
}

function LiverContent() {
  const { session, family, loading: familyLoading } = useFamily()
  const [plans, setPlans] = useState<LiverPlan[]>([])
  const [logs, setLogs] = useState<LiverLog[]>([])
  const [bodyLogs, setBodyLogs] = useState<LiverBodyLog[]>([])
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pickedMemberId, setPickedMemberId] = useState<string | null>(null)
  const [boundFamilyId, setBoundFamilyId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [month, setMonth] = useState(() => new Date())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsKey, setSettingsKey] = useState(0)
  const [mainTab, setMainTab] = useState<"habits" | "bmi">("habits")
  const logsRef = useRef<LiverLog[]>([])
  const dirtyKeys = useRef(new Set<string>())
  const pendingWrites = useRef(0)
  const planSaved = useRef(false)
  const familyEpoch = useRef(0)

  const userId = session?.user?.id ?? null
  const familyId = family?.id ?? null
  const viewMemberId = (() => {
    if (!userId) return null
    const candidate = pickedMemberId ?? userId
    if (family && !family.members.includes(candidate)) return userId
    return candidate
  })()

  if (familyId !== boundFamilyId) {
    setBoundFamilyId(familyId)
    setReady(false)
    setPlans([])
    setLogs([])
    setBodyLogs([])
  }

  useEffect(() => {
    if (!familyId) return
    const epoch = ++familyEpoch.current
    logsRef.current = []
    dirtyKeys.current.clear()
    pendingWrites.current = 0
    let plansReady = false
    let logsReady = false
    let bodyReady = false
    const mark = () => {
      if (plansReady && logsReady && bodyReady) setReady(true)
    }
    const onError = (error: Error) => {
      if (epoch !== familyEpoch.current) return
      setLoadError(friendlySaveError(error))
      setReady(true)
    }
    const unsubPlans = subscribeLiverPlans(
      familyId,
      (next) => {
        if (epoch !== familyEpoch.current) return
        setPlans(next)
        plansReady = true
        mark()
      },
      onError
    )
    const unsubLogs = subscribeLiverLogs(
      familyId,
      (next) => {
        if (epoch !== familyEpoch.current) return
        if (pendingWrites.current === 0) {
          logsRef.current = next
          setLogs(next)
        } else {
          const current = logsRef.current
          const merged = next.map((log) => {
            if (!dirtyKeys.current.has(logKey(log.memberId, log.date))) return log
            return current.find((item) => item.memberId === log.memberId && item.date === log.date) ?? log
          })
          const extras = current.filter((log) => {
            const key = logKey(log.memberId, log.date)
            return (
              dirtyKeys.current.has(key) &&
              !next.some((item) => item.memberId === log.memberId && item.date === log.date)
            )
          })
          const result = [...merged, ...extras]
          logsRef.current = result
          setLogs(result)
        }
        logsReady = true
        mark()
      },
      onError
    )
    const unsubBody = subscribeLiverBodyLogs(
      familyId,
      (next) => {
        if (epoch !== familyEpoch.current) return
        setBodyLogs(next)
        bodyReady = true
        mark()
      },
      onError
    )
    return () => {
      unsubPlans()
      unsubLogs()
      unsubBody()
    }
  }, [familyId])

  const canEdit = Boolean(userId && viewMemberId && userId === viewMemberId)
  const serverPlan = plans.find((plan) => plan.memberId === viewMemberId) ?? null
  const fallbackPlan =
    familyId && viewMemberId ? createDefaultPlan(familyId, viewMemberId) : null
  const activePlan = serverPlan ?? (canEdit ? fallbackPlan : null)

  useEffect(() => {
    planSaved.current = false
  }, [viewMemberId])

  useEffect(() => {
    if (serverPlan) planSaved.current = true
  }, [serverPlan])

  const memberLogs = useMemo(
    () => logs.filter((log) => log.memberId === viewMemberId),
    [logs, viewMemberId]
  )
  const memberBodyLogs = useMemo(
    () => bodyLogs.filter((log) => log.memberId === viewMemberId),
    [bodyLogs, viewMemberId]
  )
  const logsByDate = useMemo(() => {
    const map = new Map<string, LiverLog>()
    for (const log of memberLogs) map.set(log.date, log)
    return map
  }, [memberLogs])

  const today = new Date()
  const selectedKey = toDateKey(selectedDate)
  const selectedLog = logsByDate.get(selectedKey)
  const selectedHabits = activePlan ? scheduledHabits(activePlan, selectedDate) : []
  const selectedProgress = activePlan
    ? dayProgress(activePlan, selectedDate, selectedLog)
    : { done: 0, total: 0, complete: false }
  const monthStats = activePlan
    ? monthCompletion(activePlan, logsByDate, month.getFullYear(), month.getMonth(), today)
    : { scheduled: 0, complete: 0 }
  const streak = activePlan ? completionStreak(activePlan, logsByDate, today) : 0
  const todayKey = toDateKey(today)
  const todayHasDiet = activePlan
    ? scheduledHabits(activePlan, today).some((habit) => habit.kind === "diet")
    : false
  const todayKcal = sumMealKcal(logsByDate.get(todayKey)?.meals ?? [])
  const viewName =
    (viewMemberId && family?.memberNames?.[viewMemberId]) || (canEdit ? "나" : "멤버")

  const upsertLog = (next: LiverLog) => {
    const current = logsRef.current
    const index = current.findIndex((log) => log.memberId === next.memberId && log.date === next.date)
    const updated =
      index === -1 ? [...current, next] : current.map((log, i) => (i === index ? next : log))
    logsRef.current = updated
    setLogs(updated)
  }

  const persistLog = async (next: LiverLog) => {
    const epoch = familyEpoch.current
    const key = logKey(next.memberId, next.date)
    const previous = logsRef.current.find((log) => log.memberId === next.memberId && log.date === next.date)
    dirtyKeys.current.add(key)
    pendingWrites.current += 1
    upsertLog(next)
    try {
      await saveLiverLog(next)
    } catch (error) {
      console.error(error)
      if (epoch === familyEpoch.current) {
        dirtyKeys.current.delete(key)
        if (previous) upsertLog(previous)
        else {
          const rolled = logsRef.current.filter(
            (log) => !(log.memberId === next.memberId && log.date === next.date)
          )
          logsRef.current = rolled
          setLogs(rolled)
        }
        alert(friendlySaveError(error))
      }
      throw error
    } finally {
      if (epoch !== familyEpoch.current) return
      pendingWrites.current -= 1
      if (pendingWrites.current === 0) dirtyKeys.current.clear()
    }
  }

  const ensurePlan = async () => {
    if (!activePlan || serverPlan || planSaved.current) return
    try {
      await saveLiverPlan(activePlan)
      planSaved.current = true
    } catch (error) {
      console.error(error)
      alert(friendlySaveError(error))
      throw error
    }
  }

  const toggleHabit = async (habitId: string) => {
    if (!canEdit || !family?.id || !viewMemberId || !activePlan) return
    const current = logsRef.current.find((log) => log.memberId === viewMemberId && log.date === selectedKey)
    const checks = { ...(current?.checks ?? {}) }
    checks[habitId] = checks[habitId] !== true
    try {
      await ensurePlan()
      await persistLog({
        familyId: family.id,
        memberId: viewMemberId,
        date: selectedKey,
        checks,
        meals: current?.meals ?? [],
      })
    } catch {
      // persistLog already alerts
    }
  }

  const saveMeals = async (date: string, meals: LiverMeal[]) => {
    if (!canEdit || !family?.id || !viewMemberId || !activePlan) return
    const current = logsRef.current.find((log) => log.memberId === viewMemberId && log.date === date)
    await ensurePlan()
    await persistLog({
      familyId: family.id,
      memberId: viewMemberId,
      date,
      checks: current?.checks ?? {},
      meals,
    })
  }

  const saveHeight = async (heightCm: number) => {
    if (!canEdit || !activePlan) return
    try {
      await saveLiverPlan({ ...activePlan, heightCm })
      planSaved.current = true
    } catch (error) {
      console.error(error)
      alert(friendlySaveError(error))
      throw error
    }
  }

  const saveBody = async (log: Omit<LiverBodyLog, "id">) => {
    if (!canEdit) return
    try {
      if (activePlan && !serverPlan) await ensurePlan()
      await saveLiverBodyLog(log)
    } catch (error) {
      console.error(error)
      alert(friendlySaveError(error))
      throw error
    }
  }

  const removeBody = async (id: string) => {
    if (!canEdit) return
    try {
      await deleteLiverBodyLog(id)
    } catch (error) {
      console.error(error)
      alert(friendlySaveError(error))
      throw error
    }
  }

  const applyRecommendation = async () => {
    if (!canEdit || !activePlan) return
    const menu = weeklyMenuFor(selectedDate)
    const current =
      logsRef.current.find((log) => log.memberId === viewMemberId && log.date === selectedKey)
        ?.meals ?? []
    const hasMainMeals = current.some((meal) => meal.slot !== "snack")
    if (
      hasMainMeals &&
      !confirm("이미 적힌 아침·점심·저녁이 있습니다. 추천식으로 바꿀까요? (간식은 유지됩니다)")
    ) {
      return
    }
    try {
      await saveMeals(selectedKey, applyRecommendedMeals(menu, current))
    } catch {
      // saveMeals / persistLog already alerts
    }
  }

  const loading = familyLoading || (!!family?.id && !ready)
  const firstDietId = selectedHabits.find((habit) => habit.kind === "diet")?.id

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-3 sm:py-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-6 w-6 shrink-0 text-emerald-600" />
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">지방간 탈출</h1>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                생활습관을 챙겨 간 지방을 줄이는 기록입니다. 진료나 식단 처방은 의료진과 상의하세요.
              </p>
            </div>
            {session?.user && (
              <div className="flex flex-wrap items-center gap-2">
                <AppNav />
                <FamilyHeaderActions />
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
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6 space-y-4">
        {loadError && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            {loadError}
          </p>
        )}

        {family && family.members.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {family.members.map((memberId) => {
              const name = family.memberNames?.[memberId] || "멤버"
              const active = memberId === viewMemberId
              return (
                <button
                  key={memberId}
                  type="button"
                  onClick={() => setPickedMemberId(memberId)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    active
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                      : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900"
                  )}
                >
                  {name}
                  {memberId === userId ? " · 나" : ""}
                </button>
              )
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !family ? (
          <p className="py-16 text-center text-sm text-zinc-500">가족 정보를 불러오지 못했습니다.</p>
        ) : (
          <div className="space-y-4">
            <div
              role="tablist"
              aria-label="생활습관 구분"
              className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
            >
              {(
                [
                  { id: "habits" as const, label: "생활습관", icon: CalendarDays },
                  { id: "bmi" as const, label: "BMI", icon: Scale },
                ] as const
              ).map(({ id, label, icon: Icon }) => {
                const active = mainTab === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMainTab(id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-900 dark:text-emerald-400"
                        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </button>
                )
              })}
            </div>

            {mainTab === "habits" && (
              <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Stat
                  label={`${month.getMonth() + 1}월 완료`}
                  value={
                    monthStats.scheduled > 0
                      ? `${monthStats.complete}/${monthStats.scheduled}`
                      : "0"
                  }
                  hint="지난 날 중 전부 체크"
                />
                <Stat label="연속 달성" value={`${streak}일`} hint="항목 없는 날은 건너뜀" />
                <Stat
                  label="오늘 칼로리"
                  value={todayHasDiet ? formatKcal(todayKcal) : "—"}
                  hint={
                    todayHasDiet && activePlan
                      ? `목표 ${formatKcal(activePlan.calorieGoal)}`
                      : "식단 없는 날"
                  }
                />
              </div>

              <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="h-5 w-5 shrink-0" />
                      캘린더
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const now = new Date()
                          setSelectedDate(now)
                          setMonth(now)
                        }}
                      >
                        오늘
                      </Button>
                      {canEdit && activePlan && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            setSettingsKey((value) => value + 1)
                            setSettingsOpen(true)
                          }}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          요일 설정
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) setSelectedDate(date)
                      }}
                      month={month}
                      onMonthChange={setMonth}
                      locale={ko}
                      components={{
                        DayButton: ({ day, modifiers, ...props }) => {
                          const progress = activePlan
                            ? dayProgress(activePlan, day.date, logsByDate.get(toDateKey(day.date)))
                            : { done: 0, total: 0, complete: false }
                          const isSelected = modifiers.selected
                          const dow = day.date.getDay()
                          const holiday = hd.isHoliday(day.date)
                          return (
                            <button
                              {...props}
                              type="button"
                              className={cn(
                                props.className,
                                "relative flex aspect-square h-full w-full min-h-0 flex-col items-center justify-center gap-0.5 rounded-md p-0 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800",
                                modifiers.outside && "opacity-40",
                                !isSelected && (dow === 0 || holiday) && "text-red-500",
                                !isSelected && dow === 6 && "text-blue-500",
                                !isSelected && modifiers.today && "ring-1 ring-emerald-400",
                                isSelected &&
                                  "bg-emerald-100 font-semibold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
                                progress.complete &&
                                  !isSelected &&
                                  "bg-emerald-50 dark:bg-emerald-950/40"
                              )}
                            >
                              <span className="leading-none">{day.date.getDate()}</span>
                              {progress.complete ? (
                                <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                              ) : progress.done > 0 ? (
                                <span className="text-[9px] leading-none font-medium text-amber-600">
                                  {progress.done}/{progress.total}
                                </span>
                              ) : (
                                <span className="h-3" />
                              )}
                              {holiday && (
                                <span className="absolute top-0.5 right-0.5 h-1 w-1 rounded-full bg-red-500" />
                              )}
                            </button>
                          )
                        },
                      }}
                    />
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <Check className="h-3 w-3 text-emerald-600" strokeWidth={3} />
                        모두 완료
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium text-amber-600">1/3</span>
                        일부 완료
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-base sm:text-lg">
                      {format(selectedDate, "M월 d일 (EEEE)", { locale: ko })}
                    </CardTitle>
                    <p className="text-sm text-zinc-500">
                      {canEdit ? "내 체크리스트" : `${viewName}의 기록 · 읽기 전용`}
                      {selectedProgress.total > 0
                        ? ` · ${selectedProgress.done}/${selectedProgress.total}`
                        : ""}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <DayRecommendation
                      key={selectedKey}
                      date={selectedDate}
                      canEdit={canEdit && !!activePlan}
                      onApply={applyRecommendation}
                    />
                    {!activePlan ? (
                      <p className="py-8 text-center text-sm text-zinc-500">
                        {viewName}님은 아직 지방간 탈출 기록을 시작하지 않았어요.
                      </p>
                    ) : selectedHabits.length === 0 ? (
                      <p className="py-8 text-center text-sm text-zinc-500">
                        이 요일에는 체크 항목이 없습니다.
                        {canEdit ? " 요일 설정에서 넣을 항목을 고르세요." : ""}
                      </p>
                    ) : (
                      <>
                        {selectedProgress.complete && (
                          <div className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">
                            <Check className="h-4 w-4" />
                            {selectedKey === todayKey
                              ? "오늘 체크리스트를 모두 완료했어요"
                              : "이 날 체크리스트를 모두 완료했어요"}
                          </div>
                        )}
                        {selectedHabits.map((habit) => (
                          <div key={habit.id} className="space-y-3">
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={selectedLog?.checks[habit.id] === true}
                              disabled={!canEdit}
                              onClick={() => toggleHabit(habit.id)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-default",
                                selectedLog?.checks[habit.id]
                                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                                  selectedLog?.checks[habit.id]
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : "border-zinc-300 dark:border-zinc-600"
                                )}
                              >
                                {selectedLog?.checks[habit.id] && (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="font-medium">{habit.label}</span>
                              </span>
                              <span className="text-xs text-zinc-400">
                                {habitKindMeta[habit.kind].emoji} {habitKindMeta[habit.kind].label}
                              </span>
                            </button>
                            {habit.id === firstDietId && activePlan && (
                              <MealEditor
                                key={`${viewMemberId}-${selectedKey}`}
                                meals={selectedLog?.meals ?? []}
                                goal={activePlan.calorieGoal}
                                canEdit={canEdit}
                                onChange={(meals) => saveMeals(selectedKey, meals)}
                              />
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
              </div>
            )}

            {mainTab === "bmi" && (
              <LiverBmiCard
                plan={activePlan}
                bodyLogs={memberBodyLogs}
                selectedDate={selectedDate}
                selectedKey={selectedKey}
                canEdit={canEdit && !!activePlan}
                onSelectDate={(date) => {
                  setSelectedDate(date)
                  setMonth(date)
                }}
                onSaveHeight={saveHeight}
                onSaveBody={saveBody}
                onDeleteBody={removeBody}
              />
            )}
          </div>
        )}
      </main>

      {canEdit && activePlan && settingsKey > 0 && (
        <PlanSettingsDialog
          key={settingsKey}
          plan={activePlan}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSave={async (next) => {
            await saveLiverPlan(next)
            planSaved.current = true
          }}
        />
      )}
    </div>
  )
}

function DayRecommendation({
  date,
  canEdit,
  onApply,
}: {
  date: Date
  canEdit: boolean
  onApply: () => Promise<void>
}) {
  const menu = weeklyMenuFor(date)
  const [applying, setApplying] = useState(false)
  const totalKcal = menu.meals.reduce((sum, meal) => sum + meal.kcal, 0)

  const handleApply = async () => {
    if (!canEdit || applying) return
    setApplying(true)
    try {
      await onApply()
    } finally {
      setApplying(false)
    }
  }

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            추천식 · {menu.title}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">합계 약 {formatKcal(totalKcal)} kcal</p>
        </div>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            disabled={applying}
            onClick={handleApply}
          >
            {applying ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            추천식 적용
          </Button>
        )}
      </div>
      <ul className="mt-2 space-y-1.5">
        {menu.meals.map((meal) => (
          <li key={meal.slot} className="flex gap-2 text-sm">
            <span className="w-14 shrink-0 text-zinc-500">
              {mealSlotMeta[meal.slot].emoji} {mealSlotMeta[meal.slot].label}
            </span>
            <span className="min-w-0 flex-1 text-zinc-800 dark:text-zinc-100">{meal.text}</span>
            <span className="shrink-0 tabular-nums text-xs text-zinc-500">{meal.kcal}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex gap-2 text-sm">
        <span className="w-14 shrink-0 text-zinc-500">🏃 운동</span>
        <span className="text-zinc-800 dark:text-zinc-100">{menu.exercise}</span>
      </p>
      <StrengthExample />
      {menu.notes && menu.notes.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-emerald-200/80 pt-2 text-xs text-emerald-800 dark:border-emerald-900 dark:text-emerald-300">
          {menu.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function StrengthExample() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2 border-t border-emerald-200/80 pt-2 dark:border-emerald-900">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-emerald-800 dark:text-emerald-200"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>근력 운동 예시</span>
        <span className="text-xs font-normal text-zinc-500">{open ? "접기" : "보기"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2.5">
          <p className="text-xs text-zinc-500">{STRENGTH_ROUTINE.summary}</p>
          <ol className="space-y-2.5">
            {STRENGTH_ROUTINE.exercises.map((exercise, index) => (
              <li key={exercise.name}>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  {index + 1}. {exercise.name}
                  <span className="ml-1 font-normal text-zinc-500">({exercise.area})</span>
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-200">{exercise.dose}</p>
                <ul className="mt-0.5 space-y-0.5 text-xs text-zinc-500">
                  {exercise.cues.map((cue) => (
                    <li key={cue}>{cue}</li>
                  ))}
                </ul>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">{exercise.effect}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-zinc-400">{hint}</p>
    </div>
  )
}

function MealEditor({
  meals,
  goal,
  canEdit,
  onChange,
}: {
  meals: LiverMeal[]
  goal: number
  canEdit: boolean
  onChange: (meals: LiverMeal[]) => Promise<void>
}) {
  const [slot, setSlot] = useState<MealSlot>("breakfast")
  const [name, setName] = useState("")
  const [kcal, setKcal] = useState("")
  const [kcalSource, setKcalSource] = useState<"auto" | "manual" | "empty">("empty")
  const [baseFood, setBaseFood] = useState<FoodCalorie | null>(null)
  const [portion, setPortion] = useState<number>(1)
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const total = sumMealKcal(meals)
  const over = goal > 0 && total > goal
  const ratio = goal > 0 ? Math.min(total / goal, 1) : 0
  const suggestions = searchFoods(name)

  const applyFood = (food: FoodCalorie, nextPortion = 1) => {
    setName(food.name)
    setBaseFood(food)
    setPortion(nextPortion)
    setKcal(String(Math.round(food.kcal * nextPortion)))
    setKcalSource("auto")
    setOpen(false)
  }

  const handleNameChange = (value: string) => {
    setName(value)
    setOpen(true)
    if (kcalSource === "manual") return
    const exact = findExactFood(value)
    if (exact) {
      setBaseFood(exact)
      setPortion(1)
      setKcal(String(exact.kcal))
      setKcalSource("auto")
      return
    }
    if (kcalSource === "auto") {
      setBaseFood(null)
      setKcal("")
      setKcalSource("empty")
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit || adding) return
    const trimmed = name.trim()
    if (!trimmed) {
      alert("음식 이름을 입력해주세요.")
      return
    }
    const exact = baseFood ?? findExactFood(trimmed)
    let parsed = kcal.trim() ? Number(kcal) : NaN
    if (!Number.isFinite(parsed)) {
      if (!exact) {
        alert("칼로리를 입력해주세요. 목록에 없는 음식은 직접 적으면 됩니다.")
        return
      }
      parsed = Math.round(exact.kcal * portion)
    }
    if (parsed < 0 || parsed > 5000) {
      alert("칼로리는 0부터 5000 사이로 입력해주세요.")
      return
    }
    const useCatalog = exact && kcalSource !== "manual"
    const storedName = useCatalog ? exact.name : trimmed
    const serving =
      useCatalog && exact
        ? portion === 1
          ? exact.serving
          : `${exact.serving} × ${portion}`
        : undefined
    const meal: LiverMeal = {
      id: createLocalId("meal"),
      slot,
      name: storedName,
      kcal: Math.round(parsed),
      ...(serving ? { serving } : {}),
    }
    setAdding(true)
    try {
      await onChange([...meals, meal])
      setName("")
      setKcal("")
      setKcalSource("empty")
      setBaseFood(null)
      setPortion(1)
      setOpen(false)
    } catch {
      // parent alerts
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id: string) => {
    if (!canEdit) return
    try {
      await onChange(meals.filter((meal) => meal.id !== id))
    } catch {
      // parent alerts
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Flame className="h-4 w-4 text-amber-500" />
          오늘 식단
        </p>
        <p className="text-sm tabular-nums">
          <span className={cn("font-semibold", over ? "text-rose-600" : "text-emerald-700")}>
            {formatKcal(total)}
          </span>
          <span className="text-zinc-400"> / {formatKcal(goal)} kcal</span>
        </p>
      </div>
      <div className="mb-1 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={cn("h-full rounded-full", over ? "bg-rose-500" : "bg-emerald-500")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        {goal <= 0
          ? "칼로리 합계입니다."
          : over
            ? `목표보다 ${formatKcal(total - goal)}kcal 더 먹었어요.`
            : total === goal
              ? "목표 칼로리에 맞았어요."
              : `${formatKcal(goal - total)}kcal 남았어요.`}
        {" "}
        음식 칼로리는 1인분 평균이 자동으로 들어가고, 양에 맞게 고칠 수 있어요.
      </p>

      {canEdit && (
        <form onSubmit={handleAdd} className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {MEAL_SLOTS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSlot(key)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  slot === key
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900"
                )}
              >
                {mealSlotMeta[key].emoji} {mealSlotMeta[key].label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_auto]">
            <div className="relative">
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setOpen(false), 120)
                }}
                placeholder="음식 이름, 예: 현미밥"
                aria-label="음식 이름"
              />
              {open && suggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-900">
                  {suggestions.map((food) => (
                    <li key={food.name}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          applyFood(food)
                        }}
                      >
                        <span>
                          {food.name}
                          <span className="ml-1 text-xs text-zinc-400">{food.serving}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-500">{food.kcal} kcal</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="relative">
              <Input
                inputMode="numeric"
                value={kcal}
                onChange={(e) => {
                  setKcal(sanitizeDigits(e.target.value))
                  setKcalSource("manual")
                }}
                placeholder="kcal"
                aria-label="칼로리"
                className={kcalSource === "auto" ? "pr-10" : undefined}
              />
              {kcalSource === "auto" && (
                <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] font-medium text-emerald-600">
                  평균
                </span>
              )}
            </div>
            <Button type="submit" disabled={adding} className="gap-1">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              추가
            </Button>
          </div>
          {baseFood && kcalSource === "auto" && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-zinc-500">인분</span>
              {PORTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setPortion(value)
                    setKcal(String(Math.round(baseFood.kcal * value)))
                    setKcalSource("auto")
                  }}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs tabular-nums",
                    portion === value
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                  )}
                >
                  {value}
                </button>
              ))}
              <span className="text-xs text-zinc-400">
                {baseFood.serving} 평균 {baseFood.kcal}kcal
              </span>
            </div>
          )}
        </form>
      )}

      {meals.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">음식을 추가하면 하루 칼로리가 합산됩니다.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {MEAL_SLOTS.map((key) => {
            const items = meals.filter((meal) => meal.slot === key)
            if (items.length === 0) return null
            const slotTotal = sumMealKcal(items)
            return (
              <div key={key}>
                <p className="mb-1 text-xs text-zinc-500">
                  {mealSlotMeta[key].emoji} {mealSlotMeta[key].label} · {formatKcal(slotTotal)} kcal
                </p>
                <ul className="space-y-1">
                  {items.map((meal) => (
                    <li
                      key={meal.id}
                      className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 text-sm dark:bg-zinc-950"
                    >
                      <span className="min-w-0 flex-1 truncate">{meal.name}</span>
                      {meal.serving && (
                        <span className="hidden text-xs text-zinc-400 sm:inline">{meal.serving}</span>
                      )}
                      <span className="tabular-nums text-zinc-600 dark:text-zinc-300">{meal.kcal}</span>
                      {canEdit && (
                        <button
                          type="button"
                          className="text-zinc-400 hover:text-rose-600"
                          onClick={() => handleRemove(meal.id)}
                          aria-label={`${meal.name} 삭제`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HabitDropPlaceholder() {
  return (
    <div
      aria-hidden
      className="flex min-h-[5.5rem] items-center justify-center rounded-lg border-2 border-dashed border-emerald-500 bg-emerald-50/50 px-3 py-4 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
    >
      여기에 놓기
    </div>
  )
}

function moveHabitToIndex(list: LiverHabit[], fromId: string, insertBeforeIndex: number) {
  const from = list.findIndex((habit) => habit.id === fromId)
  if (from < 0) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  let at = insertBeforeIndex
  if (from < insertBeforeIndex) at -= 1
  at = Math.max(0, Math.min(at, next.length))
  if (at === from) return list
  next.splice(at, 0, item)
  return next
}

function PlanSettingsDialog({
  plan,
  open,
  onOpenChange,
  onSave,
}: {
  plan: LiverPlan
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (plan: LiverPlan) => Promise<void>
}) {
  const [goal, setGoal] = useState(String(plan.calorieGoal))
  const [habits, setHabits] = useState<LiverHabit[]>(() =>
    plan.habits.map((habit) => ({ ...habit, weekdays: [...habit.weekdays] }))
  )
  const [newLabel, setNewLabel] = useState("")
  const [newKind, setNewKind] = useState<HabitKind>("custom")
  const [saving, setSaving] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const dropIndexRef = useRef<number | null>(null)
  const habitListRef = useRef<HTMLDivElement>(null)

  const updateHabit = (id: string, patch: Partial<LiverHabit>) => {
    setHabits((current) => current.map((habit) => (habit.id === id ? { ...habit, ...patch } : habit)))
  }

  const moveHabit = (id: string, direction: -1 | 1) => {
    setHabits((current) => {
      const index = current.findIndex((habit) => habit.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  const updateDropPreview = (clientY: number) => {
    const list = habitListRef.current
    if (!list || !dragIdRef.current) return
    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-habit-id]"))
    let insertBefore = rows.length
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        insertBefore = i
        break
      }
    }
    if (dropIndexRef.current === insertBefore) return
    dropIndexRef.current = insertBefore
    setDropIndex(insertBefore)
  }

  const onDragHandlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const index = habits.findIndex((habit) => habit.id === id)
    dragIdRef.current = id
    dropIndexRef.current = index < 0 ? null : index
    setDraggingId(id)
    setDropIndex(index < 0 ? null : index)
  }

  const onDragHandlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragIdRef.current) return
    updateDropPreview(event.clientY)
  }

  useEffect(() => {
    if (!draggingId) return
    const clearOnly = () => {
      dragIdRef.current = null
      dropIndexRef.current = null
      setDraggingId(null)
      setDropIndex(null)
    }
    const commit = () => {
      const fromId = dragIdRef.current
      const insertBefore = dropIndexRef.current
      if (fromId != null && insertBefore != null) {
        setHabits((current) => moveHabitToIndex(current, fromId, insertBefore))
      }
      clearOnly()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearOnly()
    }
    window.addEventListener("pointerup", commit)
    window.addEventListener("pointercancel", commit)
    window.addEventListener("blur", clearOnly)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointerup", commit)
      window.removeEventListener("pointercancel", commit)
      window.removeEventListener("blur", clearOnly)
      window.removeEventListener("keydown", onKey)
    }
  }, [draggingId])

  const toggleDay = (id: string, day: number) => {
    setHabits((current) =>
      current.map((habit) => {
        if (habit.id !== id) return habit
        const has = habit.weekdays.includes(day)
        const weekdays = has
          ? habit.weekdays.filter((value) => value !== day)
          : [...habit.weekdays, day].sort((a, b) => a - b)
        return { ...habit, weekdays }
      })
    )
  }

  const addHabit = () => {
    const label = newLabel.trim()
    if (!label) return
    if (habits.length >= 20) {
      alert("항목은 20개까지 넣을 수 있어요.")
      return
    }
    setHabits((current) => [
      ...current,
      { id: createLocalId("habit"), kind: newKind, label, weekdays: [0, 1, 2, 3, 4, 5, 6] },
    ])
    setNewLabel("")
    setNewKind("custom")
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const calorieGoal = Number(goal)
    if (!Number.isFinite(calorieGoal) || calorieGoal < 1 || calorieGoal > 8000) {
      alert("목표 칼로리는 1부터 8000 사이로 입력해주세요.")
      return
    }
    let nextHabits = habits
    const pendingLabel = newLabel.trim()
    if (pendingLabel) {
      if (habits.length >= 20) {
        alert("항목은 20개까지 넣을 수 있어요.")
        return
      }
      nextHabits = [
        ...habits,
        {
          id: createLocalId("habit"),
          kind: newKind,
          label: pendingLabel,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
        },
      ]
    }
    if (nextHabits.some((habit) => !habit.label.trim())) {
      alert("항목 이름을 입력해주세요.")
      return
    }
    setSaving(true)
    try {
      await onSave({
        ...plan,
        calorieGoal: Math.round(calorieGoal),
        habits: nextHabits.map((habit) => ({
          ...habit,
          label: habit.label.trim(),
        })),
      })
      onOpenChange(false)
    } catch (error) {
      console.error(error)
      alert(friendlySaveError(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>요일별 체크리스트</DialogTitle>
          <DialogDescription>
            요일을 눌러 그 날에 넣을 항목을 고릅니다. 왼쪽 핸들을 드래그해 노출 순서를 바꿀 수 있어요.
            종류가 식단인 항목이 있는 날에는 칼로리를 적을 수 있고, 저장하면 달력 완료 표시에도 반영됩니다.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="calorie-goal">하루 목표 칼로리</Label>
            <Input
              id="calorie-goal"
              inputMode="numeric"
              value={goal}
              onChange={(e) => setGoal(sanitizeDigits(e.target.value))}
              placeholder="1800"
            />
            <p className="text-xs text-zinc-500">식단 합계와 비교합니다. 몸 상태에 맞게 조절하세요.</p>
          </div>

          <div ref={habitListRef} className="space-y-3">
            <p className="text-xs text-zinc-500">
              목록 위쪽이 체크리스트에서 먼저 보입니다. ⋮⋮ 핸들을 끌어 점선 칸에 놓으세요.
            </p>
            {habits.map((habit, index) => {
              const dragFrom = draggingId
                ? habits.findIndex((item) => item.id === draggingId)
                : -1
              const showDropPlaceholder =
                draggingId != null &&
                dropIndex === index &&
                dragFrom >= 0 &&
                dropIndex !== dragFrom &&
                dropIndex !== dragFrom + 1
              return (
              <div key={habit.id} className="space-y-3">
                {showDropPlaceholder && <HabitDropPlaceholder />}
              <div
                data-habit-id={habit.id}
                className={cn(
                  "rounded-lg border p-3 dark:border-zinc-800",
                  draggingId === habit.id && "opacity-45"
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="mt-0.5 flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing dark:hover:bg-zinc-800"
                    aria-label={`${habit.label} 순서 드래그`}
                    onPointerDown={(event) => onDragHandlePointerDown(event, habit.id)}
                    onPointerMove={onDragHandlePointerMove}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <span className="mt-2 w-5 shrink-0 text-center text-xs font-medium text-zinc-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      value={habit.label}
                      maxLength={30}
                      onChange={(e) => updateHabit(habit.id, { label: e.target.value })}
                      aria-label="항목 이름"
                    />
                    <Select
                      value={habit.kind}
                      onValueChange={(value) => {
                        if (value && isHabitKind(value)) updateHabit(habit.id, { kind: value })
                      }}
                    >
                      <SelectTrigger className="w-full" aria-label="항목 종류">
                        <SelectValue>
                          {habitKindMeta[habit.kind].emoji} {habitKindMeta[habit.kind].label}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {HABIT_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {habitKindMeta[kind].emoji} {habitKindMeta[kind].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400"
                      disabled={index === 0}
                      onClick={() => moveHabit(habit.id, -1)}
                      aria-label={`${habit.label} 위로`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400"
                      disabled={index === habits.length - 1}
                      onClick={() => moveHabit(habit.id, 1)}
                      aria-label={`${habit.label} 아래로`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400 hover:text-rose-600"
                      onClick={() => setHabits((current) => current.filter((item) => item.id !== habit.id))}
                      aria-label={`${habit.label} 삭제`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex gap-1">
                  {WEEKDAY_LABELS.map((label, day) => {
                    const on = habit.weekdays.includes(day)
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleDay(habit.id, day)}
                        className={cn(
                          "h-8 flex-1 rounded-md text-xs font-medium",
                          on
                            ? "bg-emerald-600 text-white"
                            : day === 0
                              ? "bg-rose-50 text-rose-500 dark:bg-rose-950/40"
                              : day === 6
                                ? "bg-sky-50 text-sky-600 dark:bg-sky-950/40"
                                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              </div>
              )
            })}
            {draggingId &&
              dropIndex === habits.length &&
              habits.findIndex((item) => item.id === draggingId) !== habits.length - 1 && (
                <HabitDropPlaceholder />
              )}
          </div>

          <div className="space-y-2 rounded-lg border border-dashed p-3 dark:border-zinc-700">
            <p className="text-sm font-medium">항목 추가</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newLabel}
                maxLength={30}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="예: 계단 이용"
              />
              <Select
                value={newKind}
                onValueChange={(value) => {
                  if (value && isHabitKind(value)) setNewKind(value)
                }}
              >
                <SelectTrigger className="sm:w-32" aria-label="새 항목 종류">
                  <SelectValue>
                    {habitKindMeta[newKind].emoji} {habitKindMeta[newKind].label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {HABIT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {habitKindMeta[kind].emoji} {habitKindMeta[kind].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={addHabit}>
                추가
              </Button>
            </div>
            <p className="text-xs text-zinc-500">새로 넣은 항목은 모든 요일에 켜지고, 위에서 요일을 뺄 수 있어요.</p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!confirm("기본 생활습관으로 되돌릴까요?")) return
                setHabits(createDefaultPlan(plan.familyId, plan.memberId).habits)
                setGoal("1800")
              }}
            >
              기본값
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              저장
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
