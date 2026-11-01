export type FoodCalorie = {
  name: string
  kcal: number
  serving: string
  aliases?: string[]
}

/**
 * 흔한 1인분 평균 칼로리. 브랜드·조리·양에 따라 달라지므로 숫자 수정이 가능하다.
 */
export const FOODS: FoodCalorie[] = [
  { name: "흰쌀밥", kcal: 300, serving: "1공기", aliases: ["쌀밥", "공기밥"] },
  { name: "현미밥", kcal: 320, serving: "1공기", aliases: ["현미"] },
  { name: "잡곡밥", kcal: 310, serving: "1공기" },
  { name: "볶음밥", kcal: 550, serving: "1접시" },
  { name: "김치볶음밥", kcal: 560, serving: "1접시" },
  { name: "비빔밥", kcal: 600, serving: "1그릇" },
  { name: "덮밥", kcal: 650, serving: "1그릇" },
  { name: "회덮밥", kcal: 520, serving: "1그릇" },
  { name: "카레라이스", kcal: 700, serving: "1접시" },
  { name: "오므라이스", kcal: 700, serving: "1접시" },
  { name: "김밥", kcal: 450, serving: "1줄" },
  { name: "삼각김밥", kcal: 180, serving: "1개" },
  { name: "주먹밥", kcal: 180, serving: "1개" },
  { name: "컵밥", kcal: 420, serving: "1개" },
  { name: "편의점 도시락", kcal: 720, serving: "1개", aliases: ["도시락"] },
  { name: "죽", kcal: 200, serving: "1그릇" },
  { name: "오트밀", kcal: 150, serving: "1그릇" },
  { name: "시리얼과 우유", kcal: 250, serving: "1그릇", aliases: ["시리얼"] },
  { name: "식빵", kcal: 80, serving: "1장" },
  { name: "토스트", kcal: 240, serving: "2장" },
  { name: "샌드위치", kcal: 350, serving: "1개" },
  { name: "단팥빵", kcal: 250, serving: "1개", aliases: ["빵"] },
  { name: "크림빵", kcal: 280, serving: "1개" },
  { name: "팬케이크", kcal: 350, serving: "2장" },
  { name: "라면", kcal: 500, serving: "1개" },
  { name: "우동", kcal: 420, serving: "1그릇" },
  { name: "칼국수", kcal: 480, serving: "1그릇" },
  { name: "수제비", kcal: 450, serving: "1그릇" },
  { name: "잔치국수", kcal: 400, serving: "1그릇" },
  { name: "물냉면", kcal: 480, serving: "1그릇", aliases: ["냉면"] },
  { name: "비빔냉면", kcal: 560, serving: "1그릇" },
  { name: "짜장면", kcal: 780, serving: "1그릇" },
  { name: "짬뽕", kcal: 700, serving: "1그릇" },
  { name: "파스타", kcal: 650, serving: "1접시" },
  { name: "쌀국수", kcal: 400, serving: "1그릇" },
  { name: "초밥", kcal: 360, serving: "8피스" },
  { name: "떡볶이", kcal: 450, serving: "1인분" },
  { name: "순대", kcal: 360, serving: "1인분" },
  { name: "김밥 반 줄", kcal: 230, serving: "반 줄" },

  { name: "된장찌개", kcal: 140, serving: "1인분" },
  { name: "김치찌개", kcal: 200, serving: "1인분" },
  { name: "순두부찌개", kcal: 210, serving: "1인분" },
  { name: "미역국", kcal: 70, serving: "1그릇" },
  { name: "콩나물국", kcal: 40, serving: "1그릇" },
  { name: "계란국", kcal: 80, serving: "1그릇" },
  { name: "갈비탕", kcal: 550, serving: "1그릇" },
  { name: "설렁탕", kcal: 500, serving: "1그릇" },
  { name: "삼계탕", kcal: 900, serving: "1그릇" },
  { name: "닭볶음탕", kcal: 430, serving: "1인분" },

  { name: "계란", kcal: 75, serving: "1개", aliases: ["달걀"] },
  { name: "삶은계란", kcal: 80, serving: "1개" },
  { name: "계란후라이", kcal: 110, serving: "1개" },
  { name: "계란말이", kcal: 180, serving: "1인분" },
  { name: "달걀찜", kcal: 150, serving: "1인분" },
  { name: "닭가슴살", kcal: 110, serving: "100g", aliases: ["닭가슴"] },
  { name: "닭다리", kcal: 200, serving: "1개" },
  { name: "삼겹살", kcal: 600, serving: "200g" },
  { name: "목살", kcal: 480, serving: "200g" },
  { name: "불고기", kcal: 450, serving: "1인분" },
  { name: "제육볶음", kcal: 540, serving: "1인분" },
  { name: "보쌈", kcal: 580, serving: "1인분" },
  { name: "족발", kcal: 600, serving: "1인분" },
  { name: "곱창", kcal: 480, serving: "1인분" },
  { name: "고등어구이", kcal: 280, serving: "1토막" },
  { name: "조기구이", kcal: 200, serving: "1마리" },
  { name: "연어구이", kcal: 280, serving: "1토막" },
  { name: "회", kcal: 180, serving: "1인분" },
  { name: "참치캔", kcal: 150, serving: "1캔" },
  { name: "두부", kcal: 120, serving: "1/2모" },
  { name: "두부조림", kcal: 180, serving: "1접시" },
  { name: "순두부", kcal: 90, serving: "1인분" },
  { name: "치킨", kcal: 270, serving: "1조각" },
  { name: "닭강정", kcal: 500, serving: "1인분" },
  { name: "치킨샐러드", kcal: 280, serving: "1접시" },
  { name: "돈까스", kcal: 650, serving: "1인분" },
  { name: "생선까스", kcal: 550, serving: "1인분" },
  { name: "함박스테이크", kcal: 450, serving: "1인분" },
  { name: "햄버거", kcal: 520, serving: "1개" },
  { name: "피자", kcal: 300, serving: "1조각" },
  { name: "만두", kcal: 220, serving: "4개" },
  { name: "군만두", kcal: 300, serving: "4개" },
  { name: "튀김", kcal: 350, serving: "1인분" },
  { name: "김치전", kcal: 250, serving: "1장" },
  { name: "파전", kcal: 360, serving: "1장" },
  { name: "단백질쉐이크", kcal: 140, serving: "1잔", aliases: ["프로틴", "쉐이크"] },

  { name: "배추김치", kcal: 25, serving: "1접시", aliases: ["김치"] },
  { name: "깍두기", kcal: 30, serving: "1접시" },
  { name: "시금치나물", kcal: 50, serving: "1접시", aliases: ["나물"] },
  { name: "콩나물무침", kcal: 40, serving: "1접시" },
  { name: "샐러드", kcal: 70, serving: "1접시" },
  { name: "샐러드(드레싱)", kcal: 170, serving: "1접시" },
  { name: "포케", kcal: 450, serving: "1그릇" },
  { name: "채소볶음", kcal: 110, serving: "1접시" },
  { name: "감자조림", kcal: 150, serving: "1접시" },
  { name: "멸치볶음", kcal: 80, serving: "1접시" },
  { name: "구운김", kcal: 30, serving: "1봉", aliases: ["김"] },
  { name: "잡채", kcal: 250, serving: "1접시" },
  { name: "콩자반", kcal: 120, serving: "1접시" },

  { name: "고구마", kcal: 140, serving: "1개" },
  { name: "군고구마", kcal: 160, serving: "1개" },
  { name: "감자", kcal: 130, serving: "1개" },
  { name: "옥수수", kcal: 120, serving: "1개" },
  { name: "사과", kcal: 100, serving: "1개" },
  { name: "바나나", kcal: 90, serving: "1개" },
  { name: "귤", kcal: 40, serving: "1개" },
  { name: "딸기", kcal: 40, serving: "10알" },
  { name: "포도", kcal: 70, serving: "1컵" },
  { name: "수박", kcal: 50, serving: "1쪽" },
  { name: "토마토", kcal: 30, serving: "1개" },
  { name: "블루베리", kcal: 85, serving: "1컵" },
  { name: "견과류", kcal: 180, serving: "한 줌", aliases: ["견과", "아몬드"] },

  { name: "우유", kcal: 130, serving: "1컵" },
  { name: "저지방우유", kcal: 90, serving: "1컵" },
  { name: "두유", kcal: 140, serving: "1컵" },
  { name: "그릭요거트", kcal: 100, serving: "1개" },
  { name: "요거트", kcal: 120, serving: "1개" },
  { name: "아메리카노", kcal: 10, serving: "1잔", aliases: ["커피", "아메"] },
  { name: "카페라떼", kcal: 180, serving: "1잔", aliases: ["라떼"] },
  { name: "카푸치노", kcal: 120, serving: "1잔" },
  { name: "콜라", kcal: 140, serving: "1캔" },
  { name: "사이다", kcal: 130, serving: "1캔" },
  { name: "오렌지주스", kcal: 100, serving: "1컵", aliases: ["주스"] },
  { name: "이온음료", kcal: 120, serving: "500ml" },
  { name: "맥주", kcal: 200, serving: "500ml" },
  { name: "소주", kcal: 420, serving: "1병" },
  { name: "막걸리", kcal: 350, serving: "1병" },
  { name: "와인", kcal: 125, serving: "1잔" },

  { name: "도넛", kcal: 250, serving: "1개" },
  { name: "아이스크림", kcal: 180, serving: "1개" },
  { name: "초콜릿", kcal: 80, serving: "1개" },
  { name: "초콜릿바", kcal: 250, serving: "1개" },
  { name: "감자칩", kcal: 320, serving: "소봉", aliases: ["과자"] },
]

function normalizeFoodQuery(value: string) {
  return value.toLowerCase().replace(/[\s·.,()]/g, "")
}

function namesOf(food: FoodCalorie) {
  return [food.name, ...(food.aliases ?? [])]
}

export function findExactFood(query: string): FoodCalorie | undefined {
  const q = normalizeFoodQuery(query)
  if (!q) return undefined
  return FOODS.find((food) => namesOf(food).some((name) => normalizeFoodQuery(name) === q))
}

export function searchFoods(query: string, limit = 8): FoodCalorie[] {
  const q = normalizeFoodQuery(query)
  if (!q) return []
  const ranked = FOODS.flatMap((food) => {
    const names = namesOf(food).map(normalizeFoodQuery)
    let score = 3
    if (names.some((name) => name === q)) score = 0
    else if (names.some((name) => name.startsWith(q))) score = 1
    else if (names.some((name) => name.includes(q))) score = 2
    else return []
    return [{ food, score }]
  })
  ranked.sort((a, b) => a.score - b.score || a.food.name.length - b.food.name.length)
  return ranked.slice(0, limit).map((row) => row.food)
}
