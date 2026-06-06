<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  deleteAdminCompareReport,
  deleteAdminDocument,
  deleteAdminPaperReport,
  listAdminCompareReports,
  listAdminDocuments,
  listAdminPaperReports,
  type AdminCompareReport,
  type AdminDocument,
  type AdminPage,
  type AdminPaperReport
} from '~/services/adminApi'

definePageMeta({
  layout: 'default',
  ssr: false
})

type TabKey = 'documents' | 'compare' | 'paper'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'documents', label: '已入库文档' },
  { key: 'compare', label: '对比报告' },
  { key: 'paper', label: '分析报告' }
]

const pageSize = 20
const activeTab = ref<TabKey>('documents')
const loading = ref(false)
const error = ref('')
const toast = ref('')
const deletingKey = ref('')

const pageState = reactive<Record<TabKey, number>>({
  documents: 1,
  compare: 1,
  paper: 1
})

const filters = reactive({
  documentKeyword: '',
  documentStatus: '',
  documentFileType: '',
  compareKeyword: '',
  compareRiskLevel: '',
  paperKeyword: '',
  paperStatus: ''
})

const documents = ref<AdminPage<AdminDocument> | null>(null)
const compareReports = ref<AdminPage<AdminCompareReport> | null>(null)
const paperReports = ref<AdminPage<AdminPaperReport> | null>(null)

let toastTimer: ReturnType<typeof setTimeout> | null = null

const showToast = (message: string) => {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
    toastTimer = null
  }, 2600)
}

const activePageData = computed(() => {
  if (activeTab.value === 'documents') return documents.value
  if (activeTab.value === 'compare') return compareReports.value
  return paperReports.value
})

const activeTotalPages = computed(() => {
  const total = activePageData.value?.total ?? 0
  return Math.max(1, Math.ceil(total / pageSize))
})

const loadDocuments = async (page = pageState.documents) => {
  documents.value = await listAdminDocuments({
    page,
    size: pageSize,
    keyword: filters.documentKeyword,
    status: filters.documentStatus,
    fileType: filters.documentFileType
  })
  pageState.documents = documents.value.page
}

const loadCompareReports = async (page = pageState.compare) => {
  compareReports.value = await listAdminCompareReports({
    page,
    size: pageSize,
    keyword: filters.compareKeyword,
    riskLevel: filters.compareRiskLevel
  })
  pageState.compare = compareReports.value.page
}

const loadPaperReports = async (page = pageState.paper) => {
  paperReports.value = await listAdminPaperReports({
    page,
    size: pageSize,
    keyword: filters.paperKeyword,
    status: filters.paperStatus
  })
  pageState.paper = paperReports.value.page
}

