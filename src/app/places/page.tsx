"use client"

import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import {
  Map,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  LogOut,
  MapPin,
  ExternalLink,
  AlertTriangle,
  Star,
  Search,
  Calendar,
} from "lucide-react"
import { AuthGate } from "@/components/auth-gate"
import { AppNav } from "@/components/app-nav"
import {
  FamilyPanelProvider,
  FamilyHeaderActions,
  FamilyMembersCard,
} from "@/components/family-panel"
import { useFamily } from "@/hooks/use-family"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  subscribePlacesByFamily,
  addPlace,
  updatePlace,
  deletePlace,
  getPlaceMenus,
  getPlaceCosts,
  showPlaceMenus,
  showPlaceCosts,
  menuTasteMeta,
  placeTypeMeta,
  placeCategoryMeta,
  placeListCategoryMeta,
  type Place,
  type PlaceCategory,
  type PlaceListCategory,
  type PlaceType,
  type PlaceMenuItem,
  type PlaceCostItem,
  type MenuTaste,
} from "@/lib/firestore-places"
import { cn } from "@/lib/utils"

type MenuFormItem = { name: string; price: string; taste: MenuTaste | "" }
type CostFormItem = { name: string; price: string }

type PlaceForm = {
  name: string
  menus: MenuFormItem[]
  costs: CostFormItem[]
  location: string
  link: string
  bestReason: string
  worstReason: string
  rating: number
  eventStartDate: string
  eventEndDate: string
}

const emptyMenuRow: MenuFormItem = { name: "", price: "", taste: "" }
const emptyCostRow: CostFormItem = { name: "", price: "" }

const emptyForm: PlaceForm = {
  name: "",
  menus: [{ ...emptyMenuRow }],
  costs: [{ ...emptyCostRow }],
  location: "",
  link: "",
  bestReason: "",
  worstReason: "",
  rating: 0,
  eventStartDate: "",
  eventEndDate: "",
}

const namePlaceholders: Record<PlaceType, string> = {
  restaurant: "예: 할머니 손맛 국밥",
  kids: "예: 키즈카페 뽀로로파크",
  event: "예: 서울 빛초롱축제",
  other: "예: 남한산성 도립공원",
}

const listCategories: PlaceListCategory[] = ["all", "best", "rumored", "worst"]
const placeCategories: PlaceCategory[] = ["best", "rumored", "worst"]

function formatPrice(price: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(price)
}

function formatEventDate(dateStr: string) {
  return format(new Date(`${dateStr}T00:00:00`), "yyyy.M.d (EEE)", { locale: ko })
}

function formatEventPeriod(start?: string, end?: string) {
  const period = (() => {
    if (start && end) {
      if (start === end) return formatEventDate(start)
      return `${formatEventDate(start)} ~ ${formatEventDate(end)}`
    }
    if (start) return `${formatEventDate(start)} ~`
    if (end) return `~ ${formatEventDate(end)}`
    return ""
  })()
  return period
}

function getEventPeriodText(place: Place) {
  if (place.placeType !== "event") return ""
  return formatEventPeriod(place.eventStartDate, place.eventEndDate)
}

function normalizeMenus(menus: MenuFormItem[]): PlaceMenuItem[] | undefined {
  const result = menus
    .map((m) => {
      const item: PlaceMenuItem = { name: m.name.trim() }
      if (m.price.trim()) item.price = Number(m.price.replace(/,/g, ""))
      if (m.taste) item.taste = m.taste
      return item
    })
    .filter((m) => m.name)
  return result.length > 0 ? result : undefined
}

function menusToForm(menus: PlaceMenuItem[]): MenuFormItem[] {
  if (menus.length === 0) return [{ ...emptyMenuRow }]
  return menus.map((m) => ({
    name: m.name,
    price: m.price != null ? String(m.price) : "",
    taste: m.taste || "",
  }))
}

