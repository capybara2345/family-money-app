import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

type ServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

function loadServiceAccountFromFile(filePath: string): ServiceAccount {
  const absolutePath = join(/* turbopackIgnore: true */ process.cwd(), filePath)
  if (!existsSync(absolutePath)) {
    throw new Error(
      `Firebase 서비스 계정 파일을 찾을 수 없습니다: ${absolutePath}\n` +
        "Firebase Console → 프로젝트 설정 → 서비스 계정에서 비공개 키를 다운로드해 " +
        "프로젝트 루트에 firebase-service-account.json 으로 저장하세요."
    )
  }
  return JSON.parse(readFileSync(absolutePath, "utf8")) as ServiceAccount
}

function getServiceAccount(): ServiceAccount {
  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (filePath) {
    return loadServiceAccountFromFile(filePath)
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (serviceAccountJson) {
    return JSON.parse(serviceAccountJson) as ServiceAccount
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin 인증 정보가 없습니다. 다음 중 하나를 설정하세요:\n" +
        "- FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json (로컬 권장)\n" +
        "- FIREBASE_SERVICE_ACCOUNT_KEY (JSON 문자열, Vercel 권장)\n" +
        "- FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY"
    )
  }

  return { project_id: projectId, client_email: clientEmail, private_key: privateKey }
}

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]

  const serviceAccount = getServiceAccount()
  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
    projectId: serviceAccount.project_id,
  })
}

export function getAdminAuth() {
  return getAuth(getAdminApp())
}
