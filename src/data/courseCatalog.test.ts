import { expect, it } from 'vitest'
import { findCourseLesson, loadCourseLesson, resolveCourseAsset } from './courseCatalog'
import { getPublicCourse } from './publicCourse'

it('publishes only reviewed lessons and retains their open reference answers', async () => {
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M01', `L${number}`)?.published).toBe(true)
  }
  expect((await loadCourseLesson('M01', 'L01'))?.exercises[0]).toContain(
    '### 参考答案',
  )
  expect((await loadCourseLesson('M01', 'L05'))?.content).toContain('## 参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M02', `L${number}`)?.published).toBe(true)
  }
  expect((await loadCourseLesson('M02', 'L01'))?.exercises[0]).toContain('## 参考答案')
  expect((await loadCourseLesson('M02', 'L05'))?.content).toContain('## 公开参考实现')
  expect((await loadCourseLesson('M02', 'L06'))?.content).toContain('## 参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M03', `L${number}`)?.published).toBe(true)
  }
  expect((await loadCourseLesson('M03', 'L01'))?.exercises[0]).toContain('## 参考答案')
  expect((await loadCourseLesson('M03', 'L05'))?.content).toContain('## 公开参考实现')
  expect((await loadCourseLesson('M03', 'L06'))?.content).toContain('## 参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M04', `L${number}`)?.published).toBe(true)
  }
  expect((await loadCourseLesson('M04', 'L01'))?.exercises[0]).toContain('## 参考答案')
  expect((await loadCourseLesson('M04', 'L05'))?.content).toContain('## 参考实现')
  expect((await loadCourseLesson('M04', 'L06'))?.content).toContain('## 参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M05', `L${number}`)?.published).toBe(true)
  }
  expect((await loadCourseLesson('M05', 'L01'))?.exercises[0]).toContain('## 参考答案')
  expect((await loadCourseLesson('M05', 'L05'))?.content).toContain('## 参考实现')
  expect((await loadCourseLesson('M05', 'L06'))?.content).toContain('## 参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M06', `L${number}`)?.published).toBe(true)
  }
  expect((await loadCourseLesson('M06', 'L01'))?.exercises[0]).toContain('## 参考答案')
  expect((await loadCourseLesson('M06', 'L05'))?.content).toContain('## 参考实现')
  expect((await loadCourseLesson('M06', 'L06'))?.content).toContain('## 参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M07', `L${number}`)?.published).toBe(true)
  }
  expect((await loadCourseLesson('M07', 'L01'))?.exercises[0]).toContain('## 参考答案')
  expect((await loadCourseLesson('M07', 'L05'))?.content).toContain('## 参考实现')
  expect((await loadCourseLesson('M07', 'L06'))?.content).toContain('## 参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M08', `L${number}`)?.published).toBe(true)
  }
  for (const number of ['01', '02', '03', '04']) {
    expect((await loadCourseLesson('M08', `L${number}`))?.exercises[0]).toContain(
      '## 参考答案',
    )
  }
  expect((await loadCourseLesson('M08', 'L05'))?.content).toContain('## 参考实现')
  expect((await loadCourseLesson('M08', 'L06'))?.content).toContain('## 参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M09', `L${number}`)?.published).toBe(true)
  }
  for (const number of ['01', '02', '03', '04']) {
    expect((await loadCourseLesson('M09', `L${number}`))?.exercises[0]).toContain(
      '## 参考答案',
    )
  }
  expect((await loadCourseLesson('M09', 'L05'))?.content).toContain('## 参考实现')
  expect((await loadCourseLesson('M09', 'L06'))?.content).toContain('## 参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M10', `L${number}`)?.published).toBe(true)
  }
  for (const number of ['01', '02', '03', '04']) {
    expect((await loadCourseLesson('M10', `L${number}`))?.exercises[0]).toContain(
      '## 参考答案',
    )
  }
  expect((await loadCourseLesson('M10', 'L05'))?.content).toContain('完整参考实现')
  expect((await loadCourseLesson('M10', 'L06'))?.content).toContain('完整参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M11', `L${number}`)?.published).toBe(true)
  }
  for (const number of ['01', '02', '03', '04']) {
    expect((await loadCourseLesson('M11', `L${number}`))?.exercises[0]).toContain(
      '## 参考答案',
    )
  }
  expect((await loadCourseLesson('M11', 'L05'))?.content).toContain('公开参考实现')
  expect((await loadCourseLesson('M11', 'L06'))?.content).toContain('完整参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M12', `L${number}`)?.published).toBe(true)
  }
  for (const number of ['01', '02', '03', '04']) {
    expect((await loadCourseLesson('M12', `L${number}`))?.exercises[0]).toContain('## 参考答案')
  }
  expect((await loadCourseLesson('M12', 'L05'))?.content).toContain('公开参考实现')
  expect((await loadCourseLesson('M12', 'L06'))?.content).toContain('公开参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M13', `L${number}`)?.published).toBe(true)
  }
  for (const number of ['01', '02', '03', '04']) {
    expect((await loadCourseLesson('M13', `L${number}`))?.exercises[0]).toContain('## 参考答案')
  }
  expect((await loadCourseLesson('M13', 'L05'))?.content).toContain('完整参考实现')
  expect((await loadCourseLesson('M13', 'L06'))?.content).toContain('公开参考答案')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M14', `L${number}`)?.published).toBe(true)
  }
  for (const number of ['01', '02', '03', '04']) {
    expect((await loadCourseLesson('M14', `L${number}`))?.exercises[0]).toContain('## 参考答案')
  }
  expect((await loadCourseLesson('M14', 'L05'))?.content).toContain('完整参考项目')
  expect((await loadCourseLesson('M14', 'L06'))?.content).toContain('公开参考答案')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M15', `L${number}`)?.published).toBe(true)
  }
  for (const number of ['01', '02', '03', '04']) {
    expect((await loadCourseLesson('M15', `L${number}`))?.exercises[0]).toContain('## 参考答案')
  }
  expect((await loadCourseLesson('M15', 'L05'))?.content).toContain('公开参考项目')
  expect((await loadCourseLesson('M15', 'L06'))?.exercises.join('\n')).toContain(
    '公开参考答案',
  )
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M16', `L${number}`)?.published).toBe(true)
  }
  for (const number of ['01', '02', '03', '04']) {
    expect((await loadCourseLesson('M16', `L${number}`))?.exercises[0]).toContain('公开练习与参考答案')
  }
  expect((await loadCourseLesson('M16', 'L05'))?.content).toContain('公开参考实现')
  const m16SelfCheck = await loadCourseLesson('M16', 'L06')
  expect(m16SelfCheck?.content).toContain('公开参考答案')
  expect(m16SelfCheck?.content).toContain('所有测试输入与参考实现均公开')
  expect(m16SelfCheck?.content).not.toMatch(/隐藏测试|私有评分|正式技能评价/)
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M17', `L${number}`)?.published).toBe(true)
    expect((await loadCourseLesson('M17', `L${number}`))?.exercises[0]).toContain(
      '公开练习与参考答案',
    )
  }
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M18', `L${number}`)?.published).toBe(true)
    expect((await loadCourseLesson('M18', `L${number}`))?.exercises[0]).toContain(
      '公开练习与参考答案',
    )
  }
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M19', `L${number}`)?.published).toBe(true)
    expect((await loadCourseLesson('M19', `L${number}`))?.exercises[0]).toContain(
      '公开练习与参考答案',
    )
  }
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M20', `L${number}`)?.published).toBe(true)
    expect((await loadCourseLesson('M20', `L${number}`))?.exercises[0]).toContain(
      '公开练习与参考答案',
    )
  }
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M21', `L${number}`)?.published).toBe(true)
    expect((await loadCourseLesson('M21', `L${number}`))?.exercises[0]).toContain(
      '公开练习与参考答案',
    )
  }
  const observabilityCheck = await loadCourseLesson('M21', 'L06')
  expect(observabilityCheck?.exercises[0]).toContain('98/100=980,000 ppm')
  expect(observabilityCheck?.exercises[0]).not.toContain('930,000 ppm')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M22', `L${number}`)?.published).toBe(true)
    expect((await loadCourseLesson('M22', `L${number}`))?.exercises[0]).toContain(
      '公开练习与参考答案',
    )
  }
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M23', `L${number}`)?.published).toBe(true)
    expect((await loadCourseLesson('M23', `L${number}`))?.exercises[0]).toContain(
      '公开练习与参考答案',
    )
  }
  expect(JSON.stringify(getPublicCourse())).not.toContain('private_assessment_id')
  for (const archive of [
    'm01-l03-samples.zip',
    'm01-l04-sample.zip',
    'm01-l05-starter.zip',
    'm01-l06-reference.zip',
    'm02-l05-starter.zip',
    'm03-l05-starter.zip',
    'm04-l05-starter.zip',
    'm05-l05-starter.zip',
    'm06-l05-starter.zip',
    'm07-l05-starter.zip',
    'm08-l05-starter.zip',
    'm08-l06-check-starter.zip',
    'm09-l05-config-parser-starter.zip',
    'm09-l06-error-presentation-starter.zip',
    'm10-l01-workspace-sample.zip',
    'm10-l02-test-layers-sample.zip',
    'm10-l03-cli-inputs-sample.zip',
    'm10-l04-features-lock-docs-sample.zip',
    'm10-l05-p1-starter.zip',
    'm10-l05-p1-reference.zip',
    'm10-l06-input-format-starter.zip',
    'm10-l06-input-format-reference.zip',
    'm11-l01-recursive-expressions.zip',
    'm11-l02-shared-ownership.zip',
    'm11-l03-refcell-log.zip',
    'm11-l04-weak-tree.zip',
    'm11-l05-cache-ownership-starter.zip',
    'm11-l05-cache-ownership-reference.zip',
    'm11-l06-smart-pointer-selection-check-starter.zip',
    'm11-l06-smart-pointer-selection-reference.zip',
    'm12-l01-thread-outcomes.zip',
    'm12-l02-sync-boundaries.zip',
    'm12-l03-lock-scope.zip',
    'm12-l04-bounded-channel.zip',
    'm12-l05-parallel-log-starter.zip',
    'm12-l05-parallel-log-reference.zip',
    'm12-l06-lock-competition-starter.zip',
    'm12-l06-lock-competition-reference.zip',
    'm13-l01-sample.zip',
    'm13-l02-sample.zip',
    'm13-l03-sample.zip',
    'm13-l04-sample.zip',
    'm13-l05-blocking-starter.zip',
    'm13-l05-blocking-reference.zip',
    'm14-l01-sample.zip',
    'm14-l01-reference.zip',
    'm14-l02-sample.zip',
    'm14-l02-reference.zip',
    'm14-l03-sample.zip',
    'm14-l04-sample.zip',
    'm14-l04-reference.zip',
    'm14-l05-pipeline-starter.zip',
    'm14-l05-pipeline-reference.zip',
    'm15-l01-sample.zip',
    'm15-l01-reference.zip',
    'm15-l02-sample.zip',
    'm15-l02-reference.zip',
    'm15-l03-sample.zip',
    'm15-l03-reference.zip',
    'm15-l04-sample.zip',
    'm15-l04-reference.zip',
    'm15-l05-executor-starter.zip',
    'm15-l05-executor-reference.zip',
    'm15-l06-fault-starter.zip',
    'm15-l06-fault-reference.zip',
    'm16-l01-starter.zip',
    'm16-l01-reference.zip',
    'm16-l02-starter.zip',
    'm16-l02-reference.zip',
    'm16-l03-starter.zip',
    'm16-l03-reference.zip',
    'm16-l04-starter.zip',
    'm16-l04-reference.zip',
    'm16-l05-task-api-starter.zip',
    'm16-l05-reference.zip',
    'm16-l06-label-api-starter.zip',
    'm16-l06-reference.zip',
    'm17-l01-starter.zip',
    'm17-l01-reference.zip',
    'm17-l02-starter.zip',
    'm17-l02-reference.zip',
    'm17-l03-starter.zip',
    'm17-l03-reference.zip',
    'm17-l04-starter.zip',
    'm17-l04-reference.zip',
    'm17-l05-error-context-starter.zip',
    'm17-l05-reference.zip',
    'm17-l06-layer-check-starter.zip',
    'm17-l06-reference.zip',
    'm18-l01-starter.zip',
    'm18-l01-reference.zip',
    'm18-l02-starter.zip',
    'm18-l02-reference.zip',
    'm18-l03-starter.zip',
    'm18-l03-reference.zip',
    'm18-l04-starter.zip',
    'm18-l04-reference.zip',
    'm18-l05-persistent-task-api-starter.zip',
    'm18-l05-reference.zip',
    'm18-l06-concurrency-check-starter.zip',
    'm18-l06-reference.zip',
    'm19-l01-auth-starter.zip',
    'm19-l01-reference.zip',
    'm19-l02-session-starter.zip',
    'm19-l02-reference.zip',
    'm19-l03-resource-roles-starter.zip',
    'm19-l03-reference.zip',
    'm19-l04-security-boundaries-starter.zip',
    'm19-l04-reference.zip',
    'm19-l05-cross-user-tasks-starter.zip',
    'm19-l05-reference.zip',
    'm19-l06-authorization-check-starter.zip',
    'm19-l06-reference.zip',
    'm20-l02-retry-starter.zip',
    'm20-l02-retry-reference.zip',
    'm20-l03-sse-lifecycle-starter.zip',
    'm20-l03-sse-lifecycle-reference.zip',
    'm20-l04-task-recovery-starter.zip',
    'm20-l04-task-recovery-reference.zip',
    'm20-l05-task-event-reconnect-starter.zip',
    'm20-l05-task-event-reconnect-reference.zip',
    'm20-l06-check-starter.zip',
    'm20-l06-check-reference.zip',
    'm21-l01-structured-logging-starter.zip',
    'm21-l01-reference.zip',
    'm21-l02-metrics-starter.zip',
    'm21-l02-reference.zip',
    'm21-l03-diagnostic-starter.zip',
    'm21-l03-reference.zip',
    'm21-l04-reproduction-starter.zip',
    'm21-l04-reference.zip',
    'm21-l05-fault-lab-starter.zip',
    'm21-l06-check-starter.zip',
    'm22-l01-release-starter.zip',
    'm22-l01-reference.zip',
    'm22-l02-config-starter.zip',
    'm22-l02-reference.zip',
    'm22-l03-health-starter.zip',
    'm22-l03-reference.zip',
    'm22-l04-migration-plan-starter.zip',
    'm22-l04-reference.zip',
    'm22-l05-deploy-lab-starter.zip',
    'm22-l06-schema-compat-starter.zip',
    'm23-l01-sample-summary-starter.zip',
    'm23-l01-reference.zip',
    'm23-l02-allocation-starter.zip',
    'm23-l02-reference.zip',
    'm23-l03-load-starter.zip',
    'm23-l03-reference.zip',
    'm23-l04-recovery-starter.zip',
    'm23-l04-reference.zip',
    'm23-l05-bottleneck-lab.zip',
    'm23-l05-reference.zip',
    'm23-l06-performance-check-starter.zip',
    'm24-l01-acceptance-starter.zip',
    'm24-l02-api-runbook-starter.zip',
    'm24-l03-review-starter.zip',
    'm24-l04-incident-starter.zip',
    'm24-l05-p4-delivery-starter.zip',
    'm24-l06-capstone-starter.zip',
  ]) {
    expect(resolveCourseAsset(`./${archive}`)).toBeTruthy()
  }

  expect((await loadCourseLesson('M24', 'L06'))?.content).toContain(
    '以文档和工程决策为主的本地结课项目',
  )
  expect((await loadCourseLesson('M24', 'L06'))?.content).toContain(
    '不需要在线评测、账号、提交、技能证书、隐藏分数或 Rust 工具链',
  )

  const observability = await loadCourseLesson('M21', 'L02')
  expect(observability?.content).toContain('后台 worker')
  expect(observability?.content).not.toMatch(/runner|learner|evaluator/i)
  const observabilityCapstone = await loadCourseLesson('M21', 'L06')
  expect(observabilityCapstone?.content).toContain('98/100=980,000 ppm')
  expect(observabilityCapstone?.exercises.join('\n')).toContain(
    '预期业务失败终态',
  )
  expect(observabilityCapstone?.content).not.toMatch(
    /evaluator|skill_evidence|platform_unavailable/i,
  )
  expect((await loadCourseLesson('M23', 'L02'))?.exercises.join('\n')).not.toMatch(
    /R2\/R3/i,
  )
})

