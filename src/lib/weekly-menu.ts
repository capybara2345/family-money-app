import Holidays from "date-holidays"
import { createLocalId, type LiverMeal, type MealSlot } from "@/lib/liver"

export type StrengthExercise = {
  name: string
  area: string
  dose: string
  cues: string[]
  effect: string
}

export const STRENGTH_ROUTINE = {
  summary: "주 2~3회, 한 번에 약 15~25분이면 충분합니다.",
  exercises: [
    {
      name: "스쿼트",
      area: "하체",
      dose: "15회 × 3세트",
      cues: ["세트 사이 60초 휴식", "엉덩이를 뒤로 빼면서 앉았다 일어나기"],
      effect: "허벅지와 엉덩이 근육 강화",
    },
    {
      name: "벽 푸시업",
      area: "가슴·팔",
      dose: "12회 × 3세트",
      cues: ["벽에 손을 대고 팔굽혀펴기", "익숙해지면 무릎 푸시업으로 변경"],
      effect: "가슴과 팔 근육 강화",
    },
    {
      name: "플랭크",
      area: "복부·코어",
      dose: "20~30초 × 3세트",
      cues: ["허리가 아래로 꺾이지 않도록 유지", "익숙해지면 40~60초로 증가"],
      effect: "복부와 코어 안정성 강화",
    },
    {
      name: "글루트 브릿지",
      area: "엉덩이·하체",
      dose: "15회 × 3세트",
      cues: ["누워서 무릎을 세우고 엉덩이 들어 올리기"],
      effect: "엉덩이와 골반 주변 근육 강화",
    },
    {
      name: "버드독",
      area: "등·코어",
      dose: "좌우 각 10회 × 2세트",
      cues: ["네발기기 자세에서 반대쪽 팔과 다리 뻗기"],
      effect: "등과 코어 안정성 강화",
    },
  ] satisfies StrengthExercise[],
}

export type RecommendedMeal = {
  slot: MealSlot
  text: string
  /** 추천식 적용 시 넣는 평균 칼로리 */
  kcal: number
}

export type WeeklyMenu = {
  /** Date.getDay()와 같다. 0=일 … 6=토 */
  weekday: number
  title: string
  meals: RecommendedMeal[]
  exercise: string
  notes?: string[]
}

const FAMILY_DINNER_TEXT = "가족 저녁 외식 (과식·튀김·술 자제)"
const FAMILY_DINNER_KCAL = 700

const FAMILY_OUTING_NOTES = [
  "가족과 함께 저녁을 먹기 쉬운 날입니다.",
  "생선구이·맑은 국·샐러드 위주로 고르고, 튀김·단음료·과음은 줄입니다.",
  "외식 분량이 많으면 밥은 2/3 공기 이하로 맞춥니다.",
]

const holidays = new Holidays("KR")

export function isPublicHoliday(date: Date): boolean {
  return Boolean(holidays.isHoliday(date))
}

/** 토·일 또는 공휴일처럼 가족 저녁 외식 확률이 높은 날 */
export function isFamilyOutingDay(date: Date): boolean {
  const dow = date.getDay()
  return dow === 0 || dow === 6 || isPublicHoliday(date)
}

