/**
 * 逆地理编码共享模块：WGS84 坐标 → 行政区划 / 地址
 *
 * 由编排者维护；各工具页面只允许调用，不得修改。
 *
 * 主用 OpenStreetMap Nominatim（粒度可到门牌），429 / 异常 / 超时自动回退
 * BigDataCloud。遵循 Nominatim ≤1 req/s 使用条款，模块内部统一节流。
 */

const GEO_TIMEOUT = 8000
// Nominatim 要求 ≤1 req/s，留余量
const GEO_MIN_GAP = 1200
let lastRequestAt = 0

// 直辖市没有 state 字段，用 ISO3166-2 省级码兜底
const CN_PROVINCE_BY_ISO = {
  'CN-BJ': '北京市',
  'CN-SH': '上海市',
  'CN-TJ': '天津市',
  'CN-CQ': '重庆市',
  'CN-HE': '河北省',
  'CN-SX': '山西省',
  'CN-LN': '辽宁省',
  'CN-JL': '吉林省',
  'CN-HL': '黑龙江省',
  'CN-JS': '江苏省',
  'CN-ZJ': '浙江省',
  'CN-AH': '安徽省',
  'CN-FJ': '福建省',
  'CN-JX': '江西省',
  'CN-SD': '山东省',
  'CN-HA': '河南省',
  'CN-HB': '湖北省',
  'CN-HN': '湖南省',
  'CN-GD': '广东省',
  'CN-GX': '广西壮族自治区',
  'CN-HI': '海南省',
  'CN-SC': '四川省',
  'CN-GZ': '贵州省',
  'CN-YN': '云南省',
  'CN-XZ': '西藏自治区',
  'CN-SN': '陕西省',
  'CN-GS': '甘肃省',
  'CN-QH': '青海省',
  'CN-NX': '宁夏回族自治区',
  'CN-XJ': '新疆维吾尔自治区',
  'CN-TW': '台湾省',
  'CN-HK': '香港特别行政区',
  'CN-MO': '澳门特别行政区'
}

// 上游多语言字段会拼成「法国;法國」，取首个
function firstName(v) {
  const s = String(v == null ? '' : v)
  return s.split(';')[0].trim()
}

// 按出现顺序去重（省市同名时只保留一个）
function uniqueJoin(parts) {
  const seen = []
  for (const p of parts) {
    const v = firstName(p)
    if (v && v !== '—' && !seen.includes(v)) seen.push(v)
  }
  return seen.join(' ')
}

async function throttle() {
  const wait = GEO_MIN_GAP - (Date.now() - lastRequestAt)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()
}

async function fetchJson(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), GEO_TIMEOUT)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (res.status === 429) throw new Error('请求过于频繁（429），请稍等几秒再试')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// OpenStreetMap Nominatim：粒度最细（可到门牌）
async function viaNominatim(lat, lon) {
  const url =
    'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=zh-CN' +
    `&lat=${lat}&lon=${lon}`
  const data = await fetchJson(url)
  if (!data || (!data.display_name && !data.address)) throw new Error('empty')
  const a = data.address || {}
  const segs = String(data.display_name || '')
    .split(',')
    .map((s) => s.trim())
  const NON_ADMIN = /(社区|园区|片区|小区|街区|景区|校区|矿区|灾区|城区|库区)$/
  const isDistrict = (s) =>
    s.length >= 2 &&
    s.length <= 4 &&
    /^[\u4e00-\u9fa5]+$/.test(s) &&
    /(区|县|旗)$/.test(s) &&
    !NON_ADMIN.test(s)

  let province = a.state || a.province || a.region || CN_PROVINCE_BY_ISO[a['ISO3166-2-lvl4']] || ''
  if (!province) province = segs.find((s) => /(省|自治区|特别行政区)$/.test(s)) || ''

  const cityOrCounty = [a.city, a.county, a.district, a.municipality].filter(Boolean)
  // 上游常缺市级（如广州只给越秀区），从 display_name 补，且排在区县之前
  if (!cityOrCounty.some((s) => /市$/.test(s))) {
    const c = segs.find(
      (s) => /^[\u4e00-\u9fa5]{2,4}市$/.test(s) && s !== province && !cityOrCounty.includes(s)
    )
    if (c) cityOrCounty.unshift(c)
  }
  // 上游偶尔缺区县（如上海只给市），从 display_name 补
  if (!cityOrCounty.some((s) => /(区|县|旗)$/.test(s))) {
    const d = segs.find((s) => isDistrict(s) && s !== province && !cityOrCounty.includes(s))
    if (d) cityOrCounty.push(d)
  }

  const rows = [
    { k: '国家 / 地区', v: firstName(a.country) || '—' },
    { k: '行政区划', v: uniqueJoin([province, ...cityOrCounty]) || '—' },
    { k: '街道 / 乡镇', v: firstName(a.suburb || a.town || a.township || a.village || a.city_district) || '—' },
    { k: '社区 / 片区', v: firstName(a.quarter || a.neighbourhood || a.residential) || '—' },
    { k: '道路', v: firstName(a.road || a.pedestrian || a.footway) || '—' },
    { k: '门牌 / 地物', v: firstName(a.house_number || a.landuse || a.building || a.tourism || data.name) || '—' },
    { k: '邮编', v: a.postcode || '—' },
    { k: '地物类别', v: [data.category, data.type].filter(Boolean).join(' / ') || '—' }
  ]
  const display = String(data.display_name || '')
    .split(',')
    .map((s) => firstName(s))
    .filter(Boolean)
    .join('，')
  const region = uniqueJoin([province, ...cityOrCounty])
  return { source: 'OpenStreetMap Nominatim', rows, display, name: firstName(data.name), region }
}

