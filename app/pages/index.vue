<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
// @ts-ignore Vetur: Vue SFC default export typing
import AiAnalysisCard from '../components/AiAnalysisCard.vue'
import {
  fetchDocDiffHtml,
  streamAiAnalysis,
  saveFileToKnowledgeBase, // 🆕 引入新API
  type SegmentAnalysis,
  type ComparisonSummary
} from '../services/docCompareApi'

// --- 路由 ---
const router = useRouter()

// --- 状态变量 ---
const fileA = ref<File | null>(null)
const fileB = ref<File | null>(null)

const compareResultHtml = ref<string>('')
const loading = ref(false)
const diffLoading = ref(false)
const errorMsg = ref('')
const summaryData = ref<ComparisonSummary | null>(null)
const detailList = ref<SegmentAnalysis[]>([])

// 🆕 新增：保存按钮的 Loading 状态
const savingA = ref(false)
const savingB = ref(false)

const toastMsg = ref('')
const showToastVisible = ref(false)

const canSubmit = computed(() => fileA.value && fileB.value)

// --- 辅助工具 ---
const showToast = (msg: string) => {
  toastMsg.value = msg
  showToastVisible.value = true
  setTimeout(() => { showToastVisible.value = false }, 3000)
}

// --- 文件处理 ---
const handleFileChange = (event: Event, type: 'A' | 'B') => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const selectedFile = target.files[0]
    if (type === 'A') fileA.value = selectedFile
    else fileB.value = selectedFile

    // 重置界面状态
    compareResultHtml.value = ''
    errorMsg.value = ''
    detailList.value = []
    summaryData.value = null
  }
}

// 🆕 新增：处理保存到向量库
const handleSaveToKb = async (file: File, type: 'A' | 'B') => {
  if (!file) return

  // 设置对应的 loading 状态
  if (type === 'A') savingA.value = true
  else savingB.value = true

  try {
    const res = await saveFileToKnowledgeBase(file, 'contract_review')

    // ✅ 修复：res 里没有 message，我们直接硬编码成功提示，或者使用 docId
    // 如果你想显示后端的最外层 message，你需要修改 http.ts 不做彻底解包（不推荐），
    // 或者简单地在这里写死 "保存成功"
    showToast(`✅ 保存成功 (ID: ${res.docId})`)

  } catch (e: any) {
    showToast(`❌ 保存失败: ${e.message}`)
  } finally {
    if (type === 'A') savingA.value = false
    else savingB.value = false
  }
}

// --- 核心业务逻辑 ---
const startProcess = async () => {
  if (!fileA.value || !fileB.value) return

  const fileAFile = fileA.value as File
  const fileBFile = fileB.value as File

  loading.value = true
  diffLoading.value = true
  errorMsg.value = ''
  summaryData.value = null
  detailList.value = []
  compareResultHtml.value = ''

  // 1. 任务 A: 请求 Diff HTML
  const diffTask = (async () => {
      try {
        const data: any = await fetchDocDiffHtml(fileAFile, fileBFile)
        compareResultHtml.value = data.diffHtml
      } catch (err: any) {
        console.error("Diff Error:", err)
        compareResultHtml.value = `<div class="p-4 text-red-500 border border-red-200 rounded">Diff 失败: ${err.message}</div>`
      } finally {
        diffLoading.value = false
      }
    })()

  // 2. 任务 B: 启动 AI 流式分析
  const aiTask = handleAiStream()

  await Promise.all([diffTask, aiTask])
}

// 处理 AI 流数据的 UI 缓冲逻辑
const handleAiStream = async () => {
  if (!fileA.value || !fileB.value) return

  let tempBuffer: SegmentAnalysis[] = []
  let flushTimer: any = null

  const flushBuffer = () => {
    if (tempBuffer.length > 0) {
      detailList.value.push(...tempBuffer)
      tempBuffer = []
    }
  }

  try {
    await streamAiAnalysis(fileA.value, fileB.value, (event) => {
      if (event.type === 'SUMMARY') {
        summaryData.value = event.data as ComparisonSummary
      } else if (event.type === 'DETAIL') {
        tempBuffer.push(event.data as SegmentAnalysis)
        if (detailList.value.length < 3 || tempBuffer.length >= 5) {
          if (flushTimer) clearTimeout(flushTimer)
          flushBuffer()
          flushTimer = null
        } else if (!flushTimer) {
          flushTimer = setTimeout(() => {
            flushBuffer()
            flushTimer = null
          }, 100)
        }
      } else if (event.type === 'ERROR') {
        errorMsg.value = event.data || 'AI 分析错误'
      }
    })
  } catch (err: any) {
    console.warn("Stream Process Error:", err)
    if (!errorMsg.value) errorMsg.value = "AI 分析中断，请检查网络"
  } finally {
    if (flushTimer) clearTimeout(flushTimer)
    flushBuffer()
    loading.value = false
  }
}

