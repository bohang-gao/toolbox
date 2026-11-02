T3（PDF工具组）Claude Code 实施时生成的自验产物：
- _t3_gen.cjs 生成测试 PDF（A=3页/B=2页/C=含图片）
- _t3_logictest.cjs / _t3_render_test.cjs / _t3_check.cjs 逻辑与渲染断言
- _out_*.pdf 各工具（合并/拆分/提取/删除/旋转/排序/页码/水印/压缩/元数据/resize）的输出样本
编排方浏览器 E2E 另行验证了 pdfmerge(5页)/pdfdelete(2页)/pdfsplit(2页)/pdf-page-number/pdf-watermark/pdf2image(3 PNG)。
