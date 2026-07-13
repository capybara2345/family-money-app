import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = join(__dirname, "../src/data/lotto-draws.json")
const MAX_ROUND = Number(process.env.LOTTO_MAX_ROUND || 1232)
const CONCURRENCY = 8
const DELAY_MS = 80

function formatDate(ymd) {
  if (ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

function parseItem(item) {
  return {
    round: item.ltEpsd,
    date: formatDate(item.ltRflYmd),
    numbers: [item.tm1WnNo, item.tm2WnNo, item.tm3WnNo, item.tm4WnNo, item.tm5WnNo, item.tm6WnNo],
    bonus: item.bnsWnNo,
    ...(item.rnk1WnAmt ? { firstPrize: item.rnk1WnAmt } : {}),
    ...(item.rnk1WnNope ? { firstWinners: item.rnk1WnNope } : {}),
    ...(item.rlvtEpsdSumNtslAmt ? { totalSales: item.rlvtEpsdSumNtslAmt } : {}),
  }
}

async function fetchRound(round, retries = 3) {
  const url = `https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=${round}&_=${Date.now()}`
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://www.dhlottery.co.kr/",
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const item = json?.data?.list?.[0]
      if (!item || item.ltEpsd !== round) throw new Error("empty response")
      return parseItem(item)
    } catch (err) {
      if (attempt === retries) throw new Error(`round ${round}: ${err.message}`)
      await sleep(300 * attempt)
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchAll() {
  const draws = []
  const failed = []

  for (let start = 1; start <= MAX_ROUND; start += CONCURRENCY) {
    const end = Math.min(start + CONCURRENCY - 1, MAX_ROUND)
    const rounds = Array.from({ length: end - start + 1 }, (_, i) => start + i)

    const results = await Promise.allSettled(rounds.map((round) => fetchRound(round)))
    for (let i = 0; i < results.length; i++) {
      const round = rounds[i]
      const result = results[i]
      if (result.status === "fulfilled") {
        draws.push(result.value)
        process.stdout.write(`\r${draws.length}/${MAX_ROUND} 회차 수집 완료`)
      } else {
        failed.push({ round, reason: result.reason?.message || "unknown" })
        process.stdout.write(`\r${draws.length}/${MAX_ROUND} 회차 수집 (실패: ${round}회)`)
      }
    }

    if (end < MAX_ROUND) await sleep(DELAY_MS)
  }

  console.log("")
  if (failed.length > 0) {
    console.error(`실패 ${failed.length}건:`, failed.slice(0, 5))
    process.exit(1)
  }

  draws.sort((a, b) => a.round - b.round)

  const payload = {
    updatedAt: new Date().toISOString(),
    maxRound: MAX_ROUND,
    draws,
  }

  writeFileSync(OUTPUT, JSON.stringify(payload, null, 2), "utf8")
  console.log(`저장 완료: ${OUTPUT} (${draws.length}회차)`)
}

fetchAll().catch((err) => {
  console.error(err)
  process.exit(1)
})