it('keeps canonical lesson bodies separate from distinct practice documents', async () => {
  const practiceDocuments = [
    ['M12', 'L01', '# M12-L01 短练习：线程、move 捕获与 join 结果'],
    ['M12', 'L02', '# M12-L02 短练习：Send/Sync 与共享模型'],
    ['M12', 'L03', '# M12-L03 短练习：读写锁与 guard 范围'],
    ['M12', 'L04', '# M12-L04 短练习：消息通道、锁顺序和背压'],
    ['M15', 'L06', '# M15-L06 公开自查清单'],
    ['M19', 'L06', '# M19-L06 公开自查指南'],
    ...Array.from({ length: 6 }, (_, index) => {
      const lessonId = `L${String(index + 1).padStart(2, '0')}`
      return ['M20', lessonId, `# M20-${lessonId} 公开自查清单`]
    }),
  ]

  for (const [moduleId, lessonId, practiceHeading] of practiceDocuments) {
    const lesson = await loadCourseLesson(moduleId, lessonId)

    expect(lesson?.content.split(/\r?\n/, 1)[0]).toMatch(
      new RegExp(`^# ${moduleId}-${lessonId}[：:]`),
    )
    expect(lesson?.content).not.toContain(practiceHeading)
    expect(lesson?.exercises.join('\n')).toContain(practiceHeading)
  }
})
