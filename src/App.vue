<template>
  <div class="app-shell">
    <SideNav />
    <div class="app-body">
      <main class="content">
        <router-view />
      </main>
      <SiteFooter />
    </div>
  </div>
</template>

<script setup>
import SideNav from './components/SideNav.vue'
import SiteFooter from './components/SiteFooter.vue'
</script>
