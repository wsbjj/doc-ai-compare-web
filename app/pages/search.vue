<script setup lang="ts">
import {ref} from 'vue'
import {searchKnowledgeBase, getFilePreviewUrl, compareWithKnowledgeBase, type SearchResultItem} from '../services/docCompareApi'

// --- 状态 ---
const query = ref('')
const selectedCategory = ref('all')
const loading = ref(false)
const hasSearched = ref(false)
const results = ref<SearchResultItem[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

const categories = [
  {label: '全部', value: 'all'},
  {label: '通用文档', value: 'general'},
  {label: '合同协议', value: 'contract'},
  {label: '规章制度', value: 'policy'},
  {label: '技术规范', value: 'technical'}
]

// --- 搜索 ---
const handleSearch = async () => {
  if (!query.value.trim()) return
  loading.value = true
  hasSearched.value = true
  results.value = []

  try {
    const data = await searchKnowledgeBase(query.value, selectedCategory.value)
    results.value = data
  } catch (e) {
    console.error(e)
    alert('搜索服务暂时不可用')
  } finally {
    loading.value = false
  }
}

// --- 上传检索 ---
const triggerFileUpload = () => {
  fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return

  const file = target.files[0]
  if (!file) return

  loading.value = true
  hasSearched.value = true
  results.value = []
  query.value = `📂 正在分析文档: ${file.name}`

  try {
    const data = await compareWithKnowledgeBase(file)
    results.value = data
  } catch (e) {
    console.error(e)
    alert('文档比对服务暂时不可用')
  } finally {
    loading.value = false
    target.value = '' // 重置 input
  }
}

// --- 预览 ---
const handlePreview = async (docId: string) => {
  if (!docId) return alert('文档ID缺失')
  try {
    const url = await getFilePreviewUrl(docId)
    window.open(url, '_blank')
  } catch (e) {
    alert('无法获取文件预览')
  }
}

// --- 样式辅助 ---
// 处理分数显示 (假设 0-1，转百分比)
const formatScore = (score: number) => {
  return (score * 100).toFixed(1) + '%'
}

const getScoreColor = (score: number) => {
  if (score > 0.8) return 'text-green-600 bg-green-50 border-green-200'
  if (score > 0.5) return 'text-indigo-600 bg-indigo-50 border-indigo-200'
  return 'text-gray-600 bg-gray-50 border-gray-200'
}

// 映射文件类型显示名称
const getFileTypeName = (type: string) => {
  const map: Record<string, string> = {
    general: '通用',
    contract: '合同',
    policy: '制度',
    technical: '技术'
  }
  return map[type] || type || '未知'
}
</script>

<template>
  <div class="p-8 max-w-5xl mx-auto min-h-full flex flex-col">

    <div class="text-center mb-10 space-y-6">
      <h1 class="text-3xl font-bold text-gray-800">🔍 智能文档检索</h1>
      <p class="text-gray-500">基于向量语义搜索，快速定位文档中的关键知识点。</p>

      <div class="max-w-2xl mx-auto bg-white p-1.5 rounded-2xl shadow-xl border border-gray-100 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all duration-300">
        <div class="flex items-center">
          
          <!-- 输入框容器 -->
          <div class="relative flex-1">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg class="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <input
                v-model="query"
                @keydown.enter="handleSearch"
                type="text"
                class="block w-full pl-12 pr-10 py-4 text-gray-900 placeholder-gray-400 bg-transparent border-none focus:ring-0 focus:outline-none text-lg"
                placeholder="请输入关键词，例如：'经费概算' 或 '非遗文化'"
            >
            <!-- 清除按钮 -->
            <button 
                v-if="query" 
                @click="query = ''"
                class="absolute inset-y-0 right-2 flex items-center p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 上传按钮 -->
          <button
              @click="triggerFileUpload"
              class="flex-shrink-0 ml-1 p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
              title="上传文档进行比对"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          <input 
            type="file" 
            ref="fileInput" 
            class="hidden" 
            @change="handleFileUpload"
            accept=".pdf,.doc,.docx,.txt"
          >

          <button
              @click="handleSearch"
              :disabled="loading || !query"
              class="flex-shrink-0 ml-2 px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-violet-700 hover:shadow-lg active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 whitespace-nowrap"
          >
            <svg v-if="loading" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ loading ? '搜索中' : '搜索' }}
          </button>
        </div>
      </div>

      <div class="flex justify-center gap-2 mt-4">
        <button
            v-for="cat in categories"
            :key="cat.value"
            @click="selectedCategory = cat.value"
            class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors border"
            :class="selectedCategory === cat.value
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : 'bg-white text-gray-500 border-transparent hover:bg-gray-100'"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <div class="flex-1">
      <div v-if="loading" class="space-y-4 max-w-4xl mx-auto">
        <div v-for="i in 3" :key="i" class="bg-white p-6 rounded-xl border border-gray-100 animate-pulse">
          <div class="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div class="h-20 bg-gray-100 rounded w-full"></div>
        </div>
      </div>

      <div v-else-if="hasSearched && results.length === 0" class="text-center py-20 text-gray-400">
        <div class="text-6xl mb-4">🍃</div>
        <p>未找到与 “{{ query }}” 相关的文档内容</p>
      </div>

      <div v-else class="space-y-6 max-w-4xl mx-auto">
        <transition-group name="list">
          <div v-for="(item, index) in results" :key="index"
               class="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">

            <div class="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
              <div class="flex items-center gap-3">
                <span class="w-8 h-8 flex items-center justify-center bg-white rounded border border-gray-200 text-lg">📄</span>
                <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-800 truncate max-w-md" :title="item.metadata?.file_name">
                    {{ item.metadata?.file_name || '未知文档' }}
                  </span>
                  <span class="text-xs text-gray-400 flex items-center gap-2">
                    ID: {{ item.metadata?.doc_id?.substring(0, 8) }}...
                    <span v-if="item.metadata?.file_type"
                          class="bg-gray-200 px-1.5 rounded text-gray-600 scale-90 origin-left">
                      {{ getFileTypeName(item.metadata.file_type) }}
                    </span>
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-4">
                <span class="text-xs px-2 py-1 rounded border font-mono font-bold" :class="getScoreColor(item.score)">
                  相似度: {{ formatScore(item.score) }}
                </span>
                <button
                    @click="handlePreview(item.metadata?.doc_id)"
                    class="text-sm text-indigo-600 hover:text-indigo-800 font-medium hover:underline flex items-center gap-1"
                >
                  预览
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div class="p-6 bg-white relative">
              <div class="text-gray-400 text-3xl absolute top-4 left-4 opacity-20">“</div>

              <div
                  class="text-sm text-gray-700 leading-relaxed font-mono whitespace-pre-wrap overflow-y-auto max-h-[300px] pl-6 border-l-2 border-indigo-100">
                {{ item.content }}
              </div>

              <div class="text-gray-400 text-3xl absolute bottom-4 right-4 opacity-20 transform rotate-180">“</div>
            </div>
          </div>
        </transition-group>
      </div>

    </div>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* 自定义滚动条 */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 3px;
}

::-webkit-scrollbar-track {
  background: transparent;
}
</style>