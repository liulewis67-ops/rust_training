const DATABASE_NAME = 'rust-path-workspaces'
const DATABASE_VERSION = 1
const STORE_NAME = 'drafts'
const RECOVERY_SUFFIX = '::recovery'

export interface DraftRecord {
  key: string
  lessonId: string
  itemId: string
  templateVersion: string
  content: string
  updatedAt: number
}

export interface DraftStore {
  load(key: string): Promise<DraftRecord | null>
  loadRecovery(key: string): Promise<DraftRecord | null>
  save(record: DraftRecord): Promise<void>
  clear(key: string): Promise<void>
  reset(record: DraftRecord): Promise<void>
  restore(key: string): Promise<DraftRecord | null>
}

/** Create a stable content version so a changed template cannot load an older draft. */
export function templateVersion(template: string): string {
  let first = 2166136261
  let second = 2246822519
  for (let index = 0; index < template.length; index += 1) {
    const code = template.charCodeAt(index)
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second ^ code, 3266489917)
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0)
    .toString(16)
    .padStart(8, '0')}`
}

/** Scope a draft to this app, lesson, editable item, and exact starter template. */
export function draftKey(
  lessonId: string,
  itemId: string,
  template: string,
): string {
  const scope = [lessonId, itemId].map(encodeURIComponent).join(':')
  return `rust-path:v1:anonymous:${scope}:${templateVersion(template)}`
}

/** Open the versioned IndexedDB database and create its draft store on first use. */
function openDraftDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable in this browser'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    let settled = false
    request.onupgradeneeded = () => {
      // Keep one key-value store so current drafts and recovery points share transactions.
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => {
      const database = request.result
      if (settled) {
        database.close()
        return
      }
      settled = true
      // Close idle handles during upgrades from another tab.
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => {
      settled = true
      reject(request.error ?? new Error('Could not open local drafts'))
    }
    request.onblocked = () => {
      settled = true
      reject(new Error('Close another course tab to update local drafts'))
    }
  })
}

/** Validate records read from browser storage before exposing them to the editor. */
function isDraftRecord(
  value: unknown,
  expectedKey: string,
): value is DraftRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<DraftRecord>
  return (
    record.key === expectedKey &&
    typeof record.lessonId === 'string' &&
    typeof record.itemId === 'string' &&
    typeof record.templateVersion === 'string' &&
    typeof record.content === 'string' &&
    typeof record.updatedAt === 'number' &&
    Number.isFinite(record.updatedAt)
  )
}

/** Run one IndexedDB transaction and resolve only after its changes commit. */
function withDraftTransaction<Result>(
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore,
    setResult: (result: Result) => void,
  ) => void,
): Promise<Result> {
  return openDraftDatabase().then((database) => {
    return new Promise((resolve, reject) => {
      let result: Result | undefined
      let hasResult = false
      const transaction = database.transaction(STORE_NAME, mode)
      transaction.oncomplete = () => {
        database.close()
        if (!hasResult) {
          reject(new Error('Draft transaction completed without a result'))
          return
        }
        resolve(result as Result)
      }
      transaction.onerror = () => {
        database.close()
        reject(transaction.error ?? new Error('Could not save local draft'))
      }
      transaction.onabort = () => {
        database.close()
        reject(transaction.error ?? new Error('Local draft update was aborted'))
      }
      try {
        operation(transaction.objectStore(STORE_NAME), (value) => {
          result = value
          hasResult = true
        })
      } catch (error) {
        transaction.abort()
        database.close()
        reject(error)
      }
    })
  })
}

/** Read one current or recovery record and delete malformed data instead of returning it. */
function readDraftRecord(key: string): Promise<DraftRecord | null> {
  return withDraftTransaction('readwrite', (store, setResult) => {
    const request = store.get(key)
    request.onsuccess = () => {
      if (request.result === undefined) {
        setResult(null)
        return
      }
      if (!isDraftRecord(request.result, key)) {
        // Discard corrupt storage safely; the editor falls back to its bundled template.
        store.delete(key)
        setResult(null)
        return
      }
      setResult(request.result)
    }
  })
}

/** Store an edited draft and report success only after IndexedDB commits it. */
function saveDraft(record: DraftRecord): Promise<void> {
  return withDraftTransaction('readwrite', (store, setResult) => {
    store.put(record)
    setResult(undefined)
  })
}

/** Remove an active draft when the learner manually returns its text to the template. */
function clearDraft(key: string): Promise<void> {
  return withDraftTransaction('readwrite', (store, setResult) => {
    store.delete(key)
    setResult(undefined)
  })
}

/** Keep the current text as a recovery point, then reset its active draft atomically. */
function resetDraft(record: DraftRecord): Promise<void> {
  return withDraftTransaction('readwrite', (store, setResult) => {
    store.put({ ...record, key: `${record.key}${RECOVERY_SUFFIX}` })
    store.delete(record.key)
    setResult(undefined)
  })
}

/** Restore a saved recovery point as the active draft without consuming the recovery copy. */
function restoreDraft(key: string): Promise<DraftRecord | null> {
  const recoveryKey = `${key}${RECOVERY_SUFFIX}`
  return withDraftTransaction('readwrite', (store, setResult) => {
    const request = store.get(recoveryKey)
    request.onsuccess = () => {
      if (!isDraftRecord(request.result, recoveryKey)) {
        if (request.result !== undefined) store.delete(recoveryKey)
        setResult(null)
        return
      }
      const restored = { ...request.result, key, updatedAt: Date.now() }
      store.put(restored)
      setResult(restored)
    }
  })
}

export const indexedDbDraftStore: DraftStore = {
  /** Load the active draft for one versioned lesson item. */
  load: readDraftRecord,
  /** Load the preserved recovery copy for one versioned lesson item. */
  loadRecovery(key) {
    return readDraftRecord(`${key}${RECOVERY_SUFFIX}`)
  },
  /** Persist a draft after the active transaction commits. */
  save: saveDraft,
  /** Remove the active draft without creating a recovery point. */
  clear: clearDraft,
  /** Preserve the current text before deleting the active draft. */
  reset: resetDraft,
  /** Restore a previous draft while keeping its recovery point available. */
  restore: restoreDraft,
}
