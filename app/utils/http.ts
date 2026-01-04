// app/utils/http.ts
import type { FetchOptions } from 'ofetch'

// 定义后端通用的响应结构
interface ApiResponse<T> {
    code: number
    message: string
    data: T
}

/**
 * 封装 $fetch
 * 1. 解决 TS 类型报错：显式使用 FetchOptions 类型
 * 2. 自动解包：提取 data
 * 3. 统一错误处理
 */
export const http = async <T>(url: string, options?: FetchOptions) => {
    return await $fetch<T>(url, {
        ...options,

        // 请求拦截器
        onRequest({ options }) {
            // 如果需要鉴权，可以在这里添加 token
            // const token = useCookie('token')
            // if (token.value) {
            //   options.headers = { ...options.headers, Authorization: token.value }
            // }
        },

        // 响应拦截器
        onResponse({ response }) {
            // _data 是 $fetch 自动解析后的 JSON 对象（或者是 text/blob）
            const res = response._data

            // 判断是否是后端包装的标准 JSON (包含 code 和 data)
            // 这一步非常关键：防止把 Diff 接口返回的 HTML 字符串当成 JSON 处理报错
            if (res && typeof res === 'object' && 'code' in res && 'data' in res) {
                if (res.code === 200) {
                    // ✅ 核心：解包，将 data 的内容直接赋值给 _data，覆盖外层结构
                    response._data = res.data
                } else {
                    // ❌ 业务错误 (如 401, 500)，抛出错误让前端 catch
                    throw new Error(res.message || '系统繁忙')
                }
            }
            // 如果不是标准 JSON（比如是 HTML 字符串），直接放行，不做任何修改
        },

        // 网络错误拦截 (如 404, 500, 断网)
        onResponseError({ response }) {
            throw new Error(response._data?.message || `请求失败: ${response.status}`)
        }
    })
}