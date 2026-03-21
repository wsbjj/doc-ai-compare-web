<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// 禁用默认布局，登录页为公共路由
// @ts-ignore
definePageMeta({
  layout: false,
  public: true
})

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const errorMsg = ref('')

// 如果已经登录则自动跳转到 /dashboard（处理 CAS 回调或用户手动访问 /login 的情况）
onMounted(async () => {
  // 来自鉴权中间件的提示
  if (route.query.needLogin) {
    errorMsg.value = '请登录'
  }

  const noPermission = route.query.noPermission === '1'

  try {
    const res = await $fetch<{
      code: number
      data?: {
        loggedIn?: boolean
        casLoginUrl?: string
        user?: {
          id: string
          typeCode?: string
          typeId?: string
          typeName?: string
          name?: string
          studentNo?: string
          avatar?: string | null
        }
        userPreview?: {
          typeCode?: string
          typeId?: string
          typeName?: string
        }
      }
      message?: string
    }>('/api/auth/me', {
      credentials: 'include'
    })

    const data = res.data || {}

    if (data.loggedIn) {
      await router.push('/dashboard')
      return
    }

    if (noPermission) {
      const preview = data.userPreview || {}
      console.log('noPermission preview:', {
        typeCode: preview.typeCode,
        typeId: preview.typeId,
        typeName: preview.typeName
      })

      const msg = '无权限：仅老师可登录'
      alert(msg)
      errorMsg.value = msg
    }
  } catch {
    // 忽略自动重定向错误，仍然停留在登录页
  }
})

// 统一认证登录：根据 /auth/me 返回的 casLoginUrl 跳转到 CAS
const handleSsoLogin = async () => {
  loading.value = true
  errorMsg.value = ''

  try {
    const res = await $fetch<{
      code: number
      data?: {
        loggedIn?: boolean
        user?: { id: string }
        casLoginUrl?: string
      }
      message?: string
    }>('/api/auth/me', {
      credentials: 'include'
    })

    const data = res.data

    if (data?.loggedIn) {
      await router.push('/dashboard')
      return
    }

    if (data?.casLoginUrl && process.client) {
      window.location.href = data.casLoginUrl
      return
    }

    errorMsg.value = res.message || '无法获取统一认证登录地址，请联系管理员'
  } catch (_e) {
    errorMsg.value = '统一认证服务异常，请稍后再试'
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
        智能文档查重平台
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        AI 驱动的文档查重与数字化管理系统
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
      <div class="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-gray-100 flex flex-col items-center space-y-6">
        <p class="text-sm text-gray-600 text-center">
          本系统已接入统一身份认证，请点击下方按钮完成登录。
        </p>

        <div v-if="errorMsg" class="w-full rounded-md bg-red-50 p-3">
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

        <button
          type="button"
          @click="handleSsoLogin"
          :disabled="loading"
          class="w-full inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {{ loading ? '跳转中...' : '统一认证登录' }}
        </button>
      </div>
    </div>
  </div>
</template>