export type BmiCategory = "under" | "normal" | "over" | "obese"

export type BmiInfo = {
  value: number
  category: BmiCategory
  label: string
  hint: string
  className: string
}

/** 아시아·태평양 기준에 맞춘 BMI 구간 */
export function categorizeBmi(bmi: number): BmiInfo {
  if (bmi < 18.5) {
    return {
      value: bmi,
      category: "under",
      label: "저체중",
      hint: "영양과 근력 관리를 함께 보세요.",
      className: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
    }
  }
  if (bmi < 23) {
    return {
      value: bmi,
      category: "normal",
      label: "정상",
      hint: "현재 구간을 유지하는 게 좋습니다.",
      className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
    }
  }
  if (bmi < 25) {
    return {
      value: bmi,
      category: "over",
      label: "과체중",
      hint: "식단·걷기 관리로 천천히 줄여 보세요.",
      className: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
    }
  }
  return {
    value: bmi,
    category: "obese",
    label: "비만",
    hint: "생활습관과 함께 의료 상담을 권합니다.",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
  }
}

export function calcBmi(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null
  if (weightKg <= 0 || heightCm <= 0) return null
  const meters = heightCm / 100
  return weightKg / (meters * meters)
}

export function formatBmi(bmi: number) {
  return bmi.toFixed(1)
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

/** BMI 18.5~22.9에 해당하는 몸무게 구간 */
export function healthyWeightRange(heightCm: number): { min: number; max: number } | null {
  if (!Number.isFinite(heightCm) || heightCm <= 0) return null
  const meters = heightCm / 100
  const sq = meters * meters
  return {
    min: round1(18.5 * sq),
    max: round1(22.9 * sq),
  }
}

/** 키 기반 표준·이상 체중 지표 */
export type StandardWeightMetrics = {
  /** 수정 브로카: (키-100)×0.9 — 국내에서 흔히 쓰는 표준체중 */
  modifiedBroca: number
  /** 브로카: 키-100 */
  broca: number
  /** BMI 22 기준 이상체중 */
  idealBmi22: number
  /** BMI 정상 구간(18.5~22.9) 체중 */
  healthyMin: number
  healthyMax: number
}

export function standardWeightMetrics(heightCm: number): StandardWeightMetrics | null {
  if (!Number.isFinite(heightCm) || heightCm < 100) return null
  const meters = heightCm / 100
  const sq = meters * meters
  const range = healthyWeightRange(heightCm)
  if (!range) return null
  return {
    modifiedBroca: round1((heightCm - 100) * 0.9),
    broca: round1(heightCm - 100),
    idealBmi22: round1(22 * sq),
    healthyMin: range.min,
    healthyMax: range.max,
  }
}

export function weightDiffKg(currentKg: number, targetKg: number) {
  return round1(currentKg - targetKg)
}

export function parseDecimalInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "")
  const parts = cleaned.split(".")
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts.slice(1).join("")}`
}
