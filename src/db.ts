export interface SavedPdf {
  id: string
  name: string
  data: Uint8Array
}

export interface SavedSession {
  pdfs: SavedPdf[]
  activePdfId: string | null
}

const DB_NAME = 'notenook-session'
const STORE_NAME = 'main'
const KEY = 'session'
const VERSION = 2

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function migrateLegacy(raw: unknown): SavedSession | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  // Check if this is the old single-PDF format { pdfData, pdfName }
  if (obj.pdfName && typeof obj.pdfName === 'string' && obj.pdfData) {
    let data: Uint8Array
    if (obj.pdfData instanceof Uint8Array) {
      data = obj.pdfData
    } else if (obj.pdfData instanceof ArrayBuffer) {
      data = new Uint8Array(obj.pdfData)
    } else {
      return null
    }
    const id = crypto.randomUUID()
    return {
      pdfs: [{ id, name: obj.pdfName as string, data }],
      activePdfId: id,
    }
  }

  // Already new format
  if (Array.isArray(obj.pdfs)) {
    const pdfs: SavedPdf[] = []
    for (const p of obj.pdfs) {
      if (p && typeof p === 'object' && 'name' in p && 'data' in p && 'id' in p) {
        let data: Uint8Array
        if (p.data instanceof Uint8Array) {
          data = p.data
        } else if (p.data instanceof ArrayBuffer) {
          data = new Uint8Array(p.data)
        } else {
          continue
        }
        pdfs.push({ id: p.id as string, name: p.name as string, data })
      }
    }
    return { pdfs, activePdfId: (obj.activePdfId as string) ?? pdfs[0]?.id ?? null }
  }

  return null
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
      resolve(migrateLegacy(request.result))
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
