<template>
  <ToolShell
    path="/des"
    title="DES加密解密"
    intro="纯浏览器端的 DES（ECB + PKCS#7）加解密：输入 8 字节密钥，加密得到 Base64 密文，解密还原明文，全程本地完成。"
    :usage="[
      '输入密钥（不足 8 字节补 0，超出截断为 8 字节；加解密必须一致）。',
      '加密：输入明文，点击「加密」得到 Base64 密文。',
      '解密：粘贴 Base64 密文，点击「解密」还原明文。DES 已不安全，仅用于兼容旧数据。'
    ]"
  >
    <div class="step-block">
      <div class="step"><b>1</b> 输入与设置</div>
      <div class="option-panel">
      <div class="flex flex-wrap items-center" style="gap:12px 20px">
        <span class="form-label">模式</span>
        <label class="el-radio"><input v-model="mode" type="radio" value="encrypt" />加密</label>
        <label class="el-radio"><input v-model="mode" type="radio" value="decrypt" />解密</label>
      </div>

      <div class="mt-4 flex flex-wrap items-center" style="gap:12px 16px">
        <span class="form-label">密钥</span>
        <input
          v-model="key"
          class="el-input__inner"
          style="width:280px;font-family:Consolas,Menlo,monospace"
          type="text"
          maxlength="8"
          placeholder="8 字节密钥，例如 12345678"
          @keyup.enter="run"
        />
        <span style="color:#909399;font-size:13px">DES 密钥固定 8 字节</span>
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
          :placeholder="mode === 'encrypt' ? '输入需要加密的文本' : '粘贴本工具输出的 Base64 密文'"
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
        注意：DES 有效密钥仅 56 位，已不推荐用于任何新场景，请优先使用 AES。本工具采用 ECB 模式 + PKCS#7 填充，
        密文为 Base64，与其他网站的算法/填充/模式可能不同，无法直接互通。
      </div>

      <div class="step-actions">
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
import { desEncrypt, desDecrypt } from './deskit.js'

const mode = ref('encrypt')
const key = ref('')
const input = ref('')
const output = ref('')
const busy = ref(false)

function run() {
  busy.value = true
  output.value = ''
  try {
    if (mode.value === 'encrypt') {
      if (!input.value) throw new Error('请输入需要加密的文本')
      output.value = bytesToBase64(desEncrypt(input.value, key.value))
      msgSuccess('加密完成')
    } else {
      const b64 = String(input.value).replace(/\s+/g, '')
      if (!b64) throw new Error('请输入密文')
      let bytes
      try {
        bytes = base64ToBytes(b64)
      } catch (e) {
        throw new Error('密文不是合法的 Base64 格式')
      }
      output.value = desDecrypt(bytes, key.value)
      msgSuccess('解密完成')
    }
  } catch (e) {
    output.value = ''
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
