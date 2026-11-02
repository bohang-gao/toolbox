<template>
  <div>
    <!-- 移动端顶栏：≤991px 显示汉堡按钮 -->
    <div class="mobile-bar">
      <button class="hamburger" type="button" aria-label="打开菜单" @click="drawerOpen = true">
        <i class="fa fa-bars"></i>
      </button>
      <router-link to="/" class="mobile-logo">Toolbox</router-link>
    </div>

    <!-- 抽屉遮罩 -->
    <div v-show="drawerOpen" class="sidebar-mask" @click="drawerOpen = false"></div>

    <aside class="sidebar" :class="{ 'is-open': drawerOpen }">
      <router-link to="/" class="side-logo">Toolbox</router-link>

      <div class="side-search">
        <i class="fa fa-search"></i>
        <input
          v-model="searchText"
          class="el-input__inner side-search-input"
          type="text"
          placeholder="搜索工具…"
          aria-label="搜索工具"
          @input="onSearchInput"
          @keydown.esc="onSearchEsc"
        />
      </div>

      <nav class="side-menu">
        <router-link
          v-for="item in menu"
          :key="item.to"
          :to="item.to"
          class="side-item"
          :class="{ 'is-active': route.path === item.to }"
          @click="drawerOpen = false"
        >
          <i :class="['fa', item.icon]"></i>
          <span>{{ item.label }}</span>
          <span v-if="item.to === '/c/recent' && recentCount > 0" class="side-badge">{{ badgeText }}</span>
        </router-link>
      </nav>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRecentCount, onRecentChange } from '../lib/recent.js'

const menu = [
  { label: '常用工具', to: '/c/recent', icon: 'fa-clock-o' },
  { label: '全部工具', to: '/', icon: 'fa-th-large' },
  { label: '图片工具', to: '/c/img', icon: 'fa-file-image-o' },
  { label: 'PDF 文档工具', to: '/c/pdf', icon: 'fa-file-pdf-o' },
  { label: '文本编码工具', to: '/c/text', icon: 'fa-code' }
]

const route = useRoute()
const router = useRouter()
const drawerOpen = ref(false)
const recentCount = ref(getRecentCount())
const badgeText = computed(() => (recentCount.value > 99 ? '99+' : String(recentCount.value)))

// ===== 搜索（防抖 250ms → 以 ?q= 跳转首页） =====
const SEARCH_DEBOUNCE = 250
const searchText = ref('')
let searchTimer = null

function commitSearch() {
  if (searchTimer) { clearTimeout(searchTimer); searchTimer = null }
  const q = searchText.value.trim()
  const curQ = typeof route.query.q === 'string' ? route.query.q : ''
  if (q === curQ) return
  const query = { ...route.query }
  if (q) query.q = q
  else delete query.q
  router.push({ path: '/', query })
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(commitSearch, SEARCH_DEBOUNCE)
}

function onSearchEsc() {
  searchText.value = ''
  commitSearch()
}

// 路由 q 变化（刷新/外部跳转）时同步回输入框
watch(
  () => route.query.q,
  (q) => {
    const next = typeof q === 'string' ? q : ''
    if (next !== searchText.value) searchText.value = next
  },
  { immediate: true }
)

let unsubscribe = null
onMounted(() => {
  recentCount.value = getRecentCount()
  unsubscribe = onRecentChange(() => { recentCount.value = getRecentCount() })
})
onUnmounted(() => {
  if (unsubscribe) unsubscribe()
  if (searchTimer) clearTimeout(searchTimer)
})

watch(() => route.fullPath, () => { drawerOpen.value = false })
</script>
