export type HabitKind = "diet" | "exercise" | "sleep" | "alcohol" | "water" | "custom"

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack"

export type LiverHabit = {
  id: string
  kind: HabitKind
  label: string
  /** 0=일 … 6=토. Date.getDay()와 같다. */
  weekdays: number[]
}

export type LiverPlan = {
  id?: string
  familyId: string
  memberId: string
  calorieGoal: number
  /** 키(cm). BMI 계산에 사용한다. */
  heightCm?: number
  habits: LiverHabit[]
}

export type LiverBodyLog = {
  id?: string
  familyId: string
  memberId: string
  date: string
  weightKg: number
  waistCm?: number
}

export type LiverMeal = {
  id: string
  slot: MealSlot
  name: string
  kcal: number
  serving?: string
}

export type LiverLog = {
  id?: string
  familyId: string
  memberId: string
  date: string
  checks: Record<string, boolean>
  meals: LiverMeal[]
}

export const DEFAULT_CALORIE_GOAL = 1800

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const

export const habitKindMeta: Record<HabitKind, { label: string; emoji: string }> = {
  diet: { label: "식단", emoji: "🍽️" },
  exercise: { label: "운동", emoji: "🏃" },
  sleep: { label: "수면", emoji: "😴" },
  alcohol: { label: "금주", emoji: "🚫" },
  water: { label: "수분", emoji: "💧" },
  custom: { label: "기타", emoji: "✅" },
}

export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"]

export const mealSlotMeta: Record<MealSlot, { label: string; emoji: string }> = {
  breakfast: { label: "아침", emoji: "🌅" },
  lunch: { label: "점심", emoji: "☀️" },
  dinner: { label: "저녁", emoji: "🌙" },
  snack: { label: "간식", emoji: "🍎" },
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const STRENGTH_DAYS = [1, 3, 5]

export function defaultHabits(): LiverHabit[] {
  return [
    { id: "diet", kind: "diet", label: "식단 기록", weekdays: [...ALL_DAYS] },
    { id: "no-late-sugar", kind: "custom", label: "야식·당음료 없음", weekdays: [...ALL_DAYS] },
    { id: "alcohol", kind: "alcohol", label: "금주", weekdays: [...ALL_DAYS] },
    { id: "exercise-cardio", kind: "exercise", label: "유산소 30분", weekdays: [...ALL_DAYS] },
    { id: "exercise-strength", kind: "exercise", label: "근력 운동", weekdays: [...STRENGTH_DAYS] },
    { id: "sleep", kind: "sleep", label: "수면 7시간", weekdays: [...ALL_DAYS] },
    { id: "water", kind: "water", label: "물 1.5L", weekdays: [...ALL_DAYS] },
  ]
}

export function createDefaultPlan(familyId: string, memberId: string): LiverPlan {
  return {
    familyId,
    memberId,
    calorieGoal: DEFAULT_CALORIE_GOAL,
    habits: defaultHabits(),
  }
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  const next = startOfDay(date)
  next.setDate(next.getDate() + days)
  return next
}

export function scheduledHabits(plan: LiverPlan, date: Date): LiverHabit[] {
  const dow = date.getDay()
  return plan.habits.filter((habit) => habit.weekdays.includes(dow))
}

export function dayProgress(plan: LiverPlan, date: Date, log: LiverLog | undefined) {
  const habits = scheduledHabits(plan, date)
  const done = habits.filter((habit) => log?.checks[habit.id] === true).length
  return {
    total: habits.length,
    done,
    complete: habits.length > 0 && done === habits.length,
  }
}

export function isDayComplete(plan: LiverPlan, date: Date, log: LiverLog | undefined): boolean {
  return dayProgress(plan, date, log).complete
}

export function monthCompletion(
  plan: LiverPlan,
  logsByDate: Map<string, LiverLog>,
  year: number,
  month: number,
  today: Date
) {
  const todayStart = startOfDay(today)
  const days = new Date(year, month + 1, 0).getDate()
  let scheduled = 0
  let complete = 0
  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day)
    if (date > todayStart) continue
    if (scheduledHabits(plan, date).length === 0) continue
    scheduled += 1
    if (isDayComplete(plan, date, logsByDate.get(toDateKey(date)))) complete += 1
  }
  return { scheduled, complete }
}

/** 오늘이 아직 미완성이면 어제부터 센다. 항목이 없는 날은 연속을 끊지 않는다. */
export function completionStreak(
  plan: LiverPlan,
  logsByDate: Map<string, LiverLog>,
  today: Date
): number {
  let cursor = startOfDay(today)
  const todayHabits = scheduledHabits(plan, cursor)
  const todayDone =
    todayHabits.length > 0 && isDayComplete(plan, cursor, logsByDate.get(toDateKey(cursor)))
  if (!todayDone) cursor = addDays(cursor, -1)

  let streak = 0
  for (let i = 0; i < 400; i++) {
    const habits = scheduledHabits(plan, cursor)
    if (habits.length === 0) {
      cursor = addDays(cursor, -1)
      continue
    }
    if (!isDayComplete(plan, cursor, logsByDate.get(toDateKey(cursor)))) break
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function sumMealKcal(meals: LiverMeal[]): number {
  return meals.reduce((sum, meal) => sum + (Number.isFinite(meal.kcal) ? meal.kcal : 0), 0)
}

export function liverPlanDocId(familyId: string, memberId: string) {
  return `${familyId}_${memberId}`
}

export function liverLogDocId(familyId: string, memberId: string, date: string) {
  return `${familyId}_${memberId}_${date}`
}

export function createLocalId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}
