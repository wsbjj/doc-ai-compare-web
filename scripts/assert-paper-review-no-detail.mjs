import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../app/pages/records/paper-review.vue', import.meta.url), 'utf8')

const forbiddenSnippets = [
  '报告详情',
  '查看详情',
  '请选择一条记录查看完整质检报告',
  'openDetail',
  'getPaperTaskResult',
  'detailLoading',
  'selectedTask'
]

for (const snippet of forbiddenSnippets) {
  assert.equal(
    source.includes(snippet),
    false,
    `paper-review page should not render or fetch report detail UI: found "${snippet}"`
  )
}
