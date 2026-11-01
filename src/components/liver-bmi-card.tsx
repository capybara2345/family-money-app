"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Loader2, Scale, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  calcBmi,
  categorizeBmi,
  formatBmi,
  parseDecimalInput,
  standardWeightMetrics,
  weightDiffKg,
} from "@/lib/bmi"
import { cn } from "@/lib/utils"
import type { LiverBodyLog, LiverPlan } from "@/lib/liver"

type Props = {
  plan: LiverPlan | null
  bodyLogs: LiverBodyLog[]
  selectedDate: Date
  selectedKey: string
  canEdit: boolean
  onSelectDate: (date: Date) => void
  onSaveHeight: (heightCm: number) => Promise<void>
  onSaveBody: (log: Omit<LiverBodyLog, "id">) => Promise<void>
  onDeleteBody: (id: string) => Promise<void>
}

export function LiverBmiCard(props: Props) {
  return (
    <LiverBmiCardInner
      key={`${props.plan?.memberId ?? "none"}-${props.selectedKey}-${props.plan?.heightCm ?? "h"}-${props.bodyLogs.find((log) => log.date === props.selectedKey)?.weightKg ?? "w"}-${props.bodyLogs.find((log) => log.date === props.selectedKey)?.waistCm ?? "waist"}`}
      {...props}
    />
  )
}

function DiffText({ current, target }: { current: number; target: number }) {
  const diff = weightDiffKg(current, target)
  if (diff === 0) return <span className="text-zinc-500">목표와 같음</span>
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        diff > 0 ? "text-rose-600" : "text-emerald-600"
      )}
    >
      {diff > 0 ? "+" : ""}
      {diff}kg
    </span>
  )
}

