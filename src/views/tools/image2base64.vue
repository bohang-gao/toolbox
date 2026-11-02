<template>
  <ToolPage
    ref="pageRef"
    title="图片Base64编码"
    accept="image/*"
    :validator="imageValidator"
    :hint="hint"
    make-thumb
    :process-handler="processHandler"
    intro="在浏览器本地完成图片与 Base64 编码的互相转换：上传图片生成可直接复制的 dataURL，或粘贴 Base64 字符串预览并下载图片。"
    usage="1. 图片 → Base64：添加图片后点击「开始处理」，结果以文本形式显示，可一键复制。&#10;2. Base64 → 图片：切换到「Base64 → 图片」，粘贴 dataURL 或纯 Base64 字符串，点击「预览图片」，随后可下载。&#10;3. 所有转换均在本地完成，图片不会上传到服务器。"
  >
    <template #options>
      <div class="mt-4 option-panel">
        <div class="flex items-center flex-wrap" style="gap:12px 20px">
          <span class="form-label">转换方向</span>
          <label class="el-radio"><input v-model="mode" type="radio" value="encode" />图片 → Base64</label>
          <label class="el-radio"><input v-model="mode" type="radio" value="decode" />Base64 → 图片</label>
        </div>

        <div v-if="mode === 'decode'" class="mt-4">
          <textarea
            v-model="b64Input"
            class="el-textarea__inner"
            style="min-height:140px"
            placeholder="粘贴 data:image/png;base64,... 或纯 Base64 字符串"
          ></textarea>
          <div class="mt-2 flex items-center" style="gap:8px">
            <button type="button" class="el-button el-button--primary" @click="decode">
              <span><i class="fa fa-eye mr-1"></i> 预览图片</span>
            </button>
            <button type="button" class="el-button el-button--info" @click="clearDecoded">清空</button>
          </div>

          <div v-if="decoded && decoded.url" class="mt-4">
            <img
              :src="decoded.url"
              alt="Base64 预览"
              style="max-width:100%;max-height:420px;border:1px solid #ebeef5;border-radius:4px;background:#fff"
            />
            <div class="mt-2">
              <button type="button" class="el-button el-button--primary" @click="downloadDecoded">
                <span><i class="fa fa-download mr-1"></i> 下载图片</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #result>
      <div v-if="encoded.length" class="mt-4">
        <h2 class="text-xl">Base64 结果（共 {{ encoded.length }} 个）</h2>
        <div v-for="item in encoded" :key="item.id" class="mt-2">
          <div class="flex items-center justify-between">
            <span style="color:#303133;font-size:14px">{{ item.name }}</span>
            <button type="button" class="el-button el-button--primary copy-btn" @click="copy(item.dataUrl)">
              <span><i class="fa fa-copy mr-1"></i> 复制</span>
            </button>
          </div>
          <div class="result-box">{{ item.dataUrl }}</div>
        </div>
      </div>
    </template>
  </ToolPage>
</template>

<script setup>
import { computed, ref } from 'vue'
import ToolPage from '../../components/ToolPage.vue'
import {
  imageValidator, downloadBlob, msgSuccess, msgError
} from '../../lib/ui.js'

const pageRef = ref(null)
const mode = ref('encode')
const encoded = ref([])
const b64Input = ref('')
const decoded = ref(null)

const hint = computed(() => mode.value === 'decode'
  ? '解码模式：无需上传，请在下方粘贴 Base64 内容'
  : '点击添加图片，或将图片拖到此处')

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

async function processHandler(tasks) {
  if (mode.value !== 'encode') {
    msgError('当前为解码模式，请在下方粘贴 Base64 内容')
    return
  }
  encoded.value = []
  for (const t of tasks) {
    t.status = 'processing'
    try {
      const dataUrl = await readAsDataURL(t.file)
      t.status = 'done'
      t.outSize = dataUrl.length
      encoded.value.push({ id: t.id, name: t.file.name, dataUrl })
    } catch (e) {
      t.status = 'failed'
      t.error = e.message || String(e)
      msgError(`${t.file.name}：${t.error}`)
    }
  }
  if (encoded.value.length) msgSuccess(`编码完成，共 ${encoded.value.length} 个文件`)
}

function guessMime(b64) {
  if (b64.startsWith('/9j/')) return 'image/jpeg'
  if (b64.startsWith('iVBOR')) return 'image/png'
  if (b64.startsWith('R0lGOD')) return 'image/gif'
  if (b64.startsWith('UklGR')) return 'image/webp'
  if (b64.startsWith('Qk0')) return 'image/bmp'
  return 'image/png'
}

function parseBase64(raw) {
  const s = String(raw || '').trim()
  if (!s) throw new Error('请输入 Base64 内容')
  const m = s.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]*)$/)
  if (m) {
    const body = m[2].replace(/\s+/g, '')
    if (!body) throw new Error('Base64 内容为空')
    return { url: `data:${m[1]};base64,${body}`, mime: m[1] }
  }
  const body = s.replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) throw new Error('不是有效的 Base64 字符串')
  const mime = guessMime(body)
  return { url: `data:${mime};base64,${body}`, mime }
}

function loadDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Base64 内容不是有效的图片'))
    img.src = url
  })
}

async function decode() {
  try {
    const parsed = parseBase64(b64Input.value)
    await loadDataUrl(parsed.url)
    decoded.value = parsed
    msgSuccess('解码成功')
  } catch (e) {
    decoded.value = null
    msgError(e.message || String(e))
  }
}

function clearDecoded() {
  decoded.value = null
  b64Input.value = ''
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',')
  const head = dataUrl.slice(0, comma)
  const body = dataUrl.slice(comma + 1)
  const mime = (head.match(/^data:([^;]+)/) || [])[1] || 'image/png'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function downloadDecoded() {
  if (!decoded.value) return
  const extMap = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/bmp': 'bmp', 'image/svg+xml': 'svg'
  }
  const ext = extMap[decoded.value.mime] || 'png'
  try {
    downloadBlob(dataUrlToBlob(decoded.value.url), `decoded.${ext}`)
  } catch (e) {
    msgError(`下载失败：${e.message || e}`)
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    msgSuccess('已复制到剪贴板')
  } catch (e) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch (_) { ok = false }
    ta.remove()
    if (ok) msgSuccess('已复制到剪贴板')
    else msgError('复制失败，请手动选择文本复制')
  }
}
</script>
