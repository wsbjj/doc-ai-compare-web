// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },

    // 运行时配置：前端可用的后端基础地址
    runtimeConfig: {
        public: {
            backendBaseUrl: 'http://192.168.4.196:8080'
        }
    },

    // 注册模块
    modules: [
        '@nuxtjs/tailwindcss'
    ],

    // Tailwind 模块配置：关闭 viewer / editorSupport，禁用自动注入 CSS，避免 Windows 绝对路径问题
    tailwindcss: {
        cssPath: false,
        viewer: false,
        exposeConfig: false,
        editorSupport: {
            autocompleteUtil: false,
        },
    },

    nitro: {
        devProxy: {
            '/api': {
                target: 'http://192.168.4.196:8080/api', // 这里填你 Java 后端的地址
                changeOrigin: true,
            }
        },
        routeRules: {
            // 登录页关闭 SSR，避免在 Node Worker 中渲染，防止堆内存溢出
            '/login': { ssr: false },
            // 上传页关闭 SSR，避免在 Node Worker 中渲染触发内存溢出
            '/upload': { ssr: false }
        }
    },

    devServer: {
        port: 5001,
        host: '0.0.0.0'
    }
})
