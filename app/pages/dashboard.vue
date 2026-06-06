<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  getDashboardRecent,
  getDashboardStats,
  type DashboardStats,
  type RecentActivity
} from '~/services/docCompareApi'

// 仪表盘数据量较大，关闭 SSR，避免服务端渲染时内存占用过高
definePageMeta({
  ssr: false
})

type AuthMeResponse = {
  code: number
  data?: {
    loggedIn?: boolean
    user?: {
      id?: string
      username?: string
      studentNo?: string
    }
  }
  message?: string
}

// --- 1. 核心业务指标 ---
const coreMetrics = ref<any[]>([])

// --- 2. 效率与性能 ---
const performanceMetrics = ref<any[]>([])

// --- 3. 最近动态 ---
const recentActivities = ref<RecentActivity[]>([])

// --- 4. 加载状态 ---
const isLoading = ref(false)
const error = ref('')

// --- 5. 当前用户与扩展统计 ---
const dashboardStats = ref<DashboardStats | null>(null)
const currentUserId = ref('')
const currentStudentNo = ref('')

const displayStudentNo = computed(() => currentStudentNo.value || currentUserId.value || '管理员')
const studentNoLine = computed(() => `学号/工号：${currentStudentNo.value || currentUserId.value || '未识别'}`)

const trendRows = computed(() => dashboardStats.value?.seven_day_trend ?? [])
const maxTrendCount = computed(() => Math.max(1, ...trendRows.value.map(item => asNumber(item.count))))

const riskItems = computed(() => {
  const distribution = dashboardStats.value?.risk_distribution ?? { HIGH: 0, MEDIUM: 0, LOW: 0 }
  const total = asNumber(distribution.HIGH) + asNumber(distribution.MEDIUM) + asNumber(distribution.LOW)
  return [
    { key: 'HIGH', label: '高风险', value: asNumber(distribution.HIGH), color: 'bg-red-500', text: 'text-red-600' },
    { key: 'MEDIUM', label: '中风险', value: asNumber(distribution.MEDIUM), color: 'bg-amber-500', text: 'text-amber-600' },
    { key: 'LOW', label: '低风险', value: asNumber(distribution.LOW), color: 'bg-emerald-500', text: 'text-emerald-600' }
  ].map(item => ({
    ...item,
    percent: total > 0 ? Math.round((item.value / total) * 100) : 0
  }))
})

const paperCompletionRate = computed(() => {
  const stats = dashboardStats.value
  if (!stats || !stats.paper_total_count) return 0
  return Math.round((asNumber(stats.paper_completed_count) / asNumber(stats.paper_total_count)) * 100)
})

const reportGeneratedRate = computed(() => {
  const stats = dashboardStats.value
  if (!stats || !stats.total_compare_count) return 0
  return Math.round((asNumber(stats.report_generated_count) / asNumber(stats.total_compare_count)) * 100)
})

const asNumber = (value: unknown): number => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value))

const formatChange = (value: string | number): string => {
  const numeric = asNumber(value)
  if (numeric > 0) return `+${numeric.toFixed(1)}%`
  if (numeric < 0) return `${numeric.toFixed(1)}%`
  return '0.0%'
}

const formatMetricValue = (value: unknown): string => {
  const numeric = asNumber(value)
  return Number.isInteger(numeric) ? numeric.toLocaleString('zh-CN') : numeric.toFixed(1)
}

