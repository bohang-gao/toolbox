<template>
  <div class="mt-4">
    <h2 class="text-2xl">相关工具</h2>
    <div class="mt-2 el-row" style="margin-left:-10px;margin-right:-10px">
      <div v-for="t in related" :key="t.path" class="rel-col" style="padding-left:10px;padding-right:10px">
        <router-link :to="t.path" class="related-tool">
          <div class="flex items-center" style="width:100%">
            <div class="text-xl" :style="{color:t.color}"><i :class="['fa', t.icon]"></i></div>
            <div class="ml-2 text-lg">{{ t.name }}</div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ALL_SECTIONS } from '../data/tools.js'

const props = defineProps({ current: { type: String, required: true } })
const related = computed(() => {
  for (const sec of ALL_SECTIONS) {
    const hit = sec.tools.find(t => t.path === props.current)
    if (hit) return sec.tools.filter(t => t.path !== props.current).slice(0, 8)
  }
  return ALL_SECTIONS[0].tools.slice(0, 8)
})
</script>

<style scoped>
.rel-col{float:left;width:100%;box-sizing:border-box;overflow:hidden}
@media only screen and (max-width:767px){.rel-col{width:50%}}
@media only screen and (min-width:768px){.rel-col{width:50%}}
@media only screen and (min-width:992px){.rel-col{width:33.33333%}}
@media only screen and (min-width:1200px){.rel-col{width:25%}}
</style>
