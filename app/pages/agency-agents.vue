<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import {
  fetchAgencyAgentChatSessionDetail,
  fetchAgencyAgentChatSessions,
  fetchAgencyAgentDepartments,
  fetchAgencyAgentDetail,
  fetchAgencyAgents,
  runAgencyAgentAutoRouteStream,
  runAgencyAgentStream,
  type AgencyAgentAttachment,
  type AgencyAgentChatMessage,
  type AgencyAgentChatSession,
  type AgencyAgentChatTurn,
  type AgencyAgentChatStreamEvent,
  type AgencyAgentDepartment,
  type AgencyAgentDetail,
  type AgencyAgentRouteCandidate,
  type AgencyAgentSummary
} from '~/services/agencyAgentsApi'

type ChatEntry = {
  role: 'user' | 'assistant'
  content: string
  attachments?: AgencyAgentAttachment[]
  agentId?: string
  agentName?: string
  departmentName?: string
  agentEmoji?: string
  routeMode?: 'manual' | 'auto'
  routeReason?: string
  routeStatus?: string
  routeCandidates?: AgencyAgentRouteCandidate[]
  createdAt?: number
  turnId?: number
  pending?: boolean
  failed?: boolean
}

type CurrentUser = {
  id?: string
  name?: string
  realName?: string
  studentNo?: string
  typeCode?: string
  typeName?: string
}

const assistantMarkdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false
})

const departments = ref<AgencyAgentDepartment[]>([])
const agents = ref<AgencyAgentSummary[]>([])
const selectedDepartmentId = ref('all')
const selectedAgentId = ref<string | null>(null)
const selectedAgent = ref<AgencyAgentDetail | null>(null)
const currentUser = ref<CurrentUser | null>(null)
const keyword = ref('')
const message = ref('')
const selectedFiles = ref<File[]>([])
const chat = ref<ChatEntry[]>([])
const activeChatSessionId = ref<string | null>(null)
const chatSessions = ref<AgencyAgentChatSession[]>([])
const loadingDepartments = ref(false)
const loadingAgents = ref(false)
const loadingDetail = ref(false)
const loadingChatSessions = ref(false)
const loadingChatSessionDetail = ref(false)
const running = ref(false)
const errorMsg = ref('')
const showMarkdown = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const chatScrollRef = ref<HTMLElement | null>(null)
const autoRouteEnabled = ref(false)
const autoRouteStorageKey = 'agency-agents-auto-route-enabled'
const lastAutoRouteAgentId = ref<string | null>(null)
const workbenchMenuCollapsed = ref(false)
const workbenchMenuStorageKey = 'agency-agents-workbench-menu-collapsed'
const agentListCollapsed = ref(false)
const agentListStorageKey = 'agency-agents-agent-list-collapsed'
const chatHistoryCollapsed = ref(false)
const chatHistoryStorageKey = 'agency-agents-chat-history-collapsed'

let searchTimer: ReturnType<typeof setTimeout> | null = null
let chatScrollFrame: number | null = null
let chatTurnCounter = 0
let chatHistoryPreferenceReady = false
let chatSessionsRequestSeq = 0

const totalAgentCount = computed(() =>
  departments.value.reduce((sum, department) => sum + (department.agentCount || 0), 0)
)

const activeDepartment = computed(() =>
  selectedDepartmentId.value === 'all'
    ? { id: 'all', name: '全部', agentCount: totalAgentCount.value }
    : departments.value.find(item => item.id === selectedDepartmentId.value)
)

const agentById = computed(() => {
  const map = agents.value.reduce<Record<string, AgencyAgentSummary>>((map, agent) => {
    map[agent.id] = agent
    return map
  }, {})
  if (selectedAgent.value) {
    map[selectedAgent.value.id] = selectedAgent.value
  }
  return map
})

const currentUserNumber = computed(() =>
  currentUser.value?.studentNo?.trim() || currentUser.value?.id?.trim() || ''
)

const currentUserIdentityName = computed(() => {
  const typeCode = currentUser.value?.typeCode?.trim().toUpperCase()
  const typeName = currentUser.value?.typeName?.trim() || ''

  if (typeCode?.startsWith('S') || /学生|本科|专科|研究生|硕士|博士/.test(typeName)) {
    return '学号'
  }

  if (typeCode || typeName) return '工号'
  return '学号/工号'
})

const currentUserChatTitle = computed(() => {
  const number = currentUserNumber.value
  return number ? `${currentUserIdentityName.value}：${number}` : '我'
})