const formatTrendDate = (dateString: string): string => {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString.slice(5)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const trendBarHeight = (count: number): number => {
  if (count <= 0) return 4
  return clamp(Math.round((count / maxTrendCount.value) * 100), 12, 100)
}

// 获取当前登录学号/工号
const fetchCurrentUser = async () => {
  try {
    const res = await $fetch<AuthMeResponse>('/api/auth/me', {
      credentials: 'include'
    })
    const user = res.data?.loggedIn ? res.data.user : null
    currentUserId.value = user?.id || user?.username || ''
    currentStudentNo.value = user?.studentNo || ''
  } catch {
    // 欢迎语不阻塞仪表盘主体数据
  }
}

// 获取仪表盘统计数据
const fetchDashboardStats = async () => {
  try {
    isLoading.value = true
    const stats = await getDashboardStats()
    dashboardStats.value = stats

    // 构建核心指标
    coreMetrics.value = [
      {
        label: '今日对比次数',
        value: stats.today_count,
        unit: '次',
        icon: '⚡',
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        trend: `${formatChange(stats.count_change_percent)} 较昨日`
      },
      {
        label: '平均相似度',
        value: stats.avg_sim_percent,
        unit: '%',
        icon: '📊',
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        trend: `${formatChange(stats.sim_change_percent)} 较昨日`
      },
      {
        label: '高风险预警',
        value: stats.high_risk_count,
        unit: '个',
        icon: '🚨',
        color: 'text-red-600',
        bg: 'bg-red-50',
        trend: `${stats.weekly_high_risk_count} 近7日`
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
        progress: clamp(Math.round((2000 - asNumber(stats.avg_time)) / 2000 * 100)),
        color: 'bg-emerald-500'
      },
      {
        label: '累计节省人工工时',
        value: Math.round(asNumber(stats.total_saved_hours)),
        unit: '小时',
        desc: '按人工阅读速度 500字/分钟 估算',
        progress: clamp(Math.round(asNumber(stats.total_saved_hours) / 200 * 100)),
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
    fetchCurrentUser(),
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

    <div class="mb-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 class="text-2xl font-bold text-gray-800">👋 欢迎回来，{{ displayStudentNo }}</h2>
        <p class="text-gray-500 text-sm mt-1">{{ studentNoLine }} · 这里是系统的实时运行状态概览。</p>
      </div>
      <div v-if="dashboardStats" class="text-sm text-gray-500">
        累计对比 <span class="font-semibold text-gray-800">{{ formatMetricValue(dashboardStats.total_compare_count) }}</span> 次 · 报告生成率
        <span class="font-semibold text-gray-800">{{ reportGeneratedRate }}%</span>
      </div>
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
          <span v-if="item.trend" class="text-xs font-medium px-2 py-1 rounded bg-gray-50 text-gray-500">{{ item.trend }}</span>
        </div>
        <div>
          <p class="text-sm text-gray-500 mb-1">{{ item.label }}</p>
          <div class="flex items-baseline gap-1">
            <span :class="`text-3xl font-bold ${item.color}`">{{ formatMetricValue(item.value) }}</span>
            <span class="text-sm text-gray-400">{{ item.unit }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!isLoading" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-gray-800 flex items-center gap-2">
            <span>📈</span> 7 日对比趋势
          </h3>
          <span class="text-xs text-gray-400">{{ dashboardStats?.weekly_compare_count ?? 0 }} 次</span>
        </div>
        <div v-if="trendRows.length" class="h-36 grid grid-cols-7 gap-3 items-end">
          <div v-for="item in trendRows" :key="item.date" class="h-full min-w-0 flex flex-col items-center justify-end gap-2">
            <div class="flex h-24 w-full items-end justify-center rounded bg-gray-50">
              <div
                class="w-5 rounded-t bg-indigo-500 transition-all"
                :style="{ height: `${trendBarHeight(asNumber(item.count))}%` }"
                :title="`${item.date}：${item.count} 次，均值 ${item.avg_sim_percent || 0}%`"
              ></div>
            </div>
            <div class="text-center leading-tight">
              <p class="text-xs font-semibold text-gray-700">{{ item.count }}</p>
              <p class="text-[11px] text-gray-400">{{ formatTrendDate(item.date) }}</p>
            </div>
          </div>
        </div>
        <p v-else class="h-36 flex items-center justify-center text-sm text-gray-400">暂无趋势数据</p>
      </section>

      <section class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-gray-800 flex items-center gap-2">
            <span>🧭</span> 风险分布
          </h3>
          <span class="text-xs text-gray-400">累计 {{ dashboardStats?.total_compare_count ?? 0 }} 次</span>
        </div>
        <div class="space-y-5">
          <div v-for="item in riskItems" :key="item.key">
            <div class="flex justify-between text-sm mb-2">
              <span class="font-medium text-gray-600">{{ item.label }}</span>
              <span :class="`font-semibold ${item.text}`">{{ item.value }} 个 · {{ item.percent }}%</span>
            </div>
            <div class="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div class="h-full rounded-full" :class="item.color" :style="{ width: `${item.percent}%` }"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-gray-800 flex items-center gap-2">
            <span>📝</span> 文档质检概览
          </h3>
          <span class="text-xs text-gray-400">完成率 {{ paperCompletionRate }}%</span>
        </div>
        <div class="mb-5">
          <div class="flex items-end justify-between">
            <div>
              <p class="text-sm text-gray-500">质检任务总数</p>
              <p class="mt-1 text-3xl font-bold text-gray-800">{{ dashboardStats?.paper_total_count ?? 0 }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm text-gray-500">平均评分</p>
              <p class="mt-1 text-2xl font-bold text-indigo-600">{{ formatMetricValue(dashboardStats?.paper_avg_score ?? 0) }}</p>
            </div>
          </div>
          <div class="mt-4 h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div class="h-full rounded-full bg-indigo-500" :style="{ width: `${paperCompletionRate}%` }"></div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p class="font-semibold text-emerald-600">{{ dashboardStats?.paper_completed_count ?? 0 }}</p>
            <p class="mt-1 text-xs text-gray-400">已完成</p>
          </div>
          <div>
            <p class="font-semibold text-blue-600">{{ dashboardStats?.paper_processing_count ?? 0 }}</p>
            <p class="mt-1 text-xs text-gray-400">进行中</p>
          </div>
          <div>
            <p class="font-semibold text-red-600">{{ dashboardStats?.paper_failed_count ?? 0 }}</p>
            <p class="mt-1 text-xs text-gray-400">失败</p>
          </div>
        </div>
      </section>
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
