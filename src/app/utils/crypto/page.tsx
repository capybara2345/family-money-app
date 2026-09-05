"use client"

import { useState } from "react"
import { ArrowLeftRight, Copy, Eraser } from "lucide-react"
import { UtilsShell } from "@/components/utils-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  decodeBase64,
  decryptAes,
  encodeBase64,
  encryptAes,
  hashSha256,
} from "@/lib/crypto-utils"

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

export default function CryptoUtilsPage() {
  const [cryptoTab, setCryptoTab] = useState("base64")
  const [base64Input, setBase64Input] = useState("")
  const [base64Output, setBase64Output] = useState("")
  const [base64Error, setBase64Error] = useState("")

  const [aesInput, setAesInput] = useState("")
  const [aesPassword, setAesPassword] = useState("")
  const [aesOutput, setAesOutput] = useState("")
  const [aesError, setAesError] = useState("")

  const [shaInput, setShaInput] = useState("")
  const [shaOutput, setShaOutput] = useState("")
  const [shaCompare, setShaCompare] = useState("")
  const [shaMessage, setShaMessage] = useState("")

  const runBase64Encode = () => {
    setBase64Error("")
    try {
      setBase64Output(encodeBase64(base64Input))
    } catch (err) {
      setBase64Error(err instanceof Error ? err.message : "인코딩에 실패했습니다.")
    }
  }

  const runBase64Decode = () => {
    setBase64Error("")
    try {
      setBase64Output(decodeBase64(base64Input))
    } catch {
      setBase64Error("Base64 디코딩에 실패했습니다. 입력을 확인해주세요.")
    }
  }

  const runAesEncrypt = async () => {
    setAesError("")
    if (!aesPassword) {
      setAesError("비밀번호를 입력해주세요.")
      return
    }
    try {
      setAesOutput(await encryptAes(aesInput, aesPassword))
    } catch (err) {
      setAesError(err instanceof Error ? err.message : "암호화에 실패했습니다.")
    }
  }

  const runAesDecrypt = async () => {
    setAesError("")
    if (!aesPassword) {
      setAesError("비밀번호를 입력해주세요.")
      return
    }
    try {
      setAesOutput(await decryptAes(aesInput, aesPassword))
    } catch {
      setAesError("복호화에 실패했습니다. 암호문 또는 비밀번호를 확인해주세요.")
    }
  }

  const runShaHash = async () => {
    setShaMessage("")
    const hash = await hashSha256(shaInput)
    setShaOutput(hash)
    if (shaCompare.trim()) {
      setShaMessage(
        hash.toLowerCase() === shaCompare.trim().toLowerCase()
          ? "일치합니다. (검증 성공)"
          : "일치하지 않습니다."
      )
    }
  }

  return (
    <UtilsShell>
      <div className="space-y-4">
        <p className="text-sm text-zinc-500">
          Base64 · AES(AES-GCM) · SHA-256 변환 도구입니다. AES는 브라우저 Web Crypto로 처리되며
          서버로 전송되지 않습니다.
        </p>

        <Tabs value={cryptoTab} onValueChange={setCryptoTab}>
          <TabsList className="h-auto w-full flex-wrap gap-1">
            <TabsTrigger value="base64">Base64</TabsTrigger>
            <TabsTrigger value="aes">AES</TabsTrigger>
            <TabsTrigger value="sha256">SHA-256</TabsTrigger>
          </TabsList>

          <TabsContent value="base64" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Base64 암복호화</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="b64-in">입력</Label>
                  <Textarea
                    id="b64-in"
                    value={base64Input}
                    onChange={(e) => setBase64Input(e.target.value)}
                    className="min-h-32 font-mono"
                    placeholder="평문 또는 Base64 문자열"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={runBase64Encode}>
                    인코딩
                  </Button>
                  <Button type="button" variant="outline" onClick={runBase64Decode}>
                    디코딩
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-1"
                    onClick={() => {
                      setBase64Input(base64Output)
                      setBase64Output("")
                    }}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    결과 → 입력
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-1"
                    onClick={() => {
                      setBase64Input("")
                      setBase64Output("")
                      setBase64Error("")
                    }}
                  >
                    <Eraser className="h-4 w-4" />
                    지우기
                  </Button>
                </div>
                {base64Error && <p className="text-sm text-rose-600">{base64Error}</p>}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="b64-out">결과</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1"
                      disabled={!base64Output}
                      onClick={() => copyText(base64Output)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      복사
                    </Button>
                  </div>
                  <Textarea
                    id="b64-out"
                    readOnly
                    value={base64Output}
                    className="min-h-32 font-mono"
                    placeholder="결과가 여기에 표시됩니다"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="aes" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">AES 암복호화 (AES-256-GCM)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="aes-pass">비밀번호</Label>
                  <Input
                    id="aes-pass"
                    type="password"
                    value={aesPassword}
                    onChange={(e) => setAesPassword(e.target.value)}
                    placeholder="암호화/복호화에 사용할 비밀번호"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aes-in">입력</Label>
                  <Textarea
                    id="aes-in"
                    value={aesInput}
                    onChange={(e) => setAesInput(e.target.value)}
                    className="min-h-32 font-mono"
                    placeholder="평문 또는 AES 암호문(Base64)"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={runAesEncrypt}>
                    암호화
                  </Button>
                  <Button type="button" variant="outline" onClick={runAesDecrypt}>
                    복호화
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-1"
                    onClick={() => {
                      setAesInput(aesOutput)
                      setAesOutput("")
                    }}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    결과 → 입력
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-1"
                    onClick={() => {
                      setAesInput("")
                      setAesOutput("")
                      setAesError("")
                    }}
                  >
                    <Eraser className="h-4 w-4" />
                    지우기
                  </Button>
                </div>
                {aesError && <p className="text-sm text-rose-600">{aesError}</p>}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="aes-out">결과</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1"
                      disabled={!aesOutput}
                      onClick={() => copyText(aesOutput)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      복사
                    </Button>
                  </div>
                  <Textarea
                    id="aes-out"
                    readOnly
                    value={aesOutput}
                    className="min-h-32 font-mono"
                    placeholder="결과가 여기에 표시됩니다"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sha256" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">SHA-256 해시</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-zinc-500">
                  SHA-256은 단방향 해시라 복호화할 수 없습니다. 해시 생성과 값 비교(검증)를
                  제공합니다.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="sha-in">입력</Label>
                  <Textarea
                    id="sha-in"
                    value={shaInput}
                    onChange={(e) => setShaInput(e.target.value)}
                    className="min-h-32 font-mono"
                    placeholder="해시할 문자열"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sha-compare">비교용 해시 (선택)</Label>
                  <Input
                    id="sha-compare"
                    value={shaCompare}
                    onChange={(e) => setShaCompare(e.target.value)}
                    className="font-mono"
                    placeholder="검증할 SHA-256 해시"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={runShaHash}>
                    해시 생성
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-1"
                    onClick={() => {
                      setShaInput("")
                      setShaOutput("")
                      setShaCompare("")
                      setShaMessage("")
                    }}
                  >
                    <Eraser className="h-4 w-4" />
                    지우기
                  </Button>
                </div>
                {shaMessage && (
                  <p
                    className={`text-sm ${
                      shaMessage.includes("성공")
                        ? "text-teal-700 dark:text-teal-300"
                        : "text-rose-600"
                    }`}
                  >
                    {shaMessage}
                  </p>
                )}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="sha-out">결과 (hex)</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1"
                      disabled={!shaOutput}
                      onClick={() => copyText(shaOutput)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      복사
                    </Button>
                  </div>
                  <Textarea
                    id="sha-out"
                    readOnly
                    value={shaOutput}
                    className="min-h-24 font-mono"
                    placeholder="해시 결과가 여기에 표시됩니다"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </UtilsShell>
  )
}
