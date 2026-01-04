// services/docCompareApi.ts
import { http } from '~/utils/http'

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

export interface KnowledgeUploadResponse {
    docId: string;
}

export interface SearchResultItem {
    score: number;
    content: string;
    metadata: {
        doc_id: string;
        file_name: string;
        file_type: string;
        source: string;
        distance?: number;
        [key: string]: any;
    };
}

export interface DocumentSearchVO {
    docId: string;
    fileName: string;
    similarity: number;
    matchSnippet: string;
}

// --- 接口实现 ---

/**
 * 1. 获取文档 Diff HTML
 * ✅ 修改：使用 http 工具，泛型为 string
 * 拦截器会发现这不是 JSON 对象，直接返回 HTML 字符串
 */
export const fetchDocDiffHtml = async (fileA: File, fileB: File): Promise<string> => {
    const formData = new FormData()
    formData.append('fileA', fileA)
    formData.append('fileB', fileB)

    return await http<string>('/api/doc-preview/compare', {
        method: 'POST',
        body: formData
    })
}

/**
 * 2. 处理 AI 流式分析
 * ⚠️ 保持使用原生 fetch，因为 http ($fetch) 不支持 getReader() 流式读取
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

    if (!response.ok) throw new Error(`AI API Error: ${response.status}`)
    if (!response.body) throw new Error('Response body is empty')

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
        const {done, value} = await reader.read()
        if (done) break
        buffer += decoder.decode(value, {stream: true})
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            try {
                let jsonStr = trimmed.startsWith('data:') ? trimmed.substring(5).trim() : trimmed
                if (!jsonStr) continue
                onEvent(JSON.parse(jsonStr) as StreamEvent)
            } catch (e) { console.warn('JSON Parse Error:', trimmed) }
        }
    }
    if (buffer.trim()) {
        try {
            let jsonStr = buffer.trim().startsWith('data:') ? buffer.trim().substring(5).trim() : buffer.trim()
            onEvent(JSON.parse(jsonStr))
        } catch (e) {}
    }
}

/**
 * 3. 上传文档到知识库
 * 自动解包生效
 */
export const saveFileToKnowledgeBase = async (
    file: File,
    category: string = 'general'
): Promise<KnowledgeUploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileType', category)

    return await http<KnowledgeUploadResponse>('/api/knowledge/upload', {
        method: 'POST',
        body: formData
    })
}

/**
 * 4. 知识库检索
 * 自动解包生效
 */
export const searchKnowledgeBase = async (
    query: string,
    fileType?: string
): Promise<SearchResultItem[]> => {
    const params: Record<string, string> = {
        query: query,
        topK: '5',
        threshold: '0.4'
    }
    if (fileType && fileType !== 'all') {
        params.fileType = fileType
    }

    return await http<SearchResultItem[]>('/api/knowledge/search', {
        method: 'GET',
        params
    })
}

/**
 * 5. 获取预览链接
 * 自动解包生效
 */
export const getFilePreviewUrl = async (docId: string): Promise<string> => {
    const res = await http<{ url: string }>(`/api/knowledge/preview/${docId}`, {
        method: 'GET'
    })
    return res.url
}

/**
 * 6. 上传文件与知识库进行比对
 */
export const compareWithKnowledgeBase = async (
    file: File,
    topK: number = 5
): Promise<SearchResultItem[]> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('topK', topK.toString())

    const data = await http<DocumentSearchVO[]>('/api/knowledge/compare-upload', {
        method: 'POST',
        body: formData
    })

    // 适配后端返回的 DocumentSearchVO 格式到前端通用的 SearchResultItem 格式
    return data.map(item => ({
        score: item.similarity,
        content: item.matchSnippet,
        metadata: {
            doc_id: item.docId,
            file_name: item.fileName,
            file_type: 'general', // 默认为通用类型，因为接口未返回具体类型
            source: 'upload_compare'
        }
    }))
}