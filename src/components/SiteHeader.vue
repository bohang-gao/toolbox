<template>
  <header class="el-header" style="height:60px">
    <div class="horizon-nav fixed-top">
      <div class="el-row" style="width:100%">
        <div class="logoitem" style="flex:0 0 auto">
          <router-link to="/" class="navlogo"><strong>Toolbox</strong></router-link>
        </div>
        <div class="hidden-sm-and-down" style="flex:1">
          <ul class="hmenu">
            <li v-for="item in menu" :key="item.label" class="hmenu-item"
                :class="{'is-active': isActive(item)}">
              <router-link v-if="item.to" :to="item.to" class="no-deco block h-full px-5">{{ item.label }}</router-link>
              <a v-else href="#" class="no-deco block h-full px-5">{{ item.label }}</a>
            </li>
          </ul>
        </div>
        <div class="hidden-md-and-up" style="flex:1">
          <div class="flex items-center justify-end" style="height:60px;padding-right:16px;position:relative">
            <span role="menu" aria-label="menu" @click.stop="mobileOpen = !mobileOpen">
              <i class="hidden-md-and-up foldicon fa fa-bars" style="color:#fff"></i>
            </span>
            <ul v-show="mobileOpen" class="el-dropdown-menu" style="right:16px;left:auto;top:52px" @click="mobileOpen=false">
              <li v-for="item in menu" :key="'m'+item.label" class="el-dropdown-menu__item">
                <router-link v-if="item.to" :to="item.to" class="no-deco">{{ item.label }}</router-link>
                <a v-else href="#" class="no-deco">{{ item.label }}</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

// 分类导航在原站是独立分类页，本站首页已聚合全部工具，故按占位链接处理，
// 避免多个 to:'/' 的菜单项在首页同时高亮（仅「首页」参与 active 判定）
const menu = [
  { label: '首页', to: '/' },
  { label: '图片工具' },
  { label: '文档工具' },
  { label: '其他工具' },
  { label: '优惠券' },
  { label: '常见问题' },
  { label: '博客' },
  { label: '🔥桌面版下载' }
]
const mobileOpen = ref(false)
const route = useRoute()
const isActive = (item) => item.to === '/' && route.path === '/'
watch(() => route.fullPath, () => { mobileOpen.value = false })
if (typeof window !== 'undefined') {
  window.addEventListener('click', () => { mobileOpen.value = false })
}
</script>

<style scoped>
header.el-header{height:60px}
</style>
