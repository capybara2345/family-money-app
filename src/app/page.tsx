"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { format, isSameDay } from "date-fns"
import { ko } from "date-fns/locale"
import Holidays from "date-holidays"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  CalendarDays,
  LogOut,
  Trash2,
  Loader2,
  Pencil,
} from "lucide-react"
import { useFirebaseAuth } from "@/components/firebase-auth-provider"
import {
  addTransaction,
  deleteTransaction,
  updateTransaction,
  addFixedTransaction,
  deleteFixedTransaction,
  updateFixedTransaction,
  generateFixedTransactionsForMonth,
  createFamily,
  getFamily,
  getFamilyByMember,
  joinFamily,
  removeMemberFromFamily,
  createInvitation,
  getInvitation,
  updateMemberNickname,
  ensureFamilyData,
  subscribeTransactionsByFamily,
  subscribeFixedTransactionsByFamily,
  subscribeFamily,
  updateMemberLastSeen,
  isMemberOnline,
  type Transaction,
  type FixedTransaction,
  type Family,
} from "@/lib/firestore"

const categoryEmojiMap: Record<string, string> = {
  급여: "💰",
  용돈: "🧧",
  투자: "📈",
  "식비 & 간식": "🍽️",
  식비: "🍽️",
  교통: "🚗",
  교육: "📚",
  공과금: "💡",
  쇼핑: "🛍️",
  "오락 & 장난감": "🎮",
  의료: "🏥",
  기타: "📝",
}
const incomeCategories = ["급여", "용돈", "투자", "기타"]
const expenseCategories = ["식비 & 간식", "교통", "교육", "공과금", "쇼핑", "의료", "오락 & 장난감", "기타"]

function normalizeCategory(category: string) {
  return category === "식비" ? "식비 & 간식" : category
}

function validateAddForm(form: { date: string; category: string; description: string; amount: string }) {
  if (!form.date) return "날짜를 선택해주세요."
  if (!form.category) return "카테고리를 선택해주세요."
  if (!form.description.trim()) return "내용을 입력해주세요."
  if (!form.amount.trim()) return "금액을 입력해주세요."
  return null
}
const members = ["아빠", "엄마", "첫째", "둘째", "할머니", "가족"]
const weeklyDayLabels = ["일", "월", "화", "수", "목", "금", "토"]

function parseWeeklyDays(val: string): number[] {
  return val ? val.split(",").map(Number).filter((n) => !isNaN(n)) : []
}

function formatWeeklyDays(val: number | number[]): string {
  const days = Array.isArray(val) ? val : [val]
  return days.map((d) => weeklyDayLabels[d]).join(", ") + "요일"
}

const hd = new Holidays("KR")

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(amount)
}

