export default defineNuxtRouteMiddleware(async (to, _from) => {
  // 标记为 public 的路由直接放行，例如登录页、错误页等
  if (to.meta?.public) {
    return
  }

  try {
    // 根据后端文档，Result 结构为 { code, data, message }
    const res = await $fetch<{
      code: number
      data?: {
        loggedIn?: boolean
        user?: { id: string }
        casLoginUrl?: string
      }
      message?: string
    }>('/auth/me', {
      baseURL: 'http://192.168.4.196:8088',
      credentials: 'include'
    })

    const data = res?.data

    if (data?.loggedIn) {
      // 已登录，直接放行；如有需要可在此把 user 存入全局状态
      return
    }

    // 未登录但返回了 CAS 登录地址，跳转到统一认证中心
    if (data?.casLoginUrl) {
      if (process.client) {
        window.location.href = data.casLoginUrl
      }
      return
    }
  } catch (_e) {
    // 调用失败时走兜底逻辑
  }

  // 兜底：既没登录也没有 casLoginUrl 或出现异常
  return navigateTo('/error')
})

