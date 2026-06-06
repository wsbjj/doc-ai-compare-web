<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  getPaperReportPdfUrl,
  getPaperTaskHistory,
  type PaperTaskStatus,
  type PaperTaskVO
} from '~/services/paperApi'

definePageMeta({
  layout: 'default',
  ssr: false
})

const list = ref<PaperTaskVO[]>([])
const loading = ref(true)
const reportActionLoading = ref('')
const error = ref('')

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

const canUseReportPdf = (task?: PaperTaskVO | null): boolean => {
  return task?.status === 'COMPLETED' && !!task.resultJson
}

const updateReportObjectKey = (taskId: string, objectKey: string) => {
  list.value = list.value.map(item =>
    item.taskId === taskId ? { ...item, reportPdfObject: objectKey } : item
  )
}

const refreshHistory = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await getPaperTaskHistory(50)
    list.value = data
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '加载文档质检记录失败'
  } finally {
    loading.value = false
  }
}

const openReportPdf = async (task: PaperTaskVO) => {
  if (!canUseReportPdf(task)) return
  reportActionLoading.value = `view:${task.taskId}`
  error.value = ''
  try {
    const data = await getPaperReportPdfUrl(task.taskId)
    updateReportObjectKey(task.taskId, data.objectKey)
    window.open(data.viewUrl, '_blank', 'noopener,noreferrer')
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
            查看当前账号提交过的文档质检任务，包含处理状态、评分概览和 PDF 报告入口。
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
          <table class="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th scope="col" class="px-5 py-3.5">文件名</th>
                <th scope="col" class="px-4 py-3.5 text-center">状态</th>
                <th scope="col" class="px-4 py-3.5">阶段/进度</th>
                <th scope="col" class="px-4 py-3.5 text-center">综合分</th>
                <th scope="col" class="px-4 py-3.5">查重结论</th>
                <th scope="col" class="px-4 py-3.5 text-center">报告</th>
                <th scope="col" class="px-5 py-3.5 text-right">创建时间</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="row in list"
                :key="row.taskId"
                class="transition hover:bg-indigo-50/40"
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
                    @click="openReportPdf(row)"
                  >
                    {{ reportActionLoading === `view:${row.taskId}` ? '生成中...' : row.reportPdfObject ? '查看PDF' : '生成PDF' }}
                  </button>
                </td>
                <td class="whitespace-nowrap px-5 py-4 text-right text-xs tabular-nums text-slate-500">
                  {{ formatTime(row.createTime) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>
