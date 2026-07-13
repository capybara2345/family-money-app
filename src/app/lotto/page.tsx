import { getAllLottoDraws, getLottoDataMeta } from "@/lib/lotto-data"
import { getAllPensionDraws, getPensionDataMeta } from "@/lib/pension-data"
import { LottoPageClient } from "./page-client"

export default function LottoPage() {
  return (
    <LottoPageClient
      lottoDraws={getAllLottoDraws()}
      lottoMeta={getLottoDataMeta()}
      pensionDraws={getAllPensionDraws()}
      pensionMeta={getPensionDataMeta()}
    />
  )
}
