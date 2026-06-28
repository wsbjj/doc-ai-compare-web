# Doc AI Compare Web

`doc-ai-compare-web` 是“项目材料独创性智能审查系统”的前端应用，基于 Nuxt 4、Vue 3 和 Tailwind CSS。它负责文档对比、知识库检索、论文审查、Agent 问答、数据看板、登录和管理端页面。

## 快速开始

### 环境要求

| 组件 | 建议版本 | 说明 |
| --- | --- | --- |
| Node.js | 20+ | Nuxt 4 开发与构建 |
| pnpm | 9+ | 推荐包管理器 |
| 后端服务 | `doc-ai-compare-server` | 默认指向 `http://192.168.4.196:8080` |

### 安装与运行

```powershell
pnpm install
pnpm dev
```

默认开发服务配置在 [nuxt.config.ts](nuxt.config.ts)：

| 配置 | 当前值 | 说明 |
| --- | --- | --- |
| `devServer.host` | `0.0.0.0` | 允许局域网访问 |
| `devServer.port` | `80` | 前端开发端口 |
| `runtimeConfig.public.backendBaseUrl` | `http://192.168.4.196:8080` | SSR 阶段访问后端的绝对地址 |
| `nitro.devProxy['/api'].target` | `http://192.168.4.196:8080/api` | 浏览器端 `/api` 代理到后端 |

端口 `80` 在部分系统上需要管理员权限。若本机占用，可临时修改 `nuxt.config.ts` 的 `devServer.port`，并同步后端 `.env` 中的 `APP_FRONTEND_URL`。

### 常用命令

```bash
pnpm dev
pnpm build
pnpm preview
pnpm generate
pnpm test:paper-review
```

## 后端联调

前端浏览器请求使用相对路径 `/api/*`，由 Nuxt devProxy 转发到后端；SSR 中间件请求使用 `runtimeConfig.public.backendBaseUrl` 的绝对地址，避免 Node 端解析相对 `/api` 出错。

改后端地址时，需要同时检查：

| 位置 | 配置项 | 示例 |
| --- | --- | --- |
| 前端 `nuxt.config.ts` | `runtimeConfig.public.backendBaseUrl` | `http://192.168.4.196:8080` |
| 前端 `nuxt.config.ts` | `nitro.devProxy['/api'].target` | `http://192.168.4.196:8080/api` |
| 后端 `.env` | `SERVER_PORT` | `8080` |
| 后端 `.env` | `APP_BASE_URL` | `http://192.168.4.196:8080` |
| 后端 `.env` | `APP_FRONTEND_URL` | `http://192.168.4.196/` |
| 后端 `.env` | `CAS_SERVICE_URL` | `http://192.168.4.196:8080/api/sso/login` |

当前前端仓库没有 `.env.example`，主要配置写在 `nuxt.config.ts`。Nuxt 的 `runtimeConfig.public.backendBaseUrl` 可被 `NUXT_PUBLIC_BACKEND_BASE_URL` 覆盖，但 `nitro.devProxy.target` 当前仍是硬编码，联调时请以 `nuxt.config.ts` 为准。

## 登录与 CAS

登录流程：

1. 全局路由中间件 [app/middleware/auth.global.ts](app/middleware/auth.global.ts) 请求 `/api/auth/me`。
2. 已登录时放行；未登录时跳到 `/login?needLogin=1`。
3. 登录页 [app/pages/login.vue](app/pages/login.vue) 点击“统一认证登录”后再次请求 `/api/auth/me`。
4. 后端返回 `casLoginUrl` 时，浏览器跳转 CAS。
5. CAS 回调后端 `/api/sso/login`，后端建立 Sa-Token 登录态，再跳回 `APP_FRONTEND_URL`。

本地开发可在后端 `.env` 开启 CAS 跳过模式：

```env
CAS_SKIP_ENABLED=true
CAS_SKIP_LOGIN_ID=202203049217
```

开启后，前端请求 `/api/auth/me` 会直接得到 `loggedIn=true`，无需跳转统一认证。若要访问管理端，后端 `.env` 里还要配置：

```env
APP_ADMIN_ALLOWED_LOGIN_IDS=202203049217
```

## 项目结构

```text
doc-ai-compare-web/
├── app/
│   ├── app.vue
│   ├── layouts/default.vue              # 主布局和顶部导航
│   ├── middleware/auth.global.ts        # 全局登录检查
│   ├── pages/
│   │   ├── login.vue                    # CAS 登录页
│   │   ├── dashboard.vue                # 数据看板
│   │   ├── index.vue                    # 首页/入口页
│   │   ├── doc-compare.vue              # 文档对比
│   │   ├── upload.vue                   # 知识库上传
│   │   ├── search.vue                   # 知识库检索
│   │   ├── report.vue                   # 报告页
│   │   ├── agent.vue                    # 单 Agent 功能页
│   │   ├── agency-agents.vue            # 多 Agent 助手
│   │   ├── admin.vue                    # 管理端
│   │   └── records/                     # 历史记录
│   ├── services/
│   │   ├── docCompareApi.ts             # 文档对比、知识库、仪表盘
│   │   ├── paperApi.ts                  # 论文审查
│   │   ├── agencyAgentsApi.ts           # Agency Agents
│   │   └── adminApi.ts                  # 管理端接口
│   └── utils/http.ts                    # $fetch 封装
├── assets/css/tailwind.css
├── public/
├── scripts/
├── nuxt.config.ts
├── package.json
└── tailwind.config.ts
```

