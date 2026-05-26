"use client"

import { signIn } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wallet, LogIn } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
              <Wallet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <CardTitle className="text-2xl">가족 가계부</CardTitle>
          <CardDescription>로그인하여 가계부를 관리하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => signIn("google", { callbackUrl: "/" })}
          >
            <LogIn className="h-4 w-4" />
            Google로 로그인
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
