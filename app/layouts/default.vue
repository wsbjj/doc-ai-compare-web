<script setup lang="ts">
const route = useRoute()

const userId = ref<string | null>(null)
const userName = ref<string | null>(null)
const userStudentNo = ref<string | null>(null)
const userAvatar = ref<string | null>(null)

const recordsMenuOpen = ref(true)
const sidebarCollapsed = ref(false)
const sidebarStorageKey = 'doc-ai-sidebar-collapsed'

type TopLink = { name: string; path: string; icon: string }

const menuTopLinks: TopLink[] = [
  {
    name: '数据面板',
    path: '/dashboard',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />'
  },
  {
    name: '文档对比',
    path: '/doc-compare',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />'
  },
  {
    name: '文档检索',
    path: '/search',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />'
  },
  {
    name: '文档上传',
    path: '/upload',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />'
  },
  {
    name: '文档质检',
    path: '/agent',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />'
  },
  {
    name: 'Agent 工作台',
    path: '/agency-agents',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a7 7 0 017 7v3a3 3 0 01-3 3H8a3 3 0 01-3-3v-3a7 7 0 017-7zm-3 7h.01M15 13h.01M9 17h6M4 13H2m20 0h-2" />'
  }
]

const recordGroupIcon =
  '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />'

const recordSubLinks = [
  { name: '文档对比记录', path: '/records/doc-compare' },
  { name: '文档审查记录', path: '/records/paper-review' }
]

const flatNavForTitle = computed(() => {
  const top = menuTopLinks.map(i => ({ name: i.name, path: i.path }))
  const sub = recordSubLinks.map(i => ({ name: i.name, path: i.path }))
  return [...top, ...sub]
})

const currentPageTitle = computed(
  () => flatNavForTitle.value.find(i => i.path === route.path)?.name ?? '项目材料独创性智能审查系统'
)

const isNavActive = (path: string) => route.path === path

const isRecordSectionActive = computed(() =>
  recordSubLinks.some(s => route.path === s.path)
)

watch(sidebarCollapsed, value => {
  if (process.client) {
    localStorage.setItem(sidebarStorageKey, value ? '1' : '0')
  }
})

const normalizeAvatarSrc = (avatar?: string | null): string | null => {
  if (!avatar) return null
  if (avatar.startsWith('data:image/')) return avatar
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar
  const base64 = avatar
  if (base64.startsWith('iVBOR')) return `data:image/png;base64,${base64}`
  if (base64.startsWith('/9j/') || base64.startsWith('\/9j\/')) return `data:image/jpeg;base64,${base64}`
  if (base64.startsWith('R0lGOD')) return `data:image/gif;base64,${base64}`
  return `data:image/jpeg;base64,${base64}`
}

onMounted(async () => {
  if (process.client) {
    sidebarCollapsed.value = localStorage.getItem(sidebarStorageKey) === '1'
  }

  try {
    const res = await $fetch<{
      code: number
      data?: {
        loggedIn?: boolean
        user?: { id: string; name?: string; realName?: string; studentNo?: string }
      }
      message?: string
    }>('/api/auth/me', {
      credentials: 'include'
    })

    if (res.data?.loggedIn && res.data.user?.id) {
      userId.value = res.data.user.id
      userName.value = res.data.user.name || res.data.user.realName || null
      userStudentNo.value = res.data.user.studentNo || null
      userAvatar.value = res.data.user.avatar || null
    }
  } catch {
    // 忽略头像区域的错误
  }
})

