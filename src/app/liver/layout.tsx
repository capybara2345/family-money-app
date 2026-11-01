import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "지방간 탈출 · 가족 가계부",
  description: "생활습관 체크로 간 지방을 줄이는 기록",
}

export default function LiverLayout({ children }: { children: React.ReactNode }) {
  return children
}
