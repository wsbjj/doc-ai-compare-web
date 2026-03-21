export default defineNuxtRouteMiddleware(async (to, _from) => {
  // 标记为 public 的路由直接放行，例如登录页、错误页等
  if (to.meta?.public) {
    return
  }

  const config = useRuntimeConfig()
  const requestHeaders = useRequestHeaders(['cookie'])

  // 同时兼容：
  // - SSR：使用后端绝对地址，避免 SSR 期间相对 /api/* 被误解析
  // - Client：使用本域名 /api 代理地址，避免浏览器跨域 CORS
  const meUrl = process.server
    ? `${config.public.backendBaseUrl}/api/auth/me`
    : '/api/auth/me'

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
    }>(meUrl, {
      credentials: 'include',
      // SSR 场景下把浏览器 cookie 转发给后端，保证能拿到登录态
      headers: process.server && requestHeaders.cookie ? { cookie: requestHeaders.cookie } : undefined
    })

    const data = res?.data

    if (data?.loggedIn) {
      // 老师：正常登录态，按你的要求打印 type_name / type_id
      console.log('login user:', {
        typeCode: data.user?.typeCode,
        typeId: data.user?.typeId,
        typeName: data.user?.typeName,
        name: data.user?.name,
        studentNo: data.user?.studentNo,
        avatar: data.user?.avatar
      })
      return
    }

    // 未登录：不要自动跳转 CAS
    // 只提示并引导用户到前端登录页，由用户手动点击“统一认证登录”后再跳转 CAS
  } catch (_e) {
    // 调用失败也按未登录处理
  }

  // 未登录：跳到登录页并提示“请登录”
  return navigateTo({ path: '/login', query: { needLogin: '1' } }, { replace: true })
})

