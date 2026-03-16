// app/services/paperApi.ts - 论文查重/质检接口（多 Agent 流水线）
import { http } from '~/utils/http'

/** 任务状态 */
export type PaperTaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

/** 流水线阶段 */
export type PaperStage =
  | 'UPLOADED'   // 已上传，尚未开始
  | 'OCR'        // OCR/文本抽取中
  | 'PLAGIARISM' // 查重 Agent
  | 'LOGIC'      // 逻辑 Agent
  | 'COMPLIANCE' // 规范 Agent
  | 'REVIEW'     // 汇总/自审 Agent
  | 'COMPLETED'  // 全部结束
  | 'FAILED'

/** 单 Agent 状态 */
export type AgentStatusValue = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

/** 各维度 Agent 状态 */
export interface PaperAgentStatus {
  plagiarism?: AgentStatusValue
  logic?: AgentStatusValue
  compliance?: AgentStatusValue
  review?: AgentStatusValue
}

/** 改进建议项 */
export interface ImprovementItem {
  severity: string   // "HIGH" | "MEDIUM" | "LOW"
  dimension: string  // "PLAGIARISM" | "LOGIC" | "COMPLIANCE"
  description: string
}

/** 分章节/分段问题 */
export interface SectionIssue {
  section?: string
  paragraphIndex?: number
  dimension: string
  severity: string
  problem: string
  suggestion: string
}

/** 质检报告 */
export interface PaperQualityReport {
  plagiarismLevel?: string
  plagiarismScore?: number
  logicScore?: number
  complianceScore?: number
  overallScore?: number
  suggestions?: ImprovementItem[]
  sectionIssues?: SectionIssue[]
}

/** 论文任务 VO（含多 Agent 流程进度） */
export interface PaperTaskVO {
  taskId: string
  fileName: string
  status: PaperTaskStatus
  stage?: string
  progress?: number
  agentStatus?: PaperAgentStatus
  downloadUrl?: string | null
  resultJson?: string | null
  report?: PaperQualityReport | null
  createTime: string
}

/**
 * 提交论文质检任务
 */
export const submitPaperTask = async (
  file: File,
  asyncMode: boolean = true
): Promise<PaperTaskVO> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('async', String(asyncMode))
  return await http<PaperTaskVO>('/api/paper/submit', {
    method: 'POST',
    body: formData
  })
}

/**
 * 查询任务状态（含 stage / progress / agentStatus，不含 report、downloadUrl）
 */
export const getPaperTaskStatus = async (taskId: string): Promise<PaperTaskVO> => {
  return await http<PaperTaskVO>(`/api/paper/status/${taskId}`, { method: 'GET' })
}

/**
 * 获取质检结果（含 report、downloadUrl）
 */
export const getPaperTaskResult = async (taskId: string): Promise<PaperTaskVO> => {
  return await http<PaperTaskVO>(`/api/paper/result/${taskId}`, { method: 'GET' })
}
