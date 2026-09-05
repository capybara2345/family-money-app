"use client"

import { useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { FilePlus, Loader2, Printer, Save, Trash2 } from "lucide-react"
import { UtilsShell } from "@/components/utils-shell"
import { useFamily } from "@/hooks/use-family"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  addUtilMarkdown,
  deleteUtilMarkdown,
  subscribeUtilMarkdowns,
  updateUtilMarkdown,
  type UtilMarkdownDoc,
} from "@/lib/firestore-utils"
import { cn } from "@/lib/utils"

const emptySample = `# 새 문서

마크다운을 입력하세요.
`

export default function MdViewerPage() {
  const { session, family, loading: familyLoading } = useFamily()
  const [docs, setDocs] = useState<UtilMarkdownDoc[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState("새 문서")
  const [source, setSource] = useState(emptySample)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!family?.id) {
      setDocs([])
      setListLoading(false)
      return
    }
    setListLoading(true)
    return subscribeUtilMarkdowns(
      family.id,
      (data) => {
        setDocs(data)
        setListLoading(false)
      },
      () => setListLoading(false)
    )
  }, [family?.id])

  const preview = useMemo(() => source, [source])

  const memberName =
    family?.memberNames?.[session?.user?.id || ""] || session?.user?.name || "가족"

  const startNew = () => {
    setActiveId(null)
    setTitle("새 문서")
    setSource(emptySample)
    setMessage("")
  }

  const loadDoc = (docItem: UtilMarkdownDoc) => {
    setActiveId(docItem.id || null)
    setTitle(docItem.title)
    setSource(docItem.content)
    setMessage("")
  }

  const handleSave = async () => {
    if (!family?.id) {
      alert("가족 그룹이 필요합니다. 먼저 가족을 생성하거나 참여해주세요.")
      return
    }
    const trimmedTitle = title.trim() || "제목 없음"
    if (!source.trim()) {
      alert("저장할 내용이 없습니다.")
      return
    }
    setSaving(true)
    setMessage("")
    try {
      if (activeId) {
        await updateUtilMarkdown(activeId, {
          title: trimmedTitle,
          content: source,
          member: memberName,
          memberId: session?.user?.id,
        })
        setMessage("저장했습니다.")
      } else {
        const ref = await addUtilMarkdown({
          familyId: family.id,
          title: trimmedTitle,
          content: source,
          member: memberName,
          memberId: session?.user?.id,
        })
        setActiveId(ref.id)
        setMessage("새 문서로 저장했습니다.")
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
    if (!confirm("이 문서를 삭제할까요?")) return
    try {
      await deleteUtilMarkdown(id)
      if (activeId === id) startNew()
    } catch (err) {
      console.error(err)
      alert("삭제 중 오류가 발생했습니다.")
    }
  }

  return (
    <UtilsShell>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <p className="text-sm text-zinc-500">Firebase에 저장 · 왼쪽 목록에서 불러오기 · 인쇄</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="gap-1.5" onClick={startNew}>
              <FilePlus className="h-4 w-4" />
              새 문서
            </Button>
            <Button type="button" variant="outline" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              출력
            </Button>
            <Button type="button" className="gap-1.5" onClick={handleSave} disabled={saving || familyLoading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              저장
            </Button>
          </div>
        </div>
        {message && <p className="text-sm text-teal-700 print:hidden dark:text-teal-300">{message}</p>}

        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <Card className="print:hidden h-fit">
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
                <p className="py-6 text-center text-xs text-zinc-400">저장된 문서가 없습니다</p>
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

          <div className="space-y-4">
            <Card className="print:hidden">
              <CardContent className="space-y-2 pt-4">
                <Label htmlFor="md-title">제목</Label>
                <Input
                  id="md-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="문서 제목"
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="print:hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">입력</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="min-h-[420px] font-mono text-sm"
                    placeholder="마크다운을 입력하세요"
                  />
                </CardContent>
              </Card>

              <Card className="print:border-0 print:shadow-none">
                <CardHeader className="pb-2 print:hidden">
                  <CardTitle className="text-base">미리보기</CardTitle>
                </CardHeader>
                <CardContent>
                  <article className="md-preview prose-sm max-w-none space-y-3 text-zinc-800 dark:text-zinc-100 [&_a]:text-teal-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-500 [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] dark:[&_code]:bg-zinc-800 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-900 [&_pre]:p-3 [&_pre]:text-zinc-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-zinc-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-zinc-200 [&_th]:bg-zinc-50 [&_th]:px-2 [&_th]:py-1 dark:[&_td]:border-zinc-700 dark:[&_th]:border-zinc-700 dark:[&_th]:bg-zinc-900">
                    {preview.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview}</ReactMarkdown>
                    ) : (
                      <p className="text-zinc-400">미리볼 내용이 없습니다.</p>
                    )}
                  </article>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </UtilsShell>
  )
}