function normalizeCosts(costs: CostFormItem[]): PlaceCostItem[] | undefined {
  const result = costs
    .map((c) => {
      const item: PlaceCostItem = { name: c.name.trim() }
      if (c.price.trim()) item.price = Number(c.price.replace(/,/g, ""))
      return item
    })
    .filter((c) => c.name)
  return result.length > 0 ? result : undefined
}

function costsToForm(costs: PlaceCostItem[]): CostFormItem[] {
  if (costs.length === 0) return [{ ...emptyCostRow }]
  return costs.map((c) => ({
    name: c.name,
    price: c.price != null ? String(c.price) : "",
  }))
}

function CostListInput({
  costs,
  onChange,
}: {
  costs: CostFormItem[]
  onChange: (costs: CostFormItem[]) => void
}) {
  const updateRow = (index: number, patch: Partial<CostFormItem>) => {
    onChange(costs.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    if (costs.length <= 1) {
      onChange([{ ...emptyCostRow }])
      return
    }
    onChange(costs.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {costs.map((row, index) => (
        <div key={index} className="flex gap-2 items-start">
          <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
            <Input
              value={row.name}
              onChange={(e) => updateRow(index, { name: e.target.value })}
              placeholder="항목"
            />
            <Input
              value={row.price}
              onChange={(e) => updateRow(index, { price: e.target.value })}
              placeholder="가격"
              inputMode="numeric"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-zinc-400 hover:text-rose-600"
            onClick={() => removeRow(index)}
            title="비용 삭제"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => onChange([...costs, { ...emptyCostRow }])}
      >
        <Plus className="h-3.5 w-3.5" />
        비용 추가
      </Button>
    </div>
  )
}

function MenuListInput({
  menus,
  onChange,
}: {
  menus: MenuFormItem[]
  onChange: (menus: MenuFormItem[]) => void
}) {
  const updateRow = (index: number, patch: Partial<MenuFormItem>) => {
    onChange(menus.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const removeRow = (index: number) => {
    if (menus.length <= 1) {
      onChange([{ ...emptyMenuRow }])
      return
    }
    onChange(menus.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {menus.map((row, index) => (
        <div key={index} className="rounded-md border dark:border-zinc-800 p-2.5 space-y-2">
          <div className="flex gap-2 items-start">
            <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
              <Input
                value={row.name}
                onChange={(e) => updateRow(index, { name: e.target.value })}
                placeholder="메뉴명"
              />
              <Input
                value={row.price}
                onChange={(e) => updateRow(index, { price: e.target.value })}
                placeholder="가격"
                inputMode="numeric"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-zinc-400 hover:text-rose-600"
              onClick={() => removeRow(index)}
              title="메뉴 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1">
            {(Object.keys(menuTasteMeta) as MenuTaste[]).map((taste) => (
              <Button
                key={taste}
                type="button"
                size="sm"
                variant={row.taste === taste ? "default" : "outline"}
                className={cn(
                  "h-7 flex-1 text-xs",
                  row.taste === taste && menuTasteMeta[taste].activeClass
                )}
                onClick={() => updateRow(index, { taste: row.taste === taste ? "" : taste })}
              >
                {menuTasteMeta[taste].emoji} {menuTasteMeta[taste].label}
              </Button>
            ))}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => onChange([...menus, { ...emptyMenuRow }])}
      >
        <Plus className="h-3.5 w-3.5" />
        메뉴 추가
      </Button>
    </div>
  )
}

function StarRatingInput({
  value,
  onChange,
  size = "md",
}: {
  value: number
  onChange: (rating: number) => void
  size?: "sm" | "md"
}) {
  const starSize = size === "sm" ? "h-4 w-4" : "h-7 w-7"
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-0.5 rounded hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${n}점`}
        >
          <Star
            className={cn(
              starSize,
              n <= value ? "fill-amber-400 text-amber-400" : "fill-none text-zinc-300 dark:text-zinc-600"
            )}
          />
        </button>
      ))}
    </div>
  )
}

function StarRatingDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
  return (
    <div className="flex items-center gap-0.5" aria-label={`별점 ${rating}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            starSize,
            n <= rating ? "fill-amber-400 text-amber-400" : "fill-none text-zinc-300 dark:text-zinc-600"
          )}
        />
      ))}
    </div>
  )
}

function PlacesContent() {
  const { session, family, loading: familyLoading } = useFamily()
  const [places, setPlaces] = useState<Place[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [activePlaceType, setActivePlaceType] = useState<PlaceType>("restaurant")
  const [activeCategory, setActiveCategory] = useState<PlaceListCategory>("best")
  const [formCategory, setFormCategory] = useState<PlaceCategory>("rumored")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<PlaceForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const editingPlace = editId ? places.find((p) => p.id === editId) : undefined
  const formPlaceType = editingPlace?.placeType ?? activePlaceType

  useEffect(() => {
    if (!family?.id) {
      setPlaces([])
      setListLoading(false)
      return
    }
    setListLoading(true)
    const unsub = subscribePlacesByFamily(
      family.id,
      (data) => {
        setPlaces(data)
        setListLoading(false)
      },
      () => setListLoading(false)
    )
    return () => unsub()
  }, [family?.id])

  useEffect(() => {
    setSearchQuery("")
  }, [activePlaceType, activeCategory])

  const openAdd = () => {
    setEditId(null)
    setForm(emptyForm)
    setFormCategory(activeCategory === "all" ? "rumored" : activeCategory)
    setDialogOpen(true)
  }

  const openEdit = (p: Place) => {
    setEditId(p.id || null)
    setFormCategory(p.category)
    setForm({
      name: p.name,
      menus: menusToForm(getPlaceMenus(p)),
      costs: costsToForm(getPlaceCosts(p)),
      location: p.location || "",
      link: p.link || "",
      bestReason: p.bestReason || "",
      worstReason: p.worstReason || "",
      rating: p.rating || 0,
      eventStartDate: p.eventStartDate || "",
      eventEndDate: p.eventEndDate || "",
    })
    setDialogOpen(true)
  }

  const handleFormCategoryChange = (category: PlaceCategory) => {
    setFormCategory(category)
    if (category === "rumored") {
      setForm((prev) => ({ ...prev, rating: 0, bestReason: "", worstReason: "" }))
    } else if (category === "best") {
      setForm((prev) => ({ ...prev, worstReason: "" }))
    } else {
      setForm((prev) => ({ ...prev, bestReason: "" }))
    }
  }

  const validateForm = (placeType: PlaceType, category: PlaceCategory) => {
    if (!form.name.trim()) return "장소 이름을 입력해주세요."
    if ((category === "best" || category === "worst") && (form.rating < 1 || form.rating > 5)) {
      return "별점을 선택해주세요."
    }
    if (category === "best" && !form.bestReason.trim()) {
      return "베스트 장소는 추천 이유를 입력해주세요."
    }
    if (category === "worst" && !form.worstReason.trim()) {
      return "워스트 장소는 실망 이유를 입력해주세요."
    }
    if (
      placeType === "event" &&
      form.eventStartDate &&
      form.eventEndDate &&
      form.eventEndDate < form.eventStartDate
    ) {
      return "행사 종료일은 시작일 이후여야 합니다."
    }
    return null
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!family?.id || !session?.user?.id) return
    const placeType = formPlaceType
    const category = formCategory
    const error = validateForm(placeType, category)
    if (error) {
      alert(error)
      return
    }
    const includeMenus = showPlaceMenus(placeType, category)
    const includeCosts = showPlaceCosts(placeType, category)
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        menus: includeMenus ? normalizeMenus(form.menus) ?? [] : [],
        costs: includeCosts ? normalizeCosts(form.costs) ?? [] : [],
        location: form.location.trim() || undefined,
        link: form.link.trim() || undefined,
        bestReason: category === "best" ? form.bestReason.trim() : "",
        worstReason: category === "worst" ? form.worstReason.trim() : "",
        rating: category === "best" || category === "worst" ? form.rating : undefined,
        eventStartDate: placeType === "event" ? form.eventStartDate.trim() : "",
        eventEndDate: placeType === "event" ? form.eventEndDate.trim() : "",
      }
      if (editId) {
        await updatePlace(
          editId,
          { ...payload, placeType, category },
          editingPlace?._legacy
        )
      } else {
        await addPlace({
          familyId: family.id,
          placeType,
          category: formCategory,
          name: payload.name,
          location: payload.location,
          link: payload.link,
          bestReason: category === "best" ? form.bestReason.trim() : undefined,
          worstReason: category === "worst" ? form.worstReason.trim() : undefined,
          menus: includeMenus ? normalizeMenus(form.menus) : undefined,
          costs: includeCosts ? normalizeCosts(form.costs) : undefined,
          ...(placeType === "event"
            ? {
                eventStartDate: form.eventStartDate.trim() || undefined,
                eventEndDate: form.eventEndDate.trim() || undefined,
              }
            : {}),
          rating: payload.rating,
          memberId: session.user.id,
          member:
            family.memberNames?.[session.user.id] || session.user.name || "가족",
        })
      }
      setDialogOpen(false)
      setForm(emptyForm)
      setEditId(null)
    } catch (err) {
      console.error(err)
      alert("저장 중 오류가 발생했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: Place) => {
    if (!p.id || !confirm("정말 삭제하시겠습니까?")) return
    try {
      await deletePlace(p.id, p._legacy)
    } catch (err) {
      console.error(err)
      alert("삭제 중 오류가 발생했습니다.")
    }
  }

  const loading = familyLoading || listLoading
  const categoryItems = places.filter((p) => {
    if (p.placeType !== activePlaceType) return false
    if (activeCategory === "all") return true
    return p.category === activeCategory
  })
  const searchTerm = searchQuery.trim().toLowerCase()
  const filteredItems = searchTerm
    ? categoryItems.filter((p) => p.name.toLowerCase().includes(searchTerm))
    : categoryItems

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white dark:bg-zinc-900 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-3 sm:py-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Map className="h-6 w-6 shrink-0 text-sky-500" />
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">가족 여행 리스트</h1>
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
        <FamilyMembersCard />

        <Tabs
          value={activePlaceType}
          onValueChange={(v) => v && setActivePlaceType(v as PlaceType)}
        >
          <TabsList className="w-full flex-wrap h-auto gap-1">
            {(Object.keys(placeTypeMeta) as PlaceType[]).map((key) => (
              <TabsTrigger key={key} value={key} className="gap-1">
                <span>{placeTypeMeta[key].emoji}</span>
                <span>{placeTypeMeta[key].label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Tabs
          value={activeCategory}
          onValueChange={(v) => v && setActiveCategory(v as PlaceListCategory)}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
              {listCategories.map((key) => (
                <TabsTrigger key={key} value={key} className="gap-1">
                  <span>{placeListCategoryMeta[key].emoji}</span>
                  <span className="hidden sm:inline">{placeListCategoryMeta[key].label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <Button size="sm" className="gap-1 shrink-0" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              장소 추가
            </Button>
          </div>

          {listCategories.map((tabCategory) => (
            <TabsContent key={tabCategory} value={tabCategory} className="mt-0">
              <p className="text-sm text-zinc-500 mb-3">
                {placeTypeMeta[activePlaceType].emoji} {placeTypeMeta[activePlaceType].label} ·{" "}
                {placeListCategoryMeta[tabCategory].description}
              </p>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="장소 이름 검색"
                  className="pl-9"
                />
              </div>
              {loading ? (
                <div className="flex justify-center py-16 text-zinc-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : categoryItems.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-zinc-400">
                    <Map className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-sm">등록된 장소가 없습니다</p>
                    <Button variant="outline" size="sm" className="mt-4 gap-1" onClick={openAdd}>
                      <Plus className="h-4 w-4" />
                      첫 장소 추가하기
                    </Button>
                  </CardContent>
                </Card>
              ) : filteredItems.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16 text-zinc-400">
                    <Search className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-sm">검색 결과가 없습니다</p>
                    <p className="text-xs mt-1 text-zinc-400">다른 검색어를 입력해 보세요</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredItems.map((p) => (
                    <Card key={`${p._legacy ? "legacy" : "place"}-${p.id}`} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            {tabCategory === "all" && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0 mb-1.5",
                                  placeCategoryMeta[p.category].badgeClass
                                )}
                              >
                                {placeCategoryMeta[p.category].emoji}{" "}
                                {placeCategoryMeta[p.category].label}
                              </Badge>
                            )}
                            <CardTitle className="text-base leading-snug">{p.name}</CardTitle>
                            {p.createdAt && (
                              <p className="text-xs text-zinc-400 mt-1">
                                등록 {format(p.createdAt, "yyyy.M.d (EEE)", { locale: ko })}
                              </p>
                            )}
                            {getEventPeriodText(p) && (
                              <p className="flex items-start gap-1 text-xs text-sky-600 dark:text-sky-400 mt-1">
                                <Calendar className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span>{getEventPeriodText(p)}</span>
                              </p>
                            )}
                            {p.rating && (p.category === "best" || p.category === "worst") && (
                              <div className="mt-1.5">
                                <StarRatingDisplay rating={p.rating} />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-400 hover:text-blue-600"
                              onClick={() => openEdit(p)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-400 hover:text-rose-600"
                              onClick={() => handleDelete(p)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {showPlaceMenus(p.placeType, p.category) && getPlaceMenus(p).length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-zinc-500">먹었던 메뉴</p>
                            <ul className="rounded-md border dark:border-zinc-800 divide-y dark:divide-zinc-800">
                              {getPlaceMenus(p).map((menu, index) => (
                                <li
                                  key={index}
                                  className="flex items-center justify-between gap-3 px-2.5 py-1.5"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-zinc-700 dark:text-zinc-300">{menu.name}</span>
                                    {menu.taste && (
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] px-1.5 py-0",
                                          menuTasteMeta[menu.taste].badgeClass
                                        )}
                                      >
                                        {menuTasteMeta[menu.taste].emoji} {menuTasteMeta[menu.taste].label}
                                      </Badge>
                                    )}
                                  </div>
                                  {menu.price != null && (
                                    <span className="text-zinc-500 shrink-0 tabular-nums">
                                      {formatPrice(menu.price)}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {showPlaceCosts(p.placeType, p.category) && getPlaceCosts(p).length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-zinc-500">비용</p>
                            <ul className="rounded-md border dark:border-zinc-800 divide-y dark:divide-zinc-800">
                              {getPlaceCosts(p).map((cost, index) => (
                                <li
                                  key={index}
                                  className="flex items-center justify-between gap-3 px-2.5 py-1.5"
                                >
                                  <span className="text-zinc-700 dark:text-zinc-300">{cost.name}</span>
                                  {cost.price != null && (
                                    <span className="text-zinc-500 shrink-0 tabular-nums">
                                      {formatPrice(cost.price)}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {p.location && (
                          <p className="flex items-start gap-1.5 text-zinc-500">
                            <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{p.location}</span>
                          </p>
                        )}
                        {p.link && (
                          <a
                            href={p.link.startsWith("http") ? p.link : `https://${p.link}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            링크 열기
                          </a>
                        )}
                        {p.category === "best" && p.bestReason && (
                          <div
                            className={cn(
                              "rounded-md border px-3 py-2 text-xs",
                              "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                            )}
                          >
                            <div className="flex items-center gap-1 font-medium mb-1">
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              베스트 이유
                            </div>
                            <p className="whitespace-pre-wrap">{p.bestReason}</p>
                          </div>
                        )}
                        {p.category === "worst" && p.worstReason && (
                          <div
                            className={cn(
                              "rounded-md border px-3 py-2 text-xs",
                              "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
                            )}
                          >
                            <div className="flex items-center gap-1 font-medium mb-1">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              워스트 이유
                            </div>
                            <p className="whitespace-pre-wrap">{p.worstReason}</p>
                          </div>
                        )}
                        <div className="pt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {p.member || "가족"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId
                ? "장소 수정"
                : `${placeTypeMeta[activePlaceType].emoji} ${placeTypeMeta[activePlaceType].label} 장소 추가`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>구분 *</Label>
              <div className="grid grid-cols-3 gap-2">
                {placeCategories.map((key) => (
                  <Button
                    key={key}
                    type="button"
                    variant={formCategory === key ? "default" : "outline"}
                    className={cn(
                      "h-auto flex-col gap-0.5 py-2.5 px-1 text-xs leading-tight",
                      formCategory === key && "ring-2 ring-offset-1 ring-offset-background"
                    )}
                    onClick={() => handleFormCategoryChange(key)}
                  >
                    <span className="text-base">{placeCategoryMeta[key].emoji}</span>
                    <span>{placeCategoryMeta[key].label.replace(" 장소", "")}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>장소 이름 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={namePlaceholders[formPlaceType]}
              />
            </div>
            {formPlaceType === "event" && (
              <div className="space-y-2">
                <Label>행사 기간</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-xs text-zinc-500">시작일</span>
                    <Input
                      type="date"
                      value={form.eventStartDate}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, eventStartDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-zinc-500">종료일</span>
                    <Input
                      type="date"
                      value={form.eventEndDate}
                      min={form.eventStartDate || undefined}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, eventEndDate: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}
            {showPlaceMenus(formPlaceType, formCategory) && (
              <div className="space-y-2">
                <Label>먹었던 메뉴</Label>
                <MenuListInput
                  menus={form.menus}
                  onChange={(menus) => setForm((prev) => ({ ...prev, menus }))}
                />
              </div>
            )}
            {showPlaceCosts(formPlaceType, formCategory) && (
              <div className="space-y-2">
                <Label>비용</Label>
                <CostListInput
                  costs={form.costs}
                  onChange={(costs) => setForm((prev) => ({ ...prev, costs }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>위치</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="예: 서울 강남구 역삼동"
              />
            </div>
            <div className="space-y-2">
              <Label>링크</Label>
              <Input
                value={form.link}
                onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
                placeholder="네이버 지도, 인스타, 블로그 URL"
              />
            </div>
            {(formCategory === "best" || formCategory === "worst") && (
              <div className="space-y-2">
                <Label>별점 *</Label>
                <StarRatingInput
                  value={form.rating}
                  onChange={(rating) => setForm((prev) => ({ ...prev, rating }))}
                />
              </div>
            )}
            {formCategory === "best" && (
              <div className="space-y-2">
                <Label>베스트 이유 *</Label>
                <textarea
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                  value={form.bestReason}
                  onChange={(e) => setForm((prev) => ({ ...prev, bestReason: e.target.value }))}
                  placeholder="왜 추천하는지 적어주세요"
                />
              </div>
            )}
            {formCategory === "worst" && (
              <div className="space-y-2">
                <Label>워스트 이유 *</Label>
                <textarea
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                  value={form.worstReason}
                  onChange={(e) => setForm((prev) => ({ ...prev, worstReason: e.target.value }))}
                  placeholder="왜 실망했는지 적어주세요"
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editId ? "수정 저장" : "등록"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PlacesPage() {
  return (
    <AuthGate>
      <FamilyPanelProvider>
        <PlacesContent />
      </FamilyPanelProvider>
    </AuthGate>
  )
}