export const WEEKLY_MENUS: WeeklyMenu[] = [
  {
    weekday: 1,
    title: "식단 리셋",
    meals: [
      { slot: "breakfast", text: "계란 2개 + 바나나 + 두유", kcal: 380 },
      { slot: "lunch", text: "백반 (밥 2/3공기 + 생선)", kcal: 480 },
      { slot: "dinner", text: "두부 + 닭고기 + 채소", kcal: 420 },
    ],
    exercise: "걷기 20~30분",
  },
  {
    weekday: 2,
    title: "단백질 보충",
    meals: [
      { slot: "breakfast", text: "삶은 계란 + 통밀빵", kcal: 240 },
      { slot: "lunch", text: "일반식 (고기 반찬 + 밥)", kcal: 650 },
      { slot: "dinner", text: "닭가슴살 + 현미밥 + 채소", kcal: 500 },
    ],
    exercise: "걷기 20분 + 근력 15분",
  },
  {
    weekday: 3,
    title: "버거킹 허용일",
    meals: [
      { slot: "breakfast", text: "계란 2개 + 무가당 두유", kcal: 290 },
      { slot: "lunch", text: "와퍼 단품 또는 치킨킹 단품", kcal: 650 },
      { slot: "dinner", text: "두부 + 생선 + 채소", kcal: 400 },
    ],
    exercise: "걷기 30분",
    notes: ["햄버거 먹는 날입니다.", "감자튀김은 생략하고 물 또는 제로 음료를 고릅니다."],
  },
  {
    weekday: 4,
    title: "저녁 관리",
    meals: [
      { slot: "breakfast", text: "그릭요거트 + 견과류", kcal: 280 },
      { slot: "lunch", text: "일반식 (밥 2/3공기)", kcal: 550 },
      { slot: "dinner", text: "두부 + 계란 + 채소", kcal: 280 },
    ],
    exercise: "걷기 20~30분 + 근력 15분",
  },
  {
    weekday: 5,
    title: "지방 관리",
    meals: [
      { slot: "breakfast", text: "계란 + 바나나", kcal: 165 },
      { slot: "lunch", text: "생선구이 백반", kcal: 550 },
      { slot: "dinner", text: "연어 또는 닭고기 + 채소 + 밥", kcal: 550 },
    ],
    exercise: "걷기 30분",
  },
  {
    weekday: 6,
    title: "가족 외식일",
    meals: [
      { slot: "breakfast", text: "계란 + 두유", kcal: 215 },
      { slot: "lunch", text: "가벼운 집밥 또는 외식 전 간단식 (과식 금지)", kcal: 450 },
      { slot: "dinner", text: FAMILY_DINNER_TEXT, kcal: FAMILY_DINNER_KCAL },
    ],
    exercise: "걷기 40분 또는 자전거 30분",
    notes: [...FAMILY_OUTING_NOTES],
  },
  {
    weekday: 0,
    title: "회복·가족 외식",
    meals: [
      { slot: "breakfast", text: "그릭요거트 + 계란", kcal: 175 },
      { slot: "lunch", text: "일반식 (밥 2/3공기)", kcal: 550 },
      { slot: "dinner", text: FAMILY_DINNER_TEXT, kcal: FAMILY_DINNER_KCAL },
    ],
    exercise: "가벼운 산책 20분",
    notes: [...FAMILY_OUTING_NOTES, "체중과 허리둘레를 기록합니다."],
  },
]

const menuByWeekday = new Map(WEEKLY_MENUS.map((menu) => [menu.weekday, menu]))

function withDinner(menu: WeeklyMenu, dinner: string, kcal: number, notes: string[]): WeeklyMenu {
  return {
    ...menu,
    meals: menu.meals.map((meal) =>
      meal.slot === "dinner" ? { ...meal, text: dinner, kcal } : meal
    ),
    notes,
  }
}

export function weeklyMenuFor(date: Date): WeeklyMenu {
  const base = menuByWeekday.get(date.getDay())
  if (!base) throw new Error("요일 추천식을 찾을 수 없습니다.")

  const holiday = isPublicHoliday(date)
  const weekend = date.getDay() === 0 || date.getDay() === 6

  if (weekend || !holiday) return base

  return {
    ...withDinner(base, FAMILY_DINNER_TEXT, FAMILY_DINNER_KCAL, [
      "공휴일이라 가족과 저녁 외식할 확률이 높습니다.",
      ...FAMILY_OUTING_NOTES.slice(1),
      ...(base.notes ?? []),
    ]),
    title: `${base.title} · 공휴일 외식`,
  }
}

/** 추천식을 식단 기록 항목으로 만든다. 아침·점심·저녁만 바꾸며 간식은 유지한다. */
export function applyRecommendedMeals(
  menu: WeeklyMenu,
  currentMeals: LiverMeal[]
): LiverMeal[] {
  const kept = currentMeals.filter((meal) => meal.slot === "snack")
  const recommended = menu.meals.map((meal) => {
    const item: LiverMeal = {
      id: createLocalId("meal"),
      slot: meal.slot,
      name: meal.text,
      kcal: meal.kcal,
      serving: "추천식 1회",
    }
    return item
  })
  return [...recommended, ...kept]
}
