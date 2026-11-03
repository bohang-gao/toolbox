<template>
  <ToolShell
    path="/rsa"
    title="RSA加密解密"
    intro="基于浏览器 Web Crypto API 的 RSA-OAEP（SHA-256）加解密：可生成 2048 位密钥对，使用公钥加密、私钥解密，密钥与明文均不离开本地。"
    :usage="[
      '加密：粘贴公钥（PEM / SPKI），输入明文，点击「加密」得到 Base64 密文。',
      '解密：粘贴私钥（PEM / PKCS#8），输入密文，点击「解密」还原明文。',
      '点击「生成密钥对」可现场生成一对 2048 位 RSA 密钥；RSA-OAEP 单次加密长度有限，长文本请配合 AES 使用。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与设置</div>
      <div class="option-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">模式</span>
        <label class="el-radio"><input v-model="mode" type="radio" value="encrypt" />加密（公钥）</label>
        <label class="el-radio"><input v-model="mode" type="radio" value="decrypt" />解密（私钥）</label>
        <button type="button" class="el-button el-button--info" :disabled="busy" @click="generateKeys">
          <span><i class="fa fa-key mr-1"></i> 生成密钥对</span>
        </button>
      </div>

      <div v-if="mode === 'encrypt'" class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">公钥（PEM / SPKI）</span>
          <span style="font-size:12px;color:#909399">{{ publicKey.length }} 字符</span>
        </div>
        <textarea
          v-model="publicKey"
          class="el-textarea__inner mt-2"
          style="min-height:120px;font-family:Consolas,Menlo,monospace;font-size:12px"
          placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
        ></textarea>
      </div>

      <div v-else class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">私钥（PEM / PKCS#8）</span>
          <span style="font-size:12px;color:#909399">{{ privateKey.length }} 字符</span>
        </div>
        <textarea
          v-model="privateKey"
          class="el-textarea__inner mt-2"
          style="min-height:120px;font-family:Consolas,Menlo,monospace;font-size:12px"
          placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
        ></textarea>
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
          :placeholder="mode === 'encrypt' ? '输入需要加密的短文本' : '粘贴本工具输出的 Base64 密文'"
        ></textarea>
      </div>

      <div v-if="output" class="mt-4">
        <div class="flex justify-between items-center">
          <span class="form-label">输出结果</span>
          <button type="button" class="el-button copy-btn" style="padding:6px 12px" @click="copyText(output, '结果已复制')">复制结果</button>
        </div>
        <div class="result-box mt-2">{{ output }}</div>
      </div>

      <div class="mt-4" style="font-size:13px;color:#e6a23c;background:#fdf6ec;border:1px solid #faecd8;border-radius:4px;padding:10px 12px">
        说明：密钥格式为 PEM（公钥 SPKI / 私钥 PKCS#8），填充方案 RSA-OAEP + SHA-256，密文以 Base64 输出。
        2048 位密钥单次最多加密约 190 字节，长文本请先用 AES 加密，再用 RSA 加密 AES 密钥（混合加密）。
      </div>

      <div class="step-actions">
        <span v-if="!cryptoOk" style="color:#f56c6c;font-size:14px">当前环境不支持 Web Crypto（需要 HTTPS 或 localhost 访问）</span>
        <button type="button" class="el-button el-button--primary" :disabled="busy" @click="run">
          <span><i class="fa fa-user-secret mr-1"></i> {{ mode === 'encrypt' ? '加密' : '解密' }}</span>
        </button>
        <button type="button" class="el-button el-button--info" :disabled="busy" @click="clearAll">清空</button>
      </div>
      </div>
    </div>
  </ToolShell>
</template>

<script setup>
import { ref } from 'vue'
import ToolShell from '../../components/ToolShell.vue'
import { msgError, msgSuccess } from '../../lib/ui.js'
import { copyText, bytesToBase64, base64ToBytes } from './textkit.js'

const cryptoOk = typeof crypto !== 'undefined' && !!crypto.subtle

const MODULUS_LENGTH = 2048
const HASH = 'SHA-256'
const HASH_BYTES = 32
const OAEP = { name: 'RSA-OAEP', hash: HASH }

const mode = ref('encrypt')
const publicKey = ref('')
const privateKey = ref('')
const input = ref('')
const output = ref('')
const busy = ref(false)

function pemToBytes(pem) {
  const body = String(pem || '')
    .replace(/-----[^-]+-----/g, '')
    .replace(/\s+/g, '')
  if (!body) throw new Error('密钥为空')
  try {
    return base64ToBytes(body)
  } catch (e) {
    throw new Error('密钥不是合法的 PEM / Base64 格式')
  }
}

function bytesToPem(bytes, label) {
  const b64 = bytesToBase64(bytes).replace(/(.{64})/g, '$1\n').trim()
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----`
}

async function generateKeys() {
  if (!cryptoOk) {
    msgError('当前环境不支持 Web Crypto，请通过 HTTPS 或 localhost 访问')
    return
  }
  busy.value = true
  try {
    const pair = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: MODULUS_LENGTH, publicExponent: new Uint8Array([1, 0, 1]), hash: HASH },
      true,
      ['encrypt', 'decrypt']
    )
    const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
    publicKey.value = bytesToPem(new Uint8Array(spki), 'PUBLIC KEY')
    privateKey.value = bytesToPem(new Uint8Array(pkcs8), 'PRIVATE KEY')
    output.value = ''
    msgSuccess(`已生成 ${MODULUS_LENGTH} 位 RSA 密钥对`)
  } catch (e) {
    msgError(`生成密钥对失败：${e.message || e}`)
  } finally {
    busy.value = false
  }
}

async function importPublicKey(pem) {
  return crypto.subtle.importKey('spki', pemToBytes(pem), OAEP, false, ['encrypt'])
}

async function importPrivateKey(pem) {
  return crypto.subtle.importKey('pkcs8', pemToBytes(pem), OAEP, false, ['decrypt'])
}

async function encryptText() {
  if (!publicKey.value.trim()) throw new Error('请粘贴公钥')
  const plain = input.value
  if (!plain) throw new Error('请输入需要加密的文本')
  const key = await importPublicKey(publicKey.value)
  const maxBytes = Math.floor(key.algorithm.modulusLength / 8) - 2 * HASH_BYTES - 2
  const data = new TextEncoder().encode(plain)
  if (data.length > maxBytes) {
    throw new Error(`明文过长（${data.length} 字节），当前密钥单次最多加密 ${maxBytes} 字节`)
  }
  const cipher = await crypto.subtle.encrypt(OAEP, key, data)
  return bytesToBase64(new Uint8Array(cipher))
}

async function decryptText() {
  if (!privateKey.value.trim()) throw new Error('请粘贴私钥')
  const b64 = String(input.value).replace(/\s+/g, '')
  if (!b64) throw new Error('请输入密文')
  const key = await importPrivateKey(privateKey.value)
  const cipher = base64ToBytes(b64)
  const plainBuf = await crypto.subtle.decrypt(OAEP, key, cipher)
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
