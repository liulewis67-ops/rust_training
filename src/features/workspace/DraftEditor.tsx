import { useEffect, useRef, useState, type JSX } from 'react'
import {
  draftKey,
  indexedDbDraftStore,
  templateVersion,
  type DraftRecord,
  type DraftStore,
} from './drafts'
import {
  CloudDraftError,
  CloudDraftConflictError,
  initializeCloudDraft,
  readCloudSession,
  resolveCloudDraft,
  saveCloudDraft,
  type CloudDraft,
  type CloudSession,
} from './cloudDrafts'
import './DraftEditor.css'

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
  const keyRef = useRef(key)
  const version = templateVersion(template)
  const [content, setContent] = useState(template)
  const [storageReady, setStorageReady] = useState(false)
  const [status, setStatus] = useState<
    'loading' | 'clean' | 'saving' | 'saved' | 'error'
  >('loading')
  const [recoveryAvailable, setRecoveryAvailable] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const pendingSave = useRef<number | undefined>(undefined)
  const [cloudWorkspace, setCloudWorkspace] = useState<CloudDraft>()
  const cloudWorkspaceRef = useRef<CloudDraft>()
  const [cloudConflict, setCloudConflict] = useState<{
    localContent: string
    remote: CloudDraft
  }>()
  const [cloudStatus, setCloudStatus] = useState<
    | 'checking'
    | 'signed-out'
    | 'ready'
    | 'dirty'
    | 'saving'
    | 'conflict'
    | 'error'
  >('checking')

  /** Keep the ref current so debounced actions use the latest acknowledged revision. */
  function setAcknowledgedCloudWorkspace(workspace?: CloudDraft): void {
    cloudWorkspaceRef.current = workspace
    setCloudWorkspace(workspace)
  }

  useEffect(() => {
    let current = true
    setContent(template)
    setStorageReady(false)
    setStatus('loading')
    setRecoveryAvailable(false)
    setCloudStatus('checking')
    setCloudConflict(undefined)
    setAcknowledgedCloudWorkspace(undefined)

    // Resolve the owner before reading IndexedDB so another account cannot see this local copy.
    void (async () => {
      let session: CloudSession | undefined
      try {
        session = await readCloudSession()
      } catch {
        // Keep offline edits in a separate namespace when the current owner is unknown.
        session = undefined
      }
      if (!current) return
      const ownerScope =
        session?.kind === 'signed-in'
          ? session.userId
          : session?.kind === 'signed-out'
            ? 'anonymous'
            : 'offline'
      const storageKey = draftKey(lessonId, itemId, template, ownerScope)
      keyRef.current = storageKey

      let localRecord: DraftRecord | null
      try {
        localRecord = await store.load(storageKey)
      } catch {
        if (!current) return
        setStorageReady(false)
        setStatus('error')
        setCloudStatus('error')
        return
      }
      if (!current) return
      setContent(localRecord?.content ?? template)
      setStorageReady(true)
      setStatus('loading')
      try {
        const recovery = await store.loadRecovery(storageKey)
        if (current) setRecoveryAvailable(Boolean(recovery))
      } catch {
        if (current) setStatus('error')
      }

      if (!session || session.kind === 'signed-out') {
        if (!session) {
          setCloudStatus('error')
        } else {
          setCloudStatus('signed-out')
        }
        setStatus(localRecord ? 'saved' : 'clean')
        return
      }

      try {
        const result = await initializeCloudDraft(
          {
            lesson_id: lessonId,
            item_id: itemId,
            template_version: version,
          },
          localRecord?.content ?? template,
          fetch,
          session.userId,
        )
        if (!current) return
        if (result.kind === 'signed-out') {
          setCloudStatus('signed-out')
          setStatus(localRecord ? 'saved' : 'clean')
          return
        }

        setAcknowledgedCloudWorkspace(result.workspace)
        if (localRecord && localRecord.content !== result.workspace.content) {
          setCloudConflict({
            localContent: localRecord.content,
            remote: result.workspace,
          })
          setCloudStatus('conflict')
          setStatus('saved')
          return
        }
        if (!localRecord) {
          await store.save({
            key: storageKey,
            lessonId,
            itemId,
            templateVersion: version,
            content: result.workspace.content,
            updatedAt: Date.now(),
          })
          if (!current) return
          setContent(result.workspace.content)
        }
        setCloudStatus('ready')
        setStatus(
          localRecord || result.workspace.content !== template
            ? 'saved'
            : 'clean',
        )
      } catch {
        if (!current) return
        setCloudStatus('error')
        setStatus(localRecord ? 'saved' : 'clean')
      }
    })()

    return () => {
      // Ignore IndexedDB results after the user opens a different example or leaves the page.
      current = false
    }
  }, [itemId, key, lessonId, store, template, version])

  useEffect(() => {
    if (!storageReady) return
    const storageKey = keyRef.current
    if (content === template) {
      if (status !== 'saving') return
      let current = true
      store
        .clear(storageKey)
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
        key: storageKey,
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
      key: keyRef.current,
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
    const workspace = cloudWorkspaceRef.current
    if (
      !storageReady ||
      (content === template && (!workspace || workspace.content === template))
    ) {
      return
    }
    setStatus('saving')
    try {
      const record = createRecord()
      if (content === template) await store.clear(keyRef.current)
      else await store.save(record)
      setStatus(content === template ? 'clean' : 'saved')
      await syncCloudContent(record.content)
    } catch {
      setStatus('error')
    }
  }

  /** Sync one locally saved draft and preserve both payloads if the revision is stale. */
  async function syncCloudContent(
    value: string,
    resolveConflict = false,
  ): Promise<boolean> {
    const workspace = cloudWorkspaceRef.current
    if (!workspace || cloudStatus === 'signed-out') return false
    if (workspace.content === value) {
      setCloudStatus('ready')
      setCloudConflict(undefined)
      return true
    }
    setCloudStatus('saving')
    try {
      const saved = resolveConflict
        ? await resolveCloudDraft(workspace, value)
        : await saveCloudDraft(workspace, value)
      setAcknowledgedCloudWorkspace(saved)
      setCloudConflict(undefined)
      setCloudStatus('ready')
      return true
    } catch (error) {
      if (error instanceof CloudDraftConflictError) {
        setAcknowledgedCloudWorkspace(error.latest)
        setCloudConflict({ localContent: value, remote: error.latest })
        setCloudStatus('conflict')
      } else if (error instanceof CloudDraftError && error.status === 401) {
        setCloudStatus('signed-out')
      } else {
        setCloudStatus('error')
      }
      return false
    }
  }

  /** Keep the current local copy after the server has stored it as a conflict. */
  async function keepLocalVersion(): Promise<void> {
    cancelPendingSave()
    setActionPending(true)
    setStatus('saving')
    try {
      const record = createRecord()
      if (content === template) await store.clear(keyRef.current)
      else await store.save(record)
      setStatus(content === template ? 'clean' : 'saved')
      await syncCloudContent(record.content, true)
    } catch {
      setStatus('error')
      setCloudStatus('error')
    } finally {
      setActionPending(false)
    }
  }

  /** Replace the local draft with the latest server copy after explicit user choice. */
  async function useCloudVersion(): Promise<void> {
    cancelPendingSave()
    if (!cloudConflict) return
    setActionPending(true)
    setStatus('saving')
    try {
      const record = {
        ...createRecord(cloudConflict.remote.content),
        updatedAt: Date.now(),
      }
      if (record.content === template) await store.clear(keyRef.current)
      else await store.save(record)
      setAcknowledgedCloudWorkspace(cloudConflict.remote)
      setCloudConflict(undefined)
      setCloudStatus('ready')
      setContent(cloudConflict.remote.content)
      setStatus('saved')
    } catch {
      setStatus('error')
      setCloudStatus('error')
    } finally {
      setActionPending(false)
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
      if (cloudWorkspaceRef.current) {
        setCloudStatus('dirty')
        setCloudConflict((conflict) =>
          conflict ? { ...conflict, localContent: template } : undefined,
        )
      }
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
      const record = await store.restore(keyRef.current)
      if (!record) {
        setRecoveryAvailable(false)
        setStatus('clean')
        return
      }
      setContent(record.content)
      setStatus('saved')
      if (cloudWorkspaceRef.current) {
        setCloudStatus('dirty')
        setCloudConflict((conflict) =>
          conflict ? { ...conflict, localContent: record.content } : undefined,
        )
      }
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
  const cloudStatusText = {
    checking: '正在检查云端工作区…',
    'signed-out': '仅保存在此设备；登录后可同步',
    ready: '云端已同步',
    dirty: '本机有未同步更改',
    saving: '正在同步云端…',
    conflict: '发现冲突；云端和本机版本均保留',
    error: '云端同步失败；本机草稿仍保留',
  }[cloudStatus]

  return (
    <section className="draft-editor" aria-label={`${label}本地代码草稿`}>
      <div className="draft-editor-heading">
        <div>
          <strong>本地练习草稿</strong>
          <small>本机保存；登录后可同步，草稿不会计入成绩</small>
        </div>
        <span role="status" aria-live="polite">
          {statusText}
        </span>
      </div>
      <p
        className={`draft-cloud-status draft-cloud-status-${cloudStatus}`}
        aria-live="polite"
      >
        {cloudStatusText}
      </p>
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
          const value = event.currentTarget.value
          setContent(value)
          setStatus(storageReady ? 'saving' : 'error')
          if (cloudWorkspaceRef.current) {
            setCloudStatus('dirty')
            setCloudConflict((conflict) =>
              conflict ? { ...conflict, localContent: value } : undefined,
            )
          }
        }}
      />
      <div className="draft-editor-actions">
        <button
          type="button"
          onClick={saveNow}
          disabled={
            !storageReady ||
            cloudStatus === 'saving' ||
            actionPending ||
            (content === template &&
              (!cloudWorkspace || cloudWorkspace.content === template))
          }
        >
          保存并同步
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
      {cloudConflict && (
        <section className="draft-cloud-conflict" aria-label="草稿冲突">
          <p>
            另一设备已保存不同版本。两个版本都已保留，请选择继续编辑哪一份。
          </p>
          <details>
            <summary>查看云端版本</summary>
            <pre>{cloudConflict.remote.content}</pre>
          </details>
          <details>
            <summary>查看本机版本</summary>
            <pre>{cloudConflict.localContent}</pre>
          </details>
          <div className="draft-editor-actions">
            <button
              type="button"
              onClick={useCloudVersion}
              disabled={actionPending}
            >
              使用云端版本
            </button>
            <button
              type="button"
              onClick={keepLocalVersion}
              disabled={actionPending}
            >
              保留本机版本
            </button>
          </div>
        </section>
      )}
    </section>
  )
}
