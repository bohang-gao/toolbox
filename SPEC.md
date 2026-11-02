# imgtool.net 复刻 — 设计规格（SPEC）

> 依据对 https://imgtool.net/ 的真实抓取分析（HTML + main.css + page.css）。所有数值均来自原站 CSS 实测，不是猜测。

## 1. 技术栈约束
- Vite + Vue 3 + vue-router（原站为 Nuxt2 + Element UI，我们用 Vue3 等价复刻，不引入 Element UI 依赖，自行实现等价样式）
- 纯前端实现，所有图片/PDF 处理在浏览器端完成
- 已安装依赖（**禁止修改 package.json、禁止 npm install**）：`vue`、`vue-router`、`jszip`、`pdf-lib`、`pdfjs-dist`、`qrcode`
- 图标：内联一套 Font Awesome 4.7 图标 SVG/CSS（原站用 FA 4.7），只需覆盖项目用到的图标

## 2. 设计 Token（原站实测值）
### 颜色
| 用途 | 值 |
|---|---|
| 导航背景 | `#545c64`（Element UI dark） |
| 导航 logo 文字 | `orange` |
| 导航激活项文字/下划线 | `#ffd04b` |
| 导航普通项文字 | `#fff` |
| 页面背景 | `#f1f1f1` |
| 卡片背景 | `#fff`，边框 `1px solid #ccc` |
| 卡片标题文字 | `#333`，副标题 `#707078` |
| 主色（按钮/上传区） | `#0081ff`（本站自定义 primary，非 Element 默认蓝） |
| Element 按钮蓝 | `#409eff`，info 灰 `#909399` |
| 上传云图标灰 | `#c0c4cc` |
| 工具介绍绿底 | `background:#dfd` |
| 广告位底 | `#f4f8fa` |
| 图标色板（cu-text-*） | blue `#0081ff` / red `#e54d42` / green `#39b54a` / orange `#f37b1d` / yellow `#fbbd08` / olive `#8dc63f` / cyan `#1cbbb4` / purple `#6739b6` / mauve `#9c26b0` / pink `#e03997` / brown `#a5673f` / grey `#8799a3` / gray `#aaa` / black `#333` / white `#fff` |

### 尺寸 / 间距 / 断点
- 基准字号 15px，行高 1.5；`h1` 30px（页面大标题）
- 导航高 60px（fixed-top）；页脚高 60px
- `.content{width:80%}` 居中（移动端 100%）
- 工具卡 `.tool`：高 110px、padding 0 20px、圆角 4px、margin-bottom 20px；hover `box-shadow:0 3px 8px 0 rgba(0,0,0,.2)`（transition box-shadow .2s ease-in-out）
- 卡片图标 40px，标题 18px，副标题 13px；🔥tag 绝对定位 top:8px right:12px
- 移动端（≤991px）卡片高 80px、图标 30px、标题 14px、副标题隐藏（`hidden-sm-and-down`）
- 上传区 `.el-upload-dragger`：宽 100%、高 180px（移动端 140px）、背景 `#0081ff`、白字、无边框；云图标 55px `#c0c4cc`
- 断点：xs<768 / sm 768-991 / md 992-1199 / lg 1200-1919 / xl≥1920（Element UI 栅格断点）
- 栅格：首页卡片 xs=12 sm=12 md=8 lg=6 xl=6（即手机2列/平板2列/中屏3列/大屏4列），列间距 20px（左右 padding 10px）
- 相关工具卡 `.related-tool`：高 80px，其余同 .tool

### 布局结构
```
el-container(is-vertical)
├─ header.el-header h60  ← .horizon-nav.fixed-top bg#545c64
│   ├─ logo "imgtool.net"（orange bold 24px, margin 0 20px）
│   ├─ ≥992px: 水平菜单 首页/图片工具/文档工具/其他工具/优惠券/常见问题/博客/🔥桌面版下载
│   │   项高60px 激活项 color#ffd04b + border-bottom 2px #ffd04b
│   └─ <992px: 右侧 fa-bars 汉堡图标，点击弹出下拉菜单
├─ main.el-main  min-height:calc(100vh - 120px)  .content 容器
└─ footer.el-footer h60  两行居中小字(12px)：
    「公众号「图文工具箱」(蓝) · 关于我们」
    「Copyright © 2022-2026 · 浙ICP备... · 浙公网安备...」
```

