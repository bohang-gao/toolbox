<template>
  <div>
    <h1 class="text-4xl">AES加密解密</h1>

    <div class="tool-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">模式</span>
        <label class="el-radio"><input v-model="mode" type="radio" value="encrypt" />加密</label>
        <label class="el-radio"><input v-model="mode" type="radio" value="decrypt" />解密</label>
      </div>

      <div class="mt-4 flex flex-wrap items-center" style="gap:12px 16px">
        <span class="form-label">口令</span>
        <input
          v-model="password"
          class="el-input__inner"
          style="width:280px"
          type="password"
          placeholder="用于派生密钥的口令"
          @keyup.enter="run"
        />
        <span class="form-label">迭代次数</span>
        <input v-model.number="iterations" class="el-input__inner" style="width:120px" type="number" min="1000" max="1000000" step="1000" />
      </div>

      <div class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">{{ mode === 'encrypt' ? '明文' : '密文（Base64）' }}</span>
          <span style="font-size:12px;color:#909399">{{ input.length }} 字符</span>
        </div>
        <textarea
          v-model="input"
          class="el-textarea__inner mt-2"
          style="min-height:140px;font-family:Consolas,Menlo,monospace"
          :placeholder="mode === 'encrypt' ? '输入需要加密的文本' : '粘贴本工具生成的 Base64 密文'"
        ></textarea>
      </div>

      <div class="mt-4 flex items-center flex-wrap" style="gap:12px">
        <button type="button" class="el-button el-button--primary" :disabled="busy" @click="run">
          <span><i class="fa fa-user-secret mr-1"></i> {{ mode === 'encrypt' ? '加密' : '解密' }}</span>
        </button>
        <button type="button" class="el-button el-button--info" :disabled="busy" @click="clearAll">清空</button>
        <span v-if="!cryptoOk" style="color:#f56c6c;font-size:14px">当前环境不支持 Web Crypto（需要 HTTPS 或 localhost 访问）</span>
      </div>

      <div v-if="output" class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">输出结果</span>
          <button type="button" class="el-button copy-btn" style="padding:6px 12px" @click="copyText(output, '结果已复制')">复制结果</button>
        </div>
        <div class="result-box mt-2">{{ output }}</div>
      </div>

      <div class="mt-4" style="font-size:13px;color:#e6a23c;background:#fdf6ec;border:1px solid #faecd8;border-radius:4px;padding:10px 12px">
        注意：本工具使用 AES-GCM + PBKDF2(SHA-256) 的标准实现，密文格式为 Base64(盐16字节 + IV12字节 + 密文)，与部分网站（含原站）的算法与密文格式可能不同，无法直接互通。
      </div>
    </div>

    <div class="mt-4 rounded-sm p-4" style="background-color:#dfd">
      <h2 class="text-xl">工具介绍：</h2>
      <p>基于浏览器 Web Crypto API 的 AES-GCM 加密与解密：用 PBKDF2-SHA256 从口令派生 256 位密钥，每次加密随机生成盐与 IV，全部在本地完成。</p>
      <h2 class="mt-4 text-xl">使用说明：</h2>
      <p style="white-space:pre-line">1. 输入口令（加密与解密必须一致），选择模式。
2. 加密时输入明文，点击「加密」得到 Base64 密文；解密时粘贴该密文并点击「解密」。
3. 口令错误或密文被篡改时，AES-GCM 校验失败会提示解密失败。</p>
    </div>

    <RelatedTools current="/aes" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import RelatedTools from '../../components/RelatedTools.vue'
import { msgError, msgSuccess } from '../../lib/ui.js'
import { copyText, bytesToBase64, base64ToBytes } from './textkit.js'

const cryptoOk = typeof crypto !== 'undefined' && !!crypto.subtle

const mode = ref('encrypt')
const password = ref('')
const iterations = ref(100000)
const input = ref('')
const output = ref('')
const busy = ref(false)

const SALT_LEN = 16
const IV_LEN = 12

function concatBytes(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const a of arrays) {
    out.set(a, pos)
    pos += a.length
  }
  return out
}

async function deriveKey(pwd, salt, iter) {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pwd), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptText() {
  const pwd = password.value
  const plain = input.value
  if (!pwd) throw new Error('请输入口令')
  if (!plain) throw new Error('请输入需要加密的文本')
  const iter = Math.min(1000000, Math.max(1000, Number(iterations.value) || 100000))
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const key = await deriveKey(pwd, salt, iter)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  const payload = concatBytes(salt, iv, new Uint8Array(cipher))
  return bytesToBase64(payload)
}

async function decryptText() {
  const pwd = password.value
  const b64 = String(input.value).replace(/\s+/g, '')
  if (!pwd) throw new Error('请输入口令')
  if (!b64) throw new Error('请输入密文')
  const payload = base64ToBytes(b64)
  if (payload.length < SALT_LEN + IV_LEN + 1) throw new Error('密文长度不足，格式不正确')
  const salt = payload.slice(0, SALT_LEN)
  const iv = payload.slice(SALT_LEN, SALT_LEN + IV_LEN)
  const cipher = payload.slice(SALT_LEN + IV_LEN)
  const iter = Math.min(1000000, Math.max(1000, Number(iterations.value) || 100000))
  const key = await deriveKey(pwd, salt, iter)
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new TextDecoder('utf-8').decode(plainBuf)
}

async function run() {
  if (!cryptoOk) {
    msgError('当前环境不支持 Web Crypto，请通过 HTTPS 或 localhost 访问')
    return
  }
  busy.value = true
  output.value = ''
  try {
    output.value = mode.value === 'encrypt' ? await encryptText() : await decryptText()
    msgSuccess(mode.value === 'encrypt' ? '加密完成' : '解密完成')
  } catch (e) {
    msgError(`${mode.value === 'encrypt' ? '加密' : '解密'}失败：${e.message || e}`)
  } finally {
    busy.value = false
  }
}

function clearAll() {
  input.value = ''
  output.value = ''
}
</script>
