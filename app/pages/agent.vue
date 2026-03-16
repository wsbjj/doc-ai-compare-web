<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import {
  submitPaperTask,
  getPaperTaskStatus,
  getPaperTaskResult,
  type PaperTaskVO,
  type PaperQualityReport
} from '../services/paperApi'

const file = ref<File | null>(null)
const asyncMode = ref(true)
const loading = ref(false)
const errorMsg = ref('')
const task = ref<PaperTaskVO | null>(null)
const toastMsg = ref('')
const showToast = ref(false)

const canSubmit = computed(() => !!file.value && !loading.value)

const showToastFn = (msg: string) => {
  toastMsg.value = msg
  showToast.value = true
  setTimeout(() => { showToast.value = false }, 3000)
}

const POLL_INTERVAL = 3000
let pollTimer: ReturnType<typeof setInterval> | null = null

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files?.[0]) {
    file.value = target.files[0]
    task.value = null
    errorMsg.value = ''
  }
}

const submit = async () => {
  if (!file.value) return
  loading.value = true
  errorMsg.value = ''
  task.value = null
  stopPolling()

  try {
    const data = await submitPaperTask(file.value, asyncMode.value)
    task.value = data

    if (asyncMode.value) {
      if (data.status === 'COMPLETED') {
        const full = await getPaperTaskResult(data.taskId)
        task.value = full
        showToastFn('质检完成')
      } else if (data.status === 'FAILED') {
        showToastFn('任务执行失败')
      } else {
        startPolling(data.taskId)
      }
    } else {
      if (data.status === 'COMPLETED') showToastFn('质检完成')
      else if (data.status === 'FAILED') showToastFn('任务执行失败')
    }
  } catch (e: any) {
    errorMsg.value = e?.message || '提交失败'
    showToastFn('提交失败: ' + (e?.message || ''))
  } finally {
    loading.value = false
  }
}

const startPolling = (taskId: string) => {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const data = await getPaperTaskStatus(taskId)
      task.value = { ...task.value!, ...data }
      if (data.status === 'COMPLETED') {
        stopPolling()
        const full = await getPaperTaskResult(taskId)
        task.value = full
        showToastFn('质检完成')
      } else if (data.status === 'FAILED') {
        stopPolling()
        showToastFn('任务执行失败')
      }
    } catch (_) {}
  }, POLL_INTERVAL)
}

const report = computed<PaperQualityReport | null>(() => task.value?.report ?? null)
const isPolling = computed(
  () => task.value?.status === 'PENDING' || task.value?.status === 'PROCESSING'
)

// 步骤条：阶段顺序（与文档一致）
const STAGES = [
  { key: 'UPLOADED', label: '已上传' },
  { key: 'OCR', label: '文本抽取' },
  { key: 'PLAGIARISM', label: '查重' },
  { key: 'LOGIC', label: '逻辑' },
  { key: 'COMPLIANCE', label: '规范' },
  { key: 'REVIEW', label: '汇总' },
  { key: 'COMPLETED', label: '完成' }
] as const

const currentStageIndex = computed(() => {
  const stage = task.value?.stage
  if (!stage) return -1
  const i = STAGES.findIndex(s => s.key === stage)
  return i >= 0 ? i : -1
})

const isStageDone = (index: number) => {
  const cur = currentStageIndex.value
  if (cur < 0) return false
  return index < cur || task.value?.status === 'COMPLETED'
}

const isStageActive = (index: number) => currentStageIndex.value === index

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    PENDING: '待处理',
    PROCESSING: '质检中',
    COMPLETED: '已完成',
    FAILED: '失败'
  }
  return map[status] ?? status
}

const getStatusClass = (status: string) => {
  if (status === 'COMPLETED') return 'bg-green-100 text-green-700 border-green-200'
  if (status === 'FAILED') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-amber-100 text-amber-700 border-amber-200'
}

const getAgentStatusText = (s: string) => {
  const map: Record<string, string> = {
    PENDING: '等待中',
    RUNNING: '进行中',
    DONE: '已完成',
    FAILED: '失败'
  }
  return map[s] ?? s
}

const getAgentStatusClass = (s: string) => {
  const v = (s || '').toUpperCase()
  if (v === 'DONE') return 'bg-green-50 text-green-700 border-green-200'
  if (v === 'RUNNING') return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  if (v === 'FAILED') return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-gray-50 text-gray-600 border-gray-200'
}

const getSeverityClass = (severity: string) => {
  const s = severity?.toUpperCase()
  if (s === 'HIGH') return 'bg-red-50 text-red-700 border-red-200'
  if (s === 'MEDIUM') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-gray-50 text-gray-700 border-gray-200'
}

const getDimensionText = (dim: string) => {
  const map: Record<string, string> = {
    PLAGIARISM: '查重',
    LOGIC: '逻辑',
    COMPLIANCE: '规范'
  }
  return map[dim] ?? dim
}

