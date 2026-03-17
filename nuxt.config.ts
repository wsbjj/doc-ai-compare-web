// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
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
            generateConfig: false,
        },
    },
    nitro: {
        devProxy: {
            '/api': {
                target: 'http://localhost:8088/api', // 这里填你 Java 后端的地址
                changeOrigin: true,
            }
        }
    },
    devServer: {
        port: 5001,
        host: '127.0.0.1'
    }
})
