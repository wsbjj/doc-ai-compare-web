<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getDashboardRecent,
  getCompareLogDetail,
  getCompareReportPdfUrl,
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

const displayOrDash = (s: string | null | undefined): string => {
  if (s == null || String(s).trim() === '') return '（无）'
  return String(s)
}

const safeFileStem = (name: string | null | undefined): string => {
  const n = (name || 'record').replace(/[/\\?%*:|"<>]/g, '_').trim()
  return n.slice(0, 60) || 'record'
}

/** 导出用：与数据库行一一对应的完整对象（便于核对与留档） */
const flattenCompareLogForExport = (d: CompareLogDetail): Record<string, unknown> => ({
  id: d.id,
  base_doc_id: d.baseDocId ?? null,
  compare_doc_id: d.compareDocId ?? null,
  base_file_name: d.baseFileName ?? null,
  compare_file_name: d.compareFileName ?? null,
  similarity: d.similarity ?? null,
  risk_level: d.riskLevel ?? null,
  result_summary: d.resultSummary ?? null,
  process_time_ms: d.processTimeMs ?? null,
  token_usage: d.tokenUsage ?? null,
  saved_man_hours: d.savedManHours ?? null,
  create_by: d.createBy ?? null,
  create_time: d.createTime ?? null,
  report_pdf_object: d.reportPdfObject ?? null
})

/**
 * 离线 HTML：包含「人类可读全字段表」+「完整 JSON」。
 * 数据来源仅限表 doc_compare_log；不包含逐段 AI 明细、Diff HTML、原文二进制。
 */
const buildCompareRecordHtml = (d: CompareLogDetail): string => {
  const riskCls =
    d.riskLevel === 'HIGH' || d.riskLevel === 'MEDIUM' || d.riskLevel === 'LOW' ? d.riskLevel : 'LOW'
  const simRaw =
    d.similarity != null && !Number.isNaN(Number(d.similarity))
      ? Number(d.similarity).toFixed(6)
      : '（无）'
  const simPct =
    d.similarity != null && !Number.isNaN(Number(d.similarity))
      ? (Number(d.similarity) * 100).toFixed(2)
      : '—'
  const timeStr = d.createTime ? new Date(d.createTime).toLocaleString('zh-CN') : '（无）'
  const flat = flattenCompareLogForExport(d)
  const jsonBlock = escapeHtml(JSON.stringify(flat, null, 2))

  const rows: { label: string; value: string }[] = [
    { label: '记录主键 (id)', value: d.id != null && d.id !== undefined ? String(d.id) : '（无）' },
    { label: '基准文档 ID (base_doc_id)', value: displayOrDash(d.baseDocId) },
    { label: '对比文档 ID (compare_doc_id)', value: displayOrDash(d.compareDocId) },
    { label: '基准文件名 (base_file_name)', value: displayOrDash(d.baseFileName) },
    { label: '对比文件名 (compare_file_name)', value: displayOrDash(d.compareFileName) },
    { label: '相似度 0–1 (similarity)', value: String(simRaw) },
    { label: '相似度 %（换算）', value: simPct === '—' ? '（无）' : `${simPct}%` },
    { label: '风险等级 (risk_level)', value: displayOrDash(d.riskLevel) },
    { label: '分析摘要 (result_summary)', value: displayOrDash(d.resultSummary ?? undefined) },
    {
      label: '处理耗时 ms (process_time_ms)',
      value: d.processTimeMs != null ? String(d.processTimeMs) : '（无）'
    },
    { label: '估算 Token (token_usage)', value: d.tokenUsage != null ? String(d.tokenUsage) : '（无）' },
    {
      label: '预估节省工时 小时 (saved_man_hours)',
      value: d.savedManHours != null ? String(d.savedManHours) : '（无）'
    },
    { label: '操作人 (create_by)', value: displayOrDash(d.createBy ?? undefined) },
    { label: '对比时间 (create_time)', value: timeStr },
    {
      label: '报告 PDF 对象键 (report_pdf_object)',
      value: displayOrDash(d.reportPdfObject ?? undefined)
    }
  ]

  const tableBody = rows
    .map(
      (r) =>
        `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>文档对比记录 #${d.id}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", sans-serif; margin: 0; padding: 32px 16px; background: linear-gradient(160deg, #f1f5f9 0%, #e2e8f0 100%); color: #0f172a; }
    .wrap { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 28px 32px 32px; box-shadow: 0 4px 6px -1px rgb(15 23 42 / 0.07), 0 2px 4px -2px rgb(15 23 42 / 0.05); border: 1px solid #e2e8f0; }
    h1 { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 6px; color: #0f172a; }
    .muted { color: #64748b; font-size: 0.875rem; margin: 0 0 22px; line-height: 1.5; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.02em; }
    .badge-HIGH { background: #fee2e2; color: #b91c1c; }
    .badge-MEDIUM { background: #ffedd5; color: #c2410c; }
    .badge-LOW { background: #dcfce7; color: #15803d; }
    h2 { font-size: 0.95rem; font-weight: 600; color: #334155; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
    table.fields { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    table.fields th, table.fields td { text-align: left; padding: 11px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    table.fields th { width: 42%; color: #475569; font-weight: 600; background: #f8fafc; }
    table.fields td { color: #0f172a; word-break: break-word; }
    table.fields tr:last-child th, table.fields tr:last-child td { border-bottom: none; }
    .risk-inline { margin-left: 8px; }
    pre.json { margin: 0; padding: 16px; background: #0f172a; color: #e2e8f0; border-radius: 12px; font-size: 0.75rem; line-height: 1.55; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
    .note { margin-top: 20px; padding: 12px 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; font-size: 0.8rem; color: #92400e; line-height: 1.55; }
    footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 0.72rem; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>文档对比记录</h1>
    <p class="muted">记录编号 <strong>#${d.id}</strong> · 导出时间 ${escapeHtml(new Date().toLocaleString('zh-CN'))}<br />
    下表与 JSON 均来自数据库表 <code>doc_compare_log</code> 当前行的全部字段。</p>
    <p class="muted" style="margin-top:-12px">风险等级：<span class="badge badge-${riskCls}">${escapeHtml(d.riskLevel || '（无）')}</span></p>

    <h2>字段明细（全量）</h2>
    <table class="fields">
      <tbody>${tableBody}</tbody>
    </table>

    <h2>完整原始数据（JSON）</h2>
    <pre class="json">${jsonBlock}</pre>

    <div class="note"><strong>说明：</strong>此 HTML 仅反映库表字段快照。完整逐段分析请以服务端生成的 PDF 为准（字段 <code>report_pdf_object</code> 有值时可在记录页下载）。</div>

    <footer>由项目材料独创性智能审查系统根据 <code>doc_compare_log</code> 记录生成，仅供参考。</footer>
  </div>
</body>
</html>`
}

const downloadCompareRecord = async (row: RecentActivity) => {
  downloadingId.value = row.id
  try {
    const detail = await getCompareLogDetail(row.id)
    if (detail.reportPdfObject?.trim()) {
      const downloadUrl = await getCompareReportPdfUrl(row.id)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.download = `对比报告_${detail.id}_${safeFileStem(detail.baseFileName)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      showToast('已开始下载 PDF 报告')
      return
    }
    const html = buildCompareRecordHtml(detail)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `对比记录_${detail.id}_${safeFileStem(detail.baseFileName)}.html`
    a.click()
    URL.revokeObjectURL(url)
    showToast('该记录暂无 PDF，已下载 HTML 留档')
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

const riskBadgeClass = (risk: string) => {
  if (risk === 'HIGH') return 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200'
  if (risk === 'MEDIUM') return 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200'
  return 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200'
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
  <div class="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 via-slate-50 to-slate-100/90">
    <div class="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            文档对比记录
          </h1>
          <p class="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            展示您在本系统发起的文档智能对比历史（按时间倒序）。对比完成后若已生成 PDF，点击「下载记录」将打开 MinIO
            预签名链接下载报告；否则导出库表字段的 HTML 留档。
          </p>
        </div>
      </header>

      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="toast"
          role="status"
          class="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-slate-900/20"
        >
          {{ toast }}
        </div>
      </transition>

      <div
        v-if="error"
        class="rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100"
      >
        {{ error }}
      </div>

      <section
        class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5"
      >
        <div
          class="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-5 py-4 sm:px-6"
        >
          <h2 class="text-sm font-semibold uppercase tracking-wider text-slate-600">
            历史列表
          </h2>
          <span class="text-xs text-slate-500">{{ list.length }} 条</span>
        </div>

        <div class="overflow-x-auto">
          <div v-if="loading" class="flex items-center justify-center gap-3 px-6 py-16 text-slate-500">
            <span
              class="inline-block h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
              aria-hidden="true"
            />
            <span class="text-sm font-medium">加载中…</span>
          </div>

          <div
            v-else-if="list.length === 0"
            class="px-6 py-16 text-center text-sm text-slate-500"
          >
            暂无对比记录。请前往「文档对比」上传两份文档并开始分析。
          </div>

          <table v-else class="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th scope="col" class="whitespace-nowrap px-4 py-3.5 pl-5 sm:pl-6">
                  基准文档 (A)
                </th>
                <th scope="col" class="whitespace-nowrap px-4 py-3.5">
                  对比文档 (B)
                </th>
                <th scope="col" class="whitespace-nowrap px-4 py-3.5 text-center">
                  相似度
                </th>
                <th scope="col" class="whitespace-nowrap px-4 py-3.5 text-center">
                  风险
                </th>
                <th scope="col" class="whitespace-nowrap px-4 py-3.5 text-right">
                  时间
                </th>
                <th scope="col" class="whitespace-nowrap px-4 py-3.5 pr-5 text-right sm:pr-6">
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="row in list"
                :key="row.id"
                class="group transition-colors duration-200 hover:bg-indigo-50/[0.45]"
              >
                <td class="max-w-[200px] px-4 py-4 pl-5 sm:pl-6">
                  <div class="flex min-w-0 items-start gap-2">
                    <svg
                      class="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-indigo-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span class="truncate font-medium text-slate-900" :title="row.baseFileName">{{
                      row.baseFileName
                    }}</span>
                  </div>
                </td>
                <td class="max-w-[200px] px-4 py-4">
                  <div class="flex min-w-0 items-start gap-2">
                    <svg
                      class="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-indigo-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span class="truncate text-slate-600" :title="row.compareFileName">{{
                      row.compareFileName
                    }}</span>
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-4 text-center tabular-nums text-sm font-semibold text-slate-900">
                  {{ (Number(row.similarity) * 100).toFixed(1) }}%
                </td>
                <td class="px-4 py-4 text-center">
                  <span
                    class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    :class="riskBadgeClass(row.riskLevel)"
                  >
                    {{ row.riskLevel }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-4 py-4 text-right text-xs tabular-nums text-slate-500">
                  {{ formatTime(row.createTime) }}
                </td>
                <td class="whitespace-nowrap px-4 py-4 pr-5 text-right sm:pr-6">
                  <button
                    type="button"
                    class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition-colors duration-200 hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="downloadingId === row.id"
                    :aria-busy="downloadingId === row.id"
                    @click="downloadCompareRecord(row)"
                  >
                    <svg
                      v-if="downloadingId !== row.id"
                      class="h-3.5 w-3.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    <span
                      v-else
                      class="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
                      aria-hidden="true"
                    />
                    {{ downloadingId === row.id ? '准备中…' : '下载记录' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="text-center text-xs leading-relaxed text-slate-500">
        新版对比会在服务端生成含逐段分析的 PDF 并写入 MinIO（字段
        <code class="rounded bg-slate-200/60 px-1 py-0.5 text-slate-700">report_pdf_object</code>）。历史无 PDF
        的记录仍可下载 HTML（库表字段 + JSON）。
      </p>
    </div>
  </div>
</template>
