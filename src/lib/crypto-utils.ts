const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function encodeBase64(text: string): string {
  return bytesToBase64(textEncoder.encode(text))
}

export function decodeBase64(base64: string): string {
  return textDecoder.decode(base64ToBytes(base64.trim()))
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function hashSha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(text))
  return bytesToHex(new Uint8Array(digest))
}

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

/** AES-GCM ciphertext format: base64(salt || iv || ciphertext) */
export async function encryptAes(plainText: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey(password, salt)
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(plainText)
  )
  const cipherBytes = new Uint8Array(cipherBuffer)
  const packed = new Uint8Array(salt.length + iv.length + cipherBytes.length)
  packed.set(salt, 0)
  packed.set(iv, salt.length)
  packed.set(cipherBytes, salt.length + iv.length)
  return bytesToBase64(packed)
}

export async function decryptAes(payload: string, password: string): Promise<string> {
  const packed = base64ToBytes(payload.trim())
  if (packed.length < 16 + 12 + 1) {
    throw new Error("암호문이 올바르지 않습니다.")
  }
  const salt = packed.slice(0, 16)
  const iv = packed.slice(16, 28)
  const data = packed.slice(28)
  const key = await deriveAesKey(password, salt)
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data)
  return textDecoder.decode(plainBuffer)
}
