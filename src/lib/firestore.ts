import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  Timestamp,
  updateDoc,
  getDoc,
  setDoc,
  onSnapshot,
} from "firebase/firestore"

export interface Transaction {
  id?: string
  familyId: string
  date: Date
  type: "income" | "expense"
  category: string
  description: string
  amount: number
  member: string
  memberId?: string
  createdAt?: Date
}

export interface FixedTransaction {
  id?: string
  familyId: string
  type: "income" | "expense"
  category: string
  description: string
  amount: number
  member: string
  memberId?: string
  periodType: "weekly" | "monthly"
  periodValue: number | number[]
  createdAt?: Date
}

export interface Family {
  id?: string
  name: string
  ownerId: string
  members: string[]
  memberNames: Record<string, string>
  memberLastSeen?: Record<string, Date>
  createdAt?: Date
}

export interface Invitation {
  id?: string
  familyId: string
  code: string
  createdBy: string
  createdAt?: Date
}

const txCollection = collection(db, "transactions")
const fixedCollection = collection(db, "fixedTransactions")

function timestampToDate(ts: Timestamp): Date {
  return ts.toDate()
}

function convertMemberLastSeen(
  raw: Record<string, Timestamp> | undefined
): Record<string, Date> | undefined {
  if (!raw) return undefined
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, timestampToDate(v)])
  )
}

// ─── Family ───

export async function ensureFamilyData(family: Family): Promise<Family> {
  if (!family.id) return family
  const ref = doc(db, "families", family.id)
  const snap = await getDoc(ref)
  const data = snap.data() || {}
  const members = [...(family.members || [])]
  const memberNames = { ...(family.memberNames || {}) }
  let changed = false

  if (!members.includes(family.ownerId)) {
    members.push(family.ownerId)
    changed = true
  }

  for (const memberId of members) {
    if (!memberNames[memberId]) {
      memberNames[memberId] = memberId === family.ownerId ? "방장" : "멤버"
      changed = true
    }
  }

  const memberLastSeen = convertMemberLastSeen(data.memberLastSeen) || family.memberLastSeen

  if (changed) {
    await updateDoc(ref, { members, memberNames })
    return { ...family, members, memberNames, memberLastSeen }
  }
  return { ...family, memberLastSeen }
}

