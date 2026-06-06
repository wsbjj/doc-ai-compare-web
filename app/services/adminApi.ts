import { http } from '~/utils/http'

export interface AdminPage<T> {
  records: T[]
  total: number
  page: number
  size: number
}

export interface AdminDocument {
  id: string
  fileName: string
  fileType?: string | null
  fileHash?: string | null
  storagePath?: string | null
  chunkCount?: number | null
  status?: string | null
  createTime?: string | null
  objectExists: boolean
  objectSize?: number | null
  previewUrl?: string | null
  downloadUrl?: string | null
}

export interface AdminCompareReport {
  id: number
  baseDocId?: string | null
  compareDocId?: string | null
  baseFileName?: string | null
  compareFileName?: string | null
  similarity?: number | string | null
  riskLevel?: string | null
  resultSummary?: string | null
  processTimeMs?: number | null
  tokenUsage?: number | null
  savedManHours?: number | string | null
  createBy?: string | null
  reportPdfObject?: string | null
  createTime?: string | null
  hasReport: boolean
  reportObjectExists: boolean
  reportObjectSize?: number | null
  reportViewUrl?: string | null
  reportDownloadUrl?: string | null
}

export interface AdminPaperReport {
  taskId: string
  fileName?: string | null
  minioUrl?: string | null
  status?: string | null
  reportPdfObject?: string | null
  createBy?: string | null
  stage?: string | null
  progress?: number | null
  createTime?: string | null
  fileObjectExists: boolean
  fileObjectSize?: number | null
  reportObjectExists: boolean
  reportObjectSize?: number | null
  fileDownloadUrl?: string | null
  reportViewUrl?: string | null
  reportDownloadUrl?: string | null
}

interface PageQuery {
  page: number
  size: number
  keyword?: string
  status?: string
  fileType?: string
  riskLevel?: string
}

const compactParams = (query: PageQuery): Record<string, string> => {
  const params: Record<string, string> = {
    page: String(query.page),
    size: String(query.size)
  }
  for (const [key, value] of Object.entries(query)) {
    if (key === 'page' || key === 'size') continue
    if (value != null && String(value).trim() !== '') {
      params[key] = String(value).trim()
    }
  }
  return params
}

export const listAdminDocuments = async (query: PageQuery): Promise<AdminPage<AdminDocument>> => {
  return await http<AdminPage<AdminDocument>>('/api/admin/documents', {
    method: 'GET',
    params: compactParams(query)
  })
}

export const listAdminCompareReports = async (query: PageQuery): Promise<AdminPage<AdminCompareReport>> => {
  return await http<AdminPage<AdminCompareReport>>('/api/admin/compare-reports', {
    method: 'GET',
    params: compactParams(query)
  })
}

export const listAdminPaperReports = async (query: PageQuery): Promise<AdminPage<AdminPaperReport>> => {
  return await http<AdminPage<AdminPaperReport>>('/api/admin/paper-reports', {
    method: 'GET',
    params: compactParams(query)
  })
}

export const deleteAdminDocument = async (id: string): Promise<void> => {
  await http('/api/admin/documents/' + encodeURIComponent(id), { method: 'DELETE' })
}

export const deleteAdminCompareReport = async (id: number): Promise<void> => {
  await http('/api/admin/compare-reports/' + id, { method: 'DELETE' })
}

export const deleteAdminPaperReport = async (taskId: string): Promise<void> => {
  await http('/api/admin/paper-reports/' + encodeURIComponent(taskId), { method: 'DELETE' })
}
