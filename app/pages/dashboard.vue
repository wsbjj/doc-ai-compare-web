<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { 
  getDashboardStats, 
  getDashboardRecent, 
  type DashboardStats, 
  type RecentActivity 
} from '~/services/docCompareApi'

// --- 1. 核心业务指标 ---
const coreMetrics = ref<any[]>([])

// --- 2. 效率与性能 ---
const performanceMetrics = ref<any[]>([])

// --- 3. 最近动态 ---
const recentActivities = ref<RecentActivity[]>([])

// --- 4. 加载状态 ---
const isLoading = ref(false)
const error = ref('')

// 获取仪表盘统计数据
const fetchDashboardStats = async () => {
  try {
    isLoading.value = true
    const stats = await getDashboardStats()
    
    // 构建核心指标
    coreMetrics.value = [
      {
        label: '今日对比次数',
        value: stats.today_count,
        unit: '次',
        icon: '⚡',
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        // trend: `${stats.count_change_percent} 较昨日`
      },
      {
        label: '平均相似度',
        value: stats.avg_sim_percent,
        unit: '%',
        icon: '📊',
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        // trend: `${stats.sim_change_percent} 较昨日`
      },
      {
        label: '高风险预警',
        value: stats.high_risk_count,
        unit: '个',
        icon: '🚨',
        color: 'text-red-600',
        bg: 'bg-red-50',
        // trend: '需关注'
      },
      {
        label: '知识库文档',
        value: stats.total_docs,
        unit: '份',
        icon: '📚',
        color: 'text-green-600',
        bg: 'bg-green-50',
        trend: `+${stats.weekly_new_docs} 本周新增`
      }
    ]
    
    // 构建性能指标
    performanceMetrics.value = [
      {
        label: 'AI 响应平均耗时',
        value: stats.avg_time_sec,
        unit: 's/篇',
        desc: '基于高性能 GPU 集群加速',
        progress: Math.min(Math.round((2000 - stats.avg_time) / 2000 * 100), 100),
        color: 'bg-emerald-500'
      },
      {
        label: '累计节省人工工时',
        value: Math.round(stats.total_saved_hours),
        unit: '小时',
        desc: '按人工阅读速度 500字/分钟 估算',
        progress: Math.min(Math.round(stats.total_saved_hours / 200 * 100), 100),
        color: 'bg-orange-500'
      }
    ]
  } catch (e) {
    error.value = '获取仪表盘数据失败'
    console.error(e)
  }
}

// 获取最近的对比记录
const fetchRecentActivities = async () => {
  try {
    const data = await getDashboardRecent(6)
    recentActivities.value = data
  } catch (e) {
    error.value = '获取最近动态失败'
    console.error(e)
  }
}

// 初始化数据
onMounted(async () => {
  await Promise.all([
    fetchDashboardStats(),
    fetchRecentActivities()
  ])
  isLoading.value = false
})

// 格式化时间
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
</script>

<template>
  <div class="p-8 max-w-7xl mx-auto space-y-8">

    <div v-if="error" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
      {{ error }}
    </div>

    <div class="mb-2">
      <h2 class="text-2xl font-bold text-gray-800">👋 欢迎回来，管理员</h2>
      <p class="text-gray-500 text-sm mt-1">这里是系统的实时运行状态概览。</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div v-if="isLoading" class="col-span-full">
        <div class="flex justify-center items-center h-32">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span class="ml-2 text-gray-500">加载中...</span>
        </div>
      </div>
      <div v-else v-for="item in coreMetrics" :key="item.label"
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
        <div v-if="isLoading" class="flex justify-center items-center h-32">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
        <div v-else class="space-y-8">
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
          <!-- <button class="text-xs text-indigo-600 hover:underline">查看全部</button> -->
        </div>

        <div class="overflow-x-auto">
          <div v-if="isLoading" class="flex justify-center items-center p-8">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            <span class="ml-2 text-gray-500">加载中...</span>
          </div>
          <div v-else-if="recentActivities.length === 0" class="px-6 py-8 text-center text-gray-500">
            暂无对比记录
          </div>
          <table v-else class="w-full text-sm text-left">
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
              <td class="px-6 py-4 font-medium text-gray-900 truncate max-w-[150px]" :title="activity.baseFileName">
                {{ activity.baseFileName }}
              </td>
              <td class="px-6 py-4 text-gray-500 truncate max-w-[150px]" :title="activity.compareFileName">
                {{ activity.compareFileName }}
              </td>
              <td class="px-6 py-4 font-mono font-bold text-gray-700">
                {{ (activity.similarity * 100).toFixed(1) }}%
              </td>
              <td class="px-6 py-4">
                  <span :class="`px-2 py-1 rounded text-xs border ${getRiskBadge(activity.riskLevel)}`">
                    {{ activity.riskLevel }}
                  </span>
              </td>
              <td class="px-6 py-4 text-right text-gray-400 text-xs">
                {{ formatTime(activity.createTime) }}
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</template>