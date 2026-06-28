import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  deleteDoc,
  deleteField,
  doc,
  query,
  where,
  Timestamp,
  updateDoc,
  onSnapshot,
} from "firebase/firestore"

export type PlaceCategory = "best" | "rumored" | "worst"
export type PlaceListCategory = PlaceCategory | "all"
export type PlaceType = "restaurant" | "kids" | "event" | "other"
export type MenuTaste = "recommend" | "okay" | "worst"

export const menuTasteMeta: Record<
  MenuTaste,
  { label: string; emoji: string; badgeClass: string; activeClass: string }
> = {
  recommend: {
    label: "추천",
    emoji: "😋",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-transparent",
    activeClass: "bg-emerald-600 hover:bg-emerald-600 text-white",
  },
  okay: {
    label: "무난",
    emoji: "😐",
    badgeClass: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-transparent",
    activeClass: "bg-zinc-600 hover:bg-zinc-600 text-white",
  },
  worst: {
    label: "최악",
    emoji: "🤮",
    badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-transparent",
    activeClass: "bg-rose-600 hover:bg-rose-600 text-white",
  },
}

export const placeTypeMeta: Record<PlaceType, { label: string; emoji: string }> = {
  restaurant: { label: "맛집", emoji: "🍽️" },
  kids: { label: "키즈", emoji: "🧒" },
  event: { label: "행사", emoji: "🎉" },
  other: { label: "기타", emoji: "📌" },
}

export const placeCategoryMeta: Record<
  PlaceCategory,
  { label: string; emoji: string; description: string; badgeClass: string }
> = {
  best: {
    label: "베스트 장소",
    emoji: "⭐",
    description: "가족이 인정한 최고의 장소",
    badgeClass:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-900",
  },
  rumored: {
    label: "소문난 장소",
    emoji: "👀",
    description: "아직 가보지 못한, 가보고 싶은 곳",
    badgeClass:
      "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-900",
  },
  worst: {
    label: "워스트 장소",
    emoji: "💀",
    description: "가봤지만 실망한 곳",
    badgeClass:
      "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-900",
  },
}

export const placeListCategoryMeta: Record<
  PlaceListCategory,
  { label: string; emoji: string; description: string }
> = {
  all: { label: "전체", emoji: "📋", description: "베스트·소문난·워스트 장소를 한눈에 봅니다" },
  best: placeCategoryMeta.best,
  rumored: placeCategoryMeta.rumored,
  worst: placeCategoryMeta.worst,
}

export interface PlaceMenuItem {
  name: string
  price?: number
  taste?: MenuTaste
}

export interface PlaceCostItem {
  name: string
  price?: number
}

export interface Place {
  id?: string
  familyId: string
  placeType: PlaceType
  category: PlaceCategory
  name: string
  /** @deprecated menus 사용 */
  description?: string
  menus?: PlaceMenuItem[]
  costs?: PlaceCostItem[]
  eventStartDate?: string
  eventEndDate?: string
  location?: string
  link?: string
  bestReason?: string
  worstReason?: string
  rating?: number
  memberId?: string
  member?: string
  createdAt?: Date
  updatedAt?: Date
  /** 기존 restaurants 컬렉션 문서 여부 */
  _legacy?: boolean
}

const placesCollection = collection(db, "places")
const legacyRestaurantsCollection = collection(db, "restaurants")

function omitUndefined<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
}

function parsePlaceType(value: unknown): PlaceType {
  if (value === "restaurant" || value === "kids" || value === "event" || value === "other") {
    return value
  }
  return "restaurant"
}

export function showPlaceMenus(placeType: PlaceType, category: PlaceCategory): boolean {
  return placeType === "restaurant" && category !== "rumored"
}

export function showPlaceCosts(placeType: PlaceType, _category: PlaceCategory): boolean {
  return placeType !== "restaurant"
}

function parseDateField(value: unknown): string | undefined {
  if (value instanceof Timestamp) {
    const d = value.toDate()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
    if (isoMatch) return isoMatch[1]
  }
  return undefined
}

function toStoredDateField(value: unknown): string | undefined {
  if (typeof value === "string") return parseDateField(value.trim())
  return parseDateField(value)
}

function parseCosts(data: Record<string, unknown>): PlaceCostItem[] | undefined {
  if (!Array.isArray(data.costs)) return undefined
  const costs = data.costs
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null
      const row = raw as Record<string, unknown>
      const name = String(row.name ?? "").trim()
      if (!name) return null
      const price =
        typeof row.price === "number" && row.price >= 0 ? row.price : undefined
      const item: PlaceCostItem = { name }
      if (price != null) item.price = price
      return item
    })
    .filter((item): item is PlaceCostItem => item !== null)
  return costs.length > 0 ? costs : undefined
}

export function getPlaceCosts(place: Place): PlaceCostItem[] {
  return place.costs ?? []
}

function parseMenus(data: Record<string, unknown>): PlaceMenuItem[] | undefined {
  if (!Array.isArray(data.menus)) return undefined
  const menus = data.menus
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null
      const row = raw as Record<string, unknown>
      const name = String(row.name ?? "").trim()
      if (!name) return null
      const price =
        typeof row.price === "number" && row.price >= 0 ? row.price : undefined
      const taste =
        row.taste === "recommend" || row.taste === "okay" || row.taste === "worst"
          ? row.taste
          : undefined
      const menu: PlaceMenuItem = { name }
      if (price != null) menu.price = price
      if (taste) menu.taste = taste
      return menu
    })
    .filter((menu): menu is PlaceMenuItem => menu !== null)
  return menus.length > 0 ? menus : undefined
}