## 3. 首页数据（51 个工具，三分区）
### 图片工具（17）
| 名称 | 路由 | 图标 | 色 | 描述 | 热门 |
|---|---|---|---|---|---|
| 证件照换底色 | /idphoto | fa-id-card | blue | 一寸照制作，一键换底色 | |
| 图片压缩 | /imagecompress | fa-compress | blue | 不改变图片尺寸减小文件大小 | 🔥 |
| 图片尺寸调整 | /imageresize | fa-expand | blue | 图片宽高等比缩放 | 🔥 |
| 图片Base64编码 | /image2base64 | fa-file-image-o | brown | 图片和base64编码互转 | |
| 二维码制作 | /qrcode | fa-qrcode | black | 根据文字生成二维码图片 | |
| 图片转PDF | /image2pdf | fa-file-image-o | red | 将图片转换为PDF文件 | 🔥 |
| 图片转文字 | /ocr | fa-text-width | orange | 提取图片中的文字 | |
| 图片转JPG | /image2jpg | fa-file-image-o | brown | 将图片转换为jpg格式 | |
| 图片转PNG | /image2png | fa-file-image-o | brown | 将图片转换为png格式 | |
| 图片转webp | /image2webp | fa-file-image-o | brown | 将图片转换为webp格式 | |
| 图片旋转翻转 | /imagerotate | fa-repeat | blue | 图片旋转，图片翻转 | |
| 拼长图 | /imagecombine | fa-bars | blue | 水平拼接，垂直拼接 | |
| 拼字幕 | /imagesubtitle | fa-tv | blue | 图片拼字幕，拼台词 | |
| 图片编辑器 | /image-editor | fa-edit | blue | 支持裁剪\|调色\|添加文字\|滤镜 | |
| 宫格拼图 | /image-grid | fa-th-large | blue | 网格拼图，模板拼图 | 🔥 |
| 图片分割 | /imagesplit | fa-th | blue | 宫格切图，网格切图 | |
| 图片加水印 | /image-watermark | fa-pencil | blue | 图片批量添加水印 | |

### 文档工具（19）
| 名称 | 路由 | 图标 | 色 | 描述 | 热门 |
|---|---|---|---|---|---|
| PDF合并 | /pdfmerge | fa-file-pdf-o | red | 将多个PDF文件合并成一个文件 | 🔥 |
| PDF拆分 | /pdfsplit | fa-file-pdf-o | red | 将一个PDF文件拆分成多个文件 | 🔥 |
| PDF提取页面 | /pdfextract | fa-file-pdf-o | red | 从一个PDF文件中提取若干页面 | |
| PDF删除页面 | /pdfdelete | fa-file-pdf-o | red | 从一个PDF文件中删除若干页面 | |
| Word转PDF | /word2pdf | fa-file-word-o | blue | 将Word文件转换为PDF文件 | |
| Excel转PDF | /excel2pdf | fa-file-excel-o | green | 将Excel文件转换为PDF文件 | |
| PPT转PDF | /ppt2pdf | fa-file-powerpoint-o | orange | 将PPT文件转换为PDF文件 | |
| PDF转Word | /pdf2word | fa-file-pdf-o | red | 将PDF文件转换为Word文件 | |
| PDF转图片 | /pdf2image | fa-file-pdf-o | red | 提取PDF页面为图片 | 🔥 |
| PDF旋转 | /pdfrotate | fa-repeat | red | 批量旋转PDF页面 | |
| PDF排序 | /pdfsort | fa-sort-alpha-asc | red | PDF页面排序 | 🔥 |
| PDF压缩 | /pdfcompress | fa-compress | red | 压缩PDF文件减小体积 | |
| PDF加页码 | /pdf-page-number | fa-sort-numeric-asc | red | 支持多种位置添加页码 | |
| PDF加水印 | /pdf-watermark | fa-pencil | red | 添加文字或图片水印 | |
| PDF修改元数据 | /pdf-metadata | fa-info | gray | 修改标题\|作者\|时间等 | |
| PDF页面调整 | /pdf-resize | fa-file-pdf-o | red | 统一PDF页面宽度 | |
| PDF转长图 | /pdf-to-long-image | fa-file-pdf-o | red | 将PDF转为长长的图片 | |
| PDF提取图片 | /pdf-extract-image | fa-file-pdf-o | red | 从PDF文件中提取所有图片 | |
| PDF去水印 | /pdf-remove-watermark | fa-file-pdf-o | red | 去除PDF文件中的水印 | |
| PDF编辑器 | /pdf-editor | fa-pencil-square-o | red | 本地编辑PDF可添加文字、图片和签名 | 🔥 |

### 其他工具（15）
| 名称 | 路由 | 图标 | 色 | 描述 |
|---|---|---|---|---|
| Unix时间戳 | /timestamp | fa-clock-o | grey | 在线时间戳转换 |
| 颜色值转换 | /color | fa-leaf | red | RGB转HEX,RGBA,HSL |
| Base64编码解码 | /base64 | fa-code | olive | base64编码，base64解码 |
| URL编码解码 | /url | fa-code | green | url编码，url解码 |
| Unicode编码转换 | /unicode | fa-code | cyan | unicode转中文，中文转unicode |
| 进制转换 | /number | fa-angle-double-right | blue | 二、四、八、十、十六、三十二进制互转 |
| 正则表达式测试 | /regex | fa-check-square-o | red | 在线正则测试工具 |
| AES加密解密 | /aes | fa-user-secret | olive | 在线AES加密、AES解密工具 |
| DES加密解密 | /des | fa-user-secret | green | 在线DES加密、DES解密工具 |
| RSA加密解密 | /rsa | fa-user-secret | cyan | 在线RSA加密、RSA解密工具 |
| Hash计算 | /hash | fa-calculator | blue | 在线Hash计算工具 |
| 文件Hash计算 | /file_hash | fa-calculator | purple | 在线文件Hash值计算工具 |
| WebSocket测试 | /websocket | fa-connectdevelop | mauve | 在线WebSocket测试工具 |
| 摩斯电码 | /morse | fa-phone-square | brown | 摩斯电码编码，摩斯电码解码 |

