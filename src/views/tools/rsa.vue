<template>
  <div>
    <h1 class="text-4xl">RSA加密解密</h1>

    <div class="tool-panel">
      <div class="flex items-start" style="gap:12px">
        <div class="text-2xl" style="color:#1cbbb4;line-height:1"><i class="fa fa-user-secret"></i></div>
        <div>
          <h2 class="text-xl" style="color:#333">该工具需要服务端处理，演示版未实现</h2>
          <p class="mt-2" style="color:#707078">
            RSA 为非对称加密算法，实际使用中涉及密钥对生成、PEM 格式解析、填充方案（PKCS#1 / OAEP）等较多细节，
            原站通过服务端加密组件实现。本复刻版为纯前端演示，暂不提供 RSA 加解密功能，页面结构与视觉与原站保持一致。
          </p>
          <p class="mt-2" style="color:#707078">
            如需在浏览器本地加密文本，可使用本站已实现的
            <router-link to="/aes" style="color:#409eff">AES加密解密</router-link>
            工具。
          </p>
        </div>
      </div>

      <div class="mt-4" style="font-size:13px;color:#e6a23c;background:#fdf6ec;border:1px solid #faecd8;border-radius:4px;padding:10px 12px">
        提示：RSA 通常只用于加密短数据或传输对称密钥，大段文本请使用「RSA 加密 AES 密钥」的混合加密方案。
      </div>
    </div>

    <div class="mt-4 rounded-sm p-4" style="background-color:#dfd">
      <h2 class="text-xl">工具介绍：</h2>
      <p>原站提供的 RSA 在线加解密工具，使用公钥加密、私钥解密，常见于接口数据加密与签名校验场景。</p>
      <h2 class="mt-4 text-xl">使用说明：</h2>
      <p style="white-space:pre-line">1. 本演示版未实现 RSA 加解密，请在原站使用该工具。
2. RSA 加密长度受密钥位数限制，长文本需分段或采用混合加密。
3. 私钥请勿粘贴到不可信的网页，谨防密钥泄露。</p>
    </div>

    <RelatedTools current="/rsa" />
  </div>
</template>

<script setup>
import RelatedTools from '../../components/RelatedTools.vue'
</script>
