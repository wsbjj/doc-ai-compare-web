// services/docCompareApi.ts

// --- 类型定义 ---
export interface ComparisonSummary {
globalVectorSimilarity: number;
totalSimilarSegments: number;
}

export interface SegmentAnalysis {
id: number;
vectorScore: number;
aiScore: number;
textA: string;
textB: string;
analysis: string;
conclusion: string;
riskLevel: string;
}

interface StreamEvent {
type: 'SUMMARY' | 'DETAIL' | 'ERROR';
data: any;
}

/**
* 1. 获取文档 Diff HTML
*/
export const fetchDocDiffHtml = async (fileA: File, fileB: File): Promise<string> => {
const formData = new FormData()
formData.append('fileA', fileA)
formData.append('fileB', fileB)

const response = await fetch('/api/doc-preview/compare', {
method: 'POST',
body: formData
})

if (!response.ok) {
throw new Error(await response.text() || 'Diff request failed')
}
return response.text()
}

/**
* 2. 处理 AI 流式分析
* @param fileA 文件A
* @param fileB 文件B
* @param onEvent 回调函数，每收到一个解析好的事件就调用一次
*/
export const streamAiAnalysis = async (
fileA: File,
fileB: File,
onEvent: (event: StreamEvent) => void
): Promise<void> => {
  const formData = new FormData()
  formData.append('fileA', fileA)
  formData.append('fileB', fileB)

  const response = await fetch('/api/doc-compare/stream', {
  method: 'POST',
  body: formData
  })

  if (!response.ok) {
  throw new Error(`AI API Error: ${response.status}`)
  }

  if (!response.body) {
  throw new Error('Response body is empty')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
  const { done, value } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  // 保留最后一行（可能不完整）到下一轮处理
  buffer = lines.pop() || ''

  for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed) continue

  try {
  // 兼容处理：去除 "data:" 前缀
  let jsonStr = trimmed
  if (trimmed.startsWith('data:')) {
  jsonStr = trimmed.substring(5).trim()
  }
  if (!jsonStr) continue

  const event = JSON.parse(jsonStr) as StreamEvent
  onEvent(event)
  } catch (e) {
  console.warn('JSON Parse Error in stream:', trimmed)
  }
  }
  }

  // 处理最后残留的 buffer
  if (buffer.trim()) {
  try {
  let jsonStr = buffer.trim()
  if (jsonStr.startsWith('data:')) jsonStr = jsonStr.substring(5).trim()
  onEvent(JSON.parse(jsonStr))
  } catch (e) {}
  }
  }