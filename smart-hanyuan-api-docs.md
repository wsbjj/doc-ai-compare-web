# 智慧韩园 - 文档查重系统 API 对接文档

## 1. 概述

本文档旨在为“智慧韩园”系统接入智能文档对比分析系统（文档查重系统）提供接口规范说明。

### 1.1 基础信息

- **基础访问路径 (Base URL)**: `http://<服务器地址>:8082/api`
- **数据交互格式**: `application/json` 或 `multipart/form-data` (视具体接口而定)
- **字符编码**: `UTF-8`

### 1.2 通用响应格式

所有非流式 (Non-SSE) 和非直接 HTML 响应的接口，统一采用以下 JSON 结构：

```json
{
  "code": 200,
  "message": "请求成功",
  "data": {} // 具体的业务数据
}
```

- `code`: 状态码，`200` 表示成功，非 `200` 表示存在异常或业务错误。
- `message`: 响应提示信息。
- `data`: 实际返回的业务数据载荷。

---

## 2. 认证与登录 (CAS 单点登录)

文档查重系统接入智慧韩园的 CAS (Central Authentication Service) 统一身份认证系统。用户必须通过 CAS 登录获取有效 Token 后，方可调用本系统的其他业务接口。

### 2.1 CAS 登录流程说明

1. **前端重定向**: 当用户未登录时，文档查重系统前端需将其重定向至智慧韩园 CAS 认证中心页面。
2. **CAS 认证**: 用户在 CAS 认证中心完成登录验证。
3. **返回 Ticket**: 认证成功后，CAS 会携带一个临时票据 (`ticket`) 重定向回查重系统前端。
4. **验证 Ticket**: 前端截取 URL 中的 `ticket`，调用本系统的 **CAS 登录回调接口**。
5. **颁发 Token**: 后端验证 `ticket` 成功后，返回本系统的身份令牌 (`Token`) 给前端。
6. **请求鉴权**: 前端后续所有的业务 API 请求，需在 HTTP Header 中携带此 Token。

### 2.2 CAS 登录回调接口

前端获取到 CAS 重定向带来的 `ticket` 后，调用此接口换取系统的访问 Token。

- **接口路径**: `/auth/cas/login`
- **请求方式**: `POST`
- **Content-Type**: `application/json`

**请求参数 (JSON)**:

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `ticket` | String | 是 | CAS 认证中心重定向返回的临时票据 |
| `service` | String | 是 | 申请 ticket 时的客户端服务回调地址，用于后端校验 |

**响应示例**:

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userInfo": {
      "userId": "10001",
      "username": "zhangsan",
      "realName": "张三",
      "role": "student"
    }
  }
}
```

### 2.3 接口鉴权方式

获取到 `token` 后，后续请求所有需要鉴权的业务接口（如文档上传、查重分析等），都必须在 HTTP 请求头中添加 `Authorization` 字段。

**Header 格式**:
```http
Authorization: Bearer <Token>
```
