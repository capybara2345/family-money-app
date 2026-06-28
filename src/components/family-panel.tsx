"use client"

import { createContext, useContext, useState } from "react"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import { useFamily } from "@/hooks/use-family"
import {
  createInvitation,
  getInvitation,
  joinFamily,
  getFamily,
  ensureFamilyData,
  removeMemberFromFamily,
  updateMemberNickname,
  isMemberOnline,
} from "@/lib/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type FamilyPanelContextValue = {
  openJoin: () => void
  openInvite: () => void
  openProfile: () => void
}

const FamilyPanelContext = createContext<FamilyPanelContextValue | null>(null)

function useFamilyPanel() {
  const ctx = useContext(FamilyPanelContext)
  if (!ctx) throw new Error("FamilyPanelProvider가 필요합니다.")
  return ctx
}

export function FamilyPanelProvider({ children }: { children: React.ReactNode }) {
  const { session, family, setFamily } = useFamily()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)

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

  return (
    <FamilyPanelContext.Provider
      value={{
        openJoin: () => setJoinDialogOpen(true),
        openInvite: handleGenerateInvite,
        openProfile,
      }}
    >
      {children}

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>멤버 초대</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-zinc-500">
              아래 코드를 초대하고 싶은 멤버에게 공유하세요. 가계부와 여행 리스트가 함께 공유됩니다.
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
          </div>
        </DialogContent>
      </Dialog>

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
    </FamilyPanelContext.Provider>
  )
}

export function FamilyHeaderActions() {
  const { session } = useFamily()
  const { openJoin, openInvite, openProfile } = useFamilyPanel()

  if (!session?.user) return null

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={openJoin}>
        <span className="sm:hidden">코드 입력</span>
        <span className="hidden sm:inline">초대 코드 입력</span>
      </Button>
      <Button size="sm" variant="outline" className="text-xs sm:text-sm" onClick={openInvite}>
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
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openProfile} title="프로필 설정">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function FamilyMembersCard() {
  const { session, family } = useFamily()

  if (!family) return null

  const handleKick = async (userId: string) => {
    if (!family?.id) return
    if (!confirm("정말 이 멤버를 강퇴하시겠습니까?")) return
    try {
      await removeMemberFromFamily(family.id, userId)
    } catch (err) {
      console.error(err)
      alert("강퇴 중 오류가 발생했습니다.")
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-500">
          가족 멤버 ({family.members.length}명) · 가계부·여행 함께 보기
        </CardTitle>
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
                {isOwner && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-1">
                    방장
                  </Badge>
                )}
                {isMe && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1">
                    나
                  </Badge>
                )}
                {session?.user?.id === family.ownerId && !isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-zinc-400 hover:text-rose-600"
                    onClick={() => handleKick(memberId)}
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
  )
}
