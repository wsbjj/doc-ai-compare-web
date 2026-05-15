import { http } from '~/utils/http'

export interface AgencyAgentDepartment {
  id: string
  name: string
  englishName: string
  agentCount: number
  order: number
}

export interface AgencyAgentSummary {
  id: string
  name: string
  description: string
  departmentId: string
  departmentName: string
  departmentEnglishName: string
  sourceType: string
  emoji?: string
  color?: string
  sourcePath: string
  order: number
}

export interface AgencyAgentDetail extends AgencyAgentSummary {
  markdown: string
}

export interface AgencyAgentAttachment {
  fileName: string
  status: 'OK' | 'EMPTY' | 'FAILED' | 'SKIPPED' | string
  charCount: number
  message: string
}

export interface AgencyAgentChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgencyAgentChatResponse {
  agentId: string
  agentName: string
  content: string
  attachments: AgencyAgentAttachment[]
}

export interface AgencyAgentChatStreamEvent {
  type: 'META' | 'DELTA' | 'DONE' | 'ERROR' | string
  agentId?: string
  agentName?: string
  content?: string
  attachments?: AgencyAgentAttachment[]
  message?: string
}

export const fetchAgencyAgentDepartments = async (): Promise<AgencyAgentDepartment[]> => {
  return await http<AgencyAgentDepartment[]>('/api/agency-agents/departments', {
    method: 'GET'
  })
}

export const fetchAgencyAgents = async (
  departmentId?: string,
  keyword?: string
): Promise<AgencyAgentSummary[]> => {
  const params: Record<string, string> = {}
  if (departmentId && departmentId !== 'all') params.departmentId = departmentId
  if (keyword?.trim()) params.keyword = keyword.trim()

  return await http<AgencyAgentSummary[]>('/api/agency-agents/agents', {
    method: 'GET',
    params
  })
}

export const fetchAgencyAgentDetail = async (id: string): Promise<AgencyAgentDetail> => {
  return await http<AgencyAgentDetail>(`/api/agency-agents/agents/${id}`, {
    method: 'GET'
  })
}

export const runAgencyAgent = async (
  id: string,
  message: string,
  history: AgencyAgentChatMessage[],
  files: File[]
): Promise<AgencyAgentChatResponse> => {
  const formData = new FormData()
  formData.append('message', message)
  if (history.length) {
    formData.append('historyJson', JSON.stringify(history))
  }
  for (const file of files) {
    formData.append('files', file)
  }

  return await http<AgencyAgentChatResponse>(`/api/agency-agents/agents/${id}/chat`, {
    method: 'POST',
    body: formData
  })
}

export const runAgencyAgentStream = async (
  id: string,
  message: string,
  history: AgencyAgentChatMessage[],
  files: File[],
  onEvent: (event: AgencyAgentChatStreamEvent) => void
): Promise<void> => {
  const formData = new FormData()
  formData.append('message', message)
  if (history.length) {
    formData.append('historyJson', JSON.stringify(history))
  }
  for (const file of files) {
    formData.append('files', file)
  }

  const response = await fetch(`/api/agency-agents/agents/${id}/chat/stream`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  })

  if (!response.body) throw new Error('Agent 流式响应为空')
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok && !contentType.includes('text/event-stream')) {
    throw new Error(`Agent API Error: ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let hasEvent = false

  const consumeLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('data:')) return
    const jsonText = trimmed.substring(5).trim()
    if (!jsonText || jsonText === '[DONE]') return
    hasEvent = true
    onEvent(JSON.parse(jsonText) as AgencyAgentChatStreamEvent)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      consumeLine(line)
    }
  }

  const tail = decoder.decode()
  if (tail) buffer += tail
  if (buffer.trim()) {
    consumeLine(buffer)
  }

  if (!response.ok && !hasEvent) {
    throw new Error(`Agent API Error: ${response.status}`)
  }
}
