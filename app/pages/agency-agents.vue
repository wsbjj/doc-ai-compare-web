<script setup lang="ts">
import {
  fetchAgencyAgentDepartments,
  fetchAgencyAgentDetail,
  fetchAgencyAgents,
  runAgencyAgent,
  type AgencyAgentAttachment,
  type AgencyAgentChatMessage,
  type AgencyAgentDepartment,
  type AgencyAgentDetail,
  type AgencyAgentSummary
} from '~/services/agencyAgentsApi'

type ChatEntry = {
  role: 'user' | 'assistant'
  content: string
  attachments?: AgencyAgentAttachment[]
}

const departments = ref<AgencyAgentDepartment[]>([])
const agents = ref<AgencyAgentSummary[]>([])
const selectedDepartmentId = ref('all')
const selectedAgentId = ref<string | null>(null)
const selectedAgent = ref<AgencyAgentDetail | null>(null)
const keyword = ref('')
const message = ref('')
const selectedFiles = ref<File[]>([])
const chat = ref<ChatEntry[]>([])
const loadingDepartments = ref(false)
const loadingAgents = ref(false)
const loadingDetail = ref(false)
const running = ref(false)
const errorMsg = ref('')
const showMarkdown = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const workbenchMenuCollapsed = ref(false)
const workbenchMenuStorageKey = 'agency-agents-workbench-menu-collapsed'
const agentListCollapsed = ref(false)
const agentListStorageKey = 'agency-agents-agent-list-collapsed'

let searchTimer: ReturnType<typeof setTimeout> | null = null

const totalAgentCount = computed(() =>
  departments.value.reduce((sum, department) => sum + (department.agentCount || 0), 0)
)

const activeDepartment = computed(() =>
  selectedDepartmentId.value === 'all'
    ? { id: 'all', name: '全部', agentCount: totalAgentCount.value }
    : departments.value.find(item => item.id === selectedDepartmentId.value)
)

const canRun = computed(() =>
  !!selectedAgent.value && !running.value && (!!message.value.trim() || selectedFiles.value.length > 0)
)

const runStatusText = computed(() => {
  if (running.value) return '运行中'
  if (chat.value.some(item => item.role === 'assistant')) return '运行完成'
  return '待运行'
})

const chatHistoryForBackend = computed<AgencyAgentChatMessage[]>(() =>
  chat.value
    .filter(item => item.role === 'user' || item.role === 'assistant')
    .slice(-8)
    .map(item => ({ role: item.role, content: item.content }))
)

const loadDepartments = async () => {
  loadingDepartments.value = true
  try {
    departments.value = await fetchAgencyAgentDepartments()
  } catch (e: any) {
    errorMsg.value = e?.message || '部门加载失败'
  } finally {
    loadingDepartments.value = false
  }
}

const loadAgents = async () => {
  loadingAgents.value = true
  try {
    const list = await fetchAgencyAgents(selectedDepartmentId.value, keyword.value)
    agents.value = list
    const stillVisible = list.some(item => item.id === selectedAgentId.value)
    if (list.length && (!selectedAgentId.value || !stillVisible)) {
      await selectAgent(list[0].id, true)
    } else if (!list.length) {
      selectedAgentId.value = null
      selectedAgent.value = null
    } else if (selectedAgentId.value && !selectedAgent.value) {
      await loadAgentDetail(selectedAgentId.value)
    }
  } catch (e: any) {
    errorMsg.value = e?.message || 'Agent 加载失败'
  } finally {
    loadingAgents.value = false
  }
}

const loadAgentDetail = async (id: string) => {
  loadingDetail.value = true
  try {
    selectedAgent.value = await fetchAgencyAgentDetail(id)
  } catch (e: any) {
    errorMsg.value = e?.message || 'Agent 详情加载失败'
  } finally {
    loadingDetail.value = false
  }
}

const selectDepartment = (id: string) => {
  selectedDepartmentId.value = id
}

const selectAgent = async (id: string, keepChat = false) => {
  if (selectedAgentId.value === id && selectedAgent.value) return
  selectedAgentId.value = id
  errorMsg.value = ''
  if (!keepChat) chat.value = []
  await loadAgentDetail(id)
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return
  selectedFiles.value = [...selectedFiles.value, ...Array.from(target.files)]
  target.value = ''
}

const removeFile = (index: number) => {
  selectedFiles.value = selectedFiles.value.filter((_, i) => i !== index)
}