## 主要页面

| 页面 | 路由 | 说明 |
| --- | --- | --- |
| 登录 | `/login` | CAS 登录入口；无权限时展示提示 |
| 数据看板 | `/dashboard` | 今日对比、风险分布、趋势、论文审查统计 |
| 文档对比 | `/doc-compare` | 双文档 Diff、AI 流式分析、报告下载 |
| 知识库上传 | `/upload` | 上传文档进入知识库 |
| 知识库检索 | `/search` | 语义检索、预览、与上传文件比对 |
| 报告页 | `/report` | 分析结果展示 |
| Agency Agents | `/agency-agents` | 部门/Agent 列表、会话、流式问答 |
| 管理端 | `/admin` | 文档、对比报告、论文报告管理 |
| 记录页 | `/records/*` | 文档对比和论文审查历史 |

## API 服务层

| 文件 | 负责接口 | 说明 |
| --- | --- | --- |
| `app/utils/http.ts` | 通用 `$fetch` | 自动解包后端 `Result<T>` 的 `data` 字段；HTML/文本响应直接放行 |
| `app/services/docCompareApi.ts` | `/api/doc-*`, `/api/knowledge/*`, `/api/dashboard/*` | 文档对比、知识库、仪表盘、报告 PDF |
| `app/services/paperApi.ts` | `/api/paper/*` | 论文审查提交、状态、结果、历史、PDF |
| `app/services/agencyAgentsApi.ts` | `/api/agency-agents/*` | Agent 列表、会话、普通/流式问答 |
| `app/services/adminApi.ts` | `/api/admin/*` | 管理端分页、下载、删除 |

后端统一响应格式：

```ts
interface ApiResponse<T> {
  code: number
  message: string
  data: T
}
```

`http<T>()` 会在 `code === 200` 时直接返回 `data`。如果接口返回 HTML 字符串或流式响应，不要依赖自动解包。

## 流式接口

以下接口使用原生 `fetch`，因为 `$fetch` 不适合直接处理 `ReadableStream`：

| 场景 | 接口 |
| --- | --- |
| 文档 AI 流式分析 | `/api/doc-compare/stream` |
| 指定 Agent 流式问答 | `/api/agency-agents/agents/{id}/chat/stream` |
| 自动路由 Agent 流式问答 | `/api/agency-agents/auto-chat/stream` |

读取方式参考 [app/services/docCompareApi.ts](app/services/docCompareApi.ts) 和 [app/services/agencyAgentsApi.ts](app/services/agencyAgentsApi.ts)。

## 与后端 `.env` 的关系

前端没有保存后端密钥，但后端 `.env` 会直接影响前端体验：

| 后端变量 | 前端表现 |
| --- | --- |
| `APP_FRONTEND_URL` | CAS 回调、退出、无权限跳转目标 |
| `CAS_SKIP_ENABLED` | 开启后前端无需统一认证即可进入 |
| `CAS_SKIP_LOGIN_ID` | 前端显示的登录用户 ID |
| `APP_ADMIN_ALLOWED_LOGIN_IDS` | 决定 `/admin` 是否可用 |
| `SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE` | 上传页允许的最大文件大小 |
| `OCR_ENABLED` | 扫描 PDF/图片型 PDF 文本提取效果 |
| `MINIO_BUCKET_NAME` / `MINIO_ENDPOINT` | 预览、下载和报告 PDF 链接是否可用 |

后端完整变量表见 `../doc-ai-compare-server/README.md`。

## 常见问题

| 问题 | 处理 |
| --- | --- |
| 页面一直跳 `/login?needLogin=1` | 检查后端登录态、CAS 配置；本地可开启 `CAS_SKIP_ENABLED=true` |
| 浏览器请求 `/api` 失败 | 检查 `nitro.devProxy['/api'].target` 是否指向当前后端 |
| SSR 阶段登录检查失败 | 检查 `runtimeConfig.public.backendBaseUrl` 是否可从 Node 进程访问 |
| 流式分析没有输出 | 使用原生 `fetch` 读取 stream，不要改成 `$fetch` |
| 上传返回 413 或失败 | 检查后端 multipart 大小限制和 Nginx/代理限制 |
| 管理端提示无权限 | 登录 ID 必须在后端 `APP_ADMIN_ALLOWED_LOGIN_IDS` 中 |
| 修改后端地址后 CAS 回不来 | 同步修改后端 `APP_BASE_URL`、`APP_FRONTEND_URL`、`CAS_SERVICE_URL` |

## 开发约定

- 页面组件使用 Vue `<script setup lang="ts">`。
- 新增后端接口时，优先在 `app/services/*Api.ts` 增加类型和封装。
- 新增需要登录的页面不需要手写鉴权，默认由 `auth.global.ts` 处理；公开页面需设置 `definePageMeta({ public: true })`。
- SSE/流式响应用原生 `fetch`。
- 不要把后端 `.env` 的密钥复制到前端仓库。
- 修改 `nuxt.config.ts` 的后端地址后，同时更新本 README。

## 最后检查

```bash
pnpm test:paper-review
pnpm build
```

Last reviewed: 2026-06-28