// --- 交互功能 ---
const scrollToDiff = (id: number) => {
  showToast(`AI 提示片段 #${id}：请在上方 Diff 视图中查找对应差异。`)
}

// 导出报告
const exportReport = () => {
  if (!summaryData.value || !fileA.value || !fileB.value) return

  // 检查是否还在加载中
  if (loading.value) {
    showToast('⏳ 报告生成中，请等待完毕后再导出')
    return
  }

  const reportData = {
    fileA: fileA.value.name,
    fileB: fileB.value.name,
    diffHtml: compareResultHtml.value,
    summaryData: summaryData.value,
    detailList: detailList.value,
    timestamp: new Date().toLocaleString('zh-CN')
  }

  // 将报告数据存储到sessionStorage
  sessionStorage.setItem('reportData', JSON.stringify(reportData))
  
  // 打开新窗口显示报告
  router.push('/report')
}
</script>

<template>
  <div class="py-10 px-4 relative">

    <transition name="fade">
      <div v-if="showToastVisible" class="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 z-[100]">
        <span class="text-sm font-medium">{{ toastMsg }}</span>
      </div>
    </transition>

    <div class="max-w-7xl mx-auto space-y-8">
      <h1 class="text-3xl font-bold text-gray-800 text-center">📄 智能文档对比系统</h1>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">

        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <h3 class="font-semibold text-lg text-gray-700 mb-4 flex items-center justify-between">
            <div class="flex items-center">
              <span class="w-2 h-6 bg-blue-500 rounded mr-2"></span> 基准文档 (File A)
            </div>
          </h3>
          <label class="block w-full cursor-pointer">
            <div class="border-2 border-dashed border-blue-200 rounded-lg p-8 hover:bg-blue-50 transition-colors text-center group">
              <span class="text-blue-500 font-medium group-hover:text-blue-600">点击上传 .doc/.docx/.pdf/.txt</span>
              <input type="file" class="hidden" @change="e => handleFileChange(e, 'A')" accept=".doc,.docx,.pdf,.txt"/>
            </div>
          </label>

          <div v-if="fileA" class="mt-4 bg-green-50 p-3 rounded-lg border border-green-100 flex items-center justify-between">
            <div class="flex items-center gap-2 overflow-hidden">
              <span class="text-lg">📄</span>
              <span class="text-sm text-green-700 font-medium truncate" :title="fileA.name">{{ fileA.name }}</span>
            </div>

            <button
                @click.stop="handleSaveToKb(fileA, 'A')"
                :disabled="savingA"
                class="flex-shrink-0 flex items-center gap-1 bg-white border border-green-200 text-green-600 text-xs px-3 py-1.5 rounded hover:bg-green-100 hover:text-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="savingA" class="animate-spin h-3 w-3" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path></svg>
              <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
              {{ savingA ? '保存中...' : '入库' }}
            </button>
          </div>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
          <h3 class="font-semibold text-lg text-gray-700 mb-4 flex items-center justify-between">
            <div class="flex items-center">
              <span class="w-2 h-6 bg-orange-500 rounded mr-2"></span> 对比文档 (File B)
            </div>
          </h3>
          <label class="block w-full cursor-pointer">
            <div class="border-2 border-dashed border-orange-200 rounded-lg p-8 hover:bg-orange-50 transition-colors text-center group">
              <span class="text-orange-500 font-medium group-hover:text-orange-600">点击上传 .doc/.docx/.pdf/.txt</span>
              <input type="file" class="hidden" @change="e => handleFileChange(e, 'B')" accept=".doc,.docx,.pdf,.txt"/>
            </div>
          </label>

          <div v-if="fileB" class="mt-4 bg-green-50 p-3 rounded-lg border border-green-100 flex items-center justify-between">
            <div class="flex items-center gap-2 overflow-hidden">
              <span class="text-lg">📄</span>
              <span class="text-sm text-green-700 font-medium truncate" :title="fileB.name">{{ fileB.name }}</span>
            </div>

            <button
                @click.stop="handleSaveToKb(fileB, 'B')"
                :disabled="savingB"
                class="flex-shrink-0 flex items-center gap-1 bg-white border border-green-200 text-green-600 text-xs px-3 py-1.5 rounded hover:bg-green-100 hover:text-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="savingB" class="animate-spin h-3 w-3" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path></svg>
              <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
              {{ savingB ? '保存中...' : '入库' }}
            </button>
          </div>
        </div>
      </div>

      <div class="max-w-2xl mx-auto text-center">
        <button
            @click="startProcess"
            :disabled="!canSubmit || loading"
            class="w-full py-4 text-lg font-bold text-white rounded-xl shadow-lg transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            :class="loading ? 'grayscale cursor-wait' : ''"
        >
          <span v-if="loading" class="flex items-center justify-center gap-2">
            <svg class="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            AI 正在深度分析中...
          </span>
          <span v-else>🚀 开始智能对比分析</span>
        </button>
        <p v-if="errorMsg" class="mt-4 text-red-500 bg-red-50 py-2 px-4 rounded inline-block border border-red-100">{{ errorMsg }}</p>
      </div>

      <div v-if="compareResultHtml || detailList.length > 0" class="space-y-8 animate-fade-in pb-20">

        <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div class="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 class="font-bold text-xl text-gray-800 flex items-center gap-2">
              <span>🔍 全文差异比对报告</span>
              <span class="text-xs font-normal text-gray-500 ml-2 bg-white px-2 py-1 rounded border border-gray-200">红色删除线为A文档内容，绿色为B文档新增</span>
            </h3>
            <span v-if="diffLoading" class="text-sm text-blue-500 flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full">
              <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path></svg>
              正在渲染高亮差异...
            </span>
          </div>

          <div class="p-8 overflow-x-auto min-h-[400px] max-h-[800px] overflow-y-auto relative bg-white">
            <div v-if="diffLoading && !compareResultHtml" class="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
              <div class="animate-bounce text-4xl mb-4">📄</div>
              <p class="text-gray-400">正在生成像素级差异比对...</p>
            </div>
            <div class="diff-wrapper prose max-w-none" v-html="compareResultHtml"></div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="flex flex-col md:flex-row md:items-center justify-between border-l-4 border-indigo-600 pl-4 gap-4">
            <h2 class="text-2xl font-bold text-gray-800">🤖 AI 智能分析建议</h2>
            <transition name="fade">
              <div v-if="summaryData" class="flex gap-6 bg-white px-6 py-3 rounded-lg shadow-sm border border-gray-100">
                <div class="text-center">
                  <span class="text-xs text-gray-400 block mb-1">全局相似度</span>
                  <span class="text-xl font-bold text-indigo-600">{{ summaryData.globalVectorSimilarity.toFixed(1) }}%</span>
                </div>
                <div class="w-px bg-gray-200"></div>
                <div class="text-center">
                  <span class="text-xs text-gray-400 block mb-1">相似片段数</span>
                  <span class="text-xl font-bold text-orange-500">{{ summaryData.totalSimilarSegments }}</span>
                </div>
                <div class="w-px bg-gray-200"></div>
                <button
                  @click="exportReport"
                  class="flex-shrink-0 flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs px-4 py-2 rounded hover:bg-indigo-100 transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2m0 0v-8m0 8l-6-4m6 4l6-4"></path>
                  </svg>
                  导出报告
                </button>
              </div>
            </transition>
          </div>

          <transition-group name="list" tag="div" class="flex flex-col gap-6">
            <AiAnalysisCard
                v-for="(item, index) in detailList"
                :key="item.id"
                :item="item"
                :index="index"
                @click="scrollToDiff"
            />
          </transition-group>

          <div v-if="loading" class="text-center py-8">
            <span class="inline-block animate-pulse text-gray-400 text-sm bg-gray-100 px-4 py-2 rounded-full">AI 正在逐条分析并生成报告...</span>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style>
/* 动画 */
.list-enter-active, .list-leave-active { transition: all 0.5s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateY(20px); }
.fade-enter-active { transition: opacity 0.5s ease; }
.fade-enter-from { opacity: 0; }
.animate-fade-in { animation: fadeIn 0.5s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* 后端 Diff HTML 样式兜底 */
.diff-wrapper {
  font-family: 'Consolas', 'Monaco', 'Microsoft YaHei', sans-serif;
  line-height: 1.8;
  font-size: 15px;
  color: #333;
}
.diff-wrapper ::v-deep .diff-del {
  background-color: #ffe6e6;
  color: #b91c1c;
  text-decoration: line-through;
  padding: 0 4px;
  border-radius: 2px;
}
.diff-wrapper ::v-deep .diff-add {
  background-color: #dcfce7;
  color: #15803d;
  font-weight: bold;
  padding: 0 4px;
  border-radius: 2px;
}
.diff-wrapper ::v-deep table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
}
.diff-wrapper ::v-deep td, .diff-wrapper ::v-deep th {
  border: 1px solid #e2e8f0;
  padding: 8px;
}
</style>