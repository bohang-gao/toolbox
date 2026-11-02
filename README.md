# imgtool-clone

基于 Vue 3 + Vite 复刻 [imgtool.net](https://imgtool.net) 的在线图片/文档/文本工具站。
全部图片、PDF、文本处理均在浏览器本地完成，文件不上传服务器。

## 运行方式

```bash
npm install      # 安装依赖
npm run dev      # 开发服务器（默认 http://127.0.0.1:5173）
npm run build    # 生产构建，输出到 dist/
npm run preview  # 预览构建产物（默认 http://127.0.0.1:4173）
```

路由使用 hash 模式（`createWebHashHistory`），构建产物可直接部署到任意静态服务器。

## 技术栈

| 用途 | 方案 |
|---|---|
| 框架 | Vue 3.5（`<script setup>` + Composition API） |
| 构建 | Vite 6 + `@vitejs/plugin-vue` |
| 路由 | vue-router 4（hash 模式，工具页按需懒加载） |
| PDF 生成/编辑 | pdf-lib 1.17 |
| PDF 渲染 | pdfjs-dist 4.10 |
| 打包下载 | jszip 3.10 |
| 二维码 | qrcode 1.5 |
| 图标 | Font Awesome 4.7（自托管于 `public/fontawesome/`） |
| 样式 | 手写 CSS 还原 Element UI 视觉（`src/styles/main.css`），无 UI 框架依赖 |

## 功能对照表

共 51 个工具路由，其中 42 个为纯前端真实实现，9 个因需要服务端算力或重型编辑器而保留占位页
（页面可正常打开，标题与导航一致，内容为「该工具需要服务端处理，演示版未实现」占位卡）。

### 图片工具（17）

| 工具 | 路由 | 状态 | 说明 |
|---|---|---|---|
| 证件照换底色 | /idphoto | 占位 | 需抠图服务端能力 |
| 图片压缩 | /imagecompress | 实现 | quality 滑杆 + 等比缩放，canvas 重编码 JPEG/WEBP，显示前后体积 |
| 图片尺寸调整 | /imageresize | 实现 | 按百分比或指定宽度等比缩放 |
| 图片Base64编码 | /image2base64 | 实现 | 图片 ↔ base64 双向，可复制/预览/下载 |
| 二维码制作 | /qrcode | 实现 | 文本生成二维码 PNG |
| 图片转PDF | /image2pdf | 实现 | 多图合成 PDF，每图一页 |
| 图片转文字 | /ocr | 占位 | 需 OCR 服务端能力 |
| 图片转JPG | /image2jpg | 实现 | canvas 批量转码 |
| 图片转PNG | /image2png | 实现 | canvas 批量转码 |
| 图片转webp | /image2webp | 实现 | canvas `toBlob` 输出 webp |
| 图片旋转翻转 | /imagerotate | 实现 | 90/180/270 旋转 + 水平/垂直翻转 |
| 拼长图 | /imagecombine | 实现 | 横向/纵向拼接，可选间距 |
| 拼字幕 | /imagesubtitle | 实现 | 图片纵向拼接拼字幕 |
| 图片编辑器 | /image-editor | 占位 | 需重型编辑器 |
| 宫格拼图 | /image-grid | 实现 | 2×2 / 3×3 等网格拼图 |
| 图片分割 | /imagesplit | 实现 | 按行×列网格切割 |
| 图片加水印 | /image-watermark | 实现 | 文字水印，透明度/位置/字号可调 |

### 文档工具（20）

| 工具 | 路由 | 状态 | 说明 |
|---|---|---|---|
| PDF合并 | /pdfmerge | 实现 | pdf-lib 多文件合并 |
| PDF拆分 | /pdfsplit | 实现 | 按页码范围拆分 |
| PDF提取页面 | /pdfextract | 实现 | copyPages 提取指定页 |
| PDF删除页面 | /pdfdelete | 实现 | copyPages 删除指定页 |
| Word转PDF | /word2pdf | 占位 | 需服务端转换 |
| Excel转PDF | /excel2pdf | 占位 | 需服务端转换 |
| PPT转PDF | /ppt2pdf | 占位 | 需服务端转换 |
| PDF转Word | /pdf2word | 占位 | 需服务端转换 |
| PDF转图片 | /pdf2image | 实现 | pdfjs-dist 渲染每页为 PNG |
| PDF旋转 | /pdfrotate | 实现 | setRotation 90/180/270 |
| PDF排序 | /pdfsort | 实现 | 页面顺序重排 |
| PDF压缩 | /pdfcompress | 实现 | 重新序列化压缩体积 |
| PDF加页码 | /pdf-page-number | 实现 | drawText 多种位置 |
| PDF加水印 | /pdf-watermark | 实现 | 文字水印平铺，透明度可调 |
| PDF修改元数据 | /pdf-metadata | 实现 | 标题/作者/时间等字段 |
| PDF页面调整 | /pdf-resize | 实现 | 统一页面宽度 |
| PDF转长图 | /pdf-to-long-image | 实现 | 逐页渲染后纵向拼接 |
| PDF提取图片 | /pdf-extract-image | 实现 | 提取页面内嵌图片 |
| PDF去水印 | /pdf-remove-watermark | 实现 | 去除页面水印对象 |
| PDF编辑器 | /pdf-editor | 占位 | 需重型编辑器 |

### 其他工具（14）

| 工具 | 路由 | 状态 | 说明 |
|---|---|---|---|
| Unix时间戳 | /timestamp | 实现 | 时间戳 ↔ 日期双向 |
| 颜色值转换 | /color | 实现 | RGB/HEX/RGBA/HSL 互转 + 实时预览 |
| Base64编码解码 | /base64 | 实现 | 文本双向转换 |
| URL编码解码 | /url | 实现 | 文本双向转换 |
| Unicode编码转换 | /unicode | 实现 | 中文 ↔ unicode |
| 进制转换 | /number | 实现 | 二/四/八/十/十六/三十二进制互转 |
| 正则表达式测试 | /regex | 实现 | 实时匹配高亮 |
| AES加密解密 | /aes | 实现 | 浏览器端加解密 |
| DES加密解密 | /des | 实现 | 浏览器端加解密 |
| RSA加密解密 | /rsa | 实现 | 生成密钥对 + 加解密 |
| Hash计算 | /hash | 实现 | Web Crypto SHA-1/256/512 |
| 文件Hash计算 | /file_hash | 实现 | 本地读取文件计算 Hash |
| WebSocket测试 | /websocket | 占位 | 需长连接调试环境 |
| 摩斯电码 | /morse | 实现 | 摩斯电码双向编解码 |

## 响应式说明

按 Element UI 断点实现，四档宽度实测结果：

| 宽度 | `.content` | 首页栅格 | 卡片高度 | 图标 | 副标题 | 导航 |
|---|---|---|---|---|---|---|
| 375px | 353px（100%） | 2 列 | 80px | 30px | 隐藏 | 汉堡菜单 |
| 768px | 746px（100%） | 2 列 | 80px | 30px | 隐藏 | 汉堡菜单 |
| 1280px | 1006px（80%） | 4 列 | 110px | 40px | 显示 | 水平菜单 |
| 1920px | 1518px（80%） | 4 列 | 110px | 40px | 显示 | 水平菜单 |

- 页面 `h1` 各档位均为 30px。
- 上传拖拽区 140px（≤991px）/ 180px（≥992px）。
- 汉堡菜单在 ≤991px 显示，点击外部自动关闭；路由切换自动收起。
- 404 路由兜底重定向到首页。
