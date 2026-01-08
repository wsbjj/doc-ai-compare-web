<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { SegmentAnalysis, ComparisonSummary } from '~/services/docCompareApi'

const router = useRouter()

interface ReportData {
  fileA: string
  fileB: string
  diffHtml: string
  summaryData: ComparisonSummary
  detailList: SegmentAnalysis[]
  timestamp: string
}

const reportData = ref<ReportData | null>(null)
const isLoading = ref(true)

onMounted(() => {
  const data = sessionStorage.getItem('reportData')
  if (data) {
    try {
      reportData.value = JSON.parse(data)
    } catch (e) {
      console.error('报告数据解析失败:', e)
    }
  }
  isLoading.value = false
})

// 下载报告为HTML
const downloadReport = () => {
  if (!reportData.value) return

  const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>智能文档对比分析报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      text-align: center;
      color: #1f2937;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .header-info {
      text-align: center;
      color: #6b7280;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .summary-section {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 15px;
    }
    .summary-item {
      text-align: center;
    }
    .summary-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 8px;
      display: block;
    }
    .summary-value {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    .file-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .file-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 15px;
      background: #fafafa;
    }
    .file-card h3 {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .file-name {
      font-size: 14px;
      color: #1f2937;
      font-weight: 500;
      word-break: break-all;
    }
    .diff-section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    }
    .diff-wrapper {
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 20px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.8;
    }
    .diff-del {
      background-color: #ffe6e6;
      color: #b91c1c;
      text-decoration: line-through;
      padding: 0 4px;
      border-radius: 2px;
    }
    .diff-add {
      background-color: #dcfce7;
      color: #15803d;
      font-weight: bold;
      padding: 0 4px;
      border-radius: 2px;
    }
    .detail-list {
      margin-top: 15px;
    }
    .detail-item {
      border-left: 4px solid #3b82f6;
      background: #f0f9ff;
      border-radius: 4px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .detail-score {
      display: flex;
      gap: 20px;
      margin-bottom: 10px;
      font-size: 12px;
    }
    .detail-score-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .score-label {
      color: #6b7280;
    }
    .score-value {
      font-weight: bold;
      color: #1f2937;
    }
    .detail-text {
      font-size: 13px;
      color: #4b5563;
      margin-top: 8px;
      padding: 8px;
      background: white;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    .detail-text strong {
      color: #1f2937;
    }
    .conclusion {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
    }
    .conclusion-label {
      color: #6b7280;
      margin-bottom: 5px;
    }
    .conclusion-text {
      color: #1f2937;
      font-style: italic;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 12px;
    }
    @media print {
      body { background: white; }
      .container { box-shadow: none; }
    }
    @media (max-width: 768px) {
      .file-info { grid-template-columns: 1fr; }
      .summary-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📄 智能文档对比分析报告</h1>
    <div class="header-info">
      生成时间: ${reportData.value.timestamp}
    </div>

    <div class="summary-section">
      <h2 class="section-title">📊 对比概览</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">全局相似度</span>
          <span class="summary-value" style="color: #4f46e5;">${reportData.value.summaryData.globalVectorSimilarity.toFixed(1)}%</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">相似片段数</span>
          <span class="summary-value" style="color: #f97316;">${reportData.value.summaryData.totalSimilarSegments}</span>
        </div>
      </div>
    </div>

    <div class="file-info">
      <div class="file-card">
        <h3>基准文档 (File A)</h3>
        <div class="file-name">${reportData.value.fileA}</div>
      </div>
      <div class="file-card">
        <h3>对比文档 (File B)</h3>
        <div class="file-name">${reportData.value.fileB}</div>
      </div>
    </div>

    ${reportData.value.diffHtml ? `
    <div class="diff-section">
      <h2 class="section-title">🔍 全文差异比对报告</h2>
      <div class="diff-wrapper">
        ${reportData.value.diffHtml}
      </div>
    </div>
    ` : ''}

    ${reportData.value.detailList.length > 0 ? `
    <div class="diff-section">
      <h2 class="section-title">🤖 AI 智能分析建议</h2>
      <div class="detail-list">
        ${reportData.value.detailList.map((item, index) => `
        <div class="detail-item">
          <div style="font-weight: bold; margin-bottom: 8px;">片段 #${index + 1}</div>
          <div class="detail-score">
            <div class="detail-score-item">
              <span class="score-label">向量相似度:</span>
              <span class="score-value">${(item.vectorScore * 100).toFixed(1)}%</span>
            </div>
            <div class="detail-score-item">
              <span class="score-label">AI评分:</span>
              <span class="score-value">${(item.aiScore * 100).toFixed(1)}%</span>
            </div>
            <div class="detail-score-item">
              <span class="score-label">风险等级:</span>
              <span class="score-value" style="color: ${item.riskLevel === 'HIGH' ? '#dc2626' : item.riskLevel === 'MEDIUM' ? '#ea580c' : '#16a34a'}">${item.riskLevel}</span>
            </div>
          </div>
          <div class="detail-text">
            <strong>A文档:</strong> ${item.textA}
          </div>
          <div class="detail-text">
            <strong>B文档:</strong> ${item.textB}
          </div>
          <div class="detail-text">
            <strong>分析:</strong> ${item.analysis}
          </div>
          <div class="conclusion">
            <div class="conclusion-label">📋 结论:</div>
            <div class="conclusion-text">${item.conclusion}</div>
          </div>
        </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="footer">
      <p>本报告由智能文档对比系统自动生成，仅供参考。</p>
      <p style="margin-top: 10px;">© 2026 Smart Document Comparison System</p>
    </div>
  </div>
</body>
</html>
  `

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `报告_${new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-').replace(/:/g, '-')}.html`
  link.click()
  URL.revokeObjectURL(link.href)
}

// 返回首页
const backToHome = () => {
  router.push('/')
}

// 打印报告
const printReport = () => {
  window.print()
}

// 打印/导出为PDF - 使用浏览器打印功能
const exportToPdf = () => {
  if (!reportData.value) return

  // 生成打印友好的HTML
  const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>智能文档对比分析报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
      background: white;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 40px;
    }
    h1 {
      text-align: center;
      color: #1f2937;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .header-info {
      text-align: center;
      color: #6b7280;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .summary-section {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 15px;
    }
    .summary-item {
      text-align: center;
    }
    .summary-label {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 8px;
      display: block;
    }
    .summary-value {
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
    }
    .file-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    .file-card {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 15px;
      background: #fafafa;
    }
    .file-card h3 {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .file-name {
      font-size: 14px;
      color: #1f2937;
      font-weight: 500;
      word-break: break-all;
    }
    .diff-section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e7eb;
    }
    .diff-wrapper {
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 20px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.8;
    }
    .detail-list {
      margin-top: 15px;
    }
    .detail-item {
      border-left: 4px solid #3b82f6;
      background: #f0f9ff;
      border-radius: 4px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .detail-score {
      display: flex;
      gap: 20px;
      margin-bottom: 10px;
      font-size: 12px;
      flex-wrap: wrap;
    }
    .detail-text {
      font-size: 13px;
      color: #4b5563;
      margin-top: 8px;
      padding: 8px;
      background: white;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
    }
    .detail-text strong {
      color: #1f2937;
    }
    .conclusion {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
    }
    .conclusion-label {
      color: #6b7280;
      margin-bottom: 5px;
    }
    .conclusion-text {
      color: #1f2937;
      font-style: italic;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 12px;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { padding: 10mm; box-shadow: none; }
      .file-info, .detail-item, .diff-section, .summary-section {
        page-break-inside: avoid;
      }
    }
    @media (max-width: 768px) {
      .file-info { grid-template-columns: 1fr; }
      .summary-grid { grid-template-columns: 1fr; }
      .detail-score { flex-direction: column; gap: 5px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📄 智能文档对比分析报告</h1>
    <div class="header-info">
      生成时间: ${reportData.value.timestamp}
    </div>

    <div class="summary-section">
      <h2 class="section-title">📊 对比概览</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">全局相似度</span>
          <span class="summary-value" style="color: #4f46e5;">${reportData.value.summaryData.globalVectorSimilarity.toFixed(1)}%</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">相似片段数</span>
          <span class="summary-value" style="color: #f97316;">${reportData.value.summaryData.totalSimilarSegments}</span>
        </div>
      </div>
    </div>

    <div class="file-info">
      <div class="file-card">
        <h3>基准文档 (File A)</h3>
        <div class="file-name">${reportData.value.fileA}</div>
      </div>
      <div class="file-card">
        <h3>对比文档 (File B)</h3>
        <div class="file-name">${reportData.value.fileB}</div>
      </div>
    </div>

    ${reportData.value.diffHtml ? `
    <div class="diff-section">
      <h2 class="section-title">🔍 全文差异比对报告</h2>
      <div class="diff-wrapper">
        ${reportData.value.diffHtml}
      </div>
    </div>
    ` : ''}

    ${reportData.value.detailList.length > 0 ? `
    <div class="diff-section">
      <h2 class="section-title">🤖 AI 智能分析建议</h2>
      <div class="detail-list">
        ${reportData.value.detailList.map((item, index) => `
        <div class="detail-item">
          <div style="font-weight: bold; margin-bottom: 8px;">片段 #${index + 1}</div>
          <div class="detail-score">
            <div><span style="color: #6b7280;">向量相似度:</span> <span style="font-weight: bold;">${(item.vectorScore * 100).toFixed(1)}%</span></div>
            <div><span style="color: #6b7280;">AI评分:</span> <span style="font-weight: bold;">${(item.aiScore * 100).toFixed(1)}%</span></div>
            <div><span style="color: #6b7280;">风险等级:</span> <span style="font-weight: bold;">${item.riskLevel}</span></div>
          </div>
          <div class="detail-text"><strong>A文档:</strong> ${item.textA}</div>
          <div class="detail-text"><strong>B文档:</strong> ${item.textB}</div>
          <div class="detail-text"><strong>分析:</strong> ${item.analysis}</div>
          <div class="conclusion">
            <div class="conclusion-label">📋 结论:</div>
            <div class="conclusion-text">${item.conclusion}</div>
          </div>
        </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
      <p>本报告由智能文档对比系统自动生成，仅供参考。</p>
      <p style="margin-top: 10px;">© 2026 Smart Document Comparison System</p>
    </div>
  </div>
  <script>
    // 打开后显示提示信息
    window.addEventListener('load', () => {
      alert('📄 报告已加载完成！\\n\\n请使用快捷键 Ctrl+P (Windows) 或 Cmd+P (Mac) 打开打印对话框\\n\\n然后选择 "另存为 PDF" 即可完成导出')
    })
  <` + `/script>
</body>
</html>
  `

  // 打开新窗口并显示报告
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
    <div class="max-w-4xl mx-auto">
      <!-- 工具栏 -->
      <div class="mb-6 flex gap-3 justify-center flex-wrap">
        <button
          @click="backToHome"
          class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          返回
        </button>
        <button
          id="pdfExportBtn"
          @click="exportToPdf"
          class="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors print:hidden"
          title="打印或导出为PDF（点击后使用浏览器打印功能，选择'另存为PDF'）"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
          </svg>
          打印/导出PDF
        </button>
        <button
          @click="downloadReport"
          class="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors print:hidden font-medium"
          title="导出为HTML文件"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          HTML
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading || !reportData" class="bg-white rounded-lg shadow-lg p-12 text-center">
        <div v-if="isLoading" class="space-y-4">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p class="text-gray-500">加载报告中...</p>
        </div>
        <div v-else class="space-y-4">
          <p class="text-red-500 text-lg">❌ 未找到报告数据</p>
          <button @click="backToHome" class="text-indigo-600 hover:underline">返回首页</button>
        </div>
      </div>

      <!-- 报告内容 -->
      <div v-else class="space-y-6">
        <!-- 标题 -->
        <div class="bg-white rounded-lg shadow-lg p-8 text-center border-b-4 border-indigo-600">
          <h1 class="text-3xl font-bold text-gray-800 mb-2">📄 智能文档对比分析报告</h1>
          <p class="text-gray-500">生成时间: {{ reportData.timestamp }}</p>
        </div>

        <!-- 报告主体 -->
        <div class="report-container">

        <!-- 概览 -->
        <div class="bg-white rounded-lg shadow-lg p-8">
          <h2 class="text-xl font-bold text-gray-800 mb-6 pb-3 border-b-2 border-gray-200">📊 对比概览</h2>
          <div class="grid grid-cols-2 gap-8">
            <div class="text-center">
              <p class="text-gray-500 text-sm mb-2">全局相似度</p>
              <p class="text-4xl font-bold text-indigo-600">{{ reportData.summaryData.globalVectorSimilarity.toFixed(1) }}%</p>
            </div>
            <div class="text-center">
              <p class="text-gray-500 text-sm mb-2">相似片段数</p>
              <p class="text-4xl font-bold text-orange-500">{{ reportData.summaryData.totalSimilarSegments }}</p>
            </div>
          </div>
        </div>

        <!-- 文件信息 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h3 class="text-sm text-gray-500 mb-3 font-semibold">基准文档 (File A)</h3>
            <p class="text-gray-800 font-medium break-all">{{ reportData.fileA }}</p>
          </div>
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h3 class="text-sm text-gray-500 mb-3 font-semibold">对比文档 (File B)</h3>
            <p class="text-gray-800 font-medium break-all">{{ reportData.fileB }}</p>
          </div>
        </div>

        <!-- Diff内容 -->
        <div v-if="reportData.diffHtml" class="bg-white rounded-lg shadow-lg p-8">
          <h2 class="text-xl font-bold text-gray-800 mb-6 pb-3 border-b-2 border-gray-200">🔍 全文差异比对报告</h2>
          <div class="bg-gray-50 rounded p-4 overflow-x-auto border border-gray-200 prose prose-sm max-w-none" v-html="reportData.diffHtml"></div>
        </div>

        <!-- AI分析详情 -->
        <div v-if="reportData.detailList.length > 0" class="bg-white rounded-lg shadow-lg p-8">
          <h2 class="text-xl font-bold text-gray-800 mb-6 pb-3 border-b-2 border-gray-200">🤖 AI 智能分析建议</h2>
          <div class="space-y-6">
            <div v-for="(item, index) in reportData.detailList" :key="item.id" class="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
              <div class="font-bold text-gray-800 mb-3">片段 #{{ index + 1 }}</div>
              
              <div class="flex gap-6 text-sm mb-4">
                <div>
                  <span class="text-gray-500">向量相似度:</span>
                  <span class="font-bold text-gray-800 ml-1">{{ (item.vectorScore * 100).toFixed(1) }}%</span>
                </div>
                <div>
                  <span class="text-gray-500">AI评分:</span>
                  <span class="font-bold text-gray-800 ml-1">{{ (item.aiScore * 100).toFixed(1) }}%</span>
                </div>
                <div>
                  <span class="text-gray-500">风险等级:</span>
                  <span :class="{
                    'font-bold ml-1': true,
                    'text-red-600': item.riskLevel === 'HIGH',
                    'text-orange-600': item.riskLevel === 'MEDIUM',
                    'text-green-600': item.riskLevel === 'LOW'
                  }">{{ item.riskLevel }}</span>
                </div>
              </div>

              <div class="space-y-3 text-sm">
                <div class="bg-white p-3 rounded border border-gray-200">
                  <strong class="text-gray-700">A文档:</strong>
                  <p class="text-gray-600 mt-1">{{ item.textA }}</p>
                </div>
                <div class="bg-white p-3 rounded border border-gray-200">
                  <strong class="text-gray-700">B文档:</strong>
                  <p class="text-gray-600 mt-1">{{ item.textB }}</p>
                </div>
                <div class="bg-white p-3 rounded border border-gray-200">
                  <strong class="text-gray-700">分析:</strong>
                  <p class="text-gray-600 mt-1">{{ item.analysis }}</p>
                </div>
                <div class="bg-indigo-100 p-3 rounded border border-indigo-300">
                  <strong class="text-indigo-800">📋 结论:</strong>
                  <p class="text-indigo-700 mt-1 italic">{{ item.conclusion }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 页脚 -->
        <div class="text-center text-gray-500 text-sm py-6">
          <p>本报告由智能文档对比系统自动生成，仅供参考。</p>
          <p class="mt-2">© 2026 Smart Document Comparison System</p>
        </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  button {
    display: none !important;
  }
}

/* PDF导出优化 */
.report-container {
  background: white;
}

.report-container > div {
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-container h2 {
  break-after: avoid;
  page-break-after: avoid;
}

/* 确保表格和内容在PDF中正确显示 */
.report-container .prose {
  break-inside: avoid;
  page-break-inside: avoid;
}

.report-container .space-y-6 > div {
  break-inside: avoid;
  page-break-inside: avoid;
}
</style>
