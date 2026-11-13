<template>
  <div>
    <!-- 搜索激活：仅展示搜索结果，隐藏常用工具与分区 -->
    <section v-if="isSearch" class="search-section">
      <div class="section-head">
        <h1 class="text-4xl">搜索结果 · {{ searchResults.length }} 个</h1>
        <p class="section-desc">关键词「{{ searchQuery }}」</p>
      </div>
      <div v-if="searchResults.length"
           class="mt-2 flex flex-wrap el-row" style="margin-left:-10px;margin-right:-10px">
        <div v-for="t in searchResults" :key="t.path"
             class="tool-col" style="padding-left:10px;padding-right:10px">
          <router-link :to="t.path" class="tool">
            <div class="flex items-center" style="width:100%">
              <div class="tool-icon" :style="{color: t.color}">
                <i :class="['fa', t.icon]"></i>
              </div>
              <div class="ml-2" style="min-width:0">
                <div class="tool-header">{{ t.name }}</div>
                <div class="tool-subheader mt-1">{{ t.desc }}</div>
              </div>
            </div>
          </router-link>
        </div>
      </div>
      <div v-else class="search-empty">
        <i class="fa fa-search"></i>
        <p>没有匹配「{{ searchQuery }}」的工具</p>
        <router-link to="/" class="el-button el-button--primary">查看全部工具</router-link>
      </div>
    </section>

    <!-- /c/recent：仅展示常用工具全宽区块 -->
    <section v-else-if="isRecent" class="recent-section">
      <div class="section-head">
        <h1 class="text-4xl">常用工具</h1>
        <p class="section-desc">按使用频率与最近使用排序，数据仅保存在本机浏览器</p>
      </div>
      <RecentTools />
    </section>

    <!-- 其余分区 -->
    <template v-else>
      <!-- 全部工具页：分区列表顶部插入常用工具 -->
      <section v-if="isAll" class="recent-section">
        <div class="section-head">
          <h1 class="text-4xl">常用工具 · 最近使用</h1>
          <p class="section-desc">按使用频率与最近使用排序，数据仅保存在本机浏览器</p>
        </div>
        <RecentTools />
      </section>

      <section v-for="sec in sections" :key="sec.key">
        <div class="section-head">
          <h1 class="text-4xl">{{ sec.title }} · {{ sec.tools.length }} 个</h1>
          <p class="section-desc">{{ sec.desc }}</p>
        </div>
        <div class="mt-2 flex flex-wrap el-row" style="margin-left:-10px;margin-right:-10px">
          <div v-for="t in sec.tools" :key="t.path"
               class="tool-col" style="padding-left:10px;padding-right:10px">
            <router-link :to="t.path" class="tool">
              <div class="flex items-center" style="width:100%">
                <div class="tool-icon" :style="{color: t.color}">
                  <i :class="['fa', t.icon]"></i>
                </div>
                <div class="ml-2" style="min-width:0">
                  <div class="tool-header">{{ t.name }}</div>
                  <div class="tool-subheader hidden-sm-and-down mt-1">{{ t.desc }}</div>
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { IMG_TOOLS, PDF_TOOLS, MORE_TOOLS, COORD_TOOLS, RF_TOOLS, ALL_TOOLS, ALL_SECTIONS } from '../data/tools.js'
import RecentTools from '../components/RecentTools.vue'

const route = useRoute()

const CATEGORIES = {
  img: { key: 'img', title: '图片工具', desc: '压缩、转换、拼图、水印等图像处理', tools: IMG_TOOLS },
  pdf: { key: 'pdf', title: 'PDF 文档工具', desc: '合并、拆分、转换、加水印等文档处理', tools: PDF_TOOLS },
  text: { key: 'text', title: '文本编码工具', desc: '编码转换、加密、Hash 等开发常用', tools: MORE_TOOLS },
  coord: { key: 'coord', title: '坐标工具', desc: '坐标系转换、投影、距离、GNSS 协议解析', tools: COORD_TOOLS },
  rf: { key: 'rf', title: 'RF Wireless', desc: '5G NR 频点、SSB 栅格与 CORESET#0 位置关系', tools: RF_TOOLS }
}

const SECTION_DESC = {
  '图片工具': CATEGORIES.img.desc,
  '文档工具': CATEGORIES.pdf.desc,
  '其他工具': CATEGORIES.text.desc,
  '坐标工具': CATEGORIES.coord.desc,
  'RF Wireless': CATEGORIES.rf.desc
}

const searchQuery = computed(() => {
  const q = route.query.q
  return typeof q === 'string' ? q.trim() : ''
})

const isSearch = computed(() => searchQuery.value !== '')
const isRecent = computed(() => !isSearch.value && route.meta.cat === 'recent')
const isAll = computed(() => !isSearch.value && !route.meta.cat)

// 按 name/desc/path 不区分大小写过滤
const searchResults = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return []
  return ALL_TOOLS.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.desc.toLowerCase().includes(q) ||
    t.path.toLowerCase().includes(q)
  )
})

const sections = computed(() => {
  const cat = route.meta.cat
  if (cat === 'recent') return []
  if (cat && CATEGORIES[cat]) {
    const c = CATEGORIES[cat]
    return [{ key: c.key, title: c.title, desc: c.desc, tools: c.tools }]
  }
  return ALL_SECTIONS.map(s => ({
    key: s.title,
    title: s.title,
    desc: SECTION_DESC[s.title] || '',
    tools: s.tools
  }))
})
</script>

<style scoped>
.section-head{margin-bottom:6px}
.section-desc{color:var(--text-2);font-size:14px;margin-top:6px}
.recent-section{margin-bottom:28px}
.search-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:56px 20px;background:var(--surface);border:1px dashed var(--border);border-radius:var(--radius);color:var(--text-2)}
.search-empty i{font-size:38px;color:var(--primary)}
.search-empty p{font-size:15px}
.tool-col{float:left;width:100%;box-sizing:border-box;overflow:hidden}
@media only screen and (max-width:767px){.tool-col{width:50%}}
@media only screen and (min-width:768px){.tool-col{width:50%}}
@media only screen and (min-width:992px){.tool-col{width:33.33333%}}
@media only screen and (min-width:1200px){.tool-col{width:25%}}
</style>
