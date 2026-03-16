# doc-ai-compare-web

基于 Nuxt 4 + Vue 3 + TailwindCSS 的智能文档对比分析 Web 应用。

## 项目概述

本项目是一个 AI 驱动的文档对比分析平台，提供文档上传、智能对比、知识库检索、AI 分析报告生成等功能。

## 技术栈

- **框架**: Nuxt 4.2.2 + Vue 3.5.26
- **样式**: TailwindCSS
- **语言**: TypeScript
- **包管理器**: pnpm
- **后端**: Java (代理到 localhost:8082/api)

## 核心依赖

| 依赖 | 用途 |
|------|------|
| `nuxt` | 服务端渲染框架 |
| `vue` / `vue-router` | 前端框架与路由 |
| `@nuxtjs/tailwindcss` | CSS 框架集成 |
| `mammoth` | Word 文档解析 |
| `docx` | Word 文档生成 |
| `html2canvas` / `html2pdf.js` / `jspdf` | PDF 导出 |
| `mark.js` | 文本高亮标注 |

## 项目结构

```
doc-ai-compare-web/
├── app/
│   ├── app.vue              # 根组件
│   ├── pages/               # 页面路由
│   │   ├── index.vue        # 文档对比页（首页）
│   │   ├── dashboard.vue    # 数据大屏
│   │   ├── upload.vue       # 文件上传
│   │   ├── search.vue       # 知识库检索
│   │   ├── report.vue       # 分析报告
│   │   └── login.vue        # 登录页
│   ├── components/          # 可复用组件
│   │   └── AiAnalysisCard.vue
│   ├── layouts/             # 布局组件
│   │   └── default.vue
│   ├── services/            # API 服务层
│   │   └── docCompareApi.ts # 文档对比相关 API
│   ├── utils/               # 工具函数
│   │   └── http.ts          # HTTP 请求封装
│   └── assets/              # 静态资源
├── public/                  # 公共资源
├── nuxt.config.ts           # Nuxt 配置
├── package.json             # 项目依赖
└── tsconfig.json            # TypeScript 配置
```

## 常用命令

```bash
# 安装依赖
pnpm install

# 启动开发服务器 (默认端口 3000)
pnpm dev

# 构建生产版本
pnpm build

# 生成静态站点
pnpm generate

# 预览构建结果
pnpm preview
```

## API 服务说明

### HTTP 请求封装 (`app/utils/http.ts`)

项目封装了 `$fetch` 进行统一请求处理：
- 自动解包后端响应（提取 `data` 字段）
- 统一错误处理
- 支持请求拦截器（可扩展 token 认证）

### 主要 API 接口 (`app/services/docCompareApi.ts`)

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/doc-preview/compare` | POST | 获取文档 Diff HTML |
| `/api/doc-compare/stream` | POST | AI 流式分析 (SSE) |
| `/api/knowledge/upload` | POST | 上传文档到知识库 |
| `/api/knowledge/search` | GET | 知识库检索 |
| `/api/knowledge/preview/:docId` | GET | 获取文件预览链接 |
| `/api/knowledge/compare-upload` | POST | 上传文件与知识库比对 |
| `/api/dashboard/stats` | GET | 获取仪表盘统计 |
| `/api/dashboard/recent` | GET | 获取最近对比记录 |

## 开发规范

### 代码风格

- 使用 TypeScript 编写业务逻辑
- Vue 组件使用 `<script setup lang="ts">` 语法
- API 响应需定义类型接口

### 命名约定

- 页面文件: 小写 kebab-case (如 `dashboard.vue`)
- 组件文件: PascalCase (如 `AiAnalysisCard.vue`)
- 接口/类型: PascalCase (如 `DashboardStats`)
- 函数: camelCase (如 `fetchDocDiffHtml`)

### API 响应结构

后端统一响应格式：
```typescript
interface ApiResponse<T> {
  code: number      // 200 表示成功
  message: string
  data: T           // 实际数据
}
```

## 开发进度

根据 git 提交记录：
- [x] 文档对比页面
- [x] 文件检索功能
- [x] 文件上传功能
- [x] 数据大屏
- [ ] Agent 功能（待完成）

## 后端代理配置

开发环境下，API 请求代理到 Java 后端：

```typescript
// nuxt.config.ts
nitro: {
  devProxy: {
    '/api': {
      target: 'http://localhost:8082/api',
      changeOrigin: true,
    }
  }
}
```

## 注意事项

1. **流式请求**: AI 分析接口使用 SSE 流式传输，需使用原生 `fetch` + `getReader()`，不能使用 `$fetch`
2. **文件上传**: FormData 格式上传，注意设置正确的 Content-Type
3. **响应解包**: HTTP 封装会自动提取 `data` 字段，但 HTML 类响应会直接返回