const hasRunnableInput = computed(() => !!message.value.trim() || selectedFiles.value.length > 0)

const canRun = computed(() =>
  !running.value && hasRunnableInput.value && (autoRouteEnabled.value || !!selectedAgent.value)
)

const runStatusText = computed(() => {
  if (running.value) return '运行中'
  if (chat.value.some(item => item.role === 'assistant')) return '运行完成'
  return autoRouteEnabled.value ? '自动匹配 Agent' : '待运行'
})

const chatHistoryForBackend = computed<AgencyAgentChatMessage[]>(() =>
  chat.value
    .filter(item => item.role === 'user' || item.role === 'assistant')
    .slice(-8)
    .map(item => ({ role: item.role, content: item.content }))
)

const chatSessionCount = computed(() => chatSessions.value.length)

const normalizeChatContent = (content?: string | null) =>
  (content || '')
    .replace(/\r\n/g, '\n')
    .replace(/^[\s\u200B-\u200D\uFEFF]+|[\s\u200B-\u200D\uFEFF]+$/g, '')

const getChatDisplayContent = (item: ChatEntry) => {
  const content = normalizeChatContent(item.content)
  if (content) return content
  if (item.role === 'assistant' && item.pending) return '正在处理...'
  return item.role === 'assistant' ? 'Agent 未返回内容' : ''
}

const renderAssistantMarkdown = (item: ChatEntry) => assistantMarkdown.render(getChatDisplayContent(item))

const isAutoRouteMode = (routeMode?: string | null) => (routeMode || '').toUpperCase() === 'AUTO'

const getEntryAgentName = (item: ChatEntry) => {
  if (item.routeMode === 'auto') return '自动路由模式'
  return item.agentName || 'Agent'
}

const getEntryAgentEmoji = (item: ChatEntry) => {
  if (item.routeMode === 'auto') return '◇'
  return item.agentEmoji || '◆'
}

const getHistoryPreview = (content?: string | null, fallback = '暂无内容') => {
  const normalized = normalizeChatContent(content)
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return fallback
  return normalized.length > 88 ? `${normalized.slice(0, 88)}...` : normalized
}

const getSessionDisplayName = (session: AgencyAgentChatSession) => {
  if (isAutoRouteMode(session.routeMode)) return '自动路由模式'
  return session.displayName || 'Agent'
}

const getSessionStatusLabel = (status?: string | null) => {
  if (status === 'FAILED') return '运行失败'
  if (status === 'RUNNING') return '运行中'
  return '运行完成'
}

const getSessionStatusClass = (status?: string | null) => {
  if (status === 'FAILED') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (status === 'RUNNING') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-teal-200 bg-teal-50 text-teal-700'
}

const formatSessionTime = (value?: string | null) => {
  if (!value) return ''
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(time)
}

const getTurnUserContent = (turn: AgencyAgentChatTurn) => {
  const content = normalizeChatContent(turn.userMessage)
  if (content) return content
  const attachmentNames = (turn.attachments || [])
    .map(attachment => attachment.fileName)
    .filter(Boolean)
  return attachmentNames.length ? attachmentNames.join('\n') : '仅上传了附件'
}

const getTurnManualAgent = (turn: AgencyAgentChatTurn) =>
  turn.manualAgentId ? agentById.value[turn.manualAgentId] : undefined

const getTurnAgentName = (turn: AgencyAgentChatTurn) => {
  if (isAutoRouteMode(turn.routeMode)) return '自动路由模式'
  return turn.manualAgentName || turn.displayName || getTurnManualAgent(turn)?.name || 'Agent'
}

const getTurnDepartmentName = (turn: AgencyAgentChatTurn) => {
  if (isAutoRouteMode(turn.routeMode)) return undefined
  return turn.manualDepartmentName || getTurnManualAgent(turn)?.departmentName
}

const getTurnAgentEmoji = (turn: AgencyAgentChatTurn) => {
  if (isAutoRouteMode(turn.routeMode)) return '◇'
  return getTurnManualAgent(turn)?.emoji || '◆'
}

const findSessionPrimaryAgentId = (turns: AgencyAgentChatTurn[], displayName?: string | null) => {
  const firstManualTurn = turns.find(turn => !isAutoRouteMode(turn.routeMode) && turn.manualAgentId)
  if (firstManualTurn?.manualAgentId) return firstManualTurn.manualAgentId

  const name = displayName?.trim()
  if (!name) return null
  return agents.value.find(agent => agent.name === name)?.id || null
}

