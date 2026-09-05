"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Copy, FilePlus, Loader2, Plus, Save, Trash2 } from "lucide-react"
import { UtilsShell } from "@/components/utils-shell"
import { useFamily } from "@/hooks/use-family"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  addUtilChart,
  deleteUtilChart,
  subscribeUtilCharts,
  updateUtilChart,
  type UtilChartDoc,
  type UtilChartKind,
} from "@/lib/firestore-utils"
import { cn } from "@/lib/utils"

type DataRow = { id: string; label: string; value: string }

function createRow(label = "", value = ""): DataRow {
  return { id: crypto.randomUUID(), label, value }
}

const defaultRows = () => [
  createRow("A", "12"),
  createRow("B", "19"),
  createRow("C", "8"),
  createRow("D", "15"),
]

async function svgToPngBlob(svg: SVGSVGElement): Promise<Blob> {
  const cloned = svg.cloneNode(true) as SVGSVGElement
  if (!cloned.getAttribute("xmlns")) {
    cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  }
  const rect = svg.getBoundingClientRect()
  const width = Math.max(1, Math.ceil(rect.width))
  const height = Math.max(1, Math.ceil(rect.height))
  cloned.setAttribute("width", String(width))
  cloned.setAttribute("height", String(height))

  const xml = new XMLSerializer().serializeToString(cloned)
  const svgUrl = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }))

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("그래프 이미지 변환에 실패했습니다."))
      img.src = svgUrl
    })
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas를 사용할 수 없습니다.")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG 변환에 실패했습니다."))),
        "image/png"
      )
    })
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export default function ChartViewerPage() {
  const { session, family, loading: familyLoading } = useFamily()
  const chartRef = useRef<HTMLDivElement>(null)
  const [docs, setDocs] = useState<UtilChartDoc[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState("새 그래프")
  const [chartKind, setChartKind] = useState<UtilChartKind>("bar")
  const [xLabel, setXLabel] = useState("항목")
  const [yLabel, setYLabel] = useState("값")
  const [rows, setRows] = useState<DataRow[]>(defaultRows)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!family?.id) {
      setDocs([])
      setListLoading(false)
      return
    }
    setListLoading(true)
    return subscribeUtilCharts(
      family.id,
      (data) => {
        setDocs(data)
        setListLoading(false)
      },
      () => setListLoading(false)
    )
  }, [family?.id])

  const chartData = useMemo(
    () =>
      rows
        .map((row) => ({
          label: row.label.trim() || "(빈 값)",
          value: Number(row.value.replace(/,/g, "")),
        }))
        .filter((row) => Number.isFinite(row.value)),
    [rows]
  )

  const memberName =
    family?.memberNames?.[session?.user?.id || ""] || session?.user?.name || "가족"

  const startNew = () => {
    setActiveId(null)
    setTitle("새 그래프")
    setChartKind("bar")
    setXLabel("항목")
    setYLabel("값")
    setRows(defaultRows())
    setMessage("")
  }

  const loadDoc = (docItem: UtilChartDoc) => {
    setActiveId(docItem.id || null)
    setTitle(docItem.title)
    setChartKind(docItem.chartKind)
    setXLabel(docItem.xLabel)
    setYLabel(docItem.yLabel)
    setRows(
      docItem.rows.length > 0
        ? docItem.rows.map((row) => createRow(row.label, row.value))
        : [createRow()]
    )
    setMessage("")
  }

  const updateRow = (id: string, patch: Partial<DataRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)))
  }

  const handleSave = async () => {
    if (!family?.id) {
      alert("가족 그룹이 필요합니다. 먼저 가족을 생성하거나 참여해주세요.")
      return
    }
    const trimmedTitle = title.trim() || "제목 없음"
    if (chartData.length === 0) {
      alert("저장할 유효한 데이터가 없습니다.")
      return
    }
    setSaving(true)
    setMessage("")
    const payload = {
      title: trimmedTitle,
      chartKind,
      xLabel,
      yLabel,
      rows: rows.map(({ label, value }) => ({ label, value })),
      member: memberName,
      memberId: session?.user?.id,
    }
    try {
      if (activeId) {
        await updateUtilChart(activeId, payload)
        setMessage("저장했습니다.")
      } else {
        const ref = await addUtilChart({
          familyId: family.id,
          ...payload,
        })
        setActiveId(ref.id)
        setMessage("새 그래프로 저장했습니다.")
      }
    } catch (err) {
      console.error(err)
      alert("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("이 그래프를 삭제할까요?")) return
    try {
      await deleteUtilChart(id)
      if (activeId === id) startNew()
    } catch (err) {
      console.error(err)
      alert("삭제 중 오류가 발생했습니다.")
    }
  }

  const copyImage = async () => {
    setMessage("")
    try {
      const svg = chartRef.current?.querySelector("svg")
      if (!svg) {
        setMessage("복사할 그래프가 없습니다.")
        return
      }
      if (!navigator.clipboard?.write) {
        setMessage("이 브라우저에서는 이미지 복사를 지원하지 않습니다.")
        return
      }
      const blob = await svgToPngBlob(svg)
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])
      setMessage("그래프 이미지를 클립보드에 복사했습니다.")
    } catch (err) {
      console.error(err)
      setMessage(err instanceof Error ? err.message : "이미지 복사에 실패했습니다.")
    }
  }

  return (
    <UtilsShell>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-zinc-500">Firebase에 저장 · 왼쪽 목록에서 불러오기 · 이미지 복사</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="gap-1.5" onClick={startNew}>
              <FilePlus className="h-4 w-4" />
              새 그래프
            </Button>
            <Button type="button" variant="outline" className="gap-1.5" onClick={copyImage}>
              <Copy className="h-4 w-4" />
              이미지 복사
            </Button>
            <Button type="button" className="gap-1.5" onClick={handleSave} disabled={saving || familyLoading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              저장
            </Button>
          </div>
        </div>
        {message && <p className="text-sm text-teal-700 dark:text-teal-300">{message}</p>}

        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">저장 목록</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {familyLoading || listLoading ? (
                <div className="flex justify-center py-8 text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : !family?.id ? (
                <p className="py-6 text-center text-xs text-zinc-400">가족 그룹이 필요합니다</p>
              ) : docs.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-400">저장된 그래프가 없습니다</p>
              ) : (
                docs.map((docItem) => (
                  <button
                    key={docItem.id}
                    type="button"
                    onClick={() => loadDoc(docItem)}
                    className={cn(
                      "group flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                      activeId === docItem.id
                        ? "border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40"
                        : "border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{docItem.title}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {docItem.updatedAt
                          ? format(docItem.updatedAt, "M/d HH:mm", { locale: ko })
                          : ""}
                        {docItem.member ? ` · ${docItem.member}` : ""}
                      </p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      className="rounded p-1 text-zinc-400 opacity-0 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-950"
                      onClick={(e) => docItem.id && handleDelete(docItem.id, e)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && docItem.id) {
                          handleDelete(docItem.id, e as unknown as React.MouseEvent)
                        }
                      }}
                      title="삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="chart-title">제목</Label>
                  <Input
                    id="chart-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="그래프 제목"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>그래프 종류</Label>
                  <Select
                    value={chartKind}
                    onValueChange={(v) => {
                      if (v === "bar" || v === "line" || v === "dashed") setChartKind(v)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {chartKind === "bar"
                          ? "막대그래프"
                          : chartKind === "line"
                            ? "선그래프"
                            : "점선그래프"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bar">막대그래프</SelectItem>
                      <SelectItem value="line">선그래프</SelectItem>
                      <SelectItem value="dashed">점선그래프</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="x-label">가로축(X)</Label>
                  <Input
                    id="x-label"
                    value={xLabel}
                    onChange={(e) => setXLabel(e.target.value)}
                    placeholder="예: 월"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="y-label">세로축(Y)</Label>
                  <Input
                    id="y-label"
                    value={yLabel}
                    onChange={(e) => setYLabel(e.target.value)}
                    placeholder="예: 매출"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>데이터</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1"
                      onClick={() => setRows((prev) => [...prev, createRow()])}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      행 추가
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {rows.map((row) => (
                      <div key={row.id} className="flex gap-2">
                        <Input
                          value={row.label}
                          onChange={(e) => updateRow(row.id, { label: e.target.value })}
                          placeholder={xLabel || "X"}
                          className="flex-1"
                        />
                        <Input
                          value={row.value}
                          onChange={(e) =>
                            updateRow(row.id, {
                              value: e.target.value.replace(/[^\d.-]/g, ""),
                            })
                          }
                          placeholder={yLabel || "Y"}
                          className="w-24"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-zinc-400 hover:text-rose-600"
                          onClick={() => removeRow(row.id)}
                          title="행 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">미리보기</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="py-16 text-center text-sm text-zinc-400">유효한 숫자 데이터가 없습니다.</p>
                ) : (
                  <div
                    ref={chartRef}
                    className="h-[420px] w-full rounded-lg bg-white p-2 dark:bg-zinc-950"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      {chartKind === "bar" ? (
                        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 28 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                          <XAxis
                            dataKey="label"
                            label={{ value: xLabel, position: "insideBottom", offset: -12 }}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            label={{ value: yLabel, angle: -90, position: "insideLeft" }}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip />
                          <Bar dataKey="value" name={yLabel || "값"} fill="#0d9488" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      ) : (
                        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 8, bottom: 28 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                          <XAxis
                            dataKey="label"
                            label={{ value: xLabel, position: "insideBottom", offset: -12 }}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            label={{ value: yLabel, angle: -90, position: "insideLeft" }}
                            tick={{ fontSize: 12 }}
                          />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="value"
                            name={yLabel || "값"}
                            stroke="#0d9488"
                            strokeWidth={2}
                            strokeDasharray={chartKind === "dashed" ? "6 4" : undefined}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </UtilsShell>
  )
}
