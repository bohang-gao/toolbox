import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import { ALL_TOOLS } from '../data/tools.js'
import ToolPageView from '../views/ToolPageView.vue'
import { recordToolVisit, notifyRecentChange } from '../lib/recent.js'

// 已单独实现的占位工具（服务端/重型编辑器类）
const STUB_PATHS = ['/ocr', '/image-editor', '/pdf-editor', '/word2pdf', '/excel2pdf', '/ppt2pdf', '/pdf2word', '/websocket']

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
  '/imagesubtitle': () => import('../views/tools/imagesubtitle.vue'),
  '/idphoto': () => import('../views/tools/idphoto.vue'),
  '/textedit': () => import('../views/tools/textedit.vue')
}

// PDF 工具（T3）
const PDF_TOOL_COMPONENTS = {
  '/print': () => import('../views/tools/print.vue'),
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

// 坐标工具（与 lddgo 坐标分类对齐，纯前端实现）
const COORD_TOOL_COMPONENTS = {
  '/coord/map-convert': () => import('../views/tools/coord/map-convert.vue'),
  '/coord/position': () => import('../views/tools/coord/position.vue'),
  '/coord/degree-convert': () => import('../views/tools/coord/degree-convert.vue'),
  '/coord/distance': () => import('../views/tools/coord/distance.vue'),
  '/coord/geodetic-ecef': () => import('../views/tools/coord/geodetic-ecef.vue'),
  '/coord/helmert': () => import('../views/tools/coord/helmert.vue'),
  '/coord/projection': () => import('../views/tools/coord/projection.vue'),
  '/coord/axis-swap': () => import('../views/tools/coord/axis-swap.vue'),
  '/coord/ecef-enu': () => import('../views/tools/coord/ecef-enu.vue'),
  '/coord/molodensky-badekas': () => import('../views/tools/coord/molodensky-badekas.vue'),
  '/coord/molodensky': () => import('../views/tools/coord/molodensky.vue'),
  '/coord/polar-cartesian': () => import('../views/tools/coord/polar-cartesian.vue'),
  '/coord/coordinate-doc': () => import('../views/tools/coord/coordinate-doc.vue'),
  '/coord/unit-converter': () => import('../views/tools/coord/unit-converter.vue'),
  '/coord/geodetic-latitude': () => import('../views/tools/coord/geodetic-latitude.vue'),
  '/coord/itrf': () => import('../views/tools/coord/itrf.vue'),
  '/coord/param-solve': () => import('../views/tools/coord/param-solve.vue'),
  '/coord/wgs84-cgcs2000': () => import('../views/tools/coord/wgs84-cgcs2000.vue'),
  '/coord/base-station': () => import('../views/tools/coord/base-station.vue'),
  '/coord/ntrip-sourcetable': () => import('../views/tools/coord/ntrip-sourcetable.vue'),
  '/coord/nmea0183': () => import('../views/tools/coord/nmea0183.vue'),
  '/coord/geohash': () => import('../views/tools/coord/geohash.vue'),
  '/coord/rtcm3': () => import('../views/tools/coord/rtcm3.vue')
}
Object.assign(TOOL_COMPONENTS, COORD_TOOL_COMPONENTS)

const RF_TOOL_COMPONENTS = {
  '/rf/arfcn': () => import('../views/tools/rf/arfcn.vue'),
  '/rf/gscn': () => import('../views/tools/rf/gscn.vue'),
  '/rf/ssb-position': () => import('../views/tools/rf/ssb-position.vue'),
  '/rf/rate': () => import('../views/tools/rf/rate.vue')
}
Object.assign(TOOL_COMPONENTS, RF_TOOL_COMPONENTS)

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
  { path: '/c/coord', component: Home, meta: { cat: 'coord' } },
  { path: '/c/rf', component: Home, meta: { cat: 'rf' } },
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
