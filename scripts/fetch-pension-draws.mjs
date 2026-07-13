import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = join(__dirname, "../src/data/pension-draws.json")

function formatDate(ymd) {
  if (ymd.length !== 8) return ymd
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

function padNumber(value) {
  return String(value).padStart(6, "0").slice(-6)
}

async function fetchAll() {
  const url = `https://www.dhlottery.co.kr/pt720/selectPstPt720WnList.do?_=${Date.now()}`
  const res = await fetch(url, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://www.dhlottery.co.kr/",
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const list = json?.data?.result
  if (!Array.isArray(list) || list.length === 0) throw new Error("empty response")

  const draws = list
    .map((item) => ({
      round: item.psltEpsd,
      date: formatDate(item.psltRflYmd),
      group: Number(item.wnBndNo),
      number: padNumber(item.wnRnkVl),
      bonus: padNumber(item.bnsRnkVl),
    }))
    .sort((a, b) => a.round - b.round)

  const payload = {
    updatedAt: new Date().toISOString(),
    maxRound: draws[draws.length - 1].round,
    draws,
  }

  writeFileSync(OUTPUT, JSON.stringify(payload, null, 2), "utf8")
  console.log(`저장 완료: ${OUTPUT} (${draws.length}회차)`)
}

fetchAll().catch((err) => {
  console.error(err)
  process.exit(1)
})
