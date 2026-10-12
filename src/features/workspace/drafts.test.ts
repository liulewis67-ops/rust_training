// @vitest-environment node
import 'fake-indexeddb/auto'
import { beforeEach, expect, it } from 'vitest'
import { draftKey, indexedDbDraftStore, templateVersion } from './drafts'

/** Delete the in-memory database between cases to avoid cross-test draft state. */
function clearDraftDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('rust-path-workspaces')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error('Draft database is unexpectedly blocked'))
  })
}

beforeEach(async () => {
  await clearDraftDatabase()
})

// A saved draft can be read after reopening the store, reset to its template, and restored.
it('persists a draft and keeps an atomic recovery point across reset', async () => {
  const key = draftKey('ownership', 'example-1', 'let value = String::new();')
  const record = {
    key,
    lessonId: 'ownership',
    itemId: 'example-1',
    templateVersion: templateVersion('let value = String::new();'),
    content: 'let value = String::from("draft");',
    updatedAt: Date.now(),
  }

  await indexedDbDraftStore.save(record)
  expect(await indexedDbDraftStore.load(key)).toEqual(record)

  await indexedDbDraftStore.reset(record)
  expect(await indexedDbDraftStore.load(key)).toBeNull()
  expect(await indexedDbDraftStore.loadRecovery(key)).toMatchObject({
    content: record.content,
  })

  expect(await indexedDbDraftStore.restore(key)).toMatchObject({
    key,
    content: record.content,
  })
  expect(await indexedDbDraftStore.load(key)).toMatchObject({
    content: record.content,
  })
})

// Lesson IDs, editable item IDs, and template content all isolate storage keys.
it('does not load a draft for another lesson, item, or template version', async () => {
  const template = 'fn first() {}'
  const key = draftKey('ownership', 'example-1', template)
  const otherLesson = draftKey('borrowing', 'example-1', template)
  const otherItem = draftKey('ownership', 'example-2', template)
  const updatedTemplate = draftKey(
    'ownership',
    'example-1',
    'fn first() { todo!() }',
  )
  const ownerA = draftKey('ownership', 'example-1', template, 'learner-a')
  const otherOwner = draftKey('ownership', 'example-1', template, 'learner-b')
  const record = {
    key,
    lessonId: 'ownership',
    itemId: 'example-1',
    templateVersion: templateVersion(template),
    content: 'fn first() { println!("draft"); }',
    updatedAt: Date.now(),
  }

  await indexedDbDraftStore.save(record)
  await indexedDbDraftStore.save({ ...record, key: ownerA })

  expect(await indexedDbDraftStore.load(otherLesson)).toBeNull()
  expect(await indexedDbDraftStore.load(otherItem)).toBeNull()
  expect(await indexedDbDraftStore.load(updatedTemplate)).toBeNull()
  expect(await indexedDbDraftStore.load(otherOwner)).toBeNull()
  expect(await indexedDbDraftStore.load(ownerA)).toMatchObject({
    content: record.content,
  })
  expect(templateVersion(template)).not.toBe(
    templateVersion('fn first() { todo!() }'),
  )
})