const agentStatusEntries = computed(() => {
  const as = task.value?.agentStatus
  if (!as) return []
  const order: (keyof NonNullable<typeof as>)[] = ['plagiarism', 'logic', 'compliance', 'review']
  const labels: Record<string, string> = { plagiarism: '查重', logic: '逻辑', compliance: '规范', review: '汇总' }
  return order.filter(k => as[k] != null).map(k => ({ key: k, label: labels[k], value: as[k] }))
})

onUnmounted(() => stopPolling())
</script>

<template>
  <div class="py-10 px-4 relative">
    <transition name="fade">
      <div
        v-if="showToast"
        class="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg"
      >
        <span class="text-sm font-medium">{{ toastMsg }}</span>
      </div>
    </transition>

    <div class="max-w-5xl mx-auto space-y-8">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-gray-800">📋 论文查重 / 质检</h1>
        <p class="mt-2 text-gray-500">上传论文后，多 Agent 流水线将依次完成文本抽取、查重、逻辑与规范检查，并给出改进建议。</p>
      </div>

      <!-- 上传区 -->
      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 class="font-semibold text-lg text-gray-700 mb-4 flex items-center gap-2">
          <span class="w-2 h-6 bg-indigo-500 rounded"></span>
          上传论文
        </h3>
        <label class="block w-full cursor-pointer">
          <div
            class="border-2 border-dashed border-indigo-200 rounded-lg p-8 hover:bg-indigo-50/50 transition-colors text-center"
          >
            <span class="text-indigo-600 font-medium">点击选择 PDF / Word / TXT</span>
            <input
              type="file"
              class="hidden"
              accept=".pdf,.doc,.docx,.txt"
              @change="handleFileChange"
            />
          </div>
        </label>
        <div v-if="file" class="mt-4 flex items-center justify-between bg-gray-50 p-3 rounded-lg">
          <span class="text-sm text-gray-700 truncate" :title="file.name">📄 {{ file.name }}</span>
        </div>
        <div class="mt-4 flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="asyncMode" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
            <span class="text-sm text-gray-600">异步执行（推荐，立即返回后轮询结果）</span>
          </label>
        </div>
        <div class="mt-6">
          <button
            :disabled="!canSubmit"
            class="w-full py-3 px-4 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="submit"
          >
            <span v-if="loading" class="inline-flex items-center gap-2">
              <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {{ asyncMode ? '提交中...' : '质检中，请稍候...' }}
            </span>
            <span v-else>提交质检</span>
          </button>
        </div>
        <p v-if="errorMsg" class="mt-3 text-sm text-red-500">{{ errorMsg }}</p>
      </div>

      <!-- 任务卡片：步骤条 + 进度条 + Agent 状态 -->
      <div v-if="task" class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-3">
          <span class="font-medium text-gray-800 truncate max-w-[200px]" :title="task.fileName">{{ task.fileName }}</span>
          <span :class="['px-2 py-1 rounded text-xs border', getStatusClass(task.status)]">
            {{ getStatusText(task.status) }}
          </span>
          <span v-if="isPolling" class="text-amber-600 text-sm flex items-center gap-1">
            <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            轮询中...
          </span>
          <a
            v-if="task.downloadUrl"
            :href="task.downloadUrl"
            target="_blank"
            rel="noopener"
            class="ml-auto text-sm text-indigo-600 hover:underline"
          >
            下载原文
          </a>
        </div>

        <!-- 步骤条 -->
        <div class="px-6 py-5 border-b border-gray-100">
          <h4 class="text-sm font-semibold text-gray-700 mb-3">流水线进度</h4>
          <div class="flex items-start gap-0 overflow-x-auto pb-1">
            <template v-for="(step, index) in STAGES" :key="step.key">
              <div class="flex flex-col items-center shrink-0">
                <div
                  class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors"
                  :class="[
                    isStageDone(index)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : isStageActive(index)
                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
                        : 'border-gray-200 text-gray-400 bg-white'
                  ]"
                >
                  <span v-if="isStageDone(index)">✓</span>
                  <span v-else>{{ index + 1 }}</span>
                </div>
                <span
                  class="mt-1 text-xs truncate max-w-[3.5rem] text-center"
                  :class="isStageActive(index) ? 'text-indigo-600 font-medium' : isStageDone(index) ? 'text-gray-600' : 'text-gray-400'"
                >
                  {{ step.label }}
                </span>
              </div>
              <div
                v-if="index < STAGES.length - 1"
                class="w-4 sm:w-8 h-0.5 mt-4 shrink-0 rounded transition-colors"
                :class="isStageDone(index) ? 'bg-indigo-200' : 'bg-gray-200'"
              />
            </template>
          </div>
        </div>

        <!-- 进度条 -->
        <div v-if="task.progress != null" class="px-6 pb-4">
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span>整体进度</span>
            <span>{{ task.progress }}%</span>
          </div>
          <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-indigo-500 rounded-full transition-all duration-300"
              :style="{ width: `${task.progress}%` }"
            />
          </div>
        </div>

        <!-- 各 Agent 实时状态 -->
        <div v-if="agentStatusEntries.length" class="px-6 py-4 border-t border-gray-100 bg-gray-50/30">
          <h4 class="text-sm font-semibold text-gray-700 mb-3">Agent 状态</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div
              v-for="entry in agentStatusEntries"
              :key="entry.key"
              class="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white"
            >
              <span class="text-sm text-gray-600">{{ entry.label }}</span>
              <span :class="['px-2 py-0.5 rounded text-xs border', getAgentStatusClass(entry.value || '')]">
                {{ getAgentStatusText(entry.value || '') }}
              </span>
            </div>
          </div>
        </div>

        <!-- 报告内容 -->
        <div v-if="report" class="p-6 space-y-8">
          <div class="flex flex-col md:flex-row md:items-center justify-between border-l-4 border-indigo-600 pl-4 gap-4">
            <h2 class="text-xl font-bold text-gray-800">质检报告</h2>
            <div v-if="report.overallScore != null" class="flex items-baseline gap-2">
              <span class="text-gray-500 text-sm">综合得分</span>
              <span class="text-2xl font-bold text-indigo-600">{{ report.overallScore }}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div v-if="report.plagiarismLevel !== undefined" class="bg-white rounded-lg border border-gray-100 p-4 text-center shadow-sm">
              <p class="text-xs text-gray-500 mb-1">查重结论</p>
              <p class="font-bold text-gray-800">{{ report.plagiarismLevel }}</p>
            </div>
            <div v-if="report.plagiarismScore !== undefined" class="bg-white rounded-lg border border-gray-100 p-4 text-center shadow-sm">
              <p class="text-xs text-gray-500 mb-1">查重得分</p>
              <p class="font-bold text-indigo-600">{{ report.plagiarismScore }}</p>
            </div>
            <div v-if="report.logicScore !== undefined" class="bg-white rounded-lg border border-gray-100 p-4 text-center shadow-sm">
              <p class="text-xs text-gray-500 mb-1">逻辑得分</p>
              <p class="font-bold text-indigo-600">{{ report.logicScore }}</p>
            </div>
            <div v-if="report.complianceScore !== undefined" class="bg-white rounded-lg border border-gray-100 p-4 text-center shadow-sm">
              <p class="text-xs text-gray-500 mb-1">规范得分</p>
              <p class="font-bold text-indigo-600">{{ report.complianceScore }}</p>
            </div>
          </div>

          <!-- 全局改进建议 -->
          <div v-if="report.suggestions?.length" class="space-y-4">
            <h4 class="font-semibold text-gray-800 flex items-center gap-2">
              <span class="w-2 h-5 bg-amber-500 rounded"></span>
              改进建议
            </h4>
            <ul class="space-y-3">
              <li
                v-for="(item, i) in report.suggestions"
                :key="'s-' + i"
                class="flex gap-3 p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow transition-shadow"
              >
                <span :class="['shrink-0 px-2 py-1 rounded text-xs border', getSeverityClass(item.severity)]">
                  {{ item.severity }}
                </span>
                <span class="shrink-0 text-xs text-gray-500">{{ getDimensionText(item.dimension) }}</span>
                <p class="text-sm text-gray-700">{{ item.description }}</p>
              </li>
            </ul>
          </div>

          <!-- 分章节问题 -->
          <div v-if="report.sectionIssues?.length" class="space-y-4">
            <h4 class="font-semibold text-gray-800 flex items-center gap-2">
              <span class="w-2 h-5 bg-red-400 rounded"></span>
              分章节问题
            </h4>
            <ul class="space-y-4">
              <li
                v-for="(item, i) in report.sectionIssues"
                :key="'sec-' + i"
                class="p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow transition-shadow space-y-2"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <span v-if="item.section" class="text-sm font-medium text-gray-800">{{ item.section }}</span>
                  <span v-if="item.paragraphIndex != null" class="text-xs text-gray-500">第 {{ item.paragraphIndex }} 段</span>
                  <span :class="['px-2 py-0.5 rounded text-xs border', getSeverityClass(item.severity)]">{{ item.severity }}</span>
                  <span class="text-xs text-gray-500">{{ getDimensionText(item.dimension) }}</span>
                </div>
                <p class="text-sm text-gray-600"><span class="text-gray-500">问题：</span>{{ item.problem }}</p>
                <p class="text-sm text-indigo-600"><span class="text-gray-500">建议：</span>{{ item.suggestion }}</p>
              </li>
            </ul>
          </div>
        </div>

        <div v-else-if="task.status === 'FAILED'" class="p-6 text-red-600">
          任务执行失败，请重试或联系管理员。
        </div>
        <div v-else-if="isPolling" class="p-6 text-gray-500 text-center">
          正在质检中，请稍候…
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
