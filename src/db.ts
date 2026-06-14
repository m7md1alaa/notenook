export interface SavedSession {
  pdfData: Uint8Array
  pdfName: string
}

function normalizeSession(raw: unknown): SavedSession | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (!obj.pdfName || typeof obj.pdfName !== 'string') return null
  if (!obj.pdfData) return null

  let data: Uint8Array
  if (obj.pdfData instanceof Uint8Array) {
    data = obj.pdfData
  } else if (obj.pdfData instanceof ArrayBuffer) {
    data = new Uint8Array(obj.pdfData)
  } else {
    console.warn('[db] unexpected pdfData type:', typeof obj.pdfData)
    return null
  }

  return { pdfData: data, pdfName: obj.pdfName }
}

const DB_NAME = 'notenook-session'
const STORE_NAME = 'main'
const KEY = 'session'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveSession(session: SavedSession): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(session, KEY)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function loadSession(): Promise<SavedSession | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(KEY)
    request.onsuccess = () => {
      db.close()
      resolve(normalizeSession(request.result))
    }
    request.onerror = () => { db.close(); reject(request.error) }
  })
}

export async function clearSession(): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(KEY)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
