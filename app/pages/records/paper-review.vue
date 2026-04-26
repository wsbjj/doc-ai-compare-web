<script setup lang="ts">
definePageMeta({
  layout: 'default',
  ssr: false
})
</script>

<template>
  <div class="p-8 max-w-2xl mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">文档审查记录</h1>
      <p class="text-sm text-gray-500 mt-1">论文质检（多 Agent 流水线）历史将在此集中展示。</p>
    </div>

    <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
      <p class="text-gray-600 text-sm leading-relaxed">
        该功能正在接入中。您可先在「文档质检」页面上传论文并查看单次任务结果。
      </p>
      <NuxtLink
        to="/agent"
        class="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        前往文档质检
      </NuxtLink>
    </div>
  </div>
</template>
