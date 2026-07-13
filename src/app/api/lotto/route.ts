import { NextRequest, NextResponse } from "next/server"
import { parseDhLotteryItem } from "@/lib/lotto"

export const dynamic = "force-dynamic"

async function fetchFromDhLottery(round: number) {
  const url = `https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=${round}&_=${Date.now()}`
  const res = await fetch(url, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://www.dhlottery.co.kr/",
    },
    next: { revalidate: round >= 1200 ? 600 : 60 * 60 * 24 * 7 },
  })
  if (!res.ok) {
    throw new Error(`동행복권 API 오류 (${res.status})`)
  }
  const json = await res.json()
  const item = json?.data?.list?.[0]
  if (!item || item.ltEpsd !== round) {
    throw new Error("당첨 데이터를 찾을 수 없습니다.")
  }
  return parseDhLotteryItem(item)
}

export async function GET(request: NextRequest) {
  const roundParam = request.nextUrl.searchParams.get("round")
  if (!roundParam) {
    return NextResponse.json({ error: "round 파라미터가 필요합니다." }, { status: 400 })
  }

  const round = Number(roundParam)
  if (!Number.isInteger(round) || round < 1 || round > 9999) {
    return NextResponse.json({ error: "유효하지 않은 회차입니다." }, { status: 400 })
  }

  try {
    const draw = await fetchFromDhLottery(round)
    return NextResponse.json(draw)
  } catch (err) {
    const message = err instanceof Error ? err.message : "조회 실패"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
