<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getDashboardRecent,
  getCompareLogDetail,
  type RecentActivity,
  type CompareLogDetail
} from '~/services/docCompareApi'

definePageMeta({
  layout: 'default',
  ssr: false
})

const list = ref<RecentActivity[]>([])
const loading = ref(true)
const error = ref('')
const downloadingId = ref<number | null>(null)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

const showToast = (msg: string) => {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
    toastTimer = null
  }, 3200)
}

const escapeHtml = (s: string | null | undefined): string => {
  if (s == null || s === '') return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const safeFileStem = (name: string | null | undefined): string => {
  const n = (name || 'record').replace(/[/\\?%*:|"<>]/g, '_').trim()
  return n.slice(0, 60) || 'record'
}

const buildCompareRecordHtml = (d: CompareLogDetail): string => {
  const simPct = (Number(d.similarity) * 100).toFixed(1)
  const riskCls =
    d.riskLevel === 'HIGH' || d.riskLevel === 'MEDIUM' || d.riskLevel === 'LOW' ? d.riskLevel : 'LOW'
  const timeStr = d.createTime
    ? new Date(d.createTime).toLocaleString('zh-CN')
    : ''
  const proc =
    d.processTimeMs != null && d.processTimeMs > 0
      ? `<tr><th>处理耗时</th><td>${escapeHtml(String(d.processTimeMs))} ms</td></tr>`
      : ''
  const tok =
    d.tokenUsage != null && d.tokenUsage > 0
      ? `<tr><th>估算 Token</th><td>${escapeHtml(String(d.tokenUsage))}</td></tr>`
      : ''
  const hours =
    d.savedManHours != null && Number(d.savedManHours) > 0
      ? `<tr><th>预估节省工时</th><td>${escapeHtml(Number(d.savedManHours).toFixed(2))} 小时</td></tr>`
      : ''
  const summaryBlock =
    d.resultSummary && String(d.resultSummary).trim()
      ? `<section class="box"><h2>分析摘要</h2><p class="summary">${escapeHtml(d.resultSummary)}</p></section>`
      : ''

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>文档对比记录 #${d.id}</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
    .wrap { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 28px 32px; box-shadow: 0 1px 3px rgba(15,23,42,0.08); }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    .muted { color: #64748b; font-size: 0.875rem; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { width: 140px; color: #64748b; font-weight: 600; }
    .risk { display: inline-block; padding: 2px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; }
    .risk-HIGH { background: #fee2e2; color: #b91c1c; }
    .risk-MEDIUM { background: #ffedd5; color: #c2410c; }
    .risk-LOW { background: #dcfce7; color: #15803d; }
    .box { margin-top: 24px; }
    .box h2 { font-size: 1rem; margin: 0 0 10px; }
    .summary { white-space: pre-wrap; line-height: 1.6; margin: 0; }
    footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 0.75rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>文档对比记录</h1>
    <p class="muted">记录编号 #${d.id} · 导出时间 ${escapeHtml(new Date().toLocaleString('zh-CN'))}</p>
    <table>
      <tbody>
        <tr><th>基准文档 (A)</th><td>${escapeHtml(d.baseFileName)}</td></tr>
        <tr><th>对比文档 (B)</th><td>${escapeHtml(d.compareFileName)}</td></tr>
        <tr><th>相似度</th><td><strong>${escapeHtml(simPct)}%</strong></td></tr>
        <tr><th>风险等级</th><td><span class="risk risk-${riskCls}">${escapeHtml(d.riskLevel)}</span></td></tr>
        <tr><th>对比时间</th><td>${escapeHtml(timeStr)}</td></tr>
        <tr><th>基准文档 ID</th><td><code>${escapeHtml(d.baseDocId)}</code></td></tr>
        <tr><th>对比文档 ID</th><td><code>${escapeHtml(d.compareDocId)}</code></td></tr>
        ${proc}${tok}${hours}
      </tbody>
    </table>
    ${summaryBlock}
    <footer>本文件由项目材料独创性智能审查系统根据数据库记录生成，仅供参考。</footer>
  </div>
</body>
</html>`
}

const downloadCompareRecord = async (row: RecentActivity) => {
  downloadingId.value = row.id
  try {
    const detail = await getCompareLogDetail(row.id)
    const html = buildCompareRecordHtml(detail)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `对比记录_${detail.id}_${safeFileStem(detail.baseFileName)}.html`
    a.click()
    URL.revokeObjectURL(url)
    showToast('已开始下载记录文件')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '下载失败'
    showToast(msg)
  } finally {
    downloadingId.value = null
  }
}

const formatTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.round(diffMs / 60000)
  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `${diffHours}小时前`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}天前`
  return date.toLocaleDateString('zh-CN')
}

const getRiskBadge = (risk: string) => {
  if (risk === 'HIGH') return 'bg-red-100 text-red-700 border-red-200'
  if (risk === 'MEDIUM') return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-green-100 text-green-700 border-green-200'
}

onMounted(async () => {
  loading.value = true
  error.value = ''
  try {
    list.value = await getDashboardRecent(50)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="p-8 max-w-6xl mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">文档对比记录</h1>
      <p class="text-sm text-gray-500 mt-1">展示您在本系统发起的文档智能对比历史（按时间倒序）。</p>
    </div>

    <transition name="fade">
      <div
        v-if="toast"
        class="fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-800 px-5 py-2.5 text-sm font-medium text-white shadow-lg"
      >
        {{ toast }}
      </div>
    </transition>

    <div v-if="error" class="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
      {{ error }}
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <h2 class="font-semibold text-gray-800">历史列表</h2>
      </div>
      <div class="overflow-x-auto">
        <div v-if="loading" class="flex justify-center items-center p-12 text-gray-500">
          <span class="inline-block w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2" />
          加载中…
        </div>
        <div v-else-if="list.length === 0" class="px-6 py-12 text-center text-gray-500 text-sm">
          暂无对比记录。请前往「文档对比」上传两份文档并开始分析。
        </div>
        <table v-else class="w-full text-sm text-left">
          <thead class="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th class="px-6 py-3">基准文档 (A)</th>
              <th class="px-6 py-3">对比文档 (B)</th>
              <th class="px-6 py-3">相似度</th>
              <th class="px-6 py-3">风险</th>
              <th class="px-6 py-3 text-right">时间</th>
              <th class="px-6 py-3 text-right whitespace-nowrap w-[120px]">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in list"
              :key="row.id"
              class="border-b border-gray-50 hover:bg-gray-50 transition-colors"
            >
              <td class="px-6 py-4 font-medium text-gray-900 truncate max-w-[180px]" :title="row.baseFileName">
                {{ row.baseFileName }}
              </td>
              <td class="px-6 py-4 text-gray-600 truncate max-w-[180px]" :title="row.compareFileName">
                {{ row.compareFileName }}
              </td>
              <td class="px-6 py-4 font-mono font-semibold text-gray-800">
                {{ (Number(row.similarity) * 100).toFixed(1) }}%
              </td>
              <td class="px-6 py-4">
                <span :class="`px-2 py-1 rounded text-xs border ${getRiskBadge(row.riskLevel)}`">
                  {{ row.riskLevel }}
                </span>
              </td>
              <td class="px-6 py-4 text-right text-gray-500 text-xs whitespace-nowrap">
                {{ formatTime(row.createTime) }}
              </td>
              <td class="px-6 py-4 text-right">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="downloadingId === row.id"
                  @click="downloadCompareRecord(row)"
                >
                  <span
                    v-if="downloadingId === row.id"
                    class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
                  />
                  {{ downloadingId === row.id ? '生成中…' : '下载记录' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
