<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  getPaperReportPdfUrl,
  getPaperTaskHistory,
  getPaperTaskResult,
  type ImprovementItem,
  type PaperAgentStatus,
  type PaperQualityReport,
  type PaperTaskStatus,
  type PaperTaskVO,
  type SectionIssue
} from '~/services/paperApi'

definePageMeta({
  layout: 'default',
  ssr: false
})

const list = ref<PaperTaskVO[]>([])
const loading = ref(true)
const detailLoading = ref(false)
const reportActionLoading = ref('')
const error = ref('')
const selectedTask = ref<PaperTaskVO | null>(null)

const statusText: Record<PaperTaskStatus, string> = {
  PENDING: '待处理',
  PROCESSING: '质检中',
  COMPLETED: '已完成',
  FAILED: '失败'
}

const stageText: Record<string, string> = {
  UPLOADED: '已上传',
  OCR: '文本抽取',
  PLAGIARISM: '查重',
  LOGIC: '逻辑',
  COMPLIANCE: '规范',
  REVIEW: '汇总',
  COMPLETED: '完成',
  FAILED: '失败'
}

const agentLabels: Record<keyof PaperAgentStatus, string> = {
  plagiarism: '查重',
  logic: '逻辑',
  compliance: '规范',
  review: '汇总'
}

const report = computed<PaperQualityReport | null>(() => selectedTask.value?.report ?? null)

const agentStatusEntries = computed(() => {
  const agentStatus = selectedTask.value?.agentStatus
  if (!agentStatus) return []
  const order: (keyof PaperAgentStatus)[] = ['plagiarism', 'logic', 'compliance', 'review']
  return order
    .filter(key => agentStatus[key])
    .map(key => ({ key, label: agentLabels[key], value: agentStatus[key] as string }))
})

const formatTime = (dateString?: string): string => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const scoreText = (task: PaperTaskVO): string => {
  const value = task.report?.overallScore
  return value == null || Number.isNaN(Number(value)) ? '-' : Number(value).toFixed(1)
}

const stageLabel = (stage?: string): string => stage ? (stageText[stage] ?? stage) : '-'

const statusLabel = (status?: PaperTaskStatus): string => status ? (statusText[status] ?? status) : '-'

const statusClass = (status?: PaperTaskStatus): string => {
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  if (status === 'FAILED') return 'bg-red-50 text-red-700 ring-1 ring-red-200'
  if (status === 'PROCESSING') return 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
  return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
}

