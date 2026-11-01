export const THEME_STORAGE_KEY = "theme"

export type Theme = "light" | "dark"

/** `readTheme`과 같은 규칙. 첫 페인트 전에 html에 dark 클래스를 붙인다. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var dark=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);}catch(e){}})();`

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === "light" || stored === "dark") return stored
  } catch {
    // localStorage를 쓸 수 없는 환경에서는 시스템 설정을 따른다.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function toggleTheme() {
  const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark"
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // 저장에 실패해도 이번 화면은 전환한다.
  }
  applyTheme(next)
}
