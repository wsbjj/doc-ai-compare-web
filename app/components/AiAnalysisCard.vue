<script setup lang="ts">

// 定义 Props 接口
interface SegmentAnalysis {
  id: number;
  vectorScore: number;
  aiScore: number;
  textA: string;
  textB: string;
  analysis: string;
  conclusion: string;
  riskLevel: string;
}

const props = defineProps<{
  item: SegmentAnalysis;
  index: number;
}>();

const emit = defineEmits(['click']);

// 样式辅助函数
const getRiskStyle = (level: string) => {
  const l = level ? level.toUpperCase() : 'UNKNOWN';
  if (l.includes('HIGH') || l.includes('高')) return 'bg-red-50 text-red-600 border-red-200';
  if (l.includes('MEDIUM') || l.includes('中')) return 'bg-orange-50 text-orange-600 border-orange-200';
  if (l.includes('LOW') || l.includes('低') || l.includes('SAFE') || l.includes('NORMAL')) return 'bg-blue-50 text-blue-600 border-blue-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}
</script>

<template>
  <div @click="emit('click', item.id)"
       class="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden group">

    <div class="bg-gray-50 px-5 py-3 border-b border-gray-100 flex justify-between items-center group-hover:bg-indigo-50/20 transition-colors">
      <div class="flex items-center gap-3">
        <span class="bg-gray-800 text-white text-xs font-bold px-2 py-1 rounded">#{{ index + 1 }}</span>
        <span class="text-xs text-gray-500">全局片段 ID: {{ item.id }}</span>
        <span class="text-xs text-gray-400 group-hover:text-indigo-500 transition-colors">(点击尝试定位 👆)</span>
      </div>
      <span class="text-xs font-bold px-3 py-1 rounded border tracking-wide" :class="getRiskStyle(item.riskLevel)">
        {{ item.riskLevel }}
      </span>
    </div>

    <div class="flex border-b border-gray-100">
      <div class="flex-1 p-3 border-r border-gray-100 flex items-center justify-center gap-2 bg-gray-50/50">
        <span class="text-xs text-gray-500">📐 向量相似度:</span>
        <span class="font-mono font-bold text-gray-700">{{ item.vectorScore.toFixed(1) }}%</span>
      </div>
      <div class="flex-1 p-3 flex items-center justify-center gap-2 bg-indigo-50/20">
        <span class="text-xs text-indigo-500">🧠 AI 语义一致性:</span>
        <span class="font-mono font-bold text-indigo-700">{{ item.aiScore }} / 100</span>
      </div>
    </div>

    <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="space-y-1">
        <span class="text-xs text-gray-400 uppercase tracking-wider font-semibold pl-1">基准文档 A</span>
        <div class="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg leading-relaxed font-mono border border-gray-100 min-h-[80px] relative group/text">
          {{ item.textA }}
          <span class="absolute bottom-0 right-0 bg-gray-200 text-gray-500 text-[10px] px-1.5 py-0.5 rounded-tl-md rounded-br-lg">原文</span>
        </div>
      </div>

      <div class="space-y-1">
        <span class="text-xs text-gray-400 uppercase tracking-wider font-semibold pl-1">对比文档 B</span>
        <div class="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg leading-relaxed font-mono border border-gray-100 min-h-[80px] relative">
          {{ item.textB }}
          <span class="absolute bottom-0 right-0 bg-gray-200 text-gray-500 text-[10px] px-1.5 py-0.5 rounded-tl-md rounded-br-lg">原文</span>
        </div>
      </div>
    </div>

    <div class="bg-[#f0f9ff] border-t border-blue-100 p-4 mx-5 mb-5 rounded-lg">
      <div class="flex items-start gap-2">
        <span class="text-lg">💡</span>
        <div class="space-y-1">
          <div class="text-xs font-bold text-blue-700">判定结论：{{ item.conclusion }}</div>
          <p class="text-xs text-blue-800/80 leading-relaxed text-justify">{{ item.analysis }}</p>
        </div>
      </div>
    </div>

  </div>
</template>