const clearChat = () => {
  chat.value = []
  errorMsg.value = ''
}

const runCurrentAgent = async () => {
  if (!selectedAgent.value || !canRun.value) return
  const currentMessage = message.value.trim()
  const currentFiles = [...selectedFiles.value]
  const history = [...chatHistoryForBackend.value]

  running.value = true
  errorMsg.value = ''
  chat.value.push({
    role: 'user',
    content: currentMessage || currentFiles.map(file => file.name).join('\n')
  })
  message.value = ''
  selectedFiles.value = []
  if (fileInput.value) fileInput.value.value = ''

  try {
    const res = await runAgencyAgent(selectedAgent.value.id, currentMessage, history, currentFiles)
    chat.value.push({
      role: 'assistant',
      content: res.content || '',
      attachments: res.attachments || []
    })
  } catch (e: any) {
    errorMsg.value = e?.message || 'Agent 运行失败'
    chat.value.push({
      role: 'assistant',
      content: `运行失败：${errorMsg.value}`
    })
  } finally {
    running.value = false
  }
}

const getAttachmentStatusClass = (status: string) => {
  if (status === 'OK') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'FAILED') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

const getDepartmentShortLabel = (name: string) => {
  const compact = name.replace(/部$/, '')
  return compact.length > 2 ? compact.slice(0, 2) : compact
}

watch([selectedDepartmentId, keyword], () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    loadAgents()
  }, 180)
})

watch(workbenchMenuCollapsed, value => {
  if (process.client) {
    localStorage.setItem(workbenchMenuStorageKey, value ? '1' : '0')
  }
})

watch(agentListCollapsed, value => {
  if (process.client) {
    localStorage.setItem(agentListStorageKey, value ? '1' : '0')
  }
})