const currentInputPlaceholder = computed(() => {
  if (autoRouteEnabled.value) return '描述任务，系统会自动匹配 Agent'
  return selectedAgent.value ? `交给「${selectedAgent.value.name}」处理` : '请选择一个 Agent'
})

const scrollChatToLatest = async (behavior: ScrollBehavior = 'smooth') => {
  await nextTick()
  if (!process.client) return

  if (chatScrollFrame !== null) {
    window.cancelAnimationFrame(chatScrollFrame)
  }

  chatScrollFrame = window.requestAnimationFrame(() => {
    const scrollEl = chatScrollRef.value
    if (scrollEl) {
      scrollEl.scrollTo({
        top: scrollEl.scrollHeight,
        behavior
      })
    }
    chatScrollFrame = null
  })
}

const toggleAutoRoute = () => {
  autoRouteEnabled.value = !autoRouteEnabled.value
  errorMsg.value = ''
}

const loadCurrentUser = async () => {
  try {
    const res = await $fetch<{
      code: number
      data?: {
        loggedIn?: boolean
        user?: CurrentUser
      }
      message?: string
    }>('/api/auth/me', {
      credentials: 'include'
    })

    currentUser.value = res.data?.loggedIn ? res.data.user || null : null
  } catch {
    currentUser.value = null
  }
}

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
      await selectAgent(list[0].id)
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

const loadChatSessions = async (silent = false) => {
  if (!currentUser.value) {
    chatSessions.value = []
    return
  }

  const requestSeq = ++chatSessionsRequestSeq
  if (!silent) loadingChatSessions.value = true
  try {
    const sessions = await fetchAgencyAgentChatSessions(50)
    if (requestSeq === chatSessionsRequestSeq) {
      chatSessions.value = sessions
    }
  } catch (e: any) {
    if (!/请先登录/.test(e?.message || '')) {
      errorMsg.value = e?.message || '聊天记录加载失败'
    }
  } finally {
    if (!silent) loadingChatSessions.value = false
  }
}

const openChatSession = async (sessionId: string) => {
  if (running.value || loadingChatSessionDetail.value) return
  loadingChatSessionDetail.value = true
  errorMsg.value = ''

  try {
    const detail = await fetchAgencyAgentChatSessionDetail(sessionId)
    const turns = detail.turns || []
    const sessionIsAutoRoute = isAutoRouteMode(detail.session.routeMode)
    activeChatSessionId.value = detail.session.id
    autoRouteEnabled.value = sessionIsAutoRoute
    lastAutoRouteAgentId.value = null

    if (!sessionIsAutoRoute) {
      const primaryAgentId = findSessionPrimaryAgentId(turns, detail.session.displayName)
      if (primaryAgentId) {
        await selectAgent(primaryAgentId, true)
      }
    }

    const restoredChat: ChatEntry[] = []
    let maxTurnIndex = 0
    for (const turn of turns) {
      const turnIndex = turn.turnIndex || restoredChat.length + 1
      maxTurnIndex = Math.max(maxTurnIndex, turnIndex)
      const createdAt = turn.createTime ? new Date(turn.createTime).getTime() : Date.now()
      const routeMode = isAutoRouteMode(turn.routeMode) ? 'auto' : 'manual'
      const failed = turn.status === 'FAILED'
      const pending = turn.status === 'RUNNING'
      const assistantContent = normalizeChatContent(turn.assistantMessage)
      const errorContent = failed && turn.errorMessage ? `运行失败：${turn.errorMessage}` : ''

      restoredChat.push({
        role: 'user',
        content: getTurnUserContent(turn),
        createdAt,
        turnId: turnIndex
      })
      restoredChat.push({
        role: 'assistant',
        content: assistantContent || errorContent,
        attachments: turn.attachments || [],
        agentId: routeMode === 'auto' ? undefined : turn.manualAgentId,
        agentName: getTurnAgentName(turn),
        departmentName: getTurnDepartmentName(turn),
        agentEmoji: getTurnAgentEmoji(turn),
        routeMode,
        createdAt,
        turnId: turnIndex,
        pending,
        failed
      })
    }

    chat.value = restoredChat
    chatTurnCounter = maxTurnIndex
    await nextTick()
    void scrollChatToLatest('auto')
  } catch (e: any) {
    errorMsg.value = e?.message || '聊天记录恢复失败'
  } finally {
    loadingChatSessionDetail.value = false
  }
}

const selectDepartment = (id: string) => {
  selectedDepartmentId.value = id
}