// BigDataCloud：行政区划规整，作为回退
async function viaBigDataCloud(lat, lon) {
  const url =
    'https://api.bigdatacloud.net/data/reverse-geocode-client' +
    `?latitude=${lat}&longitude=${lon}&localityLanguage=zh`
  const data = await fetchJson(url)
  if (!data || (!data.countryName && !data.city && !data.locality)) throw new Error('empty')
  const admin = (data.localityInfo && data.localityInfo.administrative) || []
  const pick = (lvl) => {
    const hit = admin.find((x) => Number(x.adminLevel) === lvl)
    return hit ? hit.name : ''
  }
  const rows = [
    { k: '国家 / 地区', v: firstName(data.countryName) || firstName(pick(2)) || '—' },
    { k: '行政区划', v: uniqueJoin([data.principalSubdivision || pick(4), data.city, data.locality]) || '—' },
    { k: '街道 / 乡镇', v: firstName(pick(8)) || '—' },
    { k: '社区 / 片区', v: firstName(pick(10)) || '—' },
    { k: '道路', v: '—' },
    { k: '门牌 / 地物', v: '—' },
    { k: '邮编', v: data.postcode || '—' },
    { k: '地物类别', v: '—' }
  ]
  const display = uniqueJoin([data.countryName, data.principalSubdivision, data.city, data.locality])
  const region = uniqueJoin([data.principalSubdivision || pick(4), data.city, data.locality])
  return { source: 'BigDataCloud', rows, display, name: data.locality || '', region }
}

/**
 * 反查坐标对应地址。
 * @param {number} lat 纬度（WGS84）
 * @param {number} lon 经度（WGS84）
 * @returns {Promise<{source:string, rows:Array<{k:string,v:string}>, display:string,
 *   name:string, region:string, links:{osm:string}}>}
 * @throws 服务不可用 / 无地址时抛错，error.message === 'empty' 表示该点无收录地址
 */
export async function reverseGeocode(lat, lon) {
  const errors = []
  let noAddress = false
  for (const provider of [viaNominatim, viaBigDataCloud]) {
    await throttle()
    try {
      const info = await provider(lat, lon)
      return {
        ...info,
        links: { osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}` }
      }
    } catch (e) {
      if (e && e.message === 'empty') noAddress = true
      errors.push(
        `${provider.name}: ${e && e.name === 'AbortError' ? '超时' : String(e && e.message ? e.message : e)}`
      )
    }
  }
  if (noAddress && errors.every((s) => s.includes('empty'))) {
    const err = new Error('该坐标不在已收录的行政区内（多为海域、无人区或极地），查不到地址。')
    err.kind = 'no-address'
    throw err
  }
  const err = new Error(`逆地理编码服务暂不可用（${errors.join('；')}），可稍后重试。`)
  err.kind = 'unavailable'
  throw err
}

/** 把结果序列化为可复制文本 */
export function geocodeText(info, lat, lon) {
  return [
    `${info.source} 逆地理编码结果`,
    `坐标（WGS84）：${Number(lon).toFixed(6)}, ${Number(lat).toFixed(6)}`,
    ...info.rows.filter((r) => r.v && r.v !== '—').map((r) => `${r.k}：${r.v}`),
    `地址：${info.display}`
  ].join('\n')
}
