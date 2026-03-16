<script setup lang="ts">
import {useRoute} from 'vue-router'

const route = useRoute()

// 定义菜单项
const menuItems = [
  // 🆕 新增：数据面板 (作为第一个选项)
  {
    name: '数据面板',
    path: '/dashboard',
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />'
  },
  {
    name: '文档对比',
    path: '/',
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
  }
]

// 判断链接是否激活
const isActive = (path: string) => route.path === path
</script>

<template>
  <div class="flex h-screen bg-gray-50 overflow-hidden">

    <aside class="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-20">
      <div class="h-16 flex items-center justify-center border-b border-gray-100 bg-indigo-600">
        <h1 class="text-white font-bold text-xl tracking-wider flex items-center gap-2">
          <span>📊</span> 文档智能平台
        </h1>
      </div>

      <nav class="flex-1 py-6 px-3 space-y-2 overflow-y-auto">
        <NuxtLink
            v-for="item in menuItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group"
            :class="isActive(item.path)
            ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
        >
          <svg class="w-5 h-5 transition-colors"
               :class="isActive(item.path) ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'"
               fill="none" viewBox="0 0 24 24" stroke="currentColor" v-html="item.icon">
          </svg>
          <span>{{ item.name }}</span>
          <span v-if="isActive(item.path)" class="absolute right-3 w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
        </NuxtLink>
      </nav>

      <div class="p-4 border-t border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">👨‍💻</div>
          <div>
            <p class="text-sm font-medium text-gray-700">系统管理员</p>
            <p class="text-xs text-gray-400">admin@system.com</p>
          </div>
        </div>
      </div>
    </aside>

    <main class="flex-1 flex flex-col h-full overflow-hidden relative">
      <header class="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between shadow-sm z-10">
        <h2 class="text-lg font-semibold text-gray-800">
          {{ menuItems.find(i => i.path === route.path)?.name }}
        </h2>
        <div class="flex gap-4">
          <button class="text-gray-400 hover:text-indigo-600 transition-colors">🔔</button>
        </div>
      </header>
      <div class="flex-1 overflow-y-auto p-0 bg-gray-50 scroll-smooth">
        <slot/>
      </div>
    </main>
  </div>
</template>

<style>
aside nav svg {
  width: 1.25rem; /* 20px */
  height: 1.25rem; /* 20px */
}
</style>