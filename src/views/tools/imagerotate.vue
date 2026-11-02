<template>
  <ToolPage
    ref="pageRef"
    title="图片旋转翻转"
    accept="image/*"
    :validator="imageValidator"
    make-thumb
    :process-handler="processHandler"
    intro="为每张图片单独设置旋转角度与水平 / 垂直翻转，批量处理后打包下载。"
    usage="1. 点击上传区或「添加文件」选择图片。&#10;2. 在下方列表中为每张图片选择旋转角度、是否水平 / 垂直翻转。&#10;3. 点击「开始处理」，完成后自动下载。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <p style="color:#606266">逐张设置旋转与翻转：</p>
        <div v-if="pageRef && pageRef.tasks.length" class="mt-2">
          <div v-for="t in pageRef.tasks" :key="t.id" class="task-item">
            <span class="t-name">{{ t.file.name }}</span>
            <select
              :value="optOf(t).rotate"
              class="el-input__inner"
              style="width:104px;height:32px;line-height:32px;padding:0 8px;flex-shrink:0"
              @change="setOpt(t.id, 'rotate', Number($event.target.value))"
            >
              <option :value="0">不旋转</option>
              <option :value="90">90°</option>
              <option :value="180">180°</option>
              <option :value="270">270°</option>
            </select>
            <label class="el-radio">
              <input
                type="checkbox"
                :checked="optOf(t).flipH"
                @change="setOpt(t.id, 'flipH', $event.target.checked)"
              />水平翻转
            </label>
            <label class="el-radio">
              <input
                type="checkbox"
                :checked="optOf(t).flipV"
                @change="setOpt(t.id, 'flipV', $event.target.checked)"
              />垂直翻转
            </label>
          </div>
        </div>
        <p v-else class="mt-2" style="color:#909399">请先添加图片，再逐张设置。</p>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { ref, reactive } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import {
  imageValidator, loadImage, canvasToBlob, baseName,
  downloadZip, msgSuccess, msgError
} from '../../lib/ui.js'

const pageRef = ref(null)
const taskOpts = reactive({})
const DEFAULT_OPT = { rotate: 0, flipH: false, flipV: false }

function optOf(t) {
  return taskOpts[t.id] || DEFAULT_OPT
}
function setOpt(id, key, value) {
  if (!taskOpts[id]) taskOpts[id] = { ...DEFAULT_OPT }
  taskOpts[id][key] = value
}

function outFormat(type) {
  if (type === 'image/png') return { mime: 'image/png', ext: 'png' }
  if (type === 'image/webp') return { mime: 'image/webp', ext: 'webp' }
  return { mime: 'image/jpeg', ext: 'jpg' }
}

async function rotateOne(t) {
  const opt = optOf(t)
  const rot = ((Number(opt.rotate) || 0) % 360 + 360) % 360
  const img = await loadImage(t.file)
  const swap = rot === 90 || rot === 270
  const cw = swap ? img.naturalHeight : img.naturalWidth
  const ch = swap ? img.naturalWidth : img.naturalHeight
  const fmt = outFormat(t.file.type)

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (fmt.mime === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, cw, ch)
  }
  ctx.translate(cw / 2, ch / 2)
  ctx.rotate(rot * Math.PI / 180)
  ctx.scale(opt.flipH ? -1 : 1, opt.flipV ? -1 : 1)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

  const blob = await canvasToBlob(canvas, fmt.mime, 0.95)
  const suffix = [rot ? `r${rot}` : '', opt.flipH ? 'h' : '', opt.flipV ? 'v' : '']
    .filter(Boolean).join('_') || 'same'
  return { blob, name: `${baseName(t.file.name)}_${suffix}.${fmt.ext}` }
}

async function processHandler(tasks) {
  const outputs = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const out = await rotateOne(t)
      t.status = 'done'
      t.outSize = out.blob.size
      outputs.push(out)
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }
  if (outputs.length) {
    await downloadZip(outputs, 'rotated.zip')
    msgSuccess(`处理完成，共 ${outputs.length} 个文件`)
  } else {
    msgError('没有可下载的结果')
  }
}
</script>
