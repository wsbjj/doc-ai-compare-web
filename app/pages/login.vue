<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

// 1. 禁用布局
definePageMeta({
  layout: false
})

const router = useRouter()

// 2. 定义响应式数据 form
// 必须在 setup 顶层初始化，确保模板能立即访问
const form = ref({
  username: '',
  password: '',
  remember: false
})

const loading = ref(false)
const errorMsg = ref('')

// 3. 登录逻辑
const handleLogin = async () => {
  if (!form.value.username || !form.value.password) {
    errorMsg.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  errorMsg.value = ''

  try {
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 模拟登录成功 (admin / 123456)
    if (form.value.username === 'admin' && form.value.password === '123456') {
      router.push('/dashboard')
    } else {
      throw new Error('用户名或密码错误')
    }
  } catch (e: any) {
    errorMsg.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">

    <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
      <div class="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] bg-indigo-100 rounded-full opacity-30 blur-3xl"></div>
      <div class="absolute bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-100 rounded-full opacity-30 blur-3xl"></div>
    </div>

    <div class="sm:mx-auto sm:w-full sm:max-w-md z-10">
      <div class="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl flex items-center justify-center text-3xl shadow-lg text-white mb-6">
        📄
      </div>
      <h2 class="text-center text-3xl font-extrabold text-gray-900">
        智能文档平台
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        AI 驱动的文档数字化管理系统
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
      <div class="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-gray-100">

        <form class="space-y-6" @submit.prevent="handleLogin">

          <div>
            <label for="username" class="block text-sm font-medium text-gray-700">账号</label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                  v-model="form.username"
                  id="username"
                  name="username"
                  type="text"
                  required
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="请输入用户名 (admin)"
              >
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">密码</label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <input
                  v-model="form.password"
                  id="password"
                  name="password"
                  type="password"
                  required
                  class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="请输入密码 (123456)"
              >
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <input
                  v-model="form.remember"
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              >
              <label for="remember-me" class="ml-2 block text-sm text-gray-900">
                记住我
              </label>
            </div>
            <div class="text-sm">
              <a href="#" class="font-medium text-indigo-600 hover:text-indigo-500">
                忘记密码?
              </a>
            </div>
          </div>

          <div v-if="errorMsg" class="rounded-md bg-red-50 p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">{{ errorMsg }}</h3>
              </div>
            </div>
          </div>

          <div>
            <button
                type="submit"
                :disabled="loading"
                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {{ loading ? '登录中...' : '立即登录' }}
            </button>
          </div>
        </form>

        <div class="mt-6">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-gray-500">或通过以下方式登录</span>
            </div>
          </div>
          <div class="mt-6 grid grid-cols-2 gap-3">
            <button class="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">微信</button>
            <button class="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">统一认证</button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>