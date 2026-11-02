<template>
  <el-container class="is-vertical">
    <SiteHeader />
    <main class="el-main flex justify-center p-3">
      <div class="content">
        <router-view />
      </div>
    </main>
    <SiteFooter />
  </el-container>
</template>

<script setup>
import SiteHeader from './components/SiteHeader.vue'
import SiteFooter from './components/SiteFooter.vue'
</script>