const logout = async () => {
  try {
    const res = await $fetch<{
      code: number
      data?: {
        casLogoutUrl?: string
      }
      message?: string
    }>('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    })

    const url = res?.data?.casLogoutUrl
    if (url) {
      window.location.href = url
    } else {
      window.location.reload()
    }
  } catch (_e) {
    window.location.reload()
  }
}
</script>

<template>
  <div class="flex h-screen bg-gray-50 overflow-hidden">

    <aside
      class="bg-white border-r border-gray-200 flex flex-col shadow-sm z-20 transition-[width] duration-200"
      :class="sidebarCollapsed ? 'w-20' : 'w-64'"
    >
      <div
        class="h-16 flex items-center border-b border-gray-100 bg-indigo-600 px-3"
        :class="sidebarCollapsed ? 'justify-center gap-1' : 'justify-between gap-2'"
      >
        <h1
          class="min-w-0 text-white font-semibold text-base tracking-wide flex items-center gap-2 whitespace-nowrap"
          title="项目材料独创性智能审查系统"
        >
          <svg class="w-4 h-4 text-white/90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 13h4v8H3v-8zm7-6h4v14h-4V7zm7 3h4v11h-4V10zM3 3h18" />
          </svg>
          <span v-show="!sidebarCollapsed" class="leading-none truncate">项目材料独创性智能审查系统</span>
        </h1>
        <button
          type="button"
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
          :title="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <svg class="h-5 w-5 transition-transform" :class="sidebarCollapsed ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <nav class="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
        <NuxtLink
          v-for="item in menuTopLinks"
          :key="item.path"
          :to="item.path"
          class="relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group"
          :title="sidebarCollapsed ? item.name : undefined"
          :class="[
            isNavActive(item.path)
              ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            sidebarCollapsed ? 'justify-center px-0' : ''
          ]"
        >
          <svg
            class="w-5 h-5 transition-colors"
            :class="isNavActive(item.path) ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            v-html="item.icon"
          />
          <span v-show="!sidebarCollapsed">{{ item.name }}</span>
          <span v-if="isNavActive(item.path)" class="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
        </NuxtLink>

        <div
          class="rounded-lg border transition-colors"
          :class="isRecordSectionActive ? 'border-indigo-200 bg-indigo-50/50' : 'border-transparent'"
        >
          <button
            type="button"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200"
            :title="sidebarCollapsed ? '记录' : undefined"
            :class="[
              isRecordSectionActive
                ? 'text-indigo-800 font-semibold'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              sidebarCollapsed ? 'justify-center px-0' : ''
            ]"
            :aria-expanded="recordsMenuOpen"
            aria-controls="nav-records-sub"
            @click="recordsMenuOpen = !recordsMenuOpen"
          >
            <svg
              class="w-5 h-5 shrink-0"
              :class="isRecordSectionActive ? 'text-indigo-600' : 'text-gray-400'"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              v-html="recordGroupIcon"
            />
            <span v-show="!sidebarCollapsed" class="flex-1">记录</span>
            <svg
              v-show="!sidebarCollapsed"
              class="w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200"
              :class="recordsMenuOpen ? 'rotate-180' : ''"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <div
            v-show="recordsMenuOpen && !sidebarCollapsed"
            id="nav-records-sub"
            class="pb-2 pl-2 space-y-1"
          >
            <NuxtLink
              v-for="sub in recordSubLinks"
              :key="sub.path"
              :to="sub.path"
              class="relative flex items-center gap-2 pl-9 pr-3 py-2 rounded-md text-sm transition-colors"
              :class="isNavActive(sub.path)
                ? 'bg-indigo-100 text-indigo-800 font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
            >
              {{ sub.name }}
              <span v-if="isNavActive(sub.path)" class="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full" />
            </NuxtLink>
          </div>
        </div>
      </nav>

      <div class="p-4 border-t border-gray-100">
        <div class="flex items-center gap-3" :class="sidebarCollapsed ? 'justify-center' : ''">
          <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
            <img
              v-if="normalizeAvatarSrc(userAvatar)"
              :src="normalizeAvatarSrc(userAvatar) as string"
              alt="用户头像"
              class="w-full h-full object-cover"
            />
            <div v-else class="text-lg">👨‍💻</div>
          </div>
          <div v-show="!sidebarCollapsed" class="min-w-0">
            <p class="text-sm font-medium text-gray-700">
              {{ userName || userId || '系统管理员' }}
            </p>
            <p class="text-xs text-gray-400">
              {{ userStudentNo || userId || ' ' }}
            </p>
          </div>
        </div>
      </div>
    </aside>

    <main class="flex-1 flex flex-col h-full overflow-hidden relative">
      <header class="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between shadow-sm z-10">
        <h2 class="text-lg font-semibold text-gray-800">
          {{ currentPageTitle }}
        </h2>
        <div class="flex gap-4 items-center">
          <button class="text-gray-400 hover:text-indigo-600 transition-colors">🔔</button>
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            @click="logout"
          >
            退出
          </button>
        </div>
      </header>
      <div class="flex-1 overflow-y-auto p-0 bg-gray-50 scroll-smooth">
        <slot />
      </div>
    </main>
  </div>
</template>

<style>
aside nav svg {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
