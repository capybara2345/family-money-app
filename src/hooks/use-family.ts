"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useFirebaseAuth } from "@/components/firebase-auth-provider"
import {
  createFamily,
  getFamily,
  getFamilyByMember,
  ensureFamilyData,
  subscribeFamily,
  isUserInFamily,
  updateMemberLastSeen,
  type Family,
} from "@/lib/firestore"

export function useFamily() {
  const { data: session, status } = useSession()
  const { ready: firebaseReady, authenticated: firebaseAuthenticated, error: firebaseError } =
    useFirebaseAuth()
  const [family, setFamily] = useState<Family | null>(null)
  const [loading, setLoading] = useState(true)

  const initFamily = useCallback(async () => {
    if (!session?.user?.id || !firebaseAuthenticated) return
    const userId = String(session.user.id)
    setLoading(true)
    try {
      let fam: Family | null = null

      const cachedId = localStorage.getItem("familyId")
      if (cachedId) {
        fam = await getFamily(cachedId)
      }

      if (fam && !isUserInFamily(fam, userId)) {
        localStorage.removeItem("familyId")
        if (String(fam.ownerId) === userId) {
          fam = await ensureFamilyData(fam, userId)
        } else {
          fam = null
        }
      }

      if (!fam || !isUserInFamily(fam, userId)) {
        fam = await getFamilyByMember(userId)
      }

      if (!fam) {
        const familyId = await createFamily(
          `${session.user.name || "우리"} 가족`,
          userId,
          session.user.name || "방장"
        )
        fam = await getFamily(familyId)
      }

      if (fam?.id) {
        localStorage.setItem("familyId", fam.id)
      }
      if (fam) {
        if (!isUserInFamily(fam, userId)) {
          localStorage.removeItem("familyId")
          setFamily(null)
          return
        }
        fam = await ensureFamilyData(fam, userId)
      }
      setFamily(fam)
    } catch (e) {
      console.error("initFamily failed:", e)
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
    if (!family?.id || !session?.user?.id || !firebaseAuthenticated) return
    const userId = session.user.id
    return subscribeFamily(family.id, (fam) => {
      if (!fam) {
        setFamily(null)
        return
      }
      if (!isUserInFamily(fam, userId)) {
        localStorage.removeItem("familyId")
        setFamily(null)
        return
      }
      setFamily(fam)
    })
  }, [family?.id, session?.user?.id, firebaseAuthenticated])

  useEffect(() => {
    if (!family?.id || !session?.user?.id || !firebaseAuthenticated) return
    const familyId = family.id
    const userId = session.user.id
    updateMemberLastSeen(familyId, userId)
    const interval = setInterval(() => {
      updateMemberLastSeen(familyId, userId)
    }, 30000)
    return () => clearInterval(interval)
  }, [family?.id, session?.user?.id, firebaseAuthenticated])

  return {
    session,
    status,
    family,
    setFamily,
    loading,
    firebaseReady,
    firebaseAuthenticated,
    firebaseError,
  }
}
