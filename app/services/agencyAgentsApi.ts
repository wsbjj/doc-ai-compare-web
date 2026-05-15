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
