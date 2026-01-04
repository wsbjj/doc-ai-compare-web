<script setup lang="ts">
import { ref } from 'vue'

// --- 1. 核心业务指标 (模拟数据) ---
const coreMetrics = ref([
  {
    label: '今日对比次数',
    value: 42,
    unit: '次',
    icon: '⚡',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    trend: '+12% 较昨日'
  },
  {
    label: '平均相似度',
    value: 38.5,
    unit: '%',
    icon: '📊',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    trend: '-2.1% 较昨日'
  },
  {
    label: '高风险预警',
    value: 3,
    unit: '个',
    icon: '🚨',
    color: 'text-red-600',
    bg: 'bg-red-50',
    trend: '需关注'
  },
  {
    label: '知识库文档',
    value: 1284,
    unit: '份',
    icon: '📚',
    color: 'text-green-600',
    bg: 'bg-green-50',
    trend: '+15 本周新增'
  }
])

// --- 2. 效率与性能 (模拟数据) ---
const performanceMetrics = ref([
  {
    label: 'AI 响应平均耗时',
    value: '1.5',
    unit: 's/篇',
    desc: '基于高性能 GPU 集群加速',
    progress: 85, // 进度条长度
    color: 'bg-emerald-500'
  },
  {
    label: '累计节省人工工时',
    value: '128',
    unit: '小时',
    desc: '按人工阅读速度 500字/分钟 估算',
    progress: 60,
    color: 'bg-orange-500'
  }
])

// --- 3. 最近动态 (模拟数据) ---
const recentActivities = ref([
  { id: 101, fileA: '2024项目申报书_v1.doc', fileB: '2024项目申报书_v2.doc', time: '10分钟前', risk: 'LOW', similarity: '98.2%' },
  { id: 102, fileA: '合同模板_标准版.docx', fileB: '供应商合同_修改版.docx', time: '35分钟前', risk: 'HIGH', similarity: '76.5%' },
  { id: 103, fileA: '技术规格书A.doc', fileB: '技术规格书B.doc', time: '1小时前', risk: 'MEDIUM', similarity: '88.1%' },
  { id: 104, fileA: '员工手册2023.pdf', fileB: '员工手册2024.pdf', time: '2小时前', risk: 'LOW', similarity: '92.4%' },
  { id: 105, fileA: '产品介绍.pptx', fileB: '产品介绍_新.pptx', time: '3小时前', risk: 'LOW', similarity: '15.3%' },
])

const getRiskBadge = (risk: string) => {
  if (risk === 'HIGH') return 'bg-red-100 text-red-700 border-red-200'
  if (risk === 'MEDIUM') return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-green-100 text-green-700 border-green-200'
}
</script>

<template>
  <div class="p-8 max-w-7xl mx-auto space-y-8">

    <div class="mb-2">
      <h2 class="text-2xl font-bold text-gray-800">👋 欢迎回来，管理员，DEMO！DEMO！</h2>
      <p class="text-gray-500 text-sm mt-1">这里是系统的实时运行状态概览。</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div v-for="item in coreMetrics" :key="item.label"
           class="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
        <div class="flex justify-between items-start mb-4">
          <div :class="`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${item.bg}`">
            {{ item.icon }}
          </div>
          <span class="text-xs font-medium px-2 py-1 rounded bg-gray-50 text-gray-500">{{ item.trend }}</span>
        </div>
        <div>
          <p class="text-sm text-gray-500 mb-1">{{ item.label }}</p>
          <div class="flex items-baseline gap-1">
            <span :class="`text-3xl font-bold ${item.color}`">{{ item.value }}</span>
            <span class="text-sm text-gray-400">{{ item.unit }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6 lg:col-span-1 flex flex-col justify-center">
        <h3 class="font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span>🚀</span> 系统效能
        </h3>
        <div class="space-y-8">
          <div v-for="stat in performanceMetrics" :key="stat.label">
            <div class="flex justify-between items-end mb-2">
              <span class="text-sm text-gray-500">{{ stat.label }}</span>
              <span class="text-xl font-bold text-gray-800">{{ stat.value }} <small class="text-xs font-normal text-gray-400">{{ stat.unit }}</small></span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2.5 mb-2">
              <div :class="`h-2.5 rounded-full ${stat.color}`" :style="`width: ${stat.progress}%`"></div>
            </div>
            <p class="text-xs text-gray-400">{{ stat.desc }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden lg:col-span-2">
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 class="font-bold text-gray-800 flex items-center gap-2">
            <span>🕘</span> 最近对比动态
          </h3>
          <button class="text-xs text-indigo-600 hover:underline">查看全部</button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-gray-500 uppercase bg-gray-50">
            <tr>
              <th class="px-6 py-3">基准文档 (A)</th>
              <th class="px-6 py-3">对比文档 (B)</th>
              <th class="px-6 py-3">相似度</th>
              <th class="px-6 py-3">风险等级</th>
              <th class="px-6 py-3 text-right">时间</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="activity in recentActivities" :key="activity.id" class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 font-medium text-gray-900 truncate max-w-[150px]" :title="activity.fileA">
                {{ activity.fileA }}
              </td>
              <td class="px-6 py-4 text-gray-500 truncate max-w-[150px]" :title="activity.fileB">
                {{ activity.fileB }}
              </td>
              <td class="px-6 py-4 font-mono font-bold text-gray-700">
                {{ activity.similarity }}
              </td>
              <td class="px-6 py-4">
                  <span :class="`px-2 py-1 rounded text-xs border ${getRiskBadge(activity.risk)}`">
                    {{ activity.risk }}
                  </span>
              </td>
              <td class="px-6 py-4 text-right text-gray-400 text-xs">
                {{ activity.time }}
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</template>