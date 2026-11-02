<template>
  <div>
    <section v-for="sec in sections" :key="sec.title">
      <h1 class="text-4xl">{{ sec.title }}</h1>
      <div class="mt-2 flex flex-wrap el-row" style="margin-left:-10px;margin-right:-10px">
        <div v-for="t in sec.tools" :key="t.path"
             class="tool-col" style="padding-left:10px;padding-right:10px">
          <router-link :to="t.path" class="tool">
            <div class="flex items-center" style="width:100%">
              <div class="tool-icon" :style="{color: t.color}">
                <i :class="['fa', t.icon]"></i>
              </div>
              <div class="ml-2">
                <div class="tool-header">{{ t.name }}</div>
                <div class="tool-subheader hidden-sm-and-down mt-1">{{ t.desc }}</div>
              </div>
              <div v-if="t.hot" class="tool-tag text-xl">🔥</div>
            </div>
          </router-link>
        </div>
      </div>
    </section>
    <div class="gads flex mt-4" style="background-color:#f4f8fa">广告位（原站为 Google Ads）</div>
  </div>
</template>

<script setup>
import { ALL_SECTIONS } from '../data/tools.js'
const sections = ALL_SECTIONS
</script>

<style scoped>
.tool-col{float:left;width:100%;box-sizing:border-box;overflow:hidden}
@media only screen and (max-width:767px){.tool-col{width:50%}}
@media only screen and (min-width:768px){.tool-col{width:50%}}
@media only screen and (min-width:992px){.tool-col{width:33.33333%}}
@media only screen and (min-width:1200px){.tool-col{width:25%}}
</style>