export async function updateMemberNickname(familyId: string, userId: string, nickname: string) {
  const ref = doc(db, "families", familyId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error("가족 그룹을 찾을 수 없습니다.")
  const data = snap.data()
  const memberNames: Record<string, string> = data.memberNames || {}
  await updateDoc(ref, {
    memberNames: { ...memberNames, [userId]: nickname },
  })
}

export async function createFamily(name: string, ownerId: string, ownerName?: string): Promise<string> {
  const docRef = await addDoc(collection(db, "families"), {
    name,
    ownerId,
    members: [ownerId],
    memberNames: { [ownerId]: ownerName || "방장" },
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

export async function getFamily(familyId: string): Promise<Family | null> {
  const snap = await getDoc(doc(db, "families", familyId))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    id: snap.id,
    ...data,
    createdAt: data.createdAt ? timestampToDate(data.createdAt as Timestamp) : undefined,
    memberLastSeen: convertMemberLastSeen(data.memberLastSeen),
  } as Family
}

export async function getFamilyByMember(userId: string): Promise<Family | null> {
  const q = query(collection(db, "families"), where("members", "array-contains", userId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  const data = docSnap.data()
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt ? timestampToDate(data.createdAt as Timestamp) : undefined,
    memberLastSeen: convertMemberLastSeen(data.memberLastSeen),
  } as Family
}

export async function joinFamily(familyId: string, userId: string, userName?: string) {
  const ref = doc(db, "families", familyId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error("가족 그룹을 찾을 수 없습니다.")
  const data = snap.data()
  const members: string[] = data.members || []
  const memberNames: Record<string, string> = data.memberNames || {}
  if (!members.includes(userId)) {
    await updateDoc(ref, {
      members: [...members, userId],
      memberNames: { ...memberNames, [userId]: userName || "멤버" },
    })
  }
}

export async function removeMemberFromFamily(familyId: string, userId: string) {
  const ref = doc(db, "families", familyId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error("가족 그룹을 찾을 수 없습니다.")
  const data = snap.data()
  const members: string[] = data.members || []
  const memberNames: Record<string, string> = data.memberNames || {}
  const newMembers = members.filter((m) => m !== userId)
  const newMemberNames = Object.fromEntries(
    Object.entries(memberNames).filter(([key]) => key !== userId)
  )

  // 강퇴된 멤버의 거래 내역 삭제
  // memberId가 없는 기존 데이터는 member(닉네임)으로 fallback 매칭
  const targetName = memberNames[userId]
  const txSnap = await getDocs(query(txCollection, where("familyId", "==", familyId)))
  const fixedSnap = await getDocs(query(fixedCollection, where("familyId", "==", familyId)))

  const txToDelete = txSnap.docs.filter((d) => {
    const dat = d.data()
    return dat.memberId === userId || (!dat.memberId && dat.member === targetName)
  })
  const fixedToDelete = fixedSnap.docs.filter((d) => {
    const dat = d.data()
    return dat.memberId === userId || (!dat.memberId && dat.member === targetName)
  })

  await Promise.all([
    ...txToDelete.map((d) => deleteDoc(doc(db, "transactions", d.id))),
    ...fixedToDelete.map((d) => deleteDoc(doc(db, "fixedTransactions", d.id))),
    updateDoc(ref, { members: newMembers, memberNames: newMemberNames }),
  ])
}

// ─── Invitation ───

export async function createInvitation(familyId: string, createdBy: string): Promise<string> {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  await setDoc(doc(db, "invitations", code), {
    familyId,
    code,
    createdBy,
    createdAt: Timestamp.now(),
  })
  return code
}

export async function getInvitation(code: string): Promise<Invitation | null> {
  const snap = await getDoc(doc(db, "invitations", code))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    id: snap.id,
    ...data,
    createdAt: data.createdAt ? timestampToDate(data.createdAt as Timestamp) : undefined,
  } as Invitation
}

// ─── Transactions (family-scoped) ───

export async function addTransaction(data: Omit<Transaction, "id" | "createdAt">) {
  return await addDoc(txCollection, {
    ...data,
    date: Timestamp.fromDate(data.date),
    createdAt: Timestamp.now(),
  })
}

export async function getTransactionsByFamily(familyId: string): Promise<Transaction[]> {
  const q = query(txCollection, where("familyId", "==", familyId), orderBy("date", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      date: timestampToDate(data.date as Timestamp),
      createdAt: data.createdAt ? timestampToDate(data.createdAt as Timestamp) : undefined,
    } as Transaction
  })
}

export async function deleteTransaction(id: string) {
  await deleteDoc(doc(db, "transactions", id))
}

export async function updateTransaction(id: string, data: Partial<Omit<Transaction, "id">>) {
  const payload: Record<string, unknown> = { ...data }
  if (data.date) payload.date = Timestamp.fromDate(data.date)
  await updateDoc(doc(db, "transactions", id), payload)
}

// ─── Fixed Transactions (family-scoped) ───

export async function addFixedTransaction(data: Omit<FixedTransaction, "id" | "createdAt">) {
  return await addDoc(fixedCollection, {
    ...data,
    createdAt: Timestamp.now(),
  })
}

export async function getFixedTransactionsByFamily(familyId: string): Promise<FixedTransaction[]> {
  const snapshot = await getDocs(
    query(fixedCollection, where("familyId", "==", familyId), orderBy("createdAt", "desc"))
  )
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt ? timestampToDate(data.createdAt as Timestamp) : undefined,
    } as FixedTransaction
  })
}

export async function deleteFixedTransaction(id: string) {
  await deleteDoc(doc(db, "fixedTransactions", id))
}

export async function updateFixedTransaction(id: string, data: Partial<Omit<FixedTransaction, "id">>) {
  const payload: Record<string, unknown> = { ...data }
  await updateDoc(doc(db, "fixedTransactions", id), payload)
}

// Generate virtual transactions for a given month based on fixed rules
export function generateFixedTransactionsForMonth(
  fixedTxs: FixedTransaction[],
  year: number,
  month: number // 0-based
): Transaction[] {
  const result: Transaction[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function getWeeklyDays(val: number | number[]): number[] {
    return Array.isArray(val) ? val : [val]
  }

  for (const ft of fixedTxs) {
    if (ft.periodType === "monthly") {
      const day = Math.min(ft.periodValue as number, daysInMonth)
      result.push({
        id: `fixed-${ft.id}-${year}-${month}-${day}`,
        familyId: ft.familyId,
        date: new Date(year, month, day),
        type: ft.type,
        category: ft.category,
        description: `${ft.description} (고정)`,
        amount: ft.amount,
        member: ft.member,
        memberId: ft.memberId,
      })
    } else if (ft.periodType === "weekly") {
      for (const weekDay of getWeeklyDays(ft.periodValue)) {
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, month, d)
          if (date.getDay() === weekDay) {
            result.push({
              id: `fixed-${ft.id}-${year}-${month}-${d}`,
              familyId: ft.familyId,
              date,
              type: ft.type,
              category: ft.category,
              description: `${ft.description} (고정)`,
              amount: ft.amount,
              member: ft.member,
              memberId: ft.memberId,
            })
          }
        }
      }
    }
  }

  return result
}

