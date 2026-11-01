import { db } from "@/lib/firebase"
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore"
import {
  DEFAULT_CALORIE_GOAL,
  type HabitKind,
  type LiverBodyLog,
  type LiverHabit,
  type LiverLog,
  type LiverMeal,
  type LiverPlan,
  type MealSlot,
} from "@/lib/liver"

const HABIT_KINDS: HabitKind[] = ["diet", "exercise", "sleep", "alcohol", "water", "custom"]
const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"]

const plansCollection = collection(db, "liverPlans")
const logsCollection = collection(db, "liverLogs")
const bodyCollection = collection(db, "liverBodyLogs")

function parseHabits(raw: unknown): LiverHabit[] {
  if (!Array.isArray(raw)) return []
  const habits: LiverHabit[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const id = String(row.id ?? "").trim()
    const label = String(row.label ?? "").trim()
    if (!id || !label) continue
    const kind = HABIT_KINDS.includes(row.kind as HabitKind) ? (row.kind as HabitKind) : "custom"
    const weekdays = Array.isArray(row.weekdays)
      ? [...new Set(row.weekdays.map(Number).filter((day) => day >= 0 && day <= 6))]
      : []
    habits.push({ id, kind, label, weekdays })
  }
  return habits
}

function parseChecks(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const checks: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "boolean") checks[key] = value
  }
  return checks
}

function parseMeals(raw: unknown): LiverMeal[] {
  if (!Array.isArray(raw)) return []
  const meals: LiverMeal[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const id = String(row.id ?? "").trim()
    const name = String(row.name ?? "").trim()
    const slot = MEAL_SLOTS.includes(row.slot as MealSlot) ? (row.slot as MealSlot) : null
    const kcal = typeof row.kcal === "number" ? Math.round(row.kcal) : NaN
    if (!id || !name || !slot || !Number.isFinite(kcal) || kcal < 0) continue
    const meal: LiverMeal = { id, slot, name, kcal }
    if (typeof row.serving === "string" && row.serving.trim()) meal.serving = row.serving.trim()
    meals.push(meal)
  }
  return meals
}

function parseHeightCm(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined
  if (raw < 100 || raw > 250) return undefined
  return Math.round(raw * 10) / 10
}

function parsePlan(id: string, data: Record<string, unknown>): LiverPlan {
  const calorieGoal =
    typeof data.calorieGoal === "number" && data.calorieGoal > 0
      ? Math.round(data.calorieGoal)
      : DEFAULT_CALORIE_GOAL
  const heightCm = parseHeightCm(data.heightCm)
  return {
    id,
    familyId: String(data.familyId ?? ""),
    memberId: String(data.memberId ?? ""),
    calorieGoal,
    ...(heightCm != null ? { heightCm } : {}),
    habits: parseHabits(data.habits),
  }
}

function parseBodyLog(id: string, data: Record<string, unknown>): LiverBodyLog | null {
  const weightKg = typeof data.weightKg === "number" ? data.weightKg : NaN
  const date = String(data.date ?? "")
  if (!date || !Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 400) return null
  const waistRaw = typeof data.waistCm === "number" ? data.waistCm : NaN
  const waistCm =
    Number.isFinite(waistRaw) && waistRaw >= 40 && waistRaw <= 200
      ? Math.round(waistRaw * 10) / 10
      : undefined
  return {
    id,
    familyId: String(data.familyId ?? ""),
    memberId: String(data.memberId ?? ""),
    date,
    weightKg: Math.round(weightKg * 10) / 10,
    ...(waistCm != null ? { waistCm } : {}),
  }
}

function parseLog(id: string, data: Record<string, unknown>): LiverLog {
  return {
    id,
    familyId: String(data.familyId ?? ""),
    memberId: String(data.memberId ?? ""),
    date: String(data.date ?? ""),
    checks: parseChecks(data.checks),
    meals: parseMeals(data.meals),
  }
}

export function subscribeLiverPlans(
  familyId: string,
  callback: (plans: LiverPlan[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(plansCollection, where("familyId", "==", familyId))
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((docSnap) => parsePlan(docSnap.id, docSnap.data())))
    },
    (error) => {
      console.error("liverPlans subscription error:", error)
      onError?.(error)
    }
  )
}

export function subscribeLiverLogs(
  familyId: string,
  callback: (logs: LiverLog[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(logsCollection, where("familyId", "==", familyId))
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((docSnap) => parseLog(docSnap.id, docSnap.data())))
    },
    (error) => {
      console.error("liverLogs subscription error:", error)
      onError?.(error)
    }
  )
}

export function subscribeLiverBodyLogs(
  familyId: string,
  callback: (logs: LiverBodyLog[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(bodyCollection, where("familyId", "==", familyId))
  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs
        .map((docSnap) => parseBodyLog(docSnap.id, docSnap.data()))
        .filter((log): log is LiverBodyLog => log !== null)
        .sort((a, b) => b.date.localeCompare(a.date))
      callback(logs)
    },
    (error) => {
      console.error("liverBodyLogs subscription error:", error)
      onError?.(error)
    }
  )
}

export async function saveLiverPlan(plan: LiverPlan) {
  const id = plan.id || `${plan.familyId}_${plan.memberId}`
  const payload: Record<string, unknown> = {
    familyId: plan.familyId,
    memberId: plan.memberId,
    calorieGoal: plan.calorieGoal,
    habits: plan.habits.map((habit) => ({
      id: habit.id,
      kind: habit.kind,
      label: habit.label,
      weekdays: habit.weekdays,
    })),
    updatedAt: Timestamp.now(),
  }
  if (plan.heightCm != null) payload.heightCm = plan.heightCm
  await setDoc(doc(db, "liverPlans", id), payload, { merge: true })
}

export async function saveLiverBodyLog(log: LiverBodyLog) {
  const id = log.id || `${log.familyId}_${log.memberId}_${log.date}`
  const payload: Record<string, unknown> = {
    familyId: log.familyId,
    memberId: log.memberId,
    date: log.date,
    weightKg: log.weightKg,
    updatedAt: Timestamp.now(),
    waistCm: log.waistCm != null ? log.waistCm : deleteField(),
  }
  await setDoc(doc(db, "liverBodyLogs", id), payload, { merge: true })
}

export async function deleteLiverBodyLog(id: string) {
  await deleteDoc(doc(db, "liverBodyLogs", id))
}

export async function saveLiverLog(log: LiverLog) {
  const id = log.id || `${log.familyId}_${log.memberId}_${log.date}`
  await setDoc(doc(db, "liverLogs", id), {
    familyId: log.familyId,
    memberId: log.memberId,
    date: log.date,
    checks: log.checks,
    meals: log.meals.map((meal) => {
      const payload: Record<string, unknown> = {
        id: meal.id,
        slot: meal.slot,
        name: meal.name,
        kcal: meal.kcal,
      }
      if (meal.serving) payload.serving = meal.serving
      return payload
    }),
    updatedAt: Timestamp.now(),
  })
}
