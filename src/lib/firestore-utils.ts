import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  updateDoc,
  Timestamp,
} from "firebase/firestore"

export type UtilChartKind = "bar" | "line" | "dashed"

export interface UtilMarkdownDoc {
  id?: string
  familyId: string
  title: string
  content: string
  memberId?: string
  member?: string
  createdAt?: Date
  updatedAt?: Date
}

export interface UtilChartRow {
  label: string
  value: string
}

export interface UtilChartDoc {
  id?: string
  familyId: string
  title: string
  chartKind: UtilChartKind
  xLabel: string
  yLabel: string
  rows: UtilChartRow[]
  memberId?: string
  member?: string
  createdAt?: Date
  updatedAt?: Date
}

const markdownCollection = collection(db, "utilMarkdowns")
const chartCollection = collection(db, "utilCharts")

function timestampToDate(value: unknown): Date | undefined {
  if (value instanceof Timestamp) return value.toDate()
  return undefined
}

function omitUndefined<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
}

function parseMarkdown(id: string, data: Record<string, unknown>): UtilMarkdownDoc {
  return {
    id,
    familyId: String(data.familyId ?? ""),
    title: String(data.title ?? "제목 없음"),
    content: String(data.content ?? ""),
    memberId: data.memberId ? String(data.memberId) : undefined,
    member: data.member ? String(data.member) : undefined,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  }
}

function parseChart(id: string, data: Record<string, unknown>): UtilChartDoc {
  const rowsRaw = Array.isArray(data.rows) ? data.rows : []
  const chartKind =
    data.chartKind === "line" || data.chartKind === "dashed" || data.chartKind === "bar"
      ? data.chartKind
      : "bar"

  return {
    id,
    familyId: String(data.familyId ?? ""),
    title: String(data.title ?? "제목 없음"),
    chartKind,
    xLabel: String(data.xLabel ?? ""),
    yLabel: String(data.yLabel ?? ""),
    rows: rowsRaw.map((row) => {
      const item = (row ?? {}) as Record<string, unknown>
      return {
        label: String(item.label ?? ""),
        value: String(item.value ?? ""),
      }
    }),
    memberId: data.memberId ? String(data.memberId) : undefined,
    member: data.member ? String(data.member) : undefined,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  }
}

function sortByUpdatedAtDesc<T extends { updatedAt?: Date; createdAt?: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime = (a.updatedAt ?? a.createdAt)?.getTime() ?? 0
    const bTime = (b.updatedAt ?? b.createdAt)?.getTime() ?? 0
    return bTime - aTime
  })
}

export function subscribeUtilMarkdowns(
  familyId: string,
  callback: (docs: UtilMarkdownDoc[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(markdownCollection, where("familyId", "==", familyId))
  return onSnapshot(
    q,
    (snapshot) => {
      const docs = sortByUpdatedAtDesc(
        snapshot.docs.map((docSnap) => parseMarkdown(docSnap.id, docSnap.data()))
      )
      callback(docs)
    },
    (error) => {
      console.error("utilMarkdowns subscription error:", error)
      onError?.(error)
    }
  )
}

export function subscribeUtilCharts(
  familyId: string,
  callback: (docs: UtilChartDoc[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(chartCollection, where("familyId", "==", familyId))
  return onSnapshot(
    q,
    (snapshot) => {
      const docs = sortByUpdatedAtDesc(
        snapshot.docs.map((docSnap) => parseChart(docSnap.id, docSnap.data()))
      )
      callback(docs)
    },
    (error) => {
      console.error("utilCharts subscription error:", error)
      onError?.(error)
    }
  )
}

export async function addUtilMarkdown(
  data: Omit<UtilMarkdownDoc, "id" | "createdAt" | "updatedAt">
) {
  const now = Timestamp.now()
  return addDoc(
    markdownCollection,
    omitUndefined({
      ...data,
      memberId: data.memberId ? String(data.memberId) : undefined,
      createdAt: now,
      updatedAt: now,
    })
  )
}

export async function updateUtilMarkdown(
  id: string,
  data: Partial<Pick<UtilMarkdownDoc, "title" | "content" | "member" | "memberId">>
) {
  await updateDoc(
    doc(db, "utilMarkdowns", id),
    omitUndefined({
      ...data,
      memberId: data.memberId ? String(data.memberId) : undefined,
      updatedAt: Timestamp.now(),
    })
  )
}

export async function deleteUtilMarkdown(id: string) {
  await deleteDoc(doc(db, "utilMarkdowns", id))
}

export async function addUtilChart(data: Omit<UtilChartDoc, "id" | "createdAt" | "updatedAt">) {
  const now = Timestamp.now()
  return addDoc(
    chartCollection,
    omitUndefined({
      ...data,
      memberId: data.memberId ? String(data.memberId) : undefined,
      createdAt: now,
      updatedAt: now,
    })
  )
}

export async function updateUtilChart(
  id: string,
  data: Partial<
    Pick<UtilChartDoc, "title" | "chartKind" | "xLabel" | "yLabel" | "rows" | "member" | "memberId">
  >
) {
  await updateDoc(
    doc(db, "utilCharts", id),
    omitUndefined({
      ...data,
      memberId: data.memberId ? String(data.memberId) : undefined,
      updatedAt: Timestamp.now(),
    })
  )
}

export async function deleteUtilChart(id: string) {
  await deleteDoc(doc(db, "utilCharts", id))
}
