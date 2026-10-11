export type StorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

/** 读取轻量浏览器数据；隐私模式或浏览器策略拒绝时返回可展示的失败。 */
export function readStoredValue(key: string): StorageResult<string | null> {
  try {
    return { ok: true, value: window.localStorage.getItem(key) }
  } catch {
    return { ok: false, message: '本地存储不可用，本次进度仅在内存中保留' }
  }
}

/** 写入轻量偏好或原型进度；额度不足不向界面报告保存成功。 */
export function writeStoredValue(
  key: string,
  value: string,
): StorageResult<void> {
  try {
    window.localStorage.setItem(key, value)
    return { ok: true, value: undefined }
  } catch {
    return { ok: false, message: '本地保存失败，本次进度仅在内存中保留' }
  }
}
