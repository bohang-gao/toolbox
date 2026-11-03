# Toolbox

Toolbox —— 基于 Vue 3 + Vite 的在线图片/文档/文本工具站（交互与视觉参考 imgtool.net，代码为独立实现）。

**🌐 在线体验：https://bohang-gao.github.io/imgtool-clone/** （GitHub Pages，push main 自动部署）
全部图片、PDF、文本处理均在浏览器本地完成，文件不上传服务器。

## 运行方式

```bash
npm install      # 安装依赖
npm run dev      # 开发服务器（默认 http://127.0.0.1:5173）
npm run build    # 生产构建，输出到 dist/
npm run preview  # 预览构建产物（默认 http://127.0.0.1:4173）
```

路由使用 hash 模式（`createWebHashHistory`），构建产物可直接部署到任意静态服务器。

## 界面与导航

全站采用「左侧边栏 + 右侧内容区」的 AppShell 布局（≤991px 自动折叠为汉堡抽屉）：

- **侧边栏**：品牌 Logo、搜索框、五项菜单（常用工具 / 全部工具 / 图片工具 / PDF 文档工具 / 文本编码工具），当前页高亮；移动端由顶栏汉堡按钮唤出，点遮罩、菜单项或路由切换即关闭。
- **分类**：`/c/img`（17 个）、`/c/pdf`（21 个）、`/c/text`（14 个）单分区展示；首页 `/` 展示「常用工具 · 最近使用」+ 三个完整分区。
- **搜索**：侧边栏输入关键词（250ms 防抖）跳转 `/?q=关键词`，按名称/描述/路径不区分大小写过滤全部 52 个工具；`Esc` 清空并还原首页。
- **常用工具**：访问过的工具按使用次数、最近使用时间排序（最多 8 个卡片），数据存于浏览器 `localStorage`（键 `toolbox.recent`），不上传；侧边栏「常用工具」显示使用数量徽标（>99 显示 `99+`）。
- **路由**：`/c/recent` 为常用工具独立页；未知路径兜底重定向到 `/`。

## 工具页布局

所有工具页统一采用 `ToolShell` 壳层，结构自上而下：

- **面包屑**：`首页 / 分类 / 当前工具`，前两级可点击跳转，末级为当前页（不可点）。
- **Hero 头图区**：工具图标 + 标题（h1）+ 一句话描述，与页面标题、导航保持一致。
- **两栏布局**（`.tool-layout`）：左侧主操作区 `.tool-main`（白底卡片，上传/参数/结果），右侧 300px 侧栏 `.tool-aside`（「使用说明」步骤列表 + 相关工具推荐），滚动时侧栏吸顶。
- **响应式**：≥992px 两栏；≤991px 折叠为单栏，侧栏落到主区下方，顶栏显示汉堡按钮唤出侧边导航。

## 批量打印流程

`/print` 支持 PDF 与图片混合排序后一键打印，或导出合并 PDF：

1. 添加文件并排序（PDF 按页、图片可设份数），页面实时显示预计页数。
2. 点击「直接打印」弹出**确认模态**，汇总纸张（A4）、方向、每页份数、边距与文件数，确认前不会调用 `window.print()`。
3. 模态内可选「取消」（不打印、无残留）或「继续打印」（注入打印样式、渲染纸张后调用 `window.print()`，完成后自动清理）。
4. 模态内提供「没有打印机？导出 PDF」，生成合并 PDF 下载，可在任意设备打印。
5. 浏览器安全策略**不允许网页读取或枚举系统打印机**，因此打印使用系统默认打印机与浏览器打印对话框；处理失败的文件不计入页数，全部失败时取消打印并提示。

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

共 52 个工具路由，其中 43 个为纯前端真实实现，9 个因需要服务端算力或重型编辑器而保留占位页
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

### 文档工具（21）

| 工具 | 路由 | 状态 | 说明 |
|---|---|---|---|
| 批量打印 | /print | 实现 | PDF/图片排序 → 确认模态 → 打印或导出合并 PDF |
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
| DES加密解密 | /des | 实现 | 纯 JS DES-ECB + PKCS#7，Base64 密文 |
| RSA加密解密 | /rsa | 实现 | RSA-OAEP(SHA-256)，PEM 密钥 + 密钥对生成 |
| Hash计算 | /hash | 实现 | Web Crypto SHA-1/256/512 |
| 文件Hash计算 | /file_hash | 实现 | 本地读取文件计算 Hash |
| WebSocket测试 | /websocket | 占位 | 需长连接调试环境 |
| 摩斯电码 | /morse | 实现 | 摩斯电码双向编解码 |

## 响应式说明

按 Element UI 断点实现，四档宽度实测结果（侧边栏 240px，≥992px 常驻）：

| 宽度 | `.content` 宽 / 内边距 | 首页每行卡片 | 卡片高度 | 侧边栏 |
|---|---|---|---|---|
| 375px | 375px / 64px 16px | 2 列 | 84px | 抽屉（汉堡按钮） |
| 768px | 768px / 64px 16px | 2 列 | 84px | 抽屉（汉堡按钮） |
| 1280px | 1040px / 24px 32px | 4 列 | 110px | 常驻左侧 |
| 1920px | 1200px（max-width）/ 24px 32px | 4 列 | 110px | 常驻左侧 |

- 内容区最大宽度 1200px，超出部分居中留白（右对齐侧边栏）。
- 上传拖拽区 140px（≤991px）/ 180px（≥992px）。
- ≤991px 侧边栏变为抽屉，点遮罩/菜单项/路由切换自动收起；移动端顶栏显示汉堡按钮。
- 未知路由兜底重定向到首页。
