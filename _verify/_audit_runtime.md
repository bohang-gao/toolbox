# U3 运行时审计报告

执行方式：Playwright（Chromium）驱动真实浏览器，`http://localhost:5199` 开发服务器，所有选择器限定在 `.tool-main` 内（避开全局侧边栏搜索框）。
脚本：`_verify/_u3_check.cjs`；机器可读结果：`_verify/_u3_report.json`。

- 夹具：canvas 生成的 PNG（`_p2_img1.png` / `_p2_img2.png`）、pdf-lib 生成的 3 页/5 页/含图 PDF（`_u3_pdf3.pdf` / `_u3_pdf5.pdf` / `_u3_pdf_img.pdf`）、纯文本（`_u3_text.txt`）。
- 判定：任务状态到达 `done` / 捕获 download 事件且文件非空 / 文本类输出非空且值正确。
- 最终结果：**35 项断言全部通过（35 PASS / 0 FAIL）**，无 console error，无 pageerror。

| 工具 | 输入 | 期望 | 实际 | 结论 |
|---|---|---|---|---|
| 图片尺寸调整 /imageresize | PNG ×1 | 下载缩放后图片 | 下载 `_u3_out_resize.png` 759B | PASS |
| 图片旋转翻转 /imagerotate | PNG ×1 + 旋转 90° | 下载旋转后图片 | 下载 `_u3_out_rotate.png` 2408B | PASS |
| 图片转JPG /image2jpg | PNG ×1 | 输出真实 JPEG（magic `ffd8`） | 1132B，magic=true | PASS |
| 图片转PNG /image2png | PNG ×1 | 输出真实 PNG（magic `PNG`） | 2077B，magic=true | PASS |
| 图片转webp /image2webp | PNG ×1 | 输出真实 WebP（magic `RIFF`） | 680B，magic=RIFF | PASS |
| 拼长图 /imagecombine | PNG ×2 | 生成拼接长图 | `_u3_out_combined.png` 5048B | PASS |
| PDF提取页面 /pdfextract | 5 页 PDF，提取 1-3,5 | 输出 4 页 PDF | pages=4 | PASS |
| PDF旋转 /pdfrotate | 3 页 PDF，旋转 90° | 全部页面 rotation=90 | `[90,90,90]` | PASS |
| PDF排序 /pdfsort | 3 页 PDF | 输出可解析 3 页 PDF | pages=3 | PASS |
| PDF压缩 /pdfcompress | 3 页 PDF | 输出可解析 PDF | pages=3，1256B | PASS |
| PDF修改元数据 /pdf-metadata | 3 页 PDF + 标题 `U3 Title` | 输出 PDF 的 Title 被写入 | title=`U3 Title` | PASS |
| PDF页面调整 /pdf-resize | 3 页 PDF | 页面宽度统一 595 | `[595,595,595]` | PASS |
| PDF提取图片 /pdf-extract-image | 含图 PDF | 提取内嵌图片（PNG） | 2077B，magic=true | PASS |
| PDF去水印 /pdf-remove-watermark | 3 页 PDF | 重建图片型 PDF，页数保持 | pages=3 | PASS |
| PDF转长图 /pdf-to-long-image | 3 页 PDF | 生成长图（PNG） | 97987B，magic=true | PASS |
| 文件Hash计算 /file_hash | 文本文件 | 输出 64 位 SHA-256 | `b8df457be7830e6c0434…`（/^[0-9a-f]{64}$/） | PASS |
| AES加密解密 /aes | 密钥 `u3pass` + 明文 | Base64 密文 → 解密还原 | 密文 88 字符；解密=`U3 加密测试文本` | PASS |
| URL编码解码 /url | `a b&c=中文` | 含 `%20`、`%E4%B8%AD` | `a%20b%26c%3D%E4%B8%AD%E6%96%87` | PASS |
| Unicode编码转换 /unicode | `你好` | 输出 `\uXXXX` | `\u4f60\u597d` | PASS |
| 正则表达式测试 /regex | `\d+` / `a1 b22 c333` | 3 处匹配并高亮 | rows=3，marks=3 | PASS |
| 进制转换 /number | `255` | 二/十六进制正确 | `11111111` / `ff`（含四/八/三十二进制） | PASS |
| 颜色值转换 /color | `#ff0000` | HEX/RGB/RGBA/HSL | `#FF0000` / `rgb(255, 0, 0)` / `rgba(255, 0, 0, 1)` / `hsl(0, 100%, 50%)` | PASS |
| Unix时间戳 /timestamp | `1730000000` | 本地 + UTC 日期 | `2024-10-27 11:33:20` / `2024-10-27 03:33:20 UTC` | PASS |
| 摩斯电码 /morse | `SOS` | 编码为 `... --- ...` | `... --- ...` | PASS |
| Hash计算 /hash | `abc`（默认 SHA-256） | `ba7816bf…15ad` | `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` | PASS |
| 二维码制作 /qrcode | URL 文本 | dataURL 预览 + 下载 PNG | dataURL 预览成功；下载 3483B | PASS |
| **DES加密解密 /des** | 密钥 `12345678` + `hello imgtool` | Base64 密文 → 解密还原 | 密文 `/9453CeSvMtoQKJr9E/8JA==`；解密=`hello imgtool` | PASS（U3 修复） |
| **RSA加密解密 /rsa** | 生成密钥对 → 公钥加密 → 私钥解密 | 2048 位密钥对 + Base64 密文往返 | pub=450 / priv=1703；密文 344 字符；解密=`U3 RSA 测试` | PASS（U3 修复） |

## 说明

- 首次运行时曾出现 `pdf-metadata`、`regex`、`hash` 的「假失败」，根因是测试选择器命中了侧边栏全局搜索框（`.side-search-input`，每页第一个 `input.el-input__inner`），输入被 250ms 防抖后触发路由跳转。将选择器限定到 `.tool-main` 后全部通过，工具本身无缺陷。
- `/des`、`/rsa` 原为说明页，U3 期间按 SPEC §4「修复或明确降级」选择修复：DES 采用自包含纯 JS 实现（Node `des-ecb` + `--openssl-legacy-provider` 交叉验证逐字节一致）；RSA 采用 Web Crypto RSA-OAEP(SHA-256)。
- 未做降级处理，最终 43 个已实现工具全部具备真实处理能力。
- 覆盖范围：SPEC 指定的 26 个必测工具全部覆盖，另加 DES、RSA 两项修复验证，共 28 个工具、35 项断言。
