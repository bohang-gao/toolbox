import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import { ALL_TOOLS } from '../data/tools.js'
import ToolPageView from '../views/ToolPageView.vue'
import { recordToolVisit, notifyRecentChange } from '../lib/recent.js'

// 已单独实现的占位工具（服务端/重型编辑器类）
const STUB_PATHS = ['/idphoto', '/ocr', '/image-editor', '/pdf-editor', '/word2pdf', '/excel2pdf', '/ppt2pdf', '/pdf2word', '/websocket']

// 已实现的图片处理工具（懒加载）
const TOOL_COMPONENTS = {
  '/imagecompress': () => import('../views/tools/imagecompress.vue'),
  '/imageresize': () => import('../views/tools/imageresize.vue'),
  '/imagerotate': () => import('../views/tools/imagerotate.vue'),
  '/image2jpg': () => import('../views/tools/image2jpg.vue'),
  '/image2png': () => import('../views/tools/image2png.vue'),
  '/image2webp': () => import('../views/tools/image2webp.vue'),
  '/image2base64': () => import('../views/tools/image2base64.vue'),
  '/imagecombine': () => import('../views/tools/imagecombine.vue'),
  '/imagesplit': () => import('../views/tools/imagesplit.vue'),
  '/image2pdf': () => import('../views/tools/image2pdf.vue'),
  '/qrcode': () => import('../views/tools/qrcode.vue'),
  '/image-grid': () => import('../views/tools/image-grid.vue'),
  '/image-watermark': () => import('../views/tools/image-watermark.vue'),
  '/imagesubtitle': () => import('../views/tools/imagesubtitle.vue')
}

// PDF 工具（T3）
const PDF_TOOL_COMPONENTS = {
  '/pdfmerge': () => import('../views/tools/pdfmerge.vue'),
  '/pdfsplit': () => import('../views/tools/pdfsplit.vue'),
  '/pdfextract': () => import('../views/tools/pdfextract.vue'),
  '/pdfdelete': () => import('../views/tools/pdfdelete.vue'),
  '/pdf2image': () => import('../views/tools/pdf2image.vue'),
  '/pdf-to-long-image': () => import('../views/tools/pdf-to-long-image.vue'),
  '/pdfrotate': () => import('../views/tools/pdfrotate.vue'),
  '/pdfsort': () => import('../views/tools/pdfsort.vue'),
  '/pdfcompress': () => import('../views/tools/pdfcompress.vue'),
  '/pdf-page-number': () => import('../views/tools/pdf-page-number.vue'),
  '/pdf-watermark': () => import('../views/tools/pdf-watermark.vue'),
  '/pdf-metadata': () => import('../views/tools/pdf-metadata.vue'),
  '/pdf-resize': () => import('../views/tools/pdf-resize.vue'),
  '/pdf-extract-image': () => import('../views/tools/pdf-extract-image.vue'),
  '/pdf-remove-watermark': () => import('../views/tools/pdf-remove-watermark.vue')
}
Object.assign(TOOL_COMPONENTS, PDF_TOOL_COMPONENTS)

// 文本/编码工具（T4）
const TEXT_TOOL_COMPONENTS = {
  '/timestamp': () => import('../views/tools/timestamp.vue'),
  '/color': () => import('../views/tools/color.vue'),
  '/base64': () => import('../views/tools/base64.vue'),
  '/url': () => import('../views/tools/url.vue'),
  '/unicode': () => import('../views/tools/unicode.vue'),
  '/number': () => import('../views/tools/number.vue'),
  '/regex': () => import('../views/tools/regex.vue'),
  '/hash': () => import('../views/tools/hash.vue'),
  '/file_hash': () => import('../views/tools/file_hash.vue'),
  '/morse': () => import('../views/tools/morse.vue'),
  '/aes': () => import('../views/tools/aes.vue'),
  '/des': () => import('../views/tools/des.vue'),
  '/rsa': () => import('../views/tools/rsa.vue')
}
Object.assign(TOOL_COMPONENTS, TEXT_TOOL_COMPONENTS)

// 其余工具全部走通用 ToolPageView（各工具面板由后续任务按 SPEC §5 实现）
const toolRoutes = ALL_TOOLS
  .filter(t => !STUB_PATHS.includes(t.path))
  .map(t => ({
    path: t.path,
    component: TOOL_COMPONENTS[t.path] || ToolPageView,
    meta: { title: t.name, tool: t }
  }))

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/c/recent', component: Home, meta: { cat: 'recent' } },
  { path: '/c/img', component: Home, meta: { cat: 'img' } },
  { path: '/c/pdf', component: Home, meta: { cat: 'pdf' } },
  { path: '/c/text', component: Home, meta: { cat: 'text' } },
  ...STUB_PATHS.map(p => {
    const t = ALL_TOOLS.find(x => x.path === p)
    return { path: p, component: () => import('../views/Stub.vue'), meta: { title: t ? t.name : '工具', tool: t } }
  }),
  ...toolRoutes,
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 工具页访问记录（含占位工具页）：凡 meta.tool 存在即记录
router.afterEach((to) => {
  if (to.meta && to.meta.tool) recordToolVisit(to.path)
  else notifyRecentChange()
})

export default router