function LiverBmiCardInner({
  plan,
  bodyLogs,
  selectedDate,
  selectedKey,
  canEdit,
  onSelectDate,
  onSaveHeight,
  onSaveBody,
  onDeleteBody,
}: Props) {
  const sorted = useMemo(
    () => [...bodyLogs].sort((a, b) => b.date.localeCompare(a.date)),
    [bodyLogs]
  )
  const latest = sorted[0]
  const selectedLog = sorted.find((log) => log.date === selectedKey)
  const previous = sorted.find((log) => log.date < (selectedLog?.date ?? selectedKey))

  const heightCm = plan?.heightCm
  const weightForBmi = selectedLog?.weightKg ?? latest?.weightKg
  const bmiValue =
    heightCm != null && weightForBmi != null ? calcBmi(weightForBmi, heightCm) : null
  const bmiInfo = bmiValue != null ? categorizeBmi(bmiValue) : null
  const standards = heightCm != null ? standardWeightMetrics(heightCm) : null
  const weightDelta =
    selectedLog && previous
      ? Math.round((selectedLog.weightKg - previous.weightKg) * 10) / 10
      : null

  const [height, setHeight] = useState(heightCm != null ? String(heightCm) : "")
  const [weight, setWeight] = useState(selectedLog ? String(selectedLog.weightKg) : "")
  const [waist, setWaist] = useState(
    selectedLog?.waistCm != null ? String(selectedLog.waistCm) : ""
  )
  const [savingHeight, setSavingHeight] = useState(false)
  const [savingBody, setSavingBody] = useState(false)

  const handleSaveHeight = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit || savingHeight) return
    const value = Number(height)
    if (!Number.isFinite(value) || value < 100 || value > 250) {
      alert("키는 100~250cm 사이로 입력해주세요.")
      return
    }
    setSavingHeight(true)
    try {
      await onSaveHeight(Math.round(value * 10) / 10)
    } catch {
      // parent alerts
    } finally {
      setSavingHeight(false)
    }
  }

  const handleSaveBody = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit || !plan || savingBody) return
    const weightKg = Number(weight)
    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 400) {
      alert("체중을 올바르게 입력해주세요.")
      return
    }
    let waistCm: number | undefined
    if (waist.trim()) {
      waistCm = Number(waist)
      if (!Number.isFinite(waistCm) || waistCm < 40 || waistCm > 200) {
        alert("허리둘레는 40~200cm 사이로 입력해주세요.")
        return
      }
      waistCm = Math.round(waistCm * 10) / 10
    }
    setSavingBody(true)
    try {
      await onSaveBody({
        familyId: plan.familyId,
        memberId: plan.memberId,
        date: selectedKey,
        weightKg: Math.round(weightKg * 10) / 10,
        ...(waistCm != null ? { waistCm } : {}),
      })
    } catch {
      // parent alerts
    } finally {
      setSavingBody(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-5 w-5 shrink-0 text-emerald-600" />
                BMI · 표준체중
              </CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                아시아 BMI 기준과 국내에서 흔히 쓰는 표준체중 지표입니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="w-auto"
                value={selectedKey}
                onChange={(e) => {
                  if (!e.target.value) return
                  const [y, m, d] = e.target.value.split("-").map(Number)
                  onSelectDate(new Date(y, m - 1, d))
                }}
                aria-label="기록 날짜"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSelectDate(new Date())}
              >
                오늘
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            {bmiInfo && weightForBmi != null && heightCm != null ? (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-500">현재 BMI</p>
                  <p className="text-3xl font-semibold tabular-nums tracking-tight">
                    {formatBmi(bmiInfo.value)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge className={cn("border-transparent", bmiInfo.className)}>
                      {bmiInfo.label}
                    </Badge>
                    <span className="text-xs text-zinc-500">
                      {weightForBmi}kg · {heightCm}cm
                      {!selectedLog && latest ? " · 최근 체중" : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{bmiInfo.hint}</p>
                </div>
                {weightDelta != null && (
                  <p
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      weightDelta < 0
                        ? "text-emerald-600"
                        : weightDelta > 0
                          ? "text-rose-600"
                          : "text-zinc-500"
                    )}
                  >
                    이전 대비 {weightDelta > 0 ? "+" : ""}
                    {weightDelta}kg
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                {canEdit
                  ? "키와 체중을 입력하면 BMI와 표준체중이 계산됩니다."
                  : "아직 키·체중 기록이 없습니다."}
              </p>
            )}
          </div>

          {standards && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500">표준체중 지표 (키 {heightCm}cm)</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border p-3 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500">표준체중 (수정 브로카)</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {standards.modifiedBroca}
                    <span className="ml-1 text-sm font-normal text-zinc-500">kg</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">(키−100)×0.9</p>
                  {weightForBmi != null && (
                    <p className="mt-1 text-xs">
                      현재 대비 <DiffText current={weightForBmi} target={standards.modifiedBroca} />
                    </p>
                  )}
                </div>
                <div className="rounded-lg border p-3 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500">이상체중 (BMI 22)</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {standards.idealBmi22}
                    <span className="ml-1 text-sm font-normal text-zinc-500">kg</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">건강 관리 목표로 자주 쓰는 기준</p>
                  {weightForBmi != null && (
                    <p className="mt-1 text-xs">
                      현재 대비 <DiffText current={weightForBmi} target={standards.idealBmi22} />
                    </p>
                  )}
                </div>
                <div className="rounded-lg border p-3 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500">정상 체중 구간</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {standards.healthyMin}~{standards.healthyMax}
                    <span className="ml-1 text-sm font-normal text-zinc-500">kg</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">BMI 18.5~22.9</p>
                  {weightForBmi != null && (
                    <p className="mt-1 text-xs text-zinc-500">
                      {weightForBmi < standards.healthyMin
                        ? `하한까지 ${weightDiffKg(standards.healthyMin, weightForBmi)}kg`
                        : weightForBmi > standards.healthyMax
                          ? `상한보다 ${weightDiffKg(weightForBmi, standards.healthyMax)}kg 초과`
                          : "정상 구간 안입니다"}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border p-3 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500">브로카 체중</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {standards.broca}
                    <span className="ml-1 text-sm font-normal text-zinc-500">kg</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">키−100 (참고용)</p>
                  {weightForBmi != null && (
                    <p className="mt-1 text-xs">
                      현재 대비 <DiffText current={weightForBmi} target={standards.broca} />
                    </p>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-zinc-400">
                개인 체형·근육량에 따라 달라질 수 있으니 참고 지표로만 보세요.
              </p>
            </div>
          )}

          {canEdit && plan && (
            <>
              <form onSubmit={handleSaveHeight} className="grid grid-cols-[1fr_auto] items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="bmi-height">키 (cm)</Label>
                  <Input
                    id="bmi-height"
                    inputMode="decimal"
                    value={height}
                    onChange={(e) => setHeight(parseDecimalInput(e.target.value))}
                    placeholder="예: 170"
                  />
                </div>
                <Button type="submit" variant="outline" disabled={savingHeight}>
                  {savingHeight ? <Loader2 className="h-4 w-4 animate-spin" /> : "키 저장"}
                </Button>
              </form>

              <form onSubmit={handleSaveBody} className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="bmi-weight">체중 (kg)</Label>
                    <Input
                      id="bmi-weight"
                      inputMode="decimal"
                      value={weight}
                      onChange={(e) => setWeight(parseDecimalInput(e.target.value))}
                      placeholder="예: 72.5"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="bmi-waist">허리둘레 (cm)</Label>
                    <Input
                      id="bmi-waist"
                      inputMode="decimal"
                      value={waist}
                      onChange={(e) => setWaist(parseDecimalInput(e.target.value))}
                      placeholder="선택"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={savingBody}>
                  {savingBody && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {format(selectedDate, "M/d", { locale: ko })} 체중 저장
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {sorted.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">최근 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {sorted.slice(0, 20).map((log) => {
                const rowBmi = heightCm != null ? calcBmi(log.weightKg, heightCm) : null
                return (
                  <li
                    key={log.id ?? `${log.memberId}_${log.date}`}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm dark:border-zinc-800"
                  >
                    <button
                      type="button"
                      className="w-20 shrink-0 text-left text-xs text-emerald-700 hover:underline dark:text-emerald-400"
                      onClick={() => {
                        const [y, m, d] = log.date.split("-").map(Number)
                        onSelectDate(new Date(y, m - 1, d))
                      }}
                    >
                      {format(new Date(`${log.date}T00:00:00`), "M/d (EEE)", { locale: ko })}
                    </button>
                    <span className="min-w-0 flex-1 tabular-nums">
                      {log.weightKg}kg
                      {log.waistCm != null ? ` · 허리 ${log.waistCm}` : ""}
                      {rowBmi != null ? ` · BMI ${formatBmi(rowBmi)}` : ""}
                    </span>
                    {canEdit && log.id && (
                      <button
                        type="button"
                        className="text-zinc-400 hover:text-rose-600"
                        aria-label={`${log.date} 기록 삭제`}
                        onClick={async () => {
                          if (!confirm("이 체중 기록을 삭제할까요?")) return
                          try {
                            await onDeleteBody(log.id!)
                          } catch {
                            // parent alerts
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