const refreshActive = async (resetPage = false) => {
  loading.value = true
  error.value = ''
  try {
    if (activeTab.value === 'documents') {
      await loadDocuments(resetPage ? 1 : pageState.documents)
    } else if (activeTab.value === 'compare') {
      await loadCompareReports(resetPage ? 1 : pageState.compare)
    } else {
      await loadPaperReports(resetPage ? 1 : pageState.paper)
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

const setTab = async (key: TabKey) => {
  activeTab.value = key
  if (
    (key === 'documents' && !documents.value) ||
    (key === 'compare' && !compareReports.value) ||
    (key === 'paper' && !paperReports.value)
  ) {
    await refreshActive()
  }
}

const changePage = async (direction: -1 | 1) => {
  const next = Math.min(Math.max(pageState[activeTab.value] + direction, 1), activeTotalPages.value)
  if (next === pageState[activeTab.value]) return
  pageState[activeTab.value] = next
  await refreshActive()
}

const openUrl = (url?: string | null) => {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

const confirmDelete = async (kind: TabKey, id: string | number, label: string) => {
  const ok = window.confirm(`确认删除：${label}`)
  if (!ok) return
  deletingKey.value = `${kind}:${id}`
  error.value = ''
  try {
    if (kind === 'documents') {
      await deleteAdminDocument(String(id))
    } else if (kind === 'compare') {
      await deleteAdminCompareReport(Number(id))
    } else {
      await deleteAdminPaperReport(String(id))
    }
    showToast('已删除')
    await refreshActive()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '删除失败'
  } finally {
    deletingKey.value = ''
  }
}

onMounted(() => {
  refreshActive()
})

const formatTime = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatBytes = (value?: number | null) => {
  if (value == null || Number.isNaN(Number(value))) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = Number(value)
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

const formatSimilarity = (value?: number | string | null) => {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `${(Number(value) * 100).toFixed(1)}%`
}

const statusClass = (status?: string | null) => {
  const value = (status || '').toUpperCase()
  if (value === 'READY' || value === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  if (value === 'FAILED') return 'bg-red-50 text-red-700 ring-1 ring-red-200'
  if (value === 'PROCESSING') return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
  return 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'
}

const riskClass = (risk?: string | null) => {
  const value = (risk || '').toUpperCase()
  if (value === 'HIGH') return 'bg-red-50 text-red-700 ring-1 ring-red-200'
  if (value === 'MEDIUM') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
  return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
}

const existsClass = (exists: boolean) =>
  exists ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] bg-slate-50">
    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header class="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-950">管理员</h1>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              class="h-9 rounded-md px-4 text-sm font-semibold transition"
              :class="activeTab === tab.key ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'"
              @click="setTab(tab.key)"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <span class="rounded-md bg-white px-3 py-1.5 ring-1 ring-slate-200">{{ activePageData?.total ?? 0 }} 条</span>
          <button
            type="button"
            class="inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loading"
            @click="refreshActive()"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 9.4A5.5 5.5 0 1 0 18 13m0-5v5h-5" />
            </svg>
            刷新
          </button>
        </div>
      </header>

      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="toast"
          class="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {{ toast }}
        </div>
      </transition>

      <div v-if="error" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ error }}
      </div>

      <section class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-200 bg-white px-4 py-4">
          <div v-if="activeTab === 'documents'" class="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <input
              v-model="filters.documentKeyword"
              type="search"
              class="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              placeholder="文件名 / ID / MinIO object"
              @keydown.enter="refreshActive(true)"
            >
            <select v-model="filters.documentStatus" class="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400">
              <option value="">全部状态</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="READY">READY</option>
              <option value="FAILED">FAILED</option>
            </select>
            <select v-model="filters.documentFileType" class="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400">
              <option value="">全部类型</option>
              <option value="general">general</option>
              <option value="contract">contract</option>
              <option value="policy">policy</option>
              <option value="technical">technical</option>
            </select>
            <button type="button" class="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800" @click="refreshActive(true)">
              查询
            </button>
          </div>

          <div v-else-if="activeTab === 'compare'" class="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
            <input
              v-model="filters.compareKeyword"
              type="search"
              class="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              placeholder="文件名 / 操作人 / 报告 object"
              @keydown.enter="refreshActive(true)"
            >
            <select v-model="filters.compareRiskLevel" class="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400">
              <option value="">全部风险</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
            <button type="button" class="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800" @click="refreshActive(true)">
              查询
            </button>
          </div>

          <div v-else class="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
            <input
              v-model="filters.paperKeyword"
              type="search"
              class="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
              placeholder="文件名 / 任务 ID / 操作人"
              @keydown.enter="refreshActive(true)"
            >
            <select v-model="filters.paperStatus" class="h-10 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400">
              <option value="">全部状态</option>
              <option value="PENDING">PENDING</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="FAILED">FAILED</option>
            </select>
            <button type="button" class="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800" @click="refreshActive(true)">
              查询
            </button>
          </div>
        </div>

        <div v-if="loading" class="flex items-center justify-center gap-3 px-6 py-16 text-sm font-medium text-slate-500">
          <span class="h-7 w-7 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          加载中...
        </div>

        <div v-else-if="activeTab === 'documents'" class="overflow-x-auto">
          <table class="w-full min-w-[1120px] border-collapse text-left text-sm">
            <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">文件</th>
                <th class="px-4 py-3">类型</th>
                <th class="px-4 py-3">状态</th>
                <th class="px-4 py-3">MinIO</th>
                <th class="px-4 py-3 text-right">大小</th>
                <th class="px-4 py-3 text-right">创建时间</th>
                <th class="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in documents?.records ?? []" :key="row.id" class="hover:bg-slate-50/80">
                <td class="max-w-[260px] px-4 py-3">
                  <div class="truncate font-semibold text-slate-900" :title="row.fileName || row.id">{{ row.fileName || '-' }}</div>
                  <div class="mt-1 truncate text-xs text-slate-400" :title="row.id">{{ row.id }}</div>
                </td>
                <td class="px-4 py-3 text-slate-600">{{ row.fileType || '-' }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="statusClass(row.status)">{{ row.status || '-' }}</span>
                </td>
                <td class="max-w-[260px] px-4 py-3">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="existsClass(row.objectExists)">
                    {{ row.objectExists ? '存在' : '缺失' }}
                  </span>
                  <div class="mt-1 truncate text-xs text-slate-400" :title="row.storagePath || ''">{{ row.storagePath || '-' }}</div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">{{ formatBytes(row.objectSize) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-slate-500">{{ formatTime(row.createTime) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right">
                  <div class="inline-flex items-center gap-2">
                    <button type="button" class="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100" @click="openUrl(row.previewUrl)">预览</button>
                    <button type="button" class="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100" @click="openUrl(row.downloadUrl)">下载</button>
                    <button
                      type="button"
                      class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="deletingKey === `documents:${row.id}`"
                      @click="confirmDelete('documents', row.id, row.fileName || row.id)"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else-if="activeTab === 'compare'" class="overflow-x-auto">
          <table class="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">文档 A</th>
                <th class="px-4 py-3">文档 B</th>
                <th class="px-4 py-3 text-center">相似度</th>
                <th class="px-4 py-3 text-center">风险</th>
                <th class="px-4 py-3">操作人</th>
                <th class="px-4 py-3">报告</th>
                <th class="px-4 py-3 text-right">创建时间</th>
                <th class="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in compareReports?.records ?? []" :key="row.id" class="hover:bg-slate-50/80">
                <td class="max-w-[210px] px-4 py-3">
                  <div class="truncate font-semibold text-slate-900" :title="row.baseFileName || row.baseDocId || ''">{{ row.baseFileName || '-' }}</div>
                  <div class="mt-1 truncate text-xs text-slate-400">{{ row.baseDocId || '-' }}</div>
                </td>
                <td class="max-w-[210px] px-4 py-3">
                  <div class="truncate font-semibold text-slate-900" :title="row.compareFileName || row.compareDocId || ''">{{ row.compareFileName || '-' }}</div>
                  <div class="mt-1 truncate text-xs text-slate-400">{{ row.compareDocId || '-' }}</div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-center font-semibold tabular-nums text-slate-900">{{ formatSimilarity(row.similarity) }}</td>
                <td class="px-4 py-3 text-center">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="riskClass(row.riskLevel)">{{ row.riskLevel || '-' }}</span>
                </td>
                <td class="px-4 py-3 text-slate-600">{{ row.createBy || '-' }}</td>
                <td class="max-w-[220px] px-4 py-3">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="existsClass(row.reportObjectExists)">
                    {{ row.reportObjectExists ? '存在' : '缺失' }}
                  </span>
                  <div class="mt-1 truncate text-xs text-slate-400" :title="row.reportPdfObject || ''">{{ row.reportPdfObject || '-' }}</div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-slate-500">{{ formatTime(row.createTime) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right">
                  <div class="inline-flex items-center gap-2">
                    <button type="button" class="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50" :disabled="!row.reportViewUrl" @click="openUrl(row.reportViewUrl)">预览</button>
                    <button type="button" class="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50" :disabled="!row.reportDownloadUrl" @click="openUrl(row.reportDownloadUrl)">下载</button>
                    <button
                      type="button"
                      class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="deletingKey === `compare:${row.id}`"
                      @click="confirmDelete('compare', row.id, `#${row.id}`)"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[1160px] border-collapse text-left text-sm">
            <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">文件</th>
                <th class="px-4 py-3">状态</th>
                <th class="px-4 py-3">进度</th>
                <th class="px-4 py-3">操作人</th>
                <th class="px-4 py-3">原文</th>
                <th class="px-4 py-3">报告</th>
                <th class="px-4 py-3 text-right">创建时间</th>
                <th class="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in paperReports?.records ?? []" :key="row.taskId" class="hover:bg-slate-50/80">
                <td class="max-w-[260px] px-4 py-3">
                  <div class="truncate font-semibold text-slate-900" :title="row.fileName || row.taskId">{{ row.fileName || '-' }}</div>
                  <div class="mt-1 truncate text-xs text-slate-400" :title="row.taskId">{{ row.taskId }}</div>
                </td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="statusClass(row.status)">{{ row.status || '-' }}</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex min-w-[120px] items-center gap-2">
                    <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div class="h-full rounded-full bg-slate-800" :style="{ width: `${row.progress ?? 0}%` }" />
                    </div>
                    <span class="w-10 text-right text-xs tabular-nums text-slate-500">{{ row.progress ?? 0 }}%</span>
                  </div>
                  <div class="mt-1 text-xs text-slate-400">{{ row.stage || '-' }}</div>
                </td>
                <td class="px-4 py-3 text-slate-600">{{ row.createBy || '-' }}</td>
                <td class="max-w-[190px] px-4 py-3">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="existsClass(row.fileObjectExists)">
                    {{ row.fileObjectExists ? '存在' : '缺失' }}
                  </span>
                  <div class="mt-1 truncate text-xs text-slate-400" :title="row.minioUrl || ''">{{ formatBytes(row.fileObjectSize) }}</div>
                </td>
                <td class="max-w-[190px] px-4 py-3">
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="existsClass(row.reportObjectExists)">
                    {{ row.reportObjectExists ? '存在' : '缺失' }}
                  </span>
                  <div class="mt-1 truncate text-xs text-slate-400" :title="row.reportPdfObject || ''">{{ formatBytes(row.reportObjectSize) }}</div>
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-xs tabular-nums text-slate-500">{{ formatTime(row.createTime) }}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right">
                  <div class="inline-flex items-center gap-2">
                    <button type="button" class="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50" :disabled="!row.fileDownloadUrl" @click="openUrl(row.fileDownloadUrl)">原文</button>
                    <button type="button" class="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50" :disabled="!row.reportViewUrl" @click="openUrl(row.reportViewUrl)">预览</button>
                    <button type="button" class="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50" :disabled="!row.reportDownloadUrl" @click="openUrl(row.reportDownloadUrl)">下载</button>
                    <button
                      type="button"
                      class="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="deletingKey === `paper:${row.taskId}`"
                      @click="confirmDelete('paper', row.taskId, row.fileName || row.taskId)"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!loading && (activePageData?.records?.length ?? 0) === 0" class="border-t border-slate-100 px-6 py-12 text-center text-sm text-slate-500">
          暂无数据
        </div>

        <div class="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
          <span class="text-xs text-slate-500">
            第 {{ pageState[activeTab] }} / {{ activeTotalPages }} 页
          </span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="h-8 rounded-md bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="loading || pageState[activeTab] <= 1"
              @click="changePage(-1)"
            >
              上一页
            </button>
            <button
              type="button"
              class="h-8 rounded-md bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="loading || pageState[activeTab] >= activeTotalPages"
              @click="changePage(1)"
            >
              下一页
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