const agentStatusClass = (status?: string): string => {
  const value = (status || '').toUpperCase()
  if (value === 'DONE') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (value === 'RUNNING') return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  if (value === 'FAILED') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

const agentStatusText = (status?: string): string => {
  const map: Record<string, string> = {
    PENDING: '等待中',
    RUNNING: '进行中',
    DONE: '已完成',
    FAILED: '失败'
  }
  return map[(status || '').toUpperCase()] ?? (status || '-')
}

const severityClass = (severity?: string): string => {
  const value = (severity || '').toUpperCase()
  if (value === 'HIGH') return 'bg-red-50 text-red-700 border-red-200'
  if (value === 'MEDIUM') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

const dimensionText = (dimension?: string): string => {
  const map: Record<string, string> = {
    PLAGIARISM: '查重',
    LOGIC: '逻辑',
    COMPLIANCE: '规范'
  }
  return dimension ? (map[dimension] ?? dimension) : '-'
}

const suggestionProblem = (item: ImprovementItem): string => {
  return (item.problem || item.description || '未提供问题描述').trim()
}

const suggestionAction = (item: ImprovementItem): string => {
  return (item.suggestion || (!item.problem ? item.description : '') || '').trim()
}

const sectionProblem = (item: SectionIssue): string => {
  return (item.problem || '未提供问题描述').trim()
}

const canUseReportPdf = (task?: PaperTaskVO | null): boolean => {
  return task?.status === 'COMPLETED' && !!task.resultJson
}

const updateReportObjectKey = (taskId: string, objectKey: string) => {
  list.value = list.value.map(item =>
    item.taskId === taskId ? { ...item, reportPdfObject: objectKey } : item
  )
  if (selectedTask.value?.taskId === taskId) {
    selectedTask.value = { ...selectedTask.value, reportPdfObject: objectKey }
  }
}

const refreshHistory = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await getPaperTaskHistory(50)
    list.value = data
    if (selectedTask.value) {
      const latest = data.find(item => item.taskId === selectedTask.value?.taskId)
      selectedTask.value = latest ? { ...selectedTask.value, ...latest } : null
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '加载文档质检记录失败'
  } finally {
    loading.value = false
  }
}

const openDetail = async (row: PaperTaskVO) => {
  selectedTask.value = row
  detailLoading.value = true
  error.value = ''
  try {
    selectedTask.value = await getPaperTaskResult(row.taskId)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '加载质检报告失败'
  } finally {
    detailLoading.value = false
  }
}

const openReportPdf = async (task: PaperTaskVO, mode: 'view' | 'download') => {
  if (!canUseReportPdf(task)) return
  reportActionLoading.value = `${mode}:${task.taskId}`
  error.value = ''
  try {
    const data = await getPaperReportPdfUrl(task.taskId)
    updateReportObjectKey(task.taskId, data.objectKey)
    window.open(mode === 'view' ? data.viewUrl : data.downloadUrl, '_blank', 'noopener,noreferrer')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '获取质检报告 PDF 失败'
  } finally {
    reportActionLoading.value = ''
  }
}

onMounted(() => {
  refreshHistory()
})
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] bg-slate-50">
    <div class="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            文档质检记录
          </h1>
          <p class="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            查看当前账号提交过的文档质检任务，包含处理状态、评分概览和完整质检报告。
          </p>
        </div>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="refreshHistory"
        >
          刷新记录
        </button>
      </header>

      <div
        v-if="error"
        class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ error }}
      </div>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-500">
              历史列表
            </h2>
            <span class="text-xs text-slate-500">{{ list.length }} 条</span>
          </div>

          <div v-if="loading" class="flex items-center justify-center gap-3 px-6 py-16 text-slate-500">
            <span class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            <span class="text-sm font-medium">加载中...</span>
          </div>

          <div v-else-if="list.length === 0" class="px-6 py-16 text-center">
            <p class="text-sm text-slate-500">暂无文档质检记录。</p>
            <NuxtLink
              to="/agent"
              class="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              前往文档质检
            </NuxtLink>
          </div>

          <div v-else class="overflow-x-auto">
            <table class="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr class="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th scope="col" class="px-5 py-3.5">文件名</th>
                  <th scope="col" class="px-4 py-3.5 text-center">状态</th>
                  <th scope="col" class="px-4 py-3.5">阶段/进度</th>
                  <th scope="col" class="px-4 py-3.5 text-center">综合分</th>
                  <th scope="col" class="px-4 py-3.5">查重结论</th>
                  <th scope="col" class="px-4 py-3.5 text-center">报告</th>
                  <th scope="col" class="px-4 py-3.5 text-right">创建时间</th>
                  <th scope="col" class="px-5 py-3.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="row in list"
                  :key="row.taskId"
                  class="transition hover:bg-indigo-50/40"
                  :class="selectedTask?.taskId === row.taskId ? 'bg-indigo-50/70' : ''"
                >
                  <td class="max-w-[240px] px-5 py-4">
                    <div class="truncate font-medium text-slate-900" :title="row.fileName">
                      {{ row.fileName || '未命名文档' }}
                    </div>
                    <div class="mt-1 truncate text-xs text-slate-400" :title="row.taskId">
                      {{ row.taskId }}
                    </div>
                  </td>
                  <td class="px-4 py-4 text-center">
                    <span
                      class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      :class="statusClass(row.status)"
                    >
                      {{ statusLabel(row.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-4">
                    <div class="flex min-w-[140px] items-center gap-3">
                      <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          class="h-full rounded-full bg-indigo-500 transition-all"
                          :style="{ width: `${row.progress ?? 0}%` }"
                        />
                      </div>
                      <span class="w-12 text-right text-xs tabular-nums text-slate-500">
                        {{ row.progress ?? 0 }}%
                      </span>
                    </div>
                    <div class="mt-1 text-xs text-slate-500">{{ stageLabel(row.stage) }}</div>
                  </td>
                  <td class="px-4 py-4 text-center text-sm font-semibold tabular-nums text-slate-900">
                    {{ scoreText(row) }}
                  </td>
                  <td class="max-w-[160px] px-4 py-4 text-slate-600">
                    <span class="truncate block" :title="row.report?.plagiarismLevel || '-'">
                      {{ row.report?.plagiarismLevel || '-' }}
                    </span>
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-center">
                    <button
                      type="button"
                      class="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="!canUseReportPdf(row) || reportActionLoading === `view:${row.taskId}`"
                      @click="openReportPdf(row, 'view')"
                    >
                      {{ reportActionLoading === `view:${row.taskId}` ? '生成中...' : row.reportPdfObject ? '查看PDF' : '生成PDF' }}
                    </button>
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-right text-xs tabular-nums text-slate-500">
                    {{ formatTime(row.createTime) }}
                  </td>
                  <td class="whitespace-nowrap px-5 py-4 text-right">
                    <button
                      type="button"
                      class="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="detailLoading && selectedTask?.taskId === row.taskId"
                      @click="openDetail(row)"
                    >
                      {{ detailLoading && selectedTask?.taskId === row.taskId ? '加载中...' : '查看详情' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside class="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div class="border-b border-slate-100 px-5 py-4">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-500">
              报告详情
            </h2>
          </div>

          <div v-if="!selectedTask" class="px-6 py-16 text-center text-sm text-slate-500">
            请选择一条记录查看完整质检报告。
          </div>

          <div v-else class="space-y-6 p-5">
            <div class="space-y-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="truncate text-base font-semibold text-slate-900" :title="selectedTask.fileName">
                    {{ selectedTask.fileName || '未命名文档' }}
                  </h3>
                  <p class="mt-1 text-xs text-slate-500">{{ formatTime(selectedTask.createTime) }}</p>
                </div>
                <span
                  class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  :class="statusClass(selectedTask.status)"
                >
                  {{ statusLabel(selectedTask.status) }}
                </span>
              </div>

              <div class="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <div class="flex justify-between text-xs text-slate-500">
                  <span>{{ stageLabel(selectedTask.stage) }}</span>
                  <span>{{ selectedTask.progress ?? 0 }}%</span>
                </div>
                <div class="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    class="h-full rounded-full bg-indigo-500"
                    :style="{ width: `${selectedTask.progress ?? 0}%` }"
                  />
                </div>
              </div>

              <div class="grid gap-2 sm:grid-cols-3">
                <a
                  v-if="selectedTask.downloadUrl"
                  :href="selectedTask.downloadUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  下载原文
                </a>
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canUseReportPdf(selectedTask) || reportActionLoading === `view:${selectedTask.taskId}`"
                  @click="openReportPdf(selectedTask, 'view')"
                >
                  {{ reportActionLoading === `view:${selectedTask.taskId}` ? '生成中...' : '查看报告' }}
                </button>
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canUseReportPdf(selectedTask) || reportActionLoading === `download:${selectedTask.taskId}`"
                  @click="openReportPdf(selectedTask, 'download')"
                >
                  {{ reportActionLoading === `download:${selectedTask.taskId}` ? '准备中...' : '下载报告' }}
                </button>
              </div>
            </div>

            <div v-if="agentStatusEntries.length" class="grid grid-cols-2 gap-3">
              <div
                v-for="entry in agentStatusEntries"
                :key="entry.key"
                class="rounded-xl border border-slate-100 px-3 py-3"
              >
                <p class="text-xs text-slate-500">{{ entry.label }}</p>
                <p
                  class="mt-2 inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold"
                  :class="agentStatusClass(entry.value)"
                >
                  {{ agentStatusText(entry.value) }}
                </p>
              </div>
            </div>

            <div v-if="report" class="space-y-5">
              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-xl border border-slate-100 px-3 py-3">
                  <p class="text-xs text-slate-500">综合得分</p>
                  <p class="mt-1 text-xl font-bold text-indigo-600">{{ report.overallScore ?? '-' }}</p>
                </div>
                <div class="rounded-xl border border-slate-100 px-3 py-3">
                  <p class="text-xs text-slate-500">查重结论</p>
                  <p class="mt-1 font-semibold text-slate-900">{{ report.plagiarismLevel ?? '-' }}</p>
                </div>
                <div class="rounded-xl border border-slate-100 px-3 py-3">
                  <p class="text-xs text-slate-500">逻辑得分</p>
                  <p class="mt-1 font-semibold text-slate-900">{{ report.logicScore ?? '-' }}</p>
                </div>
                <div class="rounded-xl border border-slate-100 px-3 py-3">
                  <p class="text-xs text-slate-500">规范得分</p>
                  <p class="mt-1 font-semibold text-slate-900">{{ report.complianceScore ?? '-' }}</p>
                </div>
              </div>

              <section v-if="report.suggestions?.length" class="space-y-3">
                <h3 class="text-sm font-semibold text-slate-900">改进建议</h3>
                <div
                  v-for="(item, index) in report.suggestions"
                  :key="`suggestion-${index}`"
                  class="rounded-xl border border-slate-200 p-4"
                >
                  <div class="mb-2 flex flex-wrap items-center gap-2">
                    <span class="rounded-md border px-2 py-0.5 text-[11px] font-semibold" :class="severityClass(item.severity)">
                      {{ item.severity || 'LOW' }}
                    </span>
                    <span class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {{ dimensionText(item.dimension) }}
                    </span>
                  </div>
                  <p class="text-sm leading-relaxed text-slate-900 whitespace-pre-wrap">
                    {{ suggestionProblem(item) }}
                  </p>
                  <p v-if="suggestionAction(item)" class="mt-3 text-sm leading-relaxed text-indigo-950 whitespace-pre-wrap">
                    {{ suggestionAction(item) }}
                  </p>
                  <p v-if="item.detail" class="mt-3 text-xs leading-relaxed text-slate-500 whitespace-pre-wrap">
                    {{ item.detail }}
                  </p>
                </div>
              </section>

              <section v-if="report.sectionIssues?.length" class="space-y-3">
                <h3 class="text-sm font-semibold text-slate-900">分章节问题</h3>
                <div
                  v-for="(item, index) in report.sectionIssues"
                  :key="`section-${index}`"
                  class="rounded-xl border border-slate-200 p-4"
                >
                  <div class="mb-2 flex flex-wrap items-center gap-2">
                    <span v-if="item.section" class="text-xs font-semibold text-slate-900">{{ item.section }}</span>
                    <span v-if="item.paragraphIndex != null" class="text-xs text-slate-500">第 {{ item.paragraphIndex }} 段</span>
                    <span class="rounded-md border px-2 py-0.5 text-[11px] font-semibold" :class="severityClass(item.severity)">
                      {{ item.severity || 'LOW' }}
                    </span>
                    <span class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {{ dimensionText(item.dimension) }}
                    </span>
                  </div>
                  <p class="text-sm leading-relaxed text-slate-900 whitespace-pre-wrap">
                    {{ sectionProblem(item) }}
                  </p>
                  <p v-if="item.suggestion" class="mt-3 text-sm leading-relaxed text-indigo-950 whitespace-pre-wrap">
                    {{ item.suggestion }}
                  </p>
                </div>
              </section>
            </div>

            <div v-else class="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              {{ selectedTask.status === 'FAILED' ? '该任务执行失败，暂无报告内容。' : '报告尚未生成，请稍后刷新记录。' }}
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