### 首页分区渲染
每分区 `<h1 class="text-4xl">分区名</h1>` + 栅格卡片行。卡片 = `<a class="tool">`，内部：图标 + 标题/副标题 + 可选🔥。副标题仅 ≥992px 显示。**范围裁剪**：实现时"优惠券/常见问题/博客/桌面版"等导航链接指向占位页 `#`；Word/Excel/PPT 转 PDF、PDF转Word、OCR、图片编辑器、PDF编辑器、WebSocket 等「需要服务端或重型编辑器」的工具，页面保留并可打开，内容放「该工具需要服务端处理，演示版未实现」占位卡（保持视觉一致）。**需真实实现的工具清单见 §5**。

## 4. 工具页模板（统一结构）
```
<h1 class="text-4xl">工具名</h1>
[上传/输入区]           ← 图片/PDF类：蓝色 el-upload-dragger 拖拽区 + 「添加图片」按钮(左) + 「清空任务」「开始处理」按钮组(右)
[选项区]                ← 各工具的参数（压缩强度滑杆等）
[任务列表]              ← 文件名+大小+状态(等待/处理中/完成/失败)+预览+删除
[结果反馈]              ← 成功提示 / 错误提示（顶部 el-message 风格浮条，成功绿 #f0f9eb 边#e1f3d8 字#67c23a；错误红 #fef0f0/#f56c6c）
<div class="mt-4 rounded-sm p-4" style="background-color:#dfd">
  <h2 class="text-xl">工具介绍：</h2><p>...</p>
  <h2 class="mt-4 text-xl">使用说明：</h2><p>1....<br>2....</p>
</div>
<h2 class="text-2xl">相关工具</h2> + related-tool 栅格（同分区其他工具，xs12/sm12/md8/lg6）
```

## 5. 必须真实实现的功能与验收口径
通用：文件多选、拖拽上传、任务列表状态（等待/处理中/完成/失败）、处理完成自动下载 zip（jszip）、空列表点「开始处理」给错误提示、非图片文件被拒、超大文件(>50MB)提示、处理中按钮禁用。

| 工具 | 实现口径 |
|---|---|
| 图片压缩 | quality 滑杆(1-100 默认80) + 可选等比缩放(按百分比或最大宽)，canvas 重编码 JPEG/WEBP，显示压缩前后体积对比 |
| 图片尺寸调整 | 按百分比或指定宽（等比）批量输出 |
| 图片旋转翻转 | 每张可选旋转90/180/270、水平/垂直翻转 |
| 图片转JPG/PNG/webp | 格式批量转换（webp 用 canvas toBlob） |
| 图片Base64 | 图片→base64(dataURL 文本框可复制)；base64→图片预览+下载 |
| 拼长图 | 多图横向或纵向拼接，可选间距 |
| 图片分割 | 按行×列网格切割输出 |
| 宫格拼图 | N张图拼成 2×2/3×3 等网格 |
| 图片加水印 | 文字水印（透明度/位置/大小）批量 |
| 二维码制作 | 文本→二维码 PNG（qrcode 库） |
| 图片转PDF | 多图→pdf-lib 合成 PDF，每图一页 |
| PDF合并 | 多个 PDF → pdf-lib 合并下载 |
| PDF拆分 | 按页码范围拆出（如 1-3,5） |
| PDF提取页面 / 删除页面 | 同上，pdf-lib copyPages |
| PDF转图片 / PDF转长图 | pdfjs-dist 渲染每页为 PNG，单页下载或全部 zip；转长图=纵向拼接 |
| PDF旋转 | 全部页旋转 90/180/270（pdf-lib setRotation） |
| PDF加页码 | 文字页码（位置：底部居中等，pdf-lib drawText） |
| PDF加水印 | 文字水印平铺（pdf-lib，透明度） |
| Base64/URL/Unicode/进制/时间戳/颜色/Hash | 文本工具，双向转换即时预览；Hash 用 Web Crypto(SHA-1/256/512)；颜色 RGB/HEX/HSL 互转+预览 |

## 6. 交互与异常（全站通用）
- 路由：所有 51 个工具路由都要存在（含占位工具页），404 兜底重定向首页
- 下拉菜单（移动端）点击外部关闭；active 导航项按路由高亮
- 表单非法输入给出行内/顶部错误提示；处理失败逐文件标记失败原因
- 下载文件名保持原文件名（转换工具改扩展名）
- 动效还原：卡片 hover 阴影 .2s、按钮 hover 轻微变亮、el-message 浮入浮出