onMounted(async () => {
  if (process.client) {
    workbenchMenuCollapsed.value = localStorage.getItem(workbenchMenuStorageKey) === '1'
    agentListCollapsed.value = localStorage.getItem(agentListStorageKey) === '1'
  }
  await loadDepartments()
  await loadAgents()
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <div class="h-[calc(100vh-4rem)] min-h-[680px] bg-[#f6f7f4] text-slate-900 overflow-hidden">
    <div
      class="workbench-grid h-full grid grid-cols-1 border-t border-slate-200"
      :class="{
        'menu-collapsed': workbenchMenuCollapsed,
        'agent-list-collapsed': agentListCollapsed
      }"
    >
      <aside
        v-show="!workbenchMenuCollapsed"
        class="bg-[#fbfaf6] border-r border-slate-200 min-h-0 flex flex-col transition-[width] duration-200"
      >
        <div class="border-b border-slate-200 p-2">
          <div class="flex items-center gap-2" :class="workbenchMenuCollapsed ? 'justify-center' : 'justify-between'">
            <label v-show="!workbenchMenuCollapsed" class="relative block min-w-0 flex-1">
              <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m1.35-5.15a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              </svg>
              <input
                v-model="keyword"
                type="search"
                class="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10"
                placeholder="搜索角色、能力、路径"
              />
            </label>
            <button
              type="button"
              class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              :title="workbenchMenuCollapsed ? '展开部门菜单' : '折叠部门菜单'"
              @click="workbenchMenuCollapsed = !workbenchMenuCollapsed"
            >
              <svg
                class="h-5 w-5 transition-transform"
                :class="workbenchMenuCollapsed ? 'rotate-180' : ''"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div
          v-show="!workbenchMenuCollapsed"
          class="min-h-0 flex-1 overflow-y-auto p-3 space-y-1"
        >
          <button
            type="button"
            class="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition"
            :title="workbenchMenuCollapsed ? `全部 (${totalAgentCount})` : undefined"
            :class="[
              selectedDepartmentId === 'all'
                ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-950',
              workbenchMenuCollapsed ? 'h-11 justify-center px-0' : ''
            ]"
            @click="selectDepartment('all')"
          >
            <span class="font-semibold">{{ workbenchMenuCollapsed ? '全' : '全部' }}</span>
            <span
              v-show="!workbenchMenuCollapsed"
              class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
            >
              {{ totalAgentCount }}
            </span>
          </button>
          <button
            v-for="department in departments"
            :key="department.id"
            type="button"
            class="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition"
            :title="workbenchMenuCollapsed ? `${department.name} (${department.agentCount})` : undefined"
            :class="[
              selectedDepartmentId === department.id
                ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-950',
              workbenchMenuCollapsed ? 'h-11 justify-center px-0' : ''
            ]"
            @click="selectDepartment(department.id)"
          >
            <span class="font-semibold truncate">
              {{ workbenchMenuCollapsed ? getDepartmentShortLabel(department.name) : department.name }}
            </span>
            <span
              v-show="!workbenchMenuCollapsed"
              class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
            >
              {{ department.agentCount }}
            </span>
          </button>
          <div v-if="loadingDepartments" class="px-3 py-2 text-sm text-slate-500">加载中...</div>
        </div>
      </aside>

      <section
        v-show="!agentListCollapsed"
        class="bg-white border-r border-slate-200 min-h-0 flex flex-col"
      >
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <button
              v-if="workbenchMenuCollapsed"
              type="button"
              class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
              title="展开部门菜单"
              @click="workbenchMenuCollapsed = false"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div class="min-w-0">
              <p class="text-xs text-slate-500">当前部门</p>
              <h2 class="text-base font-bold truncate">{{ activeDepartment?.name || '全部' }}</h2>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {{ agents.length }} 个
            </span>
            <button
              type="button"
              class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
              title="折叠 Agent 列表"
              @click="agentListCollapsed = true"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <button
            v-for="agent in agents"
            :key="agent.id"
            type="button"
            class="w-full border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50"
            :class="selectedAgentId === agent.id ? 'bg-[#fff4ed]' : 'bg-white'"
            @click="selectAgent(agent.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-lg leading-none">{{ agent.emoji || '◆' }}</span>
                  <h3 class="font-bold text-slate-950 truncate">{{ agent.name }}</h3>
                </div>
                <p class="mt-1 text-sm text-slate-600 line-clamp-2 leading-relaxed">
                  {{ agent.description }}
                </p>
              </div>
              <span class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {{ agent.departmentName }}
              </span>
            </div>
          </button>

          <div v-if="loadingAgents" class="p-5 text-sm text-slate-500">加载中...</div>
          <div v-else-if="!agents.length" class="p-5 text-sm text-slate-500">未找到匹配的 Agent</div>
        </div>
      </section>

      <main class="min-h-0 bg-[#f8f4ee] flex flex-col">
        <div class="border-b border-slate-200 bg-[#fbfaf6] px-6 py-5">
          <div v-if="selectedAgent" class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 max-w-3xl">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-if="agentListCollapsed"
                  type="button"
                  class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                  title="展开 Agent 列表"
                  @click="agentListCollapsed = false"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  v-if="agentListCollapsed && workbenchMenuCollapsed"
                  type="button"
                  class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                  title="展开部门菜单"
                  @click="workbenchMenuCollapsed = false"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h16" />
                  </svg>
                </button>
                <span class="text-2xl leading-none">{{ selectedAgent.emoji || '◆' }}</span>
                <h2 class="text-2xl font-bold tracking-tight text-slate-950">{{ selectedAgent.name }}</h2>
                <span class="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {{ selectedAgent.departmentName }}
                </span>
              </div>
              <p class="mt-2 text-slate-600 leading-relaxed">{{ selectedAgent.description }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                @click="showMarkdown = true"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5L19 8.5V19a2 2 0 01-2 2z" />
                </svg>
                查看角色 Markdown
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                @click="clearChat"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0019 5" />
                </svg>
                清空
              </button>
            </div>
          </div>
          <div v-else class="flex items-center gap-2 text-sm text-slate-500">
            <button
              v-if="agentListCollapsed"
              type="button"
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
              title="展开 Agent 列表"
              @click="agentListCollapsed = false"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              v-if="agentListCollapsed && workbenchMenuCollapsed"
              type="button"
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
              title="展开部门菜单"
              @click="workbenchMenuCollapsed = false"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h16" />
              </svg>
            </button>
            <span>{{ loadingDetail ? '加载角色中...' : '请选择一个 Agent' }}</span>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div v-if="errorMsg" class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ errorMsg }}
          </div>

          <div v-if="!chat.length" class="h-full min-h-[320px] rounded-lg border border-dashed border-slate-300 bg-white/50 flex items-center justify-center text-slate-500">
            <div class="text-center">
              <p class="text-sm font-medium">交给「{{ selectedAgent?.name || 'Agent' }}」处理</p>
              <p class="mt-1 text-xs text-slate-400">本页会保留当前对话上下文</p>
            </div>
          </div>

          <div v-else class="space-y-4 max-w-5xl">
            <article
              v-for="(item, index) in chat"
              :key="index"
              class="rounded-lg border shadow-sm"
              :class="item.role === 'user'
                ? 'border-slate-200 bg-white'
                : 'border-teal-100 bg-[#fffffb]'"
            >
              <div class="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                <span class="text-sm font-bold text-slate-800">
                  {{ item.role === 'user' ? '你' : selectedAgent?.name || 'Agent' }}
                </span>
                <span v-if="item.role === 'assistant' && index === chat.length - 1 && !running" class="text-xs text-slate-400">
                  运行完成
                </span>
              </div>
              <div class="px-4 py-4">
                <p class="whitespace-pre-wrap text-sm leading-7 text-slate-800">{{ item.content }}</p>
                <div v-if="item.attachments?.length" class="mt-4 flex flex-wrap gap-2">
                  <span
                    v-for="attachment in item.attachments"
                    :key="attachment.fileName + attachment.status"
                    class="rounded-full border px-2.5 py-1 text-xs"
                    :class="getAttachmentStatusClass(attachment.status)"
                  >
                    {{ attachment.fileName }} · {{ attachment.message }}
                  </span>
                </div>
              </div>
            </article>
            <div v-if="running" class="rounded-lg border border-teal-100 bg-white px-4 py-3 text-sm text-teal-700">
              {{ selectedAgent?.name }} 正在处理...
            </div>
          </div>
        </div>

        <div class="border-t border-slate-200 bg-[#fbfaf6] px-6 py-5">
          <div class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <textarea
              v-model="message"
              rows="4"
              class="block w-full resize-none border-0 bg-transparent p-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
              :placeholder="selectedAgent ? `交给「${selectedAgent.name}」处理` : '请选择一个 Agent'"
            />

            <div v-if="selectedFiles.length" class="flex flex-wrap gap-2 border-t border-slate-100 px-2 py-3">
              <span
                v-for="(file, index) in selectedFiles"
                :key="file.name + index"
                class="inline-flex max-w-full items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
              >
                <span class="truncate">{{ file.name }}</span>
                <button type="button" class="text-slate-400 hover:text-rose-600" @click="removeFile(index)">×</button>
              </span>
            </div>

            <div class="flex items-center justify-between gap-3 border-t border-slate-100 px-2 pt-3">
              <div class="flex items-center gap-2">
                <input
                  ref="fileInput"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md,.markdown"
                  class="hidden"
                  @change="handleFileChange"
                />
                <button
                  type="button"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                  title="添加附件"
                  @click="fileInput?.click()"
                >
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.5 6.5l-7.78 7.78a3 3 0 104.24 4.24l8.49-8.49a5 5 0 00-7.07-7.07L5.64 11.7a7 7 0 109.9 9.9l6.36-6.36" />
                  </svg>
                </button>
                <span class="text-xs text-slate-400">{{ selectedFiles.length ? `${selectedFiles.length} 个附件` : runStatusText }}</span>
              </div>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg bg-[#d98b73] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#c87861] disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canRun"
                @click="runCurrentAgent"
              >
                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {{ running ? '运行中' : '运行' }}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>

    <div
      v-if="showMarkdown && selectedAgent"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      @click.self="showMarkdown = false"
    >
      <section class="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 class="font-bold text-slate-950">{{ selectedAgent.name }}</h3>
            <p class="mt-1 text-xs text-slate-500">{{ selectedAgent.sourcePath }}</p>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            title="关闭"
            @click="showMarkdown = false"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <pre class="flex-1 overflow-auto bg-[#fbfaf6] p-5 text-sm leading-7 text-slate-800 whitespace-pre-wrap">{{ selectedAgent.markdown }}</pre>
      </section>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (min-width: 1280px) {
  .workbench-grid {
    grid-template-columns: 15rem 24rem minmax(0, 1fr);
  }

  .workbench-grid.menu-collapsed {
    grid-template-columns: 24rem minmax(0, 1fr);
  }

  .workbench-grid.agent-list-collapsed {
    grid-template-columns: 15rem minmax(0, 1fr);
  }

  .workbench-grid.menu-collapsed.agent-list-collapsed {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