const selectAgent = async (id: string, keepChat = true) => {
  if (selectedAgentId.value === id && selectedAgent.value) return
  selectedAgentId.value = id
  errorMsg.value = ''
  if (!keepChat) {
    chat.value = []
    activeChatSessionId.value = null
    lastAutoRouteAgentId.value = null
    chatTurnCounter = 0
  }
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
  activeChatSessionId.value = null
  errorMsg.value = ''
  lastAutoRouteAgentId.value = null
  chatTurnCounter = 0
}

const runCurrentAgent = async () => {
  if (!canRun.value) return
  const manualAgent = selectedAgent.value
  if (!autoRouteEnabled.value && !manualAgent) return

  const currentMessage = message.value.trim()
  const currentFiles = [...selectedFiles.value]
  const history = [...chatHistoryForBackend.value]
  let autoRouteMatched = false
  let shouldRestoreCurrentFiles = false
  let refreshedRunningSession = false

  const restoreCurrentFiles = () => {
    if (autoRouteEnabled.value && currentFiles.length && shouldRestoreCurrentFiles && !selectedFiles.value.length) {
      selectedFiles.value = currentFiles
    }
  }

  running.value = true
  errorMsg.value = ''
  const createdAt = Date.now()
  const turnId = ++chatTurnCounter
  chat.value.push({
    role: 'user',
    content: currentMessage || currentFiles.map(file => file.name).join('\n'),
    createdAt,
    turnId
  })
  message.value = ''
  selectedFiles.value = []
  if (fileInput.value) fileInput.value.value = ''

  const assistantIndex = chat.value.push({
    role: 'assistant',
    content: '',
    attachments: [],
    agentId: autoRouteEnabled.value ? undefined : manualAgent?.id,
    agentName: autoRouteEnabled.value ? '自动路由模式' : manualAgent?.name,
    departmentName: autoRouteEnabled.value ? undefined : manualAgent?.departmentName,
    agentEmoji: autoRouteEnabled.value ? '◇' : manualAgent?.emoji,
    routeMode: autoRouteEnabled.value ? 'auto' : 'manual',
    createdAt,
    turnId,
    pending: true
  }) - 1
  const updateAssistant = (update: (entry: ChatEntry) => void) => {
    const entry = chat.value[assistantIndex]
    if (entry) {
      update(entry)
      void scrollChatToLatest('auto')
    }
  }

  void scrollChatToLatest()

  const applyStreamEvent = (event: AgencyAgentChatStreamEvent) => {
    if (event.sessionId) {
      activeChatSessionId.value = event.sessionId
      if (!refreshedRunningSession) {
        refreshedRunningSession = true
        void loadChatSessions(true)
      }
    }
    updateAssistant(entry => {
      if (event.agentId) entry.agentId = event.agentId
      if (event.agentName) entry.agentName = event.agentName
      if (event.departmentName) entry.departmentName = event.departmentName
      if (event.emoji) entry.agentEmoji = event.emoji

      if (event.type === 'ROUTE') {
        entry.routeStatus = event.routeStatus
        entry.routeReason = event.reason
        entry.routeCandidates = event.candidates || []
        if (event.routeStatus === 'MATCHED' && event.agentId) {
          autoRouteMatched = true
          lastAutoRouteAgentId.value = event.agentId
        }
        if (event.content) {
          entry.content = entry.content
            ? `${entry.content}\n\n${event.content}`
            : event.content
          if (event.routeStatus === 'MATCHED') {
            entry.content += '\n\n'
          }
        }
        if (
          event.routeStatus === 'NEEDS_CLARIFICATION'
          || event.routeStatus === 'WORKBENCH_HELP'
          || event.routeStatus === 'DIRECT_REPLY'
        ) {
          shouldRestoreCurrentFiles = true
          entry.pending = false
        }
        return
      }

      if (event.type === 'META') {
        entry.attachments = event.attachments || []
        return
      }
      if (event.type === 'DELTA') {
        entry.content += event.content || ''
        return
      }
      if (event.type === 'ERROR') {
        const message = event.message || 'Agent 运行失败'
        errorMsg.value = message
        if (autoRouteEnabled.value && !autoRouteMatched) {
          shouldRestoreCurrentFiles = true
        }
        entry.pending = false
        entry.failed = true
        entry.content = entry.content
          ? `${entry.content}\n\n运行失败：${message}`
          : `运行失败：${message}`
        return
      }
      if (event.type === 'DONE') {
        entry.pending = false
        if (!normalizeChatContent(entry.content)) {
          entry.content = 'Agent 未返回内容'
        }
      }
    })
  }

  try {
    if (autoRouteEnabled.value) {
      await runAgencyAgentAutoRouteStream(
        currentMessage,
        history,
        currentFiles,
        lastAutoRouteAgentId.value,
        activeChatSessionId.value,
        applyStreamEvent
      )
    } else if (manualAgent) {
      await runAgencyAgentStream(
        manualAgent.id,
        currentMessage,
        history,
        currentFiles,
        activeChatSessionId.value,
        applyStreamEvent
      )
    }
    updateAssistant(entry => {
      entry.pending = false
      if (!entry.failed && !normalizeChatContent(entry.content)) {
        entry.content = 'Agent 未返回内容'
      }
    })
  } catch (e: any) {
    errorMsg.value = e?.message || 'Agent 运行失败'
    if (autoRouteEnabled.value && !autoRouteMatched) {
      shouldRestoreCurrentFiles = true
    }
    updateAssistant(entry => {
      entry.pending = false
      entry.failed = true
      entry.content = entry.content
        ? `${entry.content}\n\n运行失败：${errorMsg.value}`
        : `运行失败：${errorMsg.value}`
    })
  } finally {
    restoreCurrentFiles()
    running.value = false
    updateAssistant(entry => {
      entry.pending = false
    })
    await loadChatSessions(true)
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

watch(chatHistoryCollapsed, value => {
  if (process.client && chatHistoryPreferenceReady) {
    localStorage.setItem(chatHistoryStorageKey, value ? '1' : '0')
  }
})

watch(autoRouteEnabled, value => {
  if (process.client) {
    localStorage.setItem(autoRouteStorageKey, value ? '1' : '0')
  }
})

onMounted(async () => {
  if (process.client) {
    autoRouteEnabled.value = localStorage.getItem(autoRouteStorageKey) === '1'
    workbenchMenuCollapsed.value = localStorage.getItem(workbenchMenuStorageKey) === '1'
    agentListCollapsed.value = localStorage.getItem(agentListStorageKey) === '1'
    const storedHistoryState = localStorage.getItem(chatHistoryStorageKey)
    chatHistoryCollapsed.value = storedHistoryState == null
      ? window.innerWidth < 1280
      : storedHistoryState === '1'
    void nextTick(() => {
      chatHistoryPreferenceReady = true
    })
  }
  await loadCurrentUser()
  await loadDepartments()
  await loadAgents()
  await loadChatSessions()
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  if (process.client && chatScrollFrame !== null) {
    window.cancelAnimationFrame(chatScrollFrame)
  }
})
</script>

<template>
  <div class="h-[calc(100vh-4rem)] min-h-[680px] bg-[#f6f7f4] text-slate-900 overflow-hidden">
    <div
      class="workbench-grid h-full grid grid-cols-1 border-t border-slate-200"
      :class="{
        'auto-route': autoRouteEnabled,
        'menu-collapsed': workbenchMenuCollapsed,
        'agent-list-collapsed': agentListCollapsed,
        'chat-history-collapsed': chatHistoryCollapsed
      }"
    >
      <aside
        v-show="!autoRouteEnabled && !workbenchMenuCollapsed"
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
        v-show="!autoRouteEnabled && !agentListCollapsed"
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
          <div v-if="autoRouteEnabled" class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 max-w-3xl">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-teal-100 bg-white text-lg text-teal-700">◇</span>
                <h2 class="text-2xl font-bold tracking-tight text-slate-950">自动路由模式</h2>
                <span class="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 ring-1 ring-teal-100">
                  自动匹配 Agent
                </span>
              </div>
              <p class="mt-2 text-slate-600 leading-relaxed">输入任务后，系统会根据 Agent skill 元数据自动选择最合适的角色。</p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-100"
                @click="toggleAutoRoute"
              >
                <span class="h-2 w-2 rounded-full bg-teal-500"></span>
                关闭自动路由
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
          <div v-else-if="selectedAgent" class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 max-w-3xl">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-if="!autoRouteEnabled && agentListCollapsed"
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
                  v-if="!autoRouteEnabled && agentListCollapsed && workbenchMenuCollapsed"
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
                class="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-50"
                @click="toggleAutoRoute"
              >
                <span class="h-2 w-2 rounded-full bg-slate-300"></span>
                自动路由
              </button>
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
              v-if="!autoRouteEnabled && agentListCollapsed"
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
              v-if="!autoRouteEnabled && agentListCollapsed && workbenchMenuCollapsed"
              type="button"
              class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
              title="展开部门菜单"
              @click="workbenchMenuCollapsed = false"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-50"
              @click="toggleAutoRoute"
            >
              <span class="h-2 w-2 rounded-full bg-slate-300"></span>
              自动路由
            </button>
            <span>{{ loadingDetail ? '加载角色中...' : '请选择一个 Agent' }}</span>
          </div>
        </div>

        <div ref="chatScrollRef" class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div v-if="errorMsg" class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ errorMsg }}
          </div>

          <div v-if="!chat.length" class="h-full min-h-[320px] rounded-lg border border-dashed border-slate-300 bg-white/60 flex items-center justify-center text-slate-500">
            <div class="text-center">
              <p class="text-sm font-medium">
                {{ autoRouteEnabled ? '输入任务后自动匹配 Agent' : `交给「${selectedAgent?.name || 'Agent'}」处理` }}
              </p>
              <p class="mt-1 text-xs text-slate-400">本页会保留当前对话上下文</p>
            </div>
          </div>

          <div v-else class="mx-auto flex w-full max-w-6xl flex-col gap-5">
            <article
              v-for="(item, index) in chat"
              :key="index"
              class="flex w-full items-start"
              :class="item.role === 'user'
                ? 'justify-end'
                : 'justify-start'"
            >
              <div
                v-if="item.role === 'assistant'"
                class="mr-3 mt-5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-white text-lg leading-none shadow-sm"
                :title="getEntryAgentName(item)"
              >
                {{ getEntryAgentEmoji(item) }}
              </div>
              <div
                class="flex min-w-0 max-w-[88%] flex-col sm:max-w-[76%] xl:max-w-[68%]"
                :class="item.role === 'user' ? 'items-end' : 'items-start'"
              >
                <div
                  class="mb-1.5 flex items-center gap-2 px-1 text-xs"
                  :class="item.role === 'user' ? 'justify-end text-right' : 'justify-start text-left'"
                >
                  <span
                    class="font-semibold"
                    :class="item.role === 'user' ? 'text-[#8f4d3a]' : 'text-teal-700'"
                  >
                    {{ item.role === 'user' ? currentUserChatTitle : getEntryAgentName(item) }}
                  </span>
                  <span
                    v-if="item.role === 'assistant' && index === chat.length - 1 && !item.failed"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1"
                    :class="item.pending
                      ? 'bg-amber-50 text-amber-700 ring-amber-100'
                      : 'bg-teal-50 text-teal-700 ring-teal-100'"
                  >
                    {{ item.pending ? '运行中' : '运行完成' }}
                  </span>
                </div>
                <div
                  class="rounded-lg border px-4 py-3 shadow-sm"
                  :class="item.role === 'user'
                    ? 'rounded-tr-sm border-[#e8c9bb] bg-[#fff7f3] shadow-[#d98b73]/10'
                    : 'rounded-tl-sm border-teal-100 bg-white shadow-slate-200/70'"
                >
                  <div
                    v-if="item.role === 'assistant'"
                    class="chat-markdown text-sm leading-7 text-slate-800"
                    v-html="renderAssistantMarkdown(item)"
                  ></div>
                  <p v-else class="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{{ getChatDisplayContent(item) }}</p>
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
              </div>
            </article>
          </div>
        </div>

        <div class="border-t border-slate-200 bg-[#fbfaf6] px-4 py-4 sm:px-6">
          <div class="mx-auto max-w-6xl rounded-lg border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)] transition focus-within:border-[#d98b73] focus-within:ring-4 focus-within:ring-[#d98b73]/10">
            <textarea
              v-model="message"
              rows="3"
              class="block min-h-[96px] w-full resize-none border-0 bg-transparent px-4 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
              :placeholder="currentInputPlaceholder"
            />

            <div v-if="selectedFiles.length" class="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-3">
              <span
                v-for="(file, index) in selectedFiles"
                :key="file.name + index"
                class="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-2 text-xs text-slate-700"
              >
                <span class="truncate">{{ file.name }}</span>
                <button
                  type="button"
                  class="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  title="移除附件"
                  @click="removeFile(index)"
                >
                  ×
                </button>
              </span>
            </div>

            <div class="flex flex-col gap-3 border-t border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
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
                  class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  title="添加附件"
                  @click="fileInput?.click()"
                >
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.5 6.5l-7.78 7.78a3 3 0 104.24 4.24l8.49-8.49a5 5 0 00-7.07-7.07L5.64 11.7a7 7 0 109.9 9.9l6.36-6.36" />
                  </svg>
                </button>
                <span class="inline-flex min-h-9 items-center rounded-full bg-slate-50 px-3 text-xs font-medium text-slate-500 ring-1 ring-slate-100">
                  {{ selectedFiles.length ? `${selectedFiles.length} 个附件` : runStatusText }}
                </span>
              </div>
              <button
                type="button"
                class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#c87861] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#b86650] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto"
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

      <aside
        class="chat-history-panel min-h-0 border-l border-slate-200 bg-[#fbfaf6] shadow-[0_0_30px_rgba(15,23,42,0.06)] transition-transform duration-200"
        :class="chatHistoryCollapsed ? 'chat-history-panel-collapsed' : 'chat-history-panel-open'"
      >
        <div
          v-if="chatHistoryCollapsed"
          class="flex h-full min-h-0 flex-col items-center gap-4 px-2 py-4"
        >
          <button
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
            title="展开聊天记录"
            @click="chatHistoryCollapsed = false"
          >
            <svg class="h-5 w-5 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div class="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
            <span class="history-rail-label text-xs font-semibold tracking-widest">聊天记录</span>
            <span class="rounded-full bg-white px-2 py-1 text-xs font-bold text-teal-700 ring-1 ring-teal-100">
              {{ chatSessionCount }}
            </span>
          </div>
        </div>

        <div v-else class="flex h-full min-h-0 flex-col">
          <header class="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-4">
            <div class="min-w-0">
              <p class="text-xs font-medium text-slate-500">我的 Agent 工作台会话</p>
              <h3 class="mt-0.5 truncate text-base font-bold text-slate-950">聊天记录</h3>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <span class="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-teal-100">
                {{ chatSessionCount }} 条
              </span>
              <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                title="折叠聊天记录"
                @click="chatHistoryCollapsed = true"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto p-3">
            <div
              v-if="loadingChatSessions"
              class="flex h-full min-h-[240px] items-center justify-center rounded-lg border border-slate-200 bg-white/70 px-5 text-center"
            >
              <div>
                <p class="text-sm font-semibold text-slate-700">正在加载聊天记录</p>
                <p class="mt-1 text-xs leading-5 text-slate-500">稍等一下，正在读取你的工作台会话。</p>
              </div>
            </div>

            <div
              v-else-if="!chatSessions.length"
              class="flex h-full min-h-[240px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/70 px-5 text-center"
            >
              <div>
                <p class="text-sm font-semibold text-slate-700">暂无聊天记录</p>
                <p class="mt-1 text-xs leading-5 text-slate-500">运行 Agent 后，这里会保存你的工作台会话。</p>
              </div>
            </div>

            <ol v-else class="space-y-3">
              <li
                v-for="session in chatSessions"
                :key="session.id"
              >
                <button
                  type="button"
                  class="w-full rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  :class="activeChatSessionId === session.id
                    ? 'border-teal-300 ring-2 ring-teal-100'
                    : 'border-slate-200'"
                  :disabled="running || loadingChatSessionDetail"
                  @click="openChatSession(session.id)"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-bold text-slate-950" :title="getSessionDisplayName(session)">
                        {{ getSessionDisplayName(session) }}
                      </p>
                      <p class="mt-0.5 truncate text-[11px] font-medium text-slate-400" :title="session.title">
                        {{ session.title || 'Agent 工作台会话' }}
                      </p>
                    </div>
                    <span :class="['shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold', getSessionStatusClass(session.status)]">
                      {{ getSessionStatusLabel(session.status) }}
                    </span>
                  </div>

                  <p class="mt-3 line-clamp-3 text-xs leading-5 text-slate-700">
                    {{ getHistoryPreview(session.summary, '暂无摘要') }}
                  </p>
                  <div class="mt-3 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-400">
                    <span>{{ session.turnCount || 0 }} 轮</span>
                    <span>{{ formatSessionTime(session.updateTime || session.createTime) }}</span>
                  </div>
                </button>
              </li>
            </ol>
          </div>
        </div>
      </aside>
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

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chat-history-panel {
  display: flex;
  flex-direction: column;
}