export function getPlaceMenus(place: Place): PlaceMenuItem[] {
  if (place.menus?.length) return place.menus
  if (place.description?.trim()) {
    return [{ name: place.description.trim() }]
  }
  return []
}

function parsePlace(id: string, data: Record<string, unknown>, legacy = false): Place {
  const menus = parseMenus(data)
  const costs = parseCosts(data)
  return {
    id,
    familyId: String(data.familyId ?? ""),
    placeType: parsePlaceType(data.placeType),
    category: data.category as PlaceCategory,
    name: String(data.name ?? ""),
    description: data.description ? String(data.description) : undefined,
    menus,
    costs,
    eventStartDate: parseDateField(data.eventStartDate),
    eventEndDate: parseDateField(data.eventEndDate),
    location: data.location ? String(data.location) : undefined,
    link: data.link ? String(data.link) : undefined,
    bestReason: data.bestReason ? String(data.bestReason) : undefined,
    worstReason: data.worstReason ? String(data.worstReason) : undefined,
    rating:
      typeof data.rating === "number" && data.rating >= 1 && data.rating <= 5
        ? data.rating
        : undefined,
    memberId: data.memberId ? String(data.memberId) : undefined,
    member: data.member ? String(data.member) : undefined,
    createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : undefined,
    updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : undefined,
    _legacy: legacy,
  }
}

function sortPlaces(places: Place[]) {
  return [...places].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

export function subscribePlacesByFamily(
  familyId: string,
  callback: (places: Place[]) => void,
  onError?: (error: Error) => void
) {
  let placesData: Place[] = []
  let legacyData: Place[] = []

  const emit = () => callback(sortPlaces([...placesData, ...legacyData]))

  const placesQuery = query(placesCollection, where("familyId", "==", familyId))
  const legacyQuery = query(legacyRestaurantsCollection, where("familyId", "==", familyId))

  const unsubPlaces = onSnapshot(
    placesQuery,
    (snapshot) => {
      placesData = snapshot.docs.map((docSnap) => parsePlace(docSnap.id, docSnap.data()))
      emit()
    },
    (error) => {
      console.error("places subscription error:", error)
      onError?.(error)
    }
  )

  const unsubLegacy = onSnapshot(
    legacyQuery,
    (snapshot) => {
      legacyData = snapshot.docs.map((docSnap) => parsePlace(docSnap.id, docSnap.data(), true))
      emit()
    },
    (error) => {
      console.error("legacy restaurants subscription error:", error)
      onError?.(error)
    }
  )

  return () => {
    unsubPlaces()
    unsubLegacy()
  }
}

function collectionName(legacy?: boolean) {
  return legacy ? "restaurants" : "places"
}

export async function addPlace(data: Omit<Place, "id" | "createdAt" | "updatedAt" | "_legacy">) {
  const now = Timestamp.now()
  return await addDoc(
    placesCollection,
    omitUndefined({
      ...data,
      memberId: data.memberId ? String(data.memberId) : undefined,
      createdAt: now,
      updatedAt: now,
    })
  )
}

export async function updatePlace(
  id: string,
  data: Partial<Omit<Place, "id" | "familyId" | "createdAt" | "_legacy">>,
  legacy = false
) {
  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: Timestamp.now(),
  }
  if ("menus" in data) {
    payload.description = deleteField()
    payload.menus = data.menus?.length ? data.menus : deleteField()
  }
  if ("costs" in data) {
    payload.costs = data.costs?.length ? data.costs : deleteField()
  }
  if ("bestReason" in data) {
    payload.bestReason = data.bestReason?.trim() ? data.bestReason.trim() : deleteField()
  }
  if ("worstReason" in data) {
    payload.worstReason = data.worstReason?.trim() ? data.worstReason.trim() : deleteField()
  }
  if ("eventStartDate" in data) {
    payload.eventStartDate = toStoredDateField(data.eventStartDate) ?? deleteField()
  }
  if ("eventEndDate" in data) {
    payload.eventEndDate = toStoredDateField(data.eventEndDate) ?? deleteField()
  }
  await updateDoc(doc(db, collectionName(legacy), id), omitUndefined(payload))
}

export async function movePlaceCategory(
  id: string,
  category: PlaceCategory,
  options?: { bestReason?: string; worstReason?: string; rating?: number },
  legacy = false
) {
  const payload: Record<string, unknown> = {
    category,
    updatedAt: Timestamp.now(),
  }
  if (category === "worst") {
    payload.worstReason = options?.worstReason?.trim()
    payload.bestReason = deleteField()
    payload.rating = options?.rating
  } else if (category === "best") {
    payload.bestReason = options?.bestReason?.trim()
    payload.worstReason = deleteField()
    payload.rating = options?.rating
  } else {
    payload.worstReason = deleteField()
    payload.bestReason = deleteField()
    payload.rating = deleteField()
    payload.menus = deleteField()
    payload.costs = deleteField()
  }
  await updateDoc(doc(db, collectionName(legacy), id), payload)
}

export async function deletePlace(id: string, legacy = false) {
  await deleteDoc(doc(db, collectionName(legacy), id))
}