export default function Home() {
  const { data: session, status } = useSession()
  const { ready: firebaseReady, authenticated: firebaseAuthenticated, error: firebaseError } = useFirebaseAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [fixedTransactions, setFixedTransactions] = useState<FixedTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [month, setMonth] = useState<Date>(new Date())
  const [fixedDialogOpen, setFixedDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: "expense" as "income" | "expense",
    category: "",
    description: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
  })
  const [fixedForm, setFixedForm] = useState({
    type: "expense" as "income" | "expense",
    category: "",
    description: "",
    amount: "",
    periodType: "monthly" as "weekly" | "monthly",
    periodValue: "1",
  })
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    type: "expense" as "income" | "expense",
    category: "",
    description: "",
    amount: "",
    date: "",
  })
  const [fixedEditDialogOpen, setFixedEditDialogOpen] = useState(false)
  const [fixedEditId, setFixedEditId] = useState<string | null>(null)
  const [fixedEditForm, setFixedEditForm] = useState({
    type: "expense" as "income" | "expense",
    category: "",
    description: "",
    amount: "",
    periodType: "monthly" as "weekly" | "monthly",
    periodValue: "1",
  })
  const [family, setFamily] = useState<Family | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)

  const initFamily = useCallback(async () => {
    if (!session?.user?.id || !firebaseAuthenticated) return
    setLoading(true)
    try {
      let fam: Family | null = null

      // 1) localStorage에 캐시된 가족 ID가 있으면 먼저 직접 조회
      const cachedId = localStorage.getItem("familyId")
      if (cachedId) {
        fam = await getFamily(cachedId)
      }

      // 1-1) 강퇴당한 경우: members에 본인이 없으면 캐시 무효화
      if (fam && !fam.members.includes(session.user.id)) {
        localStorage.removeItem("familyId")
        fam = null
      }

      // 2) 캐시 miss거나 가족이 삭제된 경우 members로 검색
      if (!fam) {
        fam = await getFamilyByMember(session.user.id)
      }

      // 3) 가족이 없으면 새로 생성
      if (!fam) {
        const familyId = await createFamily(`${session.user.name || "우리"} 가족`, session.user.id, session.user.name || "방장")
        fam = await getFamily(familyId)
      }

      if (fam?.id) {
        localStorage.setItem("familyId", fam.id)
      }
      if (fam) {
        if (!fam.members.includes(session.user.id)) {
          console.error("가족 멤버 목록에 현재 사용자가 없습니다:", session.user.id)
          localStorage.removeItem("familyId")
          setFamily(null)
          return
        }
        fam = await ensureFamilyData(fam, session.user.id)
      }
      setFamily(fam)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, session?.user?.name, firebaseAuthenticated])

  useEffect(() => {
    if (firebaseReady && firebaseAuthenticated) {
      initFamily()
    }
  }, [initFamily, firebaseReady, firebaseAuthenticated])

  useEffect(() => {
    if (selectedDate) {
      setForm((prev) => ({ ...prev, date: format(selectedDate, "yyyy-MM-dd") }))
    }
  }, [selectedDate])

  // Heartbeat for online status
  useEffect(() => {
    if (!family?.id || !session?.user?.id || !firebaseAuthenticated) return
    const familyId = family.id
    const userId = session.user.id
    updateMemberLastSeen(familyId, userId)
    const interval = setInterval(() => {
      updateMemberLastSeen(familyId, userId)
    }, 30000)
    return () => clearInterval(interval)
  }, [family?.id, session?.user?.id])

  // Real-time subscriptions
  useEffect(() => {
    if (!family?.id || !session?.user?.id || !firebaseAuthenticated) return
    const familyId = family.id
    const userId = session.user.id
    const unsubFamily = subscribeFamily(familyId, (fam) => {
      if (!fam) {
        setFamily(null)
        return
      }
      // 강퇴당한 경우: members에서 빠지면 즉시 탈출
      if (!fam.members.includes(userId)) {
        localStorage.removeItem("familyId")
        setFamily(null)
        setTransactions([])
        setFixedTransactions([])
        return
      }
      setFamily(fam)
    })
    const unsubTx = subscribeTransactionsByFamily(familyId, (data) => {
      setTransactions(data)
    })
    const unsubFixed = subscribeFixedTransactionsByFamily(familyId, (data) => {
      setFixedTransactions(data)
    })

    return () => {
      unsubFamily()
      unsubTx()
      unsubFixed()
    }
  }, [family?.id, session?.user?.id, firebaseAuthenticated])

  const mergedTransactions = useMemo(() => {
    const fixedVirtual = generateFixedTransactionsForMonth(
      fixedTransactions,
      month.getFullYear(),
      month.getMonth()
    )
    return [...transactions, ...fixedVirtual]
  }, [transactions, fixedTransactions, month])

  const monthlyStats = useMemo(() => {
    const monthly = mergedTransactions.filter(
      (t) => t.date.getMonth() === month.getMonth() && t.date.getFullYear() === month.getFullYear()
    )
    const income = monthly.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
    const expense = monthly.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
    return { income, expense, balance: income - expense }
  }, [mergedTransactions, month])

  const selectedDayTransactions = useMemo(() => {
    if (!selectedDate) return []
    return mergedTransactions
      .filter((t) => isSameDay(t.date, selectedDate))
      .sort((a, b) => (a.type === "income" && b.type === "expense" ? -1 : a.type === "expense" && b.type === "income" ? 1 : 0))
  }, [selectedDate, mergedTransactions])

  const dayTransactionsMap = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    mergedTransactions.forEach((t) => {
      const key = format(t.date, "yyyy-MM-dd")
      const existing = map.get(key) || { income: 0, expense: 0 }
      if (t.type === "income") existing.income += t.amount
      else existing.expense += t.amount
      map.set(key, existing)
    })
    return map
  }, [mergedTransactions])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family?.id) return
    const error = validateAddForm(form)
    if (error) {
      alert(error)
      return
    }
    setSaving(true)
    try {
      const date = new Date(form.date)
      await addTransaction({
        familyId: family.id,
        date,
        type: form.type,
        category: form.category,
        description: form.description,
        amount: Number(form.amount.replace(/,/g, "")),
        member: family?.memberNames?.[session?.user?.id || ""] || session?.user?.name || "가족",
        memberId: session?.user?.id,
      })
      setForm((prev) => ({ ...prev, category: "", description: "", amount: "" }))
      setSelectedDate(date)
      setMonth(date)
    } catch (err) {
      console.error(err)
      alert("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return
    try {
      await deleteTransaction(id)    } catch (err) {
      console.error(err)
      alert("삭제 중 오류가 발생했습니다.")
    }
  }

  const handleFixedAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fixedForm.category || !fixedForm.description || !fixedForm.amount || !family?.id) return
    setSaving(true)
    try {
      await addFixedTransaction({
        familyId: family.id,
        type: fixedForm.type,
        category: fixedForm.category,
        description: fixedForm.description,
        amount: Number(fixedForm.amount.replace(/,/g, "")),
        member: family?.memberNames?.[session?.user?.id || ""] || session?.user?.name || "가족",
        memberId: session?.user?.id,
        periodType: fixedForm.periodType,
        periodValue: fixedForm.periodType === "weekly"
          ? parseWeeklyDays(fixedForm.periodValue)
          : Number(fixedForm.periodValue),
      })
      setFixedForm({
        type: "expense",
        category: "",
        description: "",
        amount: "",
        periodType: "monthly",
        periodValue: "1",
      })
      setFixedDialogOpen(false)    } catch (err) {
      console.error(err)
      alert("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleFixedDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return
    try {
      await deleteFixedTransaction(id)    } catch (err) {
      console.error(err)
      alert("삭제 중 오류가 발생했습니다.")
    }
  }

  const openEdit = (tx: Transaction) => {
    if (!tx.id) return
    setEditId(tx.id)
    setEditForm({
      type: tx.type,
      category: normalizeCategory(tx.category),
      description: tx.description,
      amount: String(tx.amount),
      date: format(tx.date, "yyyy-MM-dd"),
    })
    setEditDialogOpen(true)
  }

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId || !editForm.category || !editForm.description || !editForm.amount) return
    setSaving(true)
    try {
      await updateTransaction(editId, {
        type: editForm.type,
        category: editForm.category,
        description: editForm.description,
        amount: Number(editForm.amount.replace(/,/g, "")),
        date: new Date(editForm.date),
      })
      setEditDialogOpen(false)
      setEditId(null)    } catch (err) {
      console.error(err)
      alert("수정 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const openFixedEdit = (ft: FixedTransaction) => {
    if (!ft.id) return
    setFixedEditId(ft.id)
    setFixedEditForm({
      type: ft.type,
      category: normalizeCategory(ft.category),
      description: ft.description,
      amount: String(ft.amount),
      periodType: ft.periodType,
      periodValue: Array.isArray(ft.periodValue)
        ? ft.periodValue.join(",")
        : String(ft.periodValue),
    })
    setFixedEditDialogOpen(true)
  }

  const handleFixedEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fixedEditId || !fixedEditForm.category || !fixedEditForm.description || !fixedEditForm.amount) return
    setSaving(true)
    try {
      await updateFixedTransaction(fixedEditId, {
        type: fixedEditForm.type,
        category: fixedEditForm.category,
        description: fixedEditForm.description,
        amount: Number(fixedEditForm.amount.replace(/,/g, "")),
        periodType: fixedEditForm.periodType,
        periodValue: fixedEditForm.periodType === "weekly"
          ? parseWeeklyDays(fixedEditForm.periodValue)
          : Number(fixedEditForm.periodValue),
      })
      setFixedEditDialogOpen(false)
      setFixedEditId(null)    } catch (err) {
      console.error(err)
      alert("수정 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateInvite = async () => {
    if (!family?.id || !session?.user?.id) return
    try {
      const code = await createInvitation(family.id, session.user.id)
      setInviteCode(code)
      setInviteDialogOpen(true)
    } catch (err) {
      console.error(err)
      alert("초대 코드 생성 중 오류가 발생했습니다.")
    }
  }

  const handleKickMember = async (userId: string) => {
    if (!family?.id) return
    if (!confirm("정말 이 멤버를 강퇴하시겠습니까?")) return
    try {
      await removeMemberFromFamily(family.id, userId)    } catch (err) {
      console.error(err)
      alert("강퇴 중 오류가 발생했습니다.")
    }
  }

  const handleJoinFamily = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode || !session?.user?.id) return
    try {
      const invitation = await getInvitation(joinCode.toUpperCase().trim())
      if (!invitation) {
        alert("유효하지 않은 초대 코드입니다.")
        return
      }
      await joinFamily(invitation.familyId, session.user.id, session.user.name || "멤버")
      // 가입한 가족으로 상태 즉시 전환
      let joined = await getFamily(invitation.familyId)
      if (joined) {
        joined = await ensureFamilyData(joined)
        setFamily(joined)
        localStorage.setItem("familyId", invitation.familyId)
      }
      setJoinDialogOpen(false)
      setJoinCode("")
      alert("가족 그룹에 가입되었습니다!")
    } catch (err) {
      console.error(err)
      alert("가입 중 오류가 발생했습니다.")
    }
  }

  const openProfile = () => {
    const currentName = family?.memberNames?.[session?.user?.id || ""]
    setNickname(currentName || session?.user?.name || "")
    setProfileDialogOpen(true)
  }

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family?.id || !session?.user?.id || !nickname.trim()) return
    setProfileSaving(true)
    try {
      await updateMemberNickname(family.id, session.user.id, nickname.trim())
      setProfileDialogOpen(false)
    } catch (err) {
      console.error(err)
      alert("닉네임 저장 중 오류가 발생했습니다.")
    } finally {
      setProfileSaving(false)
    }
  }

  if (status === "loading" || !firebaseReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-zinc-400">로딩 중...</div>
      </div>
    )
  }

  if (status === "authenticated" && !firebaseAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="text-center text-zinc-500 max-w-md">
          <p className="mb-2 font-medium">데이터베이스 연결에 실패했습니다.</p>
          <p className="text-sm">{firebaseError || "잠시 후 다시 시도해주세요."}</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Wallet className="h-6 w-6 shrink-0 text-emerald-600" />
                <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">가족 가계부</h1>
              </div>
              <div className="text-sm text-zinc-500 shrink-0 sm:hidden">
                {format(month, "yyyy년 M월", { locale: ko })}
              </div>
            </div>
            {session?.user && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="text-sm text-zinc-500 hidden sm:block shrink-0">
                  {format(month, "yyyy년 M월", { locale: ko })}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none text-xs sm:text-sm"
                  onClick={() => setJoinDialogOpen(true)}
                >
                  <span className="sm:hidden">코드 입력</span>
                  <span className="hidden sm:inline">초대 코드 입력</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none text-xs sm:text-sm"
                  onClick={handleGenerateInvite}
                >
                  멤버 초대
                </Button>
                <div className="flex items-center gap-1 sm:gap-2 ml-auto sm:ml-0">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "사용자"}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full object-cover bg-zinc-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none"
                      }}
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                      {session.user.name?.charAt(0) || "?"}
                    </div>
                  )}
                  <span className="text-sm font-medium hidden sm:inline">{session.user.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={openProfile}
                    title="프로필 설정"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
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
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">이번 달 수입</CardTitle>
              <ArrowUpCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-blue-600 break-all">{formatCurrency(monthlyStats.income)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">이번 달 지출</CardTitle>
              <ArrowDownCircle className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-rose-600 break-all">{formatCurrency(monthlyStats.expense)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">이번 달 잔액</CardTitle>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-xl sm:text-2xl font-bold break-all ${monthlyStats.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatCurrency(monthlyStats.balance)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Members */}
        {family && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">가족 멤버 ({family.members.length}명)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {family.members.map((memberId) => {
                  const isOwner = memberId === family.ownerId
                  const isMe = memberId === session?.user?.id
                  const name = family.memberNames?.[memberId] || "멤버"
                  const online = isMemberOnline(family.memberLastSeen, memberId)
                  return (
                    <div
                      key={memberId}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                        isMe ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950" : ""
                      }`}
                    >
                      <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold dark:bg-zinc-700">
                        {name.charAt(0)}
                        {online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
                        )}
                      </div>
                      <span>{name}</span>
                      {isOwner && <Badge variant="secondary" className="text-[10px] h-5 px-1">방장</Badge>}
                      {isMe && <Badge variant="outline" className="text-[10px] h-5 px-1">나</Badge>}
                      {session?.user?.id === family.ownerId && !isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-zinc-400 hover:text-rose-600"
                          onClick={() => handleKickMember(memberId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 shrink-0" />
                캘린더
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Dialog open={fixedDialogOpen} onOpenChange={setFixedDialogOpen}>
                  <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1"><CalendarDays className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">고정 거래 관리</span><span className="sm:hidden">고정 거래</span></Button>} />
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>고정 거래 관리</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    {/* Fixed list */}
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {fixedTransactions.length === 0 && (
                        <p className="text-sm text-zinc-400 text-center py-4">등록된 고정 거래가 없습니다.</p>
                      )}
                      {fixedTransactions.map((ft) => (
                        <div
                          key={ft.id}
                          className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between rounded-md border p-2.5 text-sm dark:border-zinc-800"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 flex-1">
                            <span
                              className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${
                                ft.type === "income"
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-rose-50 text-rose-600"
                              }`}
                            >
                              {ft.type === "income" ? "수입" : "지출"}
                            </span>
                            <span className="text-zinc-500 shrink-0">
                              {categoryEmojiMap[ft.category] || "📝"} {normalizeCategory(ft.category)}
                            </span>
                            <span className="truncate">{ft.description}</span>
                            <span className="text-zinc-400 text-xs sm:text-sm w-full sm:w-auto">
                              {ft.periodType === "monthly"
                                ? `매월 ${ft.periodValue}일`
                                : `매주 ${formatWeeklyDays(ft.periodValue)}`}
                            </span>
                            <span className="font-semibold shrink-0">{formatCurrency(ft.amount)}</span>
                          </div>
                          <div className="flex items-center shrink-0 self-end sm:self-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-zinc-400 hover:text-blue-600"
                              onClick={() => openFixedEdit(ft)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-zinc-400 hover:text-rose-600"
                              onClick={() => ft.id && handleFixedDelete(ft.id!)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <hr className="border-zinc-200 dark:border-zinc-800" />

                    {/* Add fixed form */}
                    <form onSubmit={handleFixedAdd} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">유형</Label>
                          <Select
                            value={fixedForm.type}
                            onValueChange={(v) => {
                              if (v) setFixedForm((prev) => ({ ...prev, type: v as "income" | "expense", category: "" }))
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="선택">
                                {fixedForm.type === "income" ? "수입" : fixedForm.type === "expense" ? "지출" : "선택"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="income">수입</SelectItem>
                              <SelectItem value="expense">지출</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">주기</Label>
                          <Select
                            value={fixedForm.periodType}
                            onValueChange={(v) => {
                              if (v) setFixedForm((prev) => ({ ...prev, periodType: v as "weekly" | "monthly", periodValue: v === "monthly" ? "1" : "" }))
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="선택">
                                {fixedForm.periodType === "monthly" ? "매월 특정일" : fixedForm.periodType === "weekly" ? "매주 특정 요일" : "선택"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">매월 특정일</SelectItem>
                              <SelectItem value="weekly">매주 특정 요일</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          {fixedForm.periodType === "monthly" ? (
                            <>
                              <Label className="text-xs">매월 며칠</Label>
                              <Select
                                value={fixedForm.periodValue}
                                onValueChange={(v) => v && setFixedForm((prev) => ({ ...prev, periodValue: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="선택">
                                    {fixedForm.periodValue ? `${fixedForm.periodValue}일` : "선택"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                    <SelectItem key={d} value={String(d)}>{d}일</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </>
                          ) : (
                            <>
                              <Label className="text-xs">요일 선택</Label>
                              <div className="flex flex-wrap gap-2">
                                {weeklyDayLabels.map((day, i) => {
                                  const selected = parseWeeklyDays(fixedForm.periodValue).includes(i)
                                  return (
                                    <label
                                      key={i}
                                      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm cursor-pointer transition-colors ${
                                        selected
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={selected}
                                        onChange={(e) => {
                                          const current = parseWeeklyDays(fixedForm.periodValue)
                                          const next = e.target.checked
                                            ? [...current, i].sort((a, b) => a - b)
                                            : current.filter((d) => d !== i)
                                          setFixedForm((prev) => ({ ...prev, periodValue: next.join(",") }))
                                        }}
                                      />
                                      <span>{day}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            </>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">금액</Label>
                          <Input
                            type="number"
                            value={fixedForm.amount}
                            onChange={(e) => setFixedForm((prev) => ({ ...prev, amount: e.target.value }))}
                            placeholder="0"
                            min={0}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">카테고리</Label>
                          <Select
                            value={fixedForm.category}
                            onValueChange={(v) => setFixedForm((prev) => ({ ...prev, category: v || "" }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="선택">
                                {fixedForm.category ? `${categoryEmojiMap[fixedForm.category]} ${fixedForm.category}` : "선택"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {(fixedForm.type === "income" ? incomeCategories : expenseCategories).map((c) => (
                                <SelectItem key={c} value={c}>{categoryEmojiMap[c]} {c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">내용</Label>
                        <Input
                          value={fixedForm.description}
                          onChange={(e) => setFixedForm((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="예: 월세, 용돈"
                          required
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        고정 거래 추가
                      </Button>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>
              {/* Edit Fixed Transaction Dialog */}
              <Dialog open={fixedEditDialogOpen} onOpenChange={setFixedEditDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>고정 거래 수정</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleFixedEditSave} className="space-y-4 mt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">유형</Label>
                        <Select
                          value={fixedEditForm.type}
                          onValueChange={(v) => {
                            if (v) setFixedEditForm((prev) => ({ ...prev, type: v as "income" | "expense", category: "" }))
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="선택">
                              {fixedEditForm.type === "income" ? "수입" : fixedEditForm.type === "expense" ? "지출" : "선택"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">수입</SelectItem>
                            <SelectItem value="expense">지출</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">주기</Label>
                        <Select
                          value={fixedEditForm.periodType}
                          onValueChange={(v) => {
                            if (v) setFixedEditForm((prev) => ({ ...prev, periodType: v as "weekly" | "monthly", periodValue: v === "monthly" ? "1" : "" }))
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="선택">
                              {fixedEditForm.periodType === "monthly" ? "매월 특정일" : fixedEditForm.periodType === "weekly" ? "매주 특정 요일" : "선택"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">매월 특정일</SelectItem>
                            <SelectItem value="weekly">매주 특정 요일</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        {fixedEditForm.periodType === "monthly" ? (
                          <>
                            <Label className="text-xs">매월 며칠</Label>
                            <Select
                              value={fixedEditForm.periodValue}
                              onValueChange={(v) => v && setFixedEditForm((prev) => ({ ...prev, periodValue: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="선택">
                                  {fixedEditForm.periodValue ? `${fixedEditForm.periodValue}일` : "선택"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                  <SelectItem key={d} value={String(d)}>{d}일</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        ) : (
                          <>
                            <Label className="text-xs">요일 선택</Label>
                            <div className="flex flex-wrap gap-2">
                              {weeklyDayLabels.map((day, i) => {
                                const selected = parseWeeklyDays(fixedEditForm.periodValue).includes(i)
                                return (
                                  <label
                                    key={i}
                                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm cursor-pointer transition-colors ${
                                      selected
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="hidden"
                                      checked={selected}
                                      onChange={(e) => {
                                        const current = parseWeeklyDays(fixedEditForm.periodValue)
                                        const next = e.target.checked
                                          ? [...current, i].sort((a, b) => a - b)
                                          : current.filter((d) => d !== i)
                                        setFixedEditForm((prev) => ({ ...prev, periodValue: next.join(",") }))
                                      }}
                                    />
                                    <span>{day}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">금액</Label>
                        <Input
                          type="number"
                          value={fixedEditForm.amount}
                          onChange={(e) => setFixedEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                          placeholder="0"
                          min={0}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">카테고리</Label>
                      <Select
                        value={fixedEditForm.category}
                        onValueChange={(v) => setFixedEditForm((prev) => ({ ...prev, category: v || "" }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="선택">
                            {fixedEditForm.category ? `${categoryEmojiMap[fixedEditForm.category]} ${fixedEditForm.category}` : "선택"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(fixedEditForm.type === "income" ? incomeCategories : expenseCategories).map((c) => (
                            <SelectItem key={c} value={c}>{categoryEmojiMap[c]} {c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">내용</Label>
                      <Input
                        value={fixedEditForm.description}
                        onChange={(e) => setFixedEditForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="예: 월세, 용돈"
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      수정 저장
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-12 text-zinc-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : (
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={month}
                  onMonthChange={setMonth}
                  locale={ko}
                  components={{
                    DayButton: ({ day, modifiers, ...props }) => {
                      const key = format(day.date, "yyyy-MM-dd")
                      const tx = dayTransactionsMap.get(key)
                      const isSelected = modifiers?.selected
                      const dow = day.date.getDay()
                      const holiday = hd.isHoliday(day.date)
                      return (
                        <button
                          {...props}
                          className={cn(
                            "relative flex aspect-square h-full w-full min-h-0 flex-col items-center justify-center rounded-md p-0 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800",
                            !isSelected && (dow === 0 || holiday) && "text-red-500",
                            !isSelected && dow === 6 && "text-blue-500",
                            isSelected && "bg-emerald-100 text-emerald-900 font-semibold dark:bg-emerald-900 dark:text-emerald-100",
                            props.className
                          )}
                        >
                          <span>{day.date.getDate()}</span>
                          {holiday && (
                            <span className="absolute top-0.5 right-1 h-1 w-1 rounded-full bg-red-500" />
                          )}
                          {tx && (
                            <span className="flex gap-0.5 mt-0.5">
                              {tx.income > 0 && (
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              )}
                              {tx.expense > 0 && (
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              )}
                            </span>
                          )}
                        </button>
                      )
                    },
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* Daily Transactions */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">
                {selectedDate
                  ? format(selectedDate, "M월 d일 (EEEE)", { locale: ko })
                  : "날짜를 선택하세요"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                  <Loader2 className="h-6 w-6 animate-spin mb-2" />
                  <p className="text-sm">불러오는 중...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedDate ? (
                    <form
                      onSubmit={handleAdd}
                      className="rounded-lg border bg-zinc-50/50 p-3 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-zinc-500">유형</Label>
                          <Select
                            value={form.type}
                            onValueChange={(v) => {
                              if (v) setForm((prev) => ({ ...prev, type: v as "income" | "expense", category: "" }))
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="선택">
                                {form.type === "income" ? "수입" : "지출"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="income">수입</SelectItem>
                              <SelectItem value="expense">지출</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-zinc-500">날짜</Label>
                          <Input
                            type="date"
                            className="h-9"
                            value={form.date}
                            onChange={(e) => {
                              const val = e.target.value
                              setForm((prev) => ({ ...prev, date: val }))
                              if (val) {
                                const d = new Date(val)
                                setSelectedDate(d)
                                setMonth(d)
                              }
                            }}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">카테고리</Label>
                        <Select
                          value={form.category}
                          onValueChange={(v) => setForm((prev) => ({ ...prev, category: v || "" }))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="선택">
                              {form.category ? `${categoryEmojiMap[form.category]} ${form.category}` : "선택"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(form.type === "income" ? incomeCategories : expenseCategories).map((c) => (
                              <SelectItem key={c} value={c}>
                                {categoryEmojiMap[c]} {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">내용</Label>
                        <Input
                          className="h-9"
                          value={form.description}
                          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="예: 마트 장보기"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="space-y-1 flex-1">
                          <Label className="text-xs text-zinc-500">금액</Label>
                          <Input
                            type="number"
                            className="h-9"
                            value={form.amount}
                            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                            placeholder="0"
                            min={0}
                          />
                        </div>
                        <div className="flex items-end">
                          <Button type="submit" className="h-9" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            등록
                          </Button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
                      <CalendarDays className="h-8 w-8 mb-2" />
                      <p className="text-sm">날짜를 선택하세요</p>
                    </div>
                  )}

                  {selectedDate && selectedDayTransactions.length === 0 && (
                    <p className="text-sm text-zinc-400 text-center py-2">거래 내역이 없습니다</p>
                  )}

                  {selectedDayTransactions.length > 0 && (
                    <div className="space-y-3">
                      {selectedDayTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3 dark:border-zinc-800"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                tx.type === "income"
                                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950"
                                  : "bg-rose-50 text-rose-600 dark:bg-rose-950"
                              }`}
                            >
                              {tx.type === "income" ? (
                                <ArrowUpCircle className="h-4 w-4" />
                              ) : (
                                <ArrowDownCircle className="h-4 w-4" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{tx.description}</p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                                  {categoryEmojiMap[tx.category] || "📝"} {normalizeCategory(tx.category)}
                                </Badge>
                                <span className="text-xs text-zinc-400 truncate">
                                  {tx.memberId && family?.memberNames?.[tx.memberId]
                                    ? family.memberNames[tx.memberId]
                                    : tx.member}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 pl-11 sm:pl-0 w-full sm:w-auto">
                            <span
                              className={`text-sm font-semibold shrink-0 ${
                                tx.type === "income" ? "text-blue-600" : "text-rose-600"
                              }`}
                            >
                              {tx.type === "income" ? "+" : "-"}
                              {formatCurrency(tx.amount)}
                            </span>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {tx.id && !tx.id.startsWith("fixed-") && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-zinc-400 hover:text-blue-600"
                                    onClick={() => openEdit(tx)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-zinc-400 hover:text-rose-600"
                                    onClick={() => handleDelete(tx.id!)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {tx.id?.startsWith("fixed-") && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-5">고정</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="border-t pt-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">일계</span>
                          <span className="font-semibold">
                            {formatCurrency(
                              selectedDayTransactions.reduce((sum, tx) =>
                                tx.type === "income" ? sum + tx.amount : sum - tx.amount, 0
                              )
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Edit Transaction Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>거래 수정</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>유형</Label>
              <Select
                value={editForm.type}
                onValueChange={(v) => {
                  if (v) setEditForm((prev) => ({ ...prev, type: v as "income" | "expense", category: "" }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="선택">
                    {editForm.type === "income" ? "수입" : editForm.type === "expense" ? "지출" : "선택"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">수입</SelectItem>
                  <SelectItem value="expense">지출</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>날짜</Label>
              <Input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>카테고리</Label>
              <Select
                value={editForm.category}
                onValueChange={(v) => setEditForm((prev) => ({ ...prev, category: v || "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="선택">
                    {editForm.category ? `${categoryEmojiMap[editForm.category]} ${editForm.category}` : "선택"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(editForm.type === "income" ? incomeCategories : expenseCategories).map(
                    (c) => (
                      <SelectItem key={c} value={c}>
                        {categoryEmojiMap[c]} {c}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>내용</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="예: 마트 장보기"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>금액</Label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
                min={0}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              수정 저장
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Code Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>멤버 초대</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-zinc-500">
              아래 코드를 초대하고 싶은 멤버에게 공유하세요.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border bg-zinc-50 px-3 py-2 text-center text-lg font-mono font-semibold tracking-widest dark:bg-zinc-900">
                {inviteCode}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(inviteCode)
                  alert("복사되었습니다!")
                }}
              >
                복사
              </Button>
            </div>
            <p className="text-xs text-zinc-400">
              코드는 영구적으로 유효합니다.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Family Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>가족 그룹 가입</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleJoinFamily} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>초대 코드</Label>
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="예: ABC123"
                className="font-mono tracking-widest uppercase"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              가입하기
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Profile / Nickname Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>프로필 설정</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveNickname} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>닉네임</Label>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="사용할 닉네임을 입력하세요"
                maxLength={20}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={profileSaving}>
              {profileSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              저장
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ")
}
