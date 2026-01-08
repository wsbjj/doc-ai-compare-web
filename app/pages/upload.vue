<script setup lang="ts">
import { ref } from 'vue'
import { saveFileToKnowledgeBase } from '../services/docCompareApi'

// 定义上传文件状态接口
interface UploadFileItem {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  message?: string
}

const uploadQueue = ref<UploadFileItem[]>([])
const selectedCategory = ref('general')
const isDragging = ref(false)

// 文档分类选项
const categories = [
  { label: '通用文档', value: 'general' },
  { label: '合同协议', value: 'contract' },
  { label: '规章制度', value: 'policy' },
  { label: '技术规范', value: 'technical' }
]

// --- 拖拽交互 ---
const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = true
}
const handleDragLeave = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
}
const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  if (e.dataTransfer?.files) {
    addFilesToQueue(e.dataTransfer.files)
  }
}
const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    addFilesToQueue(target.files)
  }
}

// --- 核心逻辑 ---
const addFilesToQueue = (fileList: FileList) => {
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList.item(i)
    if (!file) continue
    // 过滤非文档类型 (可选)
    // if (!file.name.match(/\.(doc|docx|pdf|txt)$/)) continue;

    uploadQueue.value.unshift({
      file,
      id: Math.random().toString(36).substring(2),
      status: 'pending',
      progress: 0
    })
  }
  // 自动开始上传
  processQueue()
}

const processQueue = async () => {
  // 找到所有 pending 的文件并行上传
  const pendingFiles = uploadQueue.value.filter(item => item.status === 'pending')

  pendingFiles.forEach(async (item) => {
    item.status = 'uploading'
    item.progress = 50 // 模拟进度，因为 fetch 没有原生 upload progress

    try {
      // 调用我们在 service 中封装的 API
      const res = await saveFileToKnowledgeBase(item.file, selectedCategory.value)

      item.progress = 100
      item.status = 'success'
      item.message = `入库成功 (ID: ${res.docId})`
    } catch (error: any) {
      item.status = 'error'
      item.progress = 0
      item.message = error.message || '上传失败'
    }
  })
}

// 移除单个记录
const removeRecord = (id: string) => {
  uploadQueue.value = uploadQueue.value.filter(item => item.id !== id)
}

// 状态样式辅助
const getStatusColor = (status: string) => {
  switch(status) {
    case 'success': return 'text-green-600 bg-green-50 border-green-100'
    case 'error': return 'text-red-600 bg-red-50 border-red-100'
    case 'uploading': return 'text-blue-600 bg-blue-50 border-blue-100'
    default: return 'text-gray-600 bg-gray-50 border-gray-100'
  }
}
</script>

<template>
  <div class="p-8 max-w-5xl mx-auto space-y-8">

    <div>
      <h1 class="text-2xl font-bold text-gray-800">📂 知识库入库管理</h1>
      <p class="text-gray-500 text-sm mt-1">上传基准文档到向量数据库，构建 AI 对比的“大脑”。</p>
    </div>

    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">

      <div class="mb-6 flex items-center gap-4">
        <span class="text-sm font-bold text-gray-700">入库分类：</span>
        <div class="flex gap-2">
          <button
              v-for="cat in categories"
              :key="cat.value"
              @click="selectedCategory = cat.value"
              class="px-4 py-2 rounded-lg text-sm transition-all border"
              :class="selectedCategory === cat.value
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'"
          >
            {{ cat.label }}
          </button>
        </div>
      </div>

      <div
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          class="border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 relative group"
          :class="isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'"
      >
        <input
            type="file"
            multiple
            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            @change="handleFileSelect"
            accept=".doc,.docx,.pdf,.txt"
        />

        <div class="pointer-events-none">
          <div class="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            ☁️
          </div>
          <h3 class="text-lg font-medium text-gray-700">点击或拖拽文件到此处</h3>
          <p class="text-gray-400 text-sm mt-2">支持 .docx, .doc, .pdf 等格式 (支持批量)</p>
        </div>
      </div>
    </div>

    <div v-if="uploadQueue.length > 0" class="space-y-4">
      <h3 class="font-bold text-gray-700 flex items-center gap-2">
        <span>📋 上传队列</span>
        <span class="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{{ uploadQueue.length }}</span>
      </h3>

      <transition-group name="list" tag="div" class="space-y-3">
        <div
            v-for="item in uploadQueue"
            :key="item.id"
            class="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-100 shadow-sm"
        >
          <div class="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
            📄
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex justify-between mb-1">
              <p class="text-sm font-medium text-gray-800 truncate">{{ item.file.name }}</p>
              <span class="text-xs" :class="item.status === 'error' ? 'text-red-500' : 'text-gray-400'">
                {{ item.status === 'uploading' ? '正在入库...' : (item.message || formatSize(item.file.size)) }}
              </span>
            </div>

            <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                  class="h-full transition-all duration-500 rounded-full"
                  :class="item.status === 'error' ? 'bg-red-500' : 'bg-indigo-500'"
                  :style="`width: ${item.progress}%`"
              ></div>
            </div>
          </div>

          <div class="flex-shrink-0">
            <button
                v-if="item.status === 'success' || item.status === 'error'"
                @click="removeRecord(item.id)"
                class="text-gray-400 hover:text-red-500 p-2"
            >
              ✕
            </button>
            <span v-else class="text-xs font-bold px-2 py-1 rounded border" :class="getStatusColor(item.status)">
              {{ item.status.toUpperCase() }}
            </span>
          </div>
        </div>
      </transition-group>
    </div>

  </div>
</template>

<script lang="ts">
// 辅助函数：文件大小格式化
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>