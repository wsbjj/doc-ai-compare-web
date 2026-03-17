<script setup lang="ts">
// 错误页作为公共路由，避免再次被中间件拦截
// @ts-ignore
definePageMeta({
  layout: false,
  public: true
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
      <div class="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-2xl mb-4">
        ⚠️
      </div>
      <h1 class="text-xl font-bold text-gray-900 mb-2">访问异常</h1>
      <p class="text-sm text-gray-500 mb-6">
        无法确认当前登录状态，请返回首页或重新尝试通过统一认证登录。
      </p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <NuxtLink
          to="/"
          class="inline-flex justify-center px-4 py-2.5 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          返回首页
        </NuxtLink>
        <NuxtLink
          to="/login"
          class="inline-flex justify-center px-4 py-2.5 text-sm font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
        >
          去登录页
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

