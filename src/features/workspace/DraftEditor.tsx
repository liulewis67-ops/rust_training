import { useEffect, useRef, useState, type JSX } from 'react'
import {
  draftKey,
  indexedDbDraftStore,
  templateVersion,
  type DraftRecord,
  type DraftStore,
} from './drafts'

/** Edit a course code example and persist its version-scoped draft in IndexedDB. */
export function DraftEditor({
  lessonId,
  itemId,
  template,
  label,
  store = indexedDbDraftStore,
}: {
  lessonId: string
  itemId: string
  template: string
  label: string
  store?: DraftStore
}): JSX.Element {
  const key = draftKey(lessonId, itemId, template)
  const version = templateVersion(template)
  const [content, setContent] = useState(template)
  const [storageReady, setStorageReady] = useState(false)
  const [status, setStatus] = useState<
    'loading' | 'clean' | 'saving' | 'saved' | 'error'
  >('loading')
  const [recoveryAvailable, setRecoveryAvailable] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const pendingSave = useRef<number | undefined>(undefined)

  useEffect(() => {
    let current = true
    setContent(template)
    setStorageReady(false)
    setStatus('loading')
    setRecoveryAvailable(false)

    // The content fingerprint changes the key so edits from an older starter cannot replace a new template.
    store
      .load(key)
      .then(async (record) => {
        if (!current) return
        setContent(record?.content ?? template)
        setStorageReady(true)
        setStatus(record ? 'saved' : 'clean')
        try {
          const recovery = await store.loadRecovery(key)
          if (current) setRecoveryAvailable(Boolean(recovery))
        } catch {
          if (current) setStatus('error')
        }
      })
      .catch(() => {
        if (!current) return
        setStorageReady(false)
        setStatus('error')
      })

    return () => {
      // Ignore IndexedDB results after the user opens a different example or leaves the page.
      current = false
    }
  }, [key, store, template])

  useEffect(() => {
    if (!storageReady) return
    if (content === template) {
      if (status !== 'saving') return
      let current = true
      store
        .clear(key)
        .then(() => {
          if (current) setStatus('clean')
        })
        .catch(() => {
          if (current) setStatus('error')
        })
      return () => {
        // Ignore a delete result if the learner edits again before it commits.
        current = false
      }
    }
    let current = true
    setStatus('saving')
    const timer = window.setTimeout(() => {
      const record: DraftRecord = {
        key,
        lessonId,
        itemId,
        templateVersion: version,
        content,
        updatedAt: Date.now(),
      }
      store
        .save(record)
        .then(() => {
          if (current) setStatus('saved')
        })
        .catch(() => {
          if (current) setStatus('error')
        })
    }, 350)
    pendingSave.current = timer

    return () => {
      // Cancel a stale debounce when text changes or an explicit reset starts.
      current = false
      window.clearTimeout(timer)
      if (pendingSave.current === timer) pendingSave.current = undefined
    }
  }, [
    content,
    itemId,
    key,
    lessonId,
    status,
    storageReady,
    store,
    template,
    version,
  ])

  /** Create a storage record containing only this editor's version-scoped draft. */
  function createRecord(value = content): DraftRecord {
    return {
      key,
      lessonId,
      itemId,
      templateVersion: version,
      content: value,
      updatedAt: Date.now(),
    }
  }

  /** Cancel a pending autosave before a save, reset, or restore transaction. */
  function cancelPendingSave(): void {
    if (pendingSave.current === undefined) return
    window.clearTimeout(pendingSave.current)
    pendingSave.current = undefined
  }

  /** Save immediately and show success only after IndexedDB confirms the transaction. */
  async function saveNow(): Promise<void> {
    cancelPendingSave()
    if (!storageReady || content === template) return
    setStatus('saving')
    try {
      await store.save(createRecord())
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  /** Preserve the latest editor value and atomically reset to the bundled example. */
  async function resetToTemplate(): Promise<void> {
    cancelPendingSave()
    if (content === template) return
    setActionPending(true)
    setStatus('saving')
    try {
      await store.reset(createRecord())
      setRecoveryAvailable(true)
      setContent(template)
      setStatus('clean')
    } catch {
      setStatus('error')
    } finally {
      setActionPending(false)
    }
  }

  /** Restore the saved recovery point without deleting the recovery copy. */
  async function restoreRecovery(): Promise<void> {
    cancelPendingSave()
    setActionPending(true)
    setStatus('saving')
    try {
      const record = await store.restore(key)
      if (!record) {
        setRecoveryAvailable(false)
        setStatus('clean')
        return
      }
      setContent(record.content)
      setStatus('saved')
    } catch {
      setStatus('error')
    } finally {
      setActionPending(false)
    }
  }

  const statusText = {
    loading: '正在读取本机草稿…',
    clean: '当前使用课程示例',
    saving: '正在保存到本机…',
    saved: '已保存到此设备',
    error: '本机存储不可用；请复制代码后再离开',
  }[status]

  return (
    <section className="draft-editor" aria-label={`${label}本地代码草稿`}>
      <div className="draft-editor-heading">
        <div>
          <strong>本地练习草稿</strong>
          <small>只保存在此设备，不会运行或计入成绩</small>
        </div>
        <span role="status" aria-live="polite">
          {statusText}
        </span>
      </div>
      <label className="sr-only" htmlFor={`draft-${key}`}>
        {label}代码草稿
      </label>
      <textarea
        id={`draft-${key}`}
        className="draft-editor-input"
        aria-label={`${label}代码草稿`}
        value={content}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        disabled={status === 'loading' || actionPending}
        rows={Math.min(20, Math.max(6, template.split('\n').length))}
        onChange={(event) => {
          // Mark each keystroke dirty; IndexedDB autosaves after typing pauses.
          setContent(event.currentTarget.value)
          setStatus(storageReady ? 'saving' : 'error')
        }}
      />
      <div className="draft-editor-actions">
        <button
          type="button"
          onClick={saveNow}
          disabled={!storageReady || content === template}
        >
          保存草稿
        </button>
        <button
          type="button"
          onClick={resetToTemplate}
          disabled={content === template}
        >
          重置为课程示例
        </button>
        {recoveryAvailable && (
          <button type="button" onClick={restoreRecovery}>
            恢复上次编辑
          </button>
        )}
      </div>
    </section>
  )
}
