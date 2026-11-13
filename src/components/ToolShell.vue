// 工具页统一外壳：面包屑 + Hero + 两栏布局（主内容 + 使用说明侧栏）+ 相关工具
<template>
  <div class="tool-page">
    <nav class="crumbs" aria-label="面包屑">
      <router-link to="/">全部工具</router-link>
      <span class="crumb-sep">/</span>
      <router-link :to="categoryPath">{{ categoryName }}</router-link>
      <span class="crumb-sep">/</span>
      <span class="crumb-current">{{ meta.name }}</span>
    </nav>

    <header class="tool-hero">
      <span class="hero-icon" :style="{ color: meta.color }"><i :class="['fa', meta.icon]"></i></span>
      <div class="hero-text">
        <h1>{{ title || meta.name }}</h1>
        <p class="hero-desc">{{ desc || meta.desc }}</p>
      </div>
    </header>

    <div class="tool-layout">
      <main class="tool-main"><slot></slot></main>
      <aside class="tool-aside">
        <div class="aside-card">
          <h3><i class="fa fa-lightbulb-o"></i> 使用说明</h3>
          <p v-if="introText" class="aside-intro">{{ introText }}</p>
          <ol v-if="usageLines.length" class="aside-usage">
            <li v-for="(line, i) in usageLines" :key="i">{{ line }}</li>
          </ol>
        </div>
      </aside>
    </div>

    <RelatedTools :current="path" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import RelatedTools from './RelatedTools.vue'
import { ALL_SECTIONS, ALL_TOOLS } from '../data/tools.js'

const props = defineProps({
  path: { type: String, required: true },
  title: String,
  desc: String,
  intro: String,
  usage: [String, Array]
})

const CATEGORY_NAMES = ['图片工具', '文档工具', '其他工具', '坐标工具', 'RF Wireless']
const CATEGORY_PATHS = ['/c/img', '/c/pdf', '/c/text', '/c/coord', '/c/rf']

const meta = computed(() => ALL_TOOLS.find(t => t.path === props.path) || { name: props.title || '工具', desc: '', icon: 'fa-wrench', color: '#3b82f6' })

const sectionIndex = computed(() => ALL_SECTIONS.findIndex(s => s.tools.some(t => t.path === props.path)))
const categoryName = computed(() => CATEGORY_NAMES[sectionIndex.value] || '全部工具')
const categoryPath = computed(() => CATEGORY_PATHS[sectionIndex.value] || '/')

const introText = computed(() => props.intro || meta.value.desc)

// usage 支持数组或换行文本；去掉已有的「1.」编号，交给有序列表渲染
const usageLines = computed(() => {
  const raw = Array.isArray(props.usage) ? props.usage : String(props.usage || '').split(/\r?\n/)
  return raw
    .map(s => String(s).trim())
    .filter(Boolean)
    .map(s => s.replace(/^\d+[.、)]\s*/, ''))
})
</script>