.history-rail-label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.chat-markdown {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.chat-markdown :deep(p) {
  margin: 0 0 0.75rem;
}

.chat-markdown :deep(p:last-child),
.chat-markdown :deep(ul:last-child),
.chat-markdown :deep(ol:last-child),
.chat-markdown :deep(pre:last-child),
.chat-markdown :deep(blockquote:last-child),
.chat-markdown :deep(table:last-child) {
  margin-bottom: 0;
}

.chat-markdown :deep(h1),
.chat-markdown :deep(h2),
.chat-markdown :deep(h3),
.chat-markdown :deep(h4) {
  margin: 0.9rem 0 0.45rem;
  color: #0f172a;
  font-weight: 800;
  line-height: 1.35;
}

.chat-markdown :deep(h1:first-child),
.chat-markdown :deep(h2:first-child),
.chat-markdown :deep(h3:first-child),
.chat-markdown :deep(h4:first-child) {
  margin-top: 0;
}

.chat-markdown :deep(h1) {
  font-size: 1.25rem;
}

.chat-markdown :deep(h2) {
  font-size: 1.125rem;
}

.chat-markdown :deep(h3) {
  font-size: 1rem;
}

.chat-markdown :deep(h4) {
  font-size: 0.95rem;
}

.chat-markdown :deep(ul),
.chat-markdown :deep(ol) {
  margin: 0.45rem 0 0.75rem;
  padding-left: 1.35rem;
}

.chat-markdown :deep(ul) {
  list-style: disc;
}

.chat-markdown :deep(ol) {
  list-style: decimal;
}

.chat-markdown :deep(li) {
  margin: 0.2rem 0;
  padding-left: 0.1rem;
}

.chat-markdown :deep(blockquote) {
  margin: 0.75rem 0;
  border-left: 3px solid #99f6e4;
  background: #f0fdfa;
  padding: 0.6rem 0.85rem;
  color: #334155;
}

.chat-markdown :deep(code) {
  border-radius: 0.35rem;
  background: #f1f5f9;
  padding: 0.1rem 0.35rem;
  color: #9f1239;
  font-size: 0.88em;
}

.chat-markdown :deep(pre) {
  margin: 0.75rem 0;
  max-width: 100%;
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: #0f172a;
  padding: 0.85rem 1rem;
  color: #e2e8f0;
  line-height: 1.65;
}

.chat-markdown :deep(pre code) {
  background: transparent;
  padding: 0;
  color: inherit;
  white-space: pre;
}

.chat-markdown :deep(a) {
  color: #0f766e;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.chat-markdown :deep(table) {
  display: block;
  max-width: 100%;
  margin: 0.75rem 0;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 0.92em;
}

.chat-markdown :deep(th),
.chat-markdown :deep(td) {
  border: 1px solid #cbd5e1;
  padding: 0.45rem 0.6rem;
  text-align: left;
  vertical-align: top;
}

.chat-markdown :deep(th) {
  background: #f8fafc;
  color: #0f172a;
  font-weight: 700;
}

.chat-markdown :deep(hr) {
  margin: 1rem 0;
  border: 0;
  border-top: 1px solid #e2e8f0;
}

@media (min-width: 1280px) {
  .workbench-grid {
    --history-width: 21rem;
    grid-template-columns: 15rem 24rem minmax(0, 1fr) var(--history-width);
  }

  .workbench-grid.chat-history-collapsed {
    --history-width: 4rem;
  }

  .workbench-grid.menu-collapsed {
    grid-template-columns: 24rem minmax(0, 1fr) var(--history-width);
  }

  .workbench-grid.agent-list-collapsed {
    grid-template-columns: 15rem minmax(0, 1fr) var(--history-width);
  }

  .workbench-grid.menu-collapsed.agent-list-collapsed {
    grid-template-columns: minmax(0, 1fr) var(--history-width);
  }

  .workbench-grid.auto-route,
  .workbench-grid.auto-route.menu-collapsed,
  .workbench-grid.auto-route.agent-list-collapsed,
  .workbench-grid.auto-route.menu-collapsed.agent-list-collapsed {
    grid-template-columns: minmax(0, 1fr) var(--history-width);
  }

  .chat-history-panel {
    position: relative;
    inset: auto;
    width: auto;
    transform: none !important;
  }
}

@media (max-width: 1279px) {
  .chat-history-panel {
    position: fixed;
    top: 4rem;
    right: 0;
    bottom: 0;
    z-index: 40;
    width: min(22rem, calc(100vw - 1rem));
  }

  .chat-history-panel-collapsed {
    transform: translateX(calc(100% - 3.75rem));
  }

  .chat-history-panel-open {
    transform: translateX(0);
  }
}
</style>