// ─── Real-time Subscriptions ───

export function subscribeTransactionsByFamily(
  familyId: string,
  callback: (transactions: Transaction[]) => void
) {
  const q = query(txCollection, where("familyId", "==", familyId), orderBy("date", "desc"))
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((docSnap) => {
      const d = docSnap.data()
      return {
        id: docSnap.id,
        ...d,
        date: timestampToDate(d.date as Timestamp),
        createdAt: d.createdAt ? timestampToDate(d.createdAt as Timestamp) : undefined,
      } as Transaction
    })
    callback(data)
  })
}

export function subscribeFixedTransactionsByFamily(
  familyId: string,
  callback: (fixed: FixedTransaction[]) => void
) {
  const q = query(fixedCollection, where("familyId", "==", familyId), orderBy("createdAt", "desc"))
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((docSnap) => {
      const d = docSnap.data()
      return {
        id: docSnap.id,
        ...d,
        createdAt: d.createdAt ? timestampToDate(d.createdAt as Timestamp) : undefined,
      } as FixedTransaction
    })
    callback(data)
  })
}

export function subscribeFamily(
  familyId: string,
  callback: (family: Family | null) => void
) {
  return onSnapshot(doc(db, "families", familyId), (snap) => {
    if (!snap.exists()) {
      callback(null)
      return
    }
    const data = snap.data()
    const family = {
      id: snap.id,
      ...data,
      createdAt: data.createdAt ? timestampToDate(data.createdAt as Timestamp) : undefined,
      memberLastSeen: data.memberLastSeen
        ? Object.fromEntries(
            Object.entries(data.memberLastSeen).map(([k, v]) => [
              k,
              timestampToDate(v as Timestamp),
            ])
          )
        : undefined,
    } as Family
    callback(family)
  })
}

export async function updateMemberLastSeen(familyId: string, userId: string) {
  const ref = doc(db, "families", familyId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const memberLastSeen: Record<string, Timestamp> = data.memberLastSeen || {}
  await updateDoc(ref, {
    memberLastSeen: { ...memberLastSeen, [userId]: Timestamp.now() },
  })
}

export function isMemberOnline(
  memberLastSeen: Record<string, Date> | undefined,
  userId: string
): boolean {
  if (!memberLastSeen || !memberLastSeen[userId]) return false
  const value = memberLastSeen[userId]
  const lastSeen =
    value instanceof Date ? value.getTime() : (value as unknown as Timestamp).toMillis()
  const now = Date.now()
  return now - lastSeen < 2 * 60 * 1000
}
