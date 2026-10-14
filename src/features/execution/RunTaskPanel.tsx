import { useRef, useState, type JSX } from 'react'
import { createRunTask, readRunTask, type RunTask } from './api'
import type { CloudDraft } from '../workspace/cloudDrafts'

/** Submit one saved code revision and read its server-owned queued status. */
export function RunTaskPanel({
  workspace,
  enabled,
  saveCurrentDraft,
}: {
  workspace?: CloudDraft
  enabled: boolean
  saveCurrentDraft: () => Promise<CloudDraft | undefined>
}): JSX.Element {
  const [status, setStatus] = useState<
    | 'idle'
    | 'submitting'
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'error'
  >('idle')
  const [task, setTask] = useState<RunTask>()
  const [stdin, setStdin] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const retryKey = useRef<{ signature: string; key: string }>()

  /** Save the latest source, submit with a stable retry key, then confirm via GET. */
  async function submitRun(): Promise<void> {
    if (!workspace || !enabled || status === 'submitting') return
    setStatus('submitting')
    setErrorMessage('')
    try {
      const saved = await saveCurrentDraft()
      if (!saved) throw new Error('登录并同步工作区后才能提交运行任务。')
      const signature = `${saved.id}:${saved.revision}:run:${stdin}`
      const idempotencyKey =
        retryKey.current?.signature === signature
          ? retryKey.current.key
          : window.crypto.randomUUID()
      retryKey.current = { signature, key: idempotencyKey }
      const created = await createRunTask({
        workspace_id: saved.id,
        workspace_revision: saved.revision,
        idempotency_key: idempotencyKey,
        operation: 'run',
        stdin,
      })
      const current = await readRunTask(created.id)
      setTask(current)
      setStatus(current.status)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '提交运行任务失败。',
      )
      setStatus('error')
    }
  }

  return (
    <div className="run-task-panel">
      <button
        type="button"
        onClick={submitRun}
        disabled={!workspace || !enabled || status === 'submitting'}
      >
        {status === 'submitting' ? '正在提交…' : '提交运行'}
      </button>
      <label className="run-task-stdin">
        标准输入
        <textarea
          aria-label="运行标准输入"
          value={stdin}
          maxLength={65_536}
          disabled={!enabled || status === 'submitting'}
          onChange={(event) => setStdin(event.currentTarget.value)}
        />
      </label>
      <p role="status" aria-live="polite">
        {!workspace || !enabled
          ? '登录并同步代码后可提交运行任务。'
          : status === 'submitting'
            ? '正在保存代码并创建任务…'
            : status === 'queued'
              ? `任务 ${task?.id} 已进入队列，等待隔离运行节点。`
              : status === 'running'
                ? `任务 ${task?.id} 正在运行。`
                : status === 'succeeded'
                  ? `任务 ${task?.id} 已完成。`
                  : status === 'failed'
                    ? `任务 ${task?.id} 执行失败。`
                    : status === 'error'
                      ? errorMessage
                      : '提交后会冻结当前云端代码版本。'}
      </p>
      {task &&
      status !== 'idle' &&
      status !== 'submitting' &&
      status !== 'error' ? (
        <small>
          版本 r{task.workspace_revision} · {task.source_hash.slice(0, 12)}
        </small>
      ) : null}
    </div>
  )
}
