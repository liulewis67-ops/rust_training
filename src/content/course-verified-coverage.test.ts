import { describe, expect, it } from 'vitest'

const chinese = import.meta.glob<string>(
  '../../content/releases/m0?-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)
const english = import.meta.glob<string>(
  '../../content/releases/en/m0?-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)
const rust = import.meta.glob<string>(
  '../../content/samples/verified-lesson-drills/src/*.rs',
  { query: '?raw', import: 'default', eager: true },
)

// Every row corresponds to one published module; columns are L01 through L06.
// L05 and L06 deliberately have distinct test functions in one capstone module.
const sources = [
  [
  "m01_decision",
  "m01_toolchain",
  "m01_diagnostics",
  "m01",
  "m01_capstone",
  "m01_capstone"
  ],
  [
  "m02_bindings",
  "m02",
  "m02_control",
  "m02_shapes",
  "m02_capstone",
  "m02_capstone"
  ],
  [
  "m03_structs",
  "m03",
  "m03_missing",
  "m03_visibility",
  "m03_capstone",
  "m03_capstone"
  ],
  [
  "m04_scope",
  "m04_moves",
  "m04",
  "m04_partial",
  "m04_capstone",
  "m04_capstone"
  ],
  [
  "m05_borrows",
  "m05",
  "m05_utf8",
  "m05_api",
  "m05_capstone",
  "m05_capstone"
  ],
  [
  "m06_validity",
  "m06",
  "m06_views",
  "m06_static",
  "m06_capstone",
  "m06_capstone"
  ],
  [
  "m07_generics",
  "m07",
  "m07_dispatch",
  "m07_conversion",
  "m07_capstone",
  "m07_capstone"
  ],
  [
  "m08_collections",
  "m08_closures",
  "m08_iteration",
  "m08",
  "m08_capstone",
  "m08_capstone"
  ],
  [
  "m09_propagation",
  "m09",
  "m09_boundaries",
  "m09_recovery",
  "m09_capstone",
  "m09_capstone"
  ]
]

describe('all published Rust lessons have bilingual executable evidence', () => {
  it('covers exactly 54 lessons in each language', () => {
    expect(Object.keys(chinese)).toHaveLength(54)
    expect(Object.keys(english)).toHaveLength(54)
  })

  it('keeps all 54 lesson-to-source links valid in both languages', () => {
    for (let moduleIndex = 0; moduleIndex < 9; moduleIndex++) {
      const moduleId = String(moduleIndex + 1).padStart(2, '0')
      for (let lessonIndex = 0; lessonIndex < 6; lessonIndex++) {
        const lessonId = String(lessonIndex + 1).padStart(2, '0')
        const id = `m${moduleId}-l${lessonId}`
        const module = sources[moduleIndex][lessonIndex]
        const sourcePath =
          `../../content/samples/verified-lesson-drills/src/${module}.rs`
        const sourceLink = `verified-lesson-drills/src/${module}.rs`

        expect(rust[sourcePath], `Missing source for ${id}`).toBeDefined()
        for (const [language, lessons] of [
          ['zh', chinese],
          ['en', english],
        ] as const) {
          const filename =
            language === 'zh'
              ? `../../content/releases/${id}.md`
              : `../../content/releases/en/${id}.md`
          const text = lessons[filename]
          expect(text, `Missing ${language} lesson ${id}`).toBeDefined()
          expect(text, `Unlinked ${language} source for ${id}`).toContain(
            sourceLink,
          )
        }
      }
    }
  })

  it('separates L05 lab evidence from L06 independent delivery', () => {
    for (let moduleIndex = 0; moduleIndex < 9; moduleIndex++) {
      const id = String(moduleIndex + 1).padStart(2, '0')
      const lab = chinese[`../../content/releases/m${id}-l05.md`]
      const check = chinese[`../../content/releases/m${id}-l06.md`]
      const labEn = english[`../../content/releases/en/m${id}-l05.md`]
      const checkEn = english[`../../content/releases/en/m${id}-l06.md`]

      expect(lab).toContain('## 实证化实验验收')
      expect(check).toContain('## 独立交付与边界验收')
      expect(labEn).toContain('## Evidence-based lab acceptance')
      expect(checkEn).toContain('## Independent graduation acceptance')
      for (const text of [lab, labEn]) {
        expect(text).toContain(`m${id}_capstone::tests::l05_`)
      }
      for (const text of [check, checkEn]) {
        expect(text).toContain(`m${id}_capstone::tests::l06_`)
      }
    }
  })
})
