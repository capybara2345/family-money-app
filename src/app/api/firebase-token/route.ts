import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth-options"
import { getAdminAuth } from "@/lib/firebase-admin"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const token = await getAdminAuth().createCustomToken(session.user.id)
    return NextResponse.json({ token })
  } catch (error) {
    console.error("Failed to create Firebase custom token:", error)
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 })
  }
}
