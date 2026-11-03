# U3 静态审计（43 个已实现工具）

范围：`src/data/tools.js` 全部工具（52）排除 `STUB_PATHS`（9 个占位：idphoto / ocr / image-editor / pdf-editor / word2pdf / excel2pdf / ppt2pdf / pdf2word / websocket）→ **43 个**。

判定口径：
- 入口：是否向 `ToolPage` 传 `processHandler`，或自有 `@click` 处理函数（文本类工具为即时转换）。
- 输出：是否有真实产物（`downloadBlob` / `downloadZip` / `saveAndDownload` / 结果文本域 / 结果面板 / 生成图片）。
- 结论：OK = 入口与输出均为真实实现；可疑 = 需运行时复核或疑似无处理能力。

| # | 工具 | 路由 | 入口 | 输出 | 结论 |
|---|---|---|---|---|---|
| 1 | 图片压缩 | /imagecompress | processHandler | canvas 重编码 → downloadZip(compressed.zip) | OK |
| 2 | 图片尺寸调整 | /imageresize | processHandler | canvas 缩放 → downloadZip(resized.zip) | OK |
| 3 | 图片Base64编码 | /image2base64 | processHandler + 解码 @click | 结果文本(dataURL)+复制；解码预览+downloadBlob | OK |
| 4 | 二维码制作 | /qrcode | @click generate | qrcode.toDataURL 预览 + downloadBlob(qrcode.png) | OK |
| 5 | 图片转PDF | /image2pdf | processHandler | pdf-lib 合成 → downloadBlob(*.pdf) | OK |
| 6 | 图片转JPG | /image2jpg | processHandler | canvas toBlob(jpeg) → downloadZip(jpg.zip) | OK |
| 7 | 图片转PNG | /image2png | processHandler | canvas toBlob(png) → downloadZip(png.zip) | OK |
| 8 | 图片转webp | /image2webp | processHandler | canvas toBlob(webp)+类型校验 → downloadZip(webp.zip) | OK |
| 9 | 图片旋转翻转 | /imagerotate | processHandler | canvas 旋转/翻转 → downloadZip(rotated.zip) | OK |
| 10 | 拼长图 | /imagecombine | processHandler | canvas 拼接 → downloadBlob(combined_*.png) | OK |
| 11 | 拼字幕 | /imagesubtitle | processHandler | canvas 拼接+字幕 → downloadBlob(subtitle.png) | OK |
| 12 | 宫格拼图 | /image-grid | processHandler | canvas 网格 → downloadZip(grid.zip) | OK |
| 13 | 图片分割 | /imagesplit | processHandler | canvas 切片 → downloadZip(split.zip) | OK |
| 14 | 图片加水印 | /image-watermark | processHandler | canvas 水印 → downloadZip(watermarked.zip) | OK |
| 15 | 批量打印 | /print | 自有 addFiles/doPrint/export | window.print + 导出 PDF downloadBlob | OK（U2 已验证） |
| 16 | PDF合并 | /pdfmerge | processHandler | pdf-lib copyPages → saveAndDownload | OK（T3 已验证） |
| 17 | PDF拆分 | /pdfsplit | processHandler | pdf-lib 分组 → downloadZip(split.zip) | OK（T3 已验证） |
| 18 | PDF提取页面 | /pdfextract | processHandler | pdf-lib copyPages → downloadZip(extracted.zip) | OK（T3 已验证） |
| 19 | PDF删除页面 | /pdfdelete | processHandler | pdf-lib 删除页 → downloadZip(deleted.zip) | OK（T3 已验证） |
| 20 | PDF转图片 | /pdf2image | processHandler | pdfjs 渲染 → downloadZip(pdf2image.zip) | OK（T3 已验证） |
| 21 | PDF旋转 | /pdfrotate | processHandler | pdf-lib setRotation → downloadZip(rotated-pdf.zip) | OK（T3 已验证） |
| 22 | PDF排序 | /pdfsort | processHandler | pdf-lib 按序 copyPages → downloadZip(sorted.zip) | OK（T3 已验证） |
| 23 | PDF压缩 | /pdfcompress | processHandler | pdf-lib 重序列化 → downloadZip(compressed-pdf.zip) | OK（T3 已验证） |
| 24 | PDF加页码 | /pdf-page-number | processHandler | pdf-lib drawText → downloadZip(numbered.zip) | OK（T3 已验证） |
| 25 | PDF加水印 | /pdf-watermark | processHandler | pdf-lib 平铺文字 → downloadZip(watermarked-pdf.zip) | OK（T3 已验证） |
| 26 | PDF修改元数据 | /pdf-metadata | processHandler + 读取 @click | pdf-lib setTitle/… → downloadBlob(*_metadata.pdf) | OK（T3 已验证） |
| 27 | PDF页面调整 | /pdf-resize | processHandler | pdf-lib scaleContent+setSize → downloadZip(resized-pdf.zip) | OK（T3 已验证） |
| 28 | PDF转长图 | /pdf-to-long-image | processHandler | pdfjs 渲染+纵向拼接 → downloadZip(long-images.zip) | OK（T3 已验证） |
| 29 | PDF提取图片 | /pdf-extract-image | processHandler | pdfjs collectPageImages → downloadZip(pdf-images.zip) | OK（T3 已验证） |
| 30 | PDF去水印 | /pdf-remove-watermark | processHandler | pdfjs 渲染为图像页 → downloadZip(no-watermark.zip) | OK（T3 已验证） |
| 31 | Unix时间戳 | /timestamp | @click 转换 | 结果面板（时间戳/本地/UTC/相对） | OK |
| 32 | 颜色值转换 | /color | 即时 @input | HEX/RGB/RGBA/HSL 结果 + 色块预览 | OK |
| 33 | Base64编码解码 | /base64 | 即时转换 | 输出文本域 + 复制 | OK |
| 34 | URL编码解码 | /url | 即时转换 | 输出文本域 + 复制 | OK |
| 35 | Unicode编码转换 | /unicode | 即时转换 | 输出文本域 + 复制 | OK |
| 36 | 进制转换 | /number | 即时转换 | 多进制结果面板 + 复制 | OK |
| 37 | 正则表达式测试 | /regex | 即时匹配 | 高亮区 + 匹配列表 | OK |
| 38 | AES加密解密 | /aes | @click run | Web Crypto AES-GCM 密文文本 + 复制 | OK |
| 39 | DES加密解密 | /des | @click run（加密/解密） | 纯 JS DES-ECB+PKCS#7 → Base64 结果面板 + 复制 | OK（U3 已修复：新增 `deskit.js`，与 OpenSSL des-ecb 逐字节一致） |
| 40 | RSA加密解密 | /rsa | @click run + 生成密钥对 | Web Crypto RSA-OAEP(SHA-256) → Base64 结果面板 + 复制；SPKI/PKCS#8 PEM | OK（U3 已修复：PEM 导入导出 + 2048 位密钥对生成） |
| 41 | Hash计算 | /hash | 即时/防抖计算 | SHA 结果面板 + 复制 | OK |
| 42 | 文件Hash计算 | /file_hash | @click run | 分块读取 + crypto.subtle.digest → 结果面板 + 复制 | OK |
| 43 | 摩斯电码 | /morse | 即时转换 | 输出文本域 + 复制 | OK |

## 静态结论

- 静态初审：43 个工具中 **41 个**具备真实处理入口与真实输出；**2 个可疑**：`/des`、`/rsa`（原为「演示版未实现」说明页，无输入、无处理、无输出）。
- 修复后复评：`/des` 改为纯 JS DES-ECB + PKCS#7（新增 `src/views/tools/deskit.js`）；`/rsa` 改为 Web Crypto RSA-OAEP(SHA-256) + PEM 导入导出 + 密钥对生成。二者现已具备真实入口与真实输出。
- 最终：**43 个全部 OK**，无空实现，无降级。
- 其余工具均引用真实库（pdf-lib / pdfjs-dist / qrcode / canvas / Web Crypto）。
- 运行时复核结果见 `_verify/_audit_runtime.md`。
