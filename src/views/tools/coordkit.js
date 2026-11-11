// 坐标工具集共享算法库（纯函数，无外部依赖）
// 由编排者维护；各工具页面只允许 import 调用，不得修改本文件。
// 参考口径：WGS84 / CGCS2000 椭球参数取自 IERS & GB/T，公式见注释。

export const PI = Math.PI
export const toRad = (d) => (d * PI) / 180
export const toDeg = (r) => (r * 180) / PI

// ============ 椭球 ============
export const ELLIPSOIDS = {
  WGS84: { name: 'WGS84', a: 6378137.0, invF: 298.257223563, b: 6356752.314245 },
  CGCS2000: { name: 'CGCS2000', a: 6378137.0, invF: 298.257222101, b: 6356752.31414 },
  KRASSOVSKY: { name: '克拉索夫斯基(北京54)', a: 6378245.0, invF: 298.3, b: 6356863.018773 },
  IAG75: { name: 'IAG75(西安80)', a: 6378140.0, invF: 298.257, b: 6356755.288158 },
  GRS80: { name: 'GRS80', a: 6378137.0, invF: 298.257222101, b: 6356752.31414 },
  SPHERE: { name: '球体 R=6371000', a: 6371000.0, invF: Infinity, b: 6371000.0 }
}

export function ellipsoidParams(keyOrObj) {
  const e = typeof keyOrObj === 'string' ? ELLIPSOIDS[keyOrObj] || ELLIPSOIDS.WGS84 : keyOrObj || ELLIPSOIDS.WGS84
  const a = e.a
  const b = e.b || a * (1 - 1 / e.invF)
  const f = e.invF === Infinity ? 0 : 1 / e.invF
  const e2 = 1 - (b * b) / (a * a) // 第一偏心率平方
  const ep2 = (a * a - b * b) / (b * b) // 第二偏心率平方
  return { a, b, f, e2, ep2 }
}

// ============ 大地坐标 <-> 空间直角(ECEF) ============
// 输入 lat/lon 为度，h 为米；输出 x/y/z 米
export function geodeticToEcef(lat, lon, h = 0, ell = 'WGS84') {
  const { a, e2 } = ellipsoidParams(ell)
  const φ = toRad(lat)
  const λ = toRad(lon)
  const sφ = Math.sin(φ)
  const cφ = Math.cos(φ)
  const N = a / Math.sqrt(1 - e2 * sφ * sφ)
  return {
    x: (N + h) * cφ * Math.cos(λ),
    y: (N + h) * cφ * Math.sin(λ),
    z: (N * (1 - e2) + h) * sφ
  }
}

// ECEF -> 大地坐标（Bowring 迭代，收敛到 1e-12 度）
export function ecefToGeodetic(x, y, z, ell = 'WGS84') {
  const { a, b, e2, ep2 } = ellipsoidParams(ell)
  const p = Math.hypot(x, y)
  if (p < 1e-12) {
    // 极点
    const lat = z >= 0 ? 90 : -90
    return { lat, lon: 0, h: Math.abs(z) - b }
  }
  const lon = toDeg(Math.atan2(y, x))
  let φ = Math.atan2(z, p * (1 - e2))
  let N = a / Math.sqrt(1 - e2 * Math.sin(φ) * Math.sin(φ))
  let h = 0
  for (let i = 0; i < 30; i++) {
    const sφ = Math.sin(φ)
    N = a / Math.sqrt(1 - e2 * sφ * sφ)
    h = p / Math.cos(φ) - N
    const next = Math.atan2(z, p * (1 - (e2 * N) / (N + h)))
    if (Math.abs(next - φ) < 1e-14) {
      φ = next
      break
    }
    φ = next
  }
  const sφ = Math.sin(φ)
  N = a / Math.sqrt(1 - e2 * sφ * sφ)
  h = p / Math.cos(φ) - N
  return { lat: toDeg(φ), lon, h }
}

// ============ ECEF <-> ENU（站心） ============
// origin: {lat, lon, h}（度/度/米）
export function ecefToEnu(x, y, z, originLat, originLon, originH = 0, ell = 'WGS84') {
  const o = geodeticToEcef(originLat, originLon, originH, ell)
  const dx = x - o.x
  const dy = y - o.y
  const dz = z - o.z
  const φ = toRad(originLat)
  const λ = toRad(originLon)
  const sφ = Math.sin(φ), cφ = Math.cos(φ)
  const sλ = Math.sin(λ), cλ = Math.cos(λ)
  return {
    e: -sλ * dx + cλ * dy,
    n: -sφ * cλ * dx - sφ * sλ * dy + cφ * dz,
    u: cφ * cλ * dx + cφ * sλ * dy + sφ * dz
  }
}

export function enuToEcef(e, n, u, originLat, originLon, originH = 0, ell = 'WGS84') {
  const o = geodeticToEcef(originLat, originLon, originH, ell)
  const φ = toRad(originLat)
  const λ = toRad(originLon)
  const sφ = Math.sin(φ), cφ = Math.cos(φ)
  const sλ = Math.sin(λ), cλ = Math.cos(λ)
  const dx = -sλ * e - sφ * cλ * n + cφ * cλ * u
  const dy = cλ * e - sφ * sλ * n + cφ * sλ * u
  const dz = cφ * n + sφ * u
  return { x: o.x + dx, y: o.y + dy, z: o.z + dz }
}

// ENU -> 方位角/俯仰角/斜距（度/度/米）
export function enuToAzElRange(e, n, u) {
  const r = Math.hypot(e, n, u)
  let az = toDeg(Math.atan2(e, n))
  if (az < 0) az += 360
  const el = r === 0 ? 0 : toDeg(Math.asin(u / r))
  return { az, el, range: r }
}

export function azElRangeToEnu(az, el, range) {
  const a = toRad(az)
  const e = toRad(el)
  return {
    e: range * Math.cos(e) * Math.sin(a),
    n: range * Math.cos(e) * Math.cos(a),
    u: range * Math.sin(e)
  }
}

// ============ 大地纬度 <-> 地心纬度 ============
export function geodeticToGeocentricLat(lat, ell = 'WGS84') {
  const { e2 } = ellipsoidParams(ell)
  const φ = toRad(lat)
  return toDeg(Math.atan((1 - e2) * Math.tan(φ)))
}

export function geocentricToGeodeticLat(latG, ell = 'WGS84') {
  const { e2 } = ellipsoidParams(ell)
  const φ = toRad(latG)
  return toDeg(Math.atan(Math.tan(φ) / (1 - e2)))
}

// ============ 角度 度/度分秒 ============
export function ddToDms(dd, secDigits = 2) {
  const sign = dd < 0 ? -1 : 1
  const v = Math.abs(dd)
  let d = Math.floor(v)
  let m = Math.floor((v - d) * 60)
  let s = (v - d - m / 60) * 3600
  const p = Math.pow(10, secDigits)
  s = Math.round(s * p) / p
  if (s >= 60) { s -= 60; m += 1 }
  if (m >= 60) { m -= 60; d += 1 }
  return { sign, d, m, s, text: `${sign < 0 ? '-' : ''}${d}°${m}′${s.toFixed(secDigits)}″` }
}

export function dmsToDd(d, m = 0, s = 0, sign = 1) {
  const v = Math.abs(d) + Math.abs(m) / 60 + Math.abs(s) / 3600
  return sign < 0 ? -v : v
}

// 宽松解析："116°24'26.64\"" / "116 24 26.64" / "116.4074" / "116°24.444'" / "N39°54'15\""
export function parseDms(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  let sign = 1
  let s = raw
  if (/^[NnSsEeWw]/.test(s)) {
    const h = s[0].toUpperCase()
    if (h === 'S' || h === 'W') sign = -1
    s = s.slice(1)
  }
  if (/[NnSsEeWw]$/.test(s)) {
    const h = s[s.length - 1].toUpperCase()
    if (h === 'S' || h === 'W') sign = -1
    s = s.slice(0, -1)
  }
  if (s.trim().startsWith('-')) { sign = -sign; s = s.trim().slice(1) }
  const nums = s.match(/-?\d+(\.\d+)?/g)
  if (!nums || !nums.length) return null
  const [a, b, c] = nums.map(Number)
  return dmsToDd(a || 0, b || 0, c || 0, sign)
}

// ============ 距离 ============
export function haversine(lat1, lon1, lat2, lon2, R = 6371008.8) {
  const φ1 = toRad(lat1), φ2 = toRad(lat2)
  const dφ = φ2 - φ1
  const dλ = toRad(lon2 - lon1)
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

// Vincenty 反算（椭球，mm 级）
export function vincentyInverse(lat1, lon1, lat2, lon2, ell = 'WGS84') {
  const { a, b, f } = ellipsoidParams(ell)
  const L = toRad(lon2 - lon1)
  const U1 = Math.atan((1 - f) * Math.tan(toRad(lat1)))
  const U2 = Math.atan((1 - f) * Math.tan(toRad(lat2)))
  const sU1 = Math.sin(U1), cU1 = Math.cos(U1)
  const sU2 = Math.sin(U2), cU2 = Math.cos(U2)
  let λ = L, λp, iter = 0
  let sσ, cσ, σ, sα, c2α, c2σm
  do {
    const sλ = Math.sin(λ), cλ = Math.cos(λ)
    const t1 = cU2 * sλ
    const t2 = cU1 * sU2 - sU1 * cU2 * cλ
    sσ = Math.hypot(t1, t2)
    if (sσ === 0) return { distance: 0, initialBearing: 0, finalBearing: 0 }
    cσ = sU1 * sU2 + cU1 * cU2 * cλ
    σ = Math.atan2(sσ, cσ)
    sα = (cU1 * cU2 * sλ) / sσ
    c2α = 1 - sα * sα
    c2σm = c2α === 0 ? 0 : cσ - (2 * sU1 * sU2) / c2α
    const C = (f / 16) * c2α * (4 + f * (4 - 3 * c2α))
    λp = λ
    λ = L + (1 - C) * f * sα * (σ + C * sσ * (c2σm + C * cσ * (-1 + 2 * c2σm * c2σm)))
    iter++
  } while (Math.abs(λ - λp) > 1e-12 && iter < 200)

  const u2 = (c2α * (a * a - b * b)) / (b * b)
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
  const dσ = B * sσ * (c2σm + (B / 4) * (cσ * (-1 + 2 * c2σm * c2σm) - (B / 6) * c2σm * (-3 + 4 * sσ * sσ) * (-3 + 4 * c2σm * c2σm)))
  const s = b * A * (σ - dσ)
  const az1 = toDeg(Math.atan2(cU2 * Math.sin(λ), cU1 * sU2 - sU1 * cU2 * Math.cos(λ)))
  const az2 = toDeg(Math.atan2(cU1 * Math.sin(λ), -sU1 * cU2 + cU1 * sU2 * Math.cos(λ)))
  return {
    distance: s,
    initialBearing: (az1 + 360) % 360,
    finalBearing: (az2 + 360) % 360
  }
}

// Vincenty 正算：已知起点 + 方位角 + 距离，求终点
export function vincentyDirect(lat1, lon1, bearing, distance, ell = 'WGS84') {
  const { a, b, f } = ellipsoidParams(ell)
  const α1 = toRad(bearing)
  const sα1 = Math.sin(α1), cα1 = Math.cos(α1)
  const tanU1 = (1 - f) * Math.tan(toRad(lat1))
  const cU1 = 1 / Math.sqrt(1 + tanU1 * tanU1)
  const sU1 = tanU1 * cU1
  const σ1 = Math.atan2(tanU1, cα1)
  const sα = cU1 * sα1
  const c2α = 1 - sα * sα
  const u2 = (c2α * (a * a - b * b)) / (b * b)
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
  let σ = distance / (b * A)
  let σp, c2σm, sσ, cσ
  for (let i = 0; i < 200; i++) {
    c2σm = Math.cos(2 * σ1 + σ)
    sσ = Math.sin(σ); cσ = Math.cos(σ)
    const dσ = B * sσ * (c2σm + (B / 4) * (cσ * (-1 + 2 * c2σm * c2σm) - (B / 6) * c2σm * (-3 + 4 * sσ * sσ) * (-3 + 4 * c2σm * c2σm)))
    σp = σ
    σ = distance / (b * A) + dσ
    if (Math.abs(σ - σp) < 1e-12) break
  }
  const tmp = sU1 * sσ - cU1 * cσ * cα1
  const lat2 = Math.atan2(sU1 * cσ + cU1 * sσ * cα1, (1 - f) * Math.hypot(sα, tmp))
  const λ = Math.atan2(sσ * sα1, cU1 * cσ - sU1 * sσ * cα1)
  const C = (f / 16) * c2α * (4 + f * (4 - 3 * c2α))
  const L = λ - (1 - C) * f * sα * (σ + C * sσ * (c2σm + C * cσ * (-1 + 2 * c2σm * c2σm)))
  const lon2 = toDeg(toRad(lon1) + L)
  const az2 = toDeg(Math.atan2(sα, -tmp))
  return { lat: toDeg(lat2), lon: lon2, finalBearing: (az2 + 360) % 360 }
}

// ============ 中国坐标系互转（GCJ02 / BD09 / WGS84） ============
const GCJ_A = 6378245.0
const GCJ_EE = 0.00669342162296594323
const X_PI = (PI * 3000) / 180

function outOfChina(lat, lon) {
  return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformLat(x, y) {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  r += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3
  r += ((20 * Math.sin(y * PI) + 40 * Math.sin((y / 3) * PI)) * 2) / 3
  r += ((160 * Math.sin((y / 12) * PI) + 320 * Math.sin((y * PI) / 30)) * 2) / 3
  return r
}

function transformLon(x, y) {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  r += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3
  r += ((20 * Math.sin(x * PI) + 40 * Math.sin((x / 3) * PI)) * 2) / 3
  r += ((150 * Math.sin((x / 12) * PI) + 300 * Math.sin((x / 30) * PI)) * 2) / 3
  return r
}

export function wgs84ToGcj02(lat, lon) {
  if (outOfChina(lat, lon)) return { lat, lon }
  let dLat = transformLat(lon - 105, lat - 35)
  let dLon = transformLon(lon - 105, lat - 35)
  const radLat = toRad(lat)
  let magic = Math.sin(radLat)
  magic = 1 - GCJ_EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * PI)
  dLon = (dLon * 180) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * PI)
  return { lat: lat + dLat, lon: lon + dLon }
}

export function gcj02ToWgs84(lat, lon) {
  if (outOfChina(lat, lon)) return { lat, lon }
  // 迭代反解，精度 1e-9 度
  let wLat = lat, wLon = lon
  for (let i = 0; i < 30; i++) {
    const g = wgs84ToGcj02(wLat, wLon)
    const dLat = g.lat - lat
    const dLon = g.lon - lon
    if (Math.abs(dLat) < 1e-11 && Math.abs(dLon) < 1e-11) break
    wLat -= dLat
    wLon -= dLon
  }
  return { lat: wLat, lon: wLon }
}

export function gcj02ToBd09(lat, lon) {
  const z = Math.sqrt(lon * lon + lat * lat) + 0.00002 * Math.sin(lat * X_PI)
  const θ = Math.atan2(lat, lon) + 0.000003 * Math.cos(lon * X_PI)
  return { lat: z * Math.sin(θ) + 0.006, lon: z * Math.cos(θ) + 0.0065 }
}

export function bd09ToGcj02(lat, lon) {
  const x = lon - 0.0065
  const y = lat - 0.006
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI)
  const θ = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI)
  return { lat: z * Math.sin(θ), lon: z * Math.cos(θ) }
}

export function wgs84ToBd09(lat, lon) {
  const g = wgs84ToGcj02(lat, lon)
  return gcj02ToBd09(g.lat, g.lon)
}

export function bd09ToWgs84(lat, lon) {
  const g = bd09ToGcj02(lat, lon)
  return gcj02ToWgs84(g.lat, g.lon)
}

// 通用分发：from/to ∈ {WGS84, GCJ02, BD09}
export function convertChinaDatum(lat, lon, from, to) {
  if (from === to) return { lat, lon }
  const toGcj = (la, lo) => (from === 'WGS84' ? wgs84ToGcj02(la, lo) : from === 'BD09' ? bd09ToGcj02(la, lo) : { lat: la, lon: lo })
  const fromGcj = (la, lo) => (to === 'WGS84' ? gcj02ToWgs84(la, lo) : to === 'BD09' ? gcj02ToBd09(la, lo) : { lat: la, lon: lo })
  const g = toGcj(lat, lon)
  return fromGcj(g.lat, g.lon)
}

// ============ 七参数（Helmert / Bursa-Wolf） ============
// params: {dx,dy,dz (米), rx,ry,rz (角秒), s (ppm)}
export function helmertForward(x, y, z, p) {
  const rx = (p.rx || 0) * (PI / 180 / 3600)
  const ry = (p.ry || 0) * (PI / 180 / 3600)
  const rz = (p.rz || 0) * (PI / 180 / 3600)
  const k = 1 + (p.s || 0) * 1e-6
  // 小角度近似（Bursa-Wolf）
  return {
    x: (p.dx || 0) + k * (x + rz * y - ry * z),
    y: (p.dy || 0) + k * (-rz * x + y + rx * z),
    z: (p.dz || 0) + k * (ry * x - rx * y + z)
  }
}

// 严格旋转矩阵版（大角度也成立，s 为 ppm）
export function helmertForwardExact(x, y, z, p) {
  const rx = (p.rx || 0) * (PI / 180 / 3600)
  const ry = (p.ry || 0) * (PI / 180 / 3600)
  const rz = (p.rz || 0) * (PI / 180 / 3600)
  const k = 1 + (p.s || 0) * 1e-6
  const cx = Math.cos(rx), sx = Math.sin(rx)
  const cy = Math.cos(ry), sy = Math.sin(ry)
  const cz = Math.cos(rz), sz = Math.sin(rz)
  // R = Rz * Ry * Rx
  const r11 = cz * cy
  const r12 = cz * sy * sx - sz * cx
  const r13 = cz * sy * cx + sz * sx
  const r21 = sz * cy
  const r22 = sz * sy * sx + cz * cx
  const r23 = sz * sy * cx - cz * sx
  const r31 = -sy
  const r32 = cy * sx
  const r33 = cy * cx
  return {
    x: (p.dx || 0) + k * (r11 * x + r12 * y + r13 * z),
    y: (p.dy || 0) + k * (r21 * x + r22 * y + r23 * z),
    z: (p.dz || 0) + k * (r31 * x + r32 * y + r33 * z)
  }
}

// 反算：迭代求解
export function helmertInverse(x2, y2, z2, p) {
  let x = x2, y = y2, z = z2
  for (let i = 0; i < 20; i++) {
    const f = helmertForward(x, y, z, p)
    const ex = f.x - x2, ey = f.y - y2, ez = f.z - z2
    x -= ex; y -= ey; z -= ez
    if (Math.abs(ex) < 1e-9 && Math.abs(ey) < 1e-9 && Math.abs(ez) < 1e-9) break
  }
  return { x, y, z }
}

// 由 3 组以上公共点最小二乘求七参数
// src/dst: [{x,y,z}, ...] (ECEF, 米)
export function solveHelmert(src, dst) {
  const n = Math.min(src.length, dst.length)
  if (n < 3) throw new Error('至少需要 3 组公共点')
  // 重心化，消除平移耦合
  const c = (arr) => ({
    x: arr.reduce((s, p) => s + p.x, 0) / arr.length,
    y: arr.reduce((s, p) => s + p.y, 0) / arr.length,
    z: arr.reduce((s, p) => s + p.z, 0) / arr.length
  })
  const cs = c(src.slice(0, n))
  const cd = c(dst.slice(0, n))
  // 未知量：rx, ry, rz（角秒→弧度后按线性化）, s(ppm)  共 4 个，每点 3 方程
  // 线性化：d = X_s * [rx ry rz s]^T
  const rows = []
  const rhs = []
  for (let i = 0; i < n; i++) {
    const sx = src[i].x - cs.x, sy = src[i].y - cs.y, sz = src[i].z - cs.z
    const dx = dst[i].x - cd.x - sx
    const dy = dst[i].y - cd.y - sy
    const dz = dst[i].z - cd.z - sz
    // x' = x + rz*y - ry*z + s*x  →  d x = rz*sy - ry*sz + s*sx
    rows.push([0, -sz, sy, sx]); rhs.push(dx)
    rows.push([sz, 0, -sx, sy]); rhs.push(dy)
    rows.push([-sy, sx, 0, sz]); rhs.push(dz)
  }
  const sol = leastSquares(rows, rhs)
  const arcsec = PI / 180 / 3600
  const rx = sol[0] / arcsec
  const ry = sol[1] / arcsec
  const rz = sol[2] / arcsec
  const s = sol[3] * 1e6
  // 平移量必须回代：dst 重心 = T + k*R*src 重心  →  T = cd - k*R*cs
  // （重心化只消除了线性化里 T 的耦合，不能直接把 cd-cs 当 T，否则会漏掉
  //   k*R*cs 项；cs 量级 1e6 m，几个角秒就是十几米的误差）
  const rotated = helmertForward(cs.x, cs.y, cs.z, { dx: 0, dy: 0, dz: 0, rx, ry, rz, s })
  return {
    dx: cd.x - rotated.x,
    dy: cd.y - rotated.y,
    dz: cd.z - rotated.z,
    rx,
    ry,
    rz,
    s
  }
}

// 最小二乘（正规方程 + 高斯消元）
export function leastSquares(rows, rhs) {
  const m = rows.length
  const n = rows[0].length
  const A = Array.from({ length: n }, () => new Array(n).fill(0))
  const b = new Array(n).fill(0)
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      b[j] += rows[i][j] * rhs[i]
      for (let k = 0; k < n; k++) A[j][k] += rows[i][j] * rows[i][k]
    }
  }
  return gaussSolve(A, b)
}

export function gaussSolve(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    if (Math.abs(M[piv][col]) < 1e-14) throw new Error('矩阵奇异，无法求解')
    ;[M[col], M[piv]] = [M[piv], M[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col] / M[col][col]
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

// ============ 莫洛登斯基（Molodensky）三参数/七参数 ============
// 直接在大地坐标上做差：输入输出 lat/lon(度) h(米)
export function molodenskyForward(lat, lon, h, p, srcEll = 'WGS84', dstEll = 'CGCS2000') {
  const s = ellipsoidParams(srcEll)
  const t = ellipsoidParams(dstEll)
  const φ = toRad(lat), λ = toRad(lon)
  const sφ = Math.sin(φ), cφ = Math.cos(φ)
  const sλ = Math.sin(λ), cλ = Math.cos(λ)
  const N = s.a / Math.sqrt(1 - s.e2 * sφ * sφ)
  const M = (s.a * (1 - s.e2)) / Math.pow(1 - s.e2 * sφ * sφ, 1.5)
  const dx = p.dx || 0, dy = p.dy || 0, dz = p.dz || 0
  const da = t.a - s.a
  const df = t.f - s.f
  const dφ = (-dx * sφ * cλ - dy * sφ * sλ + dz * cφ + (da * (N * s.e2 * sφ * cφ)) / s.a + df * (M / (1 - s.f) + N * (1 - s.f)) * sφ * cφ) / (M + h)
  const dλ = (-dx * sλ + dy * cλ) / ((N + h) * cφ)
  const dh = dx * cφ * cλ + dy * cφ * sλ + dz * sφ - da * (s.a / N) + df * (1 - s.f) * N * sφ * sφ
  return {
    lat: toDeg(φ + dφ),
    lon: toDeg(λ + dλ),
    h: h + dh,
    dLat: toDeg(dφ),
    dLon: toDeg(dλ),
    dH: dh
  }
}

// 莫洛登斯基-巴德卡斯：七参数 + 3 个旋转中心点
export function molodenskyBadekasForward(lat, lon, h, p, srcEll = 'WGS84', dstEll = 'CGCS2000') {
  const ecef = geodeticToEcef(lat, lon, h, srcEll)
  const xp = ecef.x - (p.x0 || 0)
  const yp = ecef.y - (p.y0 || 0)
  const zp = ecef.z - (p.z0 || 0)
  const r = helmertForward(xp, yp, zp, p)
  const out = { x: r.x + (p.x0 || 0), y: r.y + (p.y0 || 0), z: r.z + (p.z0 || 0) }
  const g = ecefToGeodetic(out.x, out.y, out.z, dstEll)
  return { ...g, x: out.x, y: out.y, z: out.z }
}

// ============ 极坐标 / 直角坐标 ============
// 二维：x 东、y 北；返回半径 r 与方位角 θ(度，从北顺时针)
export function cartesianToPolar(x, y) {
  const r = Math.hypot(x, y)
  let θ = toDeg(Math.atan2(x, y))
  if (θ < 0) θ += 360
  return { r, theta: θ }
}

export function polarToCartesian(r, theta) {
  const t = toRad(theta)
  return { x: r * Math.sin(t), y: r * Math.cos(t) }
}

// 三维球坐标：r, 方位角(从北顺时针), 天顶距
export function cartesian3dToSpherical(x, y, z) {
  const r = Math.hypot(x, y, z)
  let az = toDeg(Math.atan2(x, y))
  if (az < 0) az += 360
  const zen = r === 0 ? 0 : toDeg(Math.acos(z / r))
  return { r, az, zen, el: 90 - zen }
}

// ============ 坐标轴交换 / 单位换算 ============
export function swapAxes(v, order) {
  // order: 'XYZ' 之类的 3 字符排列，如 'XZY' 表示输出 = (x, z, y)
  const map = { X: v[0], Y: v[1], Z: v[2] }
  const o = String(order || 'XYZ').toUpperCase()
  const pick = (ch, i) => (map[ch] !== undefined ? map[ch] : v[i])
  return [pick(o[0], 0), pick(o[1], 1), pick(o[2], 2)]
}

// 角度单位表：与 LENGTH_UNITS 同一约定 —— 值为「1 个该单位 = 多少基准单位」，基准 = 度。
// 换算公式 convertUnit(v, from, to) = v * table[from] / table[to]，方向必须一致，
// 否则「度→角秒」会算成 1/3600 而不是 3600。
export const ANGLE_UNITS = {
  度: 1,
  弧度: 180 / PI,
  角分: 1 / 60,
  角秒: 1 / 3600,
  密位: 360 / 6400, // 6400 制（360° = 6400 mil）
  gon: 9 / 10 // 1 gon = 0.9°
}

export const LENGTH_UNITS = {
  米: 1,
  千米: 1000,
  分米: 0.1,
  厘米: 0.01,
  毫米: 0.001,
  微米: 1e-6,
  海里: 1852,
  英尺: 0.3048,
  英寸: 0.0254,
  码: 0.9144,
  英里: 1609.344,
  市里: 500,
  市尺: 1 / 3
}

export function convertUnit(value, from, to, table) {
  const f = table[from]
  const t = table[to]
  if (f === undefined || t === undefined) throw new Error('未知单位')
  return (value * f) / t
}

// ============ 投影 ============
// 横轴墨卡托（Gauss-Krüger / TM），支持自定义中央经线与比例因子
export function tmForward(lat, lon, opts = {}) {
  const ell = opts.ellipsoid || 'WGS84'
  const { a, e2, ep2 } = ellipsoidParams(ell)
  const k0 = opts.k0 === undefined ? 1 : opts.k0
  const lon0 = opts.lon0 === undefined ? 0 : opts.lon0
  const fe = opts.fe || 0
  const fn = opts.fn || 0
  const φ = toRad(lat)
  const dλ = toRad(lon - lon0)
  const sφ = Math.sin(φ), cφ = Math.cos(φ), tφ = Math.tan(φ)
  const N = a / Math.sqrt(1 - e2 * sφ * sφ)
  const T = tφ * tφ
  const C = ep2 * cφ * cφ
  const A = cφ * dλ
  const M = meridianArc(φ, a, e2)
  const x = fe + k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120)
  const y = fn + k0 * (M + N * tφ * ((A * A) / 2 + ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720))
  return { x, y }
}

export function tmInverse(x, y, opts = {}) {
  const ell = opts.ellipsoid || 'WGS84'
  const { a, e2, ep2 } = ellipsoidParams(ell)
  const k0 = opts.k0 === undefined ? 1 : opts.k0
  const lon0 = opts.lon0 === undefined ? 0 : opts.lon0
  const fe = opts.fe || 0
  const fn = opts.fn || 0
  const M = (y - fn) / k0
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256))
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const φ1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)
  const sφ1 = Math.sin(φ1), cφ1 = Math.cos(φ1), tφ1 = Math.tan(φ1)
  const C1 = ep2 * cφ1 * cφ1
  const T1 = tφ1 * tφ1
  const N1 = a / Math.sqrt(1 - e2 * sφ1 * sφ1)
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * sφ1 * sφ1, 1.5)
  const D = (x - fe) / (N1 * k0)
  const lat = φ1 - ((N1 * tφ1) / R1) * ((D * D) / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720)
  const lon = toRad(lon0) + (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) / cφ1
  return { lat: toDeg(lat), lon: toDeg(lon) }
}

export function meridianArc(φ, a, e2) {
  return a * ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256) * φ - ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * φ) + ((15 * e2 * e2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * φ) - ((35 * e2 ** 3) / 3072) * Math.sin(6 * φ))
}

export function utmZoneOf(lon, lat) {
  let zone = Math.floor((lon + 180) / 6) + 1
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) zone = 32 // 挪威特例
  if (lat >= 72 && lat < 84) {
    if (lon >= 0 && lon < 9) zone = 31
    else if (lon >= 9 && lon < 21) zone = 33
    else if (lon >= 21 && lon < 33) zone = 35
    else if (lon >= 33 && lon < 42) zone = 37
  }
  return zone
}

export function utmForward(lat, lon, zone, ell = 'WGS84') {
  const z = zone || utmZoneOf(lon, lat)
  const lon0 = (z - 1) * 6 - 180 + 3
  const { x, y } = tmForward(lat, lon, { ellipsoid: ell, k0: 0.9996, lon0, fe: 500000, fn: lat < 0 ? 10000000 : 0 })
  return { x, y, zone: z, hemisphere: lat < 0 ? 'S' : 'N', lon0 }
}

export function utmInverse(x, y, zone, south = false, ell = 'WGS84') {
  const lon0 = (zone - 1) * 6 - 180 + 3
  return tmInverse(x, y, { ellipsoid: ell, k0: 0.9996, lon0, fe: 500000, fn: south ? 10000000 : 0 })
}

// Web 墨卡托（EPSG:3857）
export function webMercatorForward(lat, lon) {
  const R = 6378137
  const x = R * toRad(lon)
  const y = R * Math.log(Math.tan(PI / 4 + toRad(lat) / 2))
  return { x, y }
}

export function webMercatorInverse(x, y) {
  const R = 6378137
  return { lat: toDeg(2 * Math.atan(Math.exp(y / R)) - PI / 2), lon: toDeg(x / R) }
}

// ============ Geohash ============
const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

export function geohashEncode(lat, lon, precision = 12) {
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180
  let hash = ''
  let bit = 0
  let ch = 0
  let even = true
  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2
      if (lon >= mid) { ch = (ch << 1) | 1; lonMin = mid } else { ch = ch << 1; lonMax = mid }
    } else {
      const mid = (latMin + latMax) / 2
      if (lat >= mid) { ch = (ch << 1) | 1; latMin = mid } else { ch = ch << 1; latMax = mid }
    }
    even = !even
    if (++bit === 5) {
      hash += GEOHASH_BASE32[ch]
      bit = 0
      ch = 0
    }
  }
  return hash
}

export function geohashDecode(hash) {
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180
  let even = true
  for (const c of String(hash).toLowerCase()) {
    const idx = GEOHASH_BASE32.indexOf(c)
    if (idx < 0) throw new Error(`非法 geohash 字符：${c}`)
    for (let mask = 16; mask; mask >>= 1) {
      if (even) {
        const mid = (lonMin + lonMax) / 2
        if (idx & mask) lonMin = mid
        else lonMax = mid
      } else {
        const mid = (latMin + latMax) / 2
        if (idx & mask) latMin = mid
        else latMax = mid
      }
      even = !even
    }
  }
  return {
    lat: (latMin + latMax) / 2,
    lon: (lonMin + lonMax) / 2,
    latErr: (latMax - latMin) / 2,
    lonErr: (lonMax - lonMin) / 2,
    bounds: { latMin, latMax, lonMin, lonMax }
  }
}

// ============ NMEA-0183 解析 ============
export function nmeaChecksum(body) {
  let c = 0
  for (const ch of body) c ^= ch.charCodeAt(0)
  return c.toString(16).toUpperCase().padStart(2, '0')
}

function nmeaCoord(v, hemi) {
  // ddmm.mmmm / dddmm.mmmm
  const s = String(v)
  const dot = s.indexOf('.')
  const intLen = dot < 0 ? s.length : dot
  const degLen = intLen - 2
  if (degLen <= 0) return NaN
  const deg = Number(s.slice(0, degLen))
  const min = Number(s.slice(degLen))
  const dd = deg + min / 60
  return /[SW]/i.test(hemi || '') ? -dd : dd
}

const NMEA_TALKER = { GP: 'GPS', GL: 'GLONASS', GA: 'Galileo', GB: 'BeiDou', BD: 'BeiDou', GN: '多系统组合', GQ: 'QZSS' }

export function parseNmea(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
  const out = []
  for (const line of lines) {
    if (!line.startsWith('$')) {
      out.push({ raw: line, type: 'RAW', ok: false, error: '不是以 $ 开头的语句' })
      continue
    }
    const star = line.lastIndexOf('*')
    const body = star >= 0 ? line.slice(1, star) : line.slice(1)
    const given = star >= 0 ? line.slice(star + 1).trim().toUpperCase() : ''
    const calc = nmeaChecksum(body)
    const ok = !given || given === calc
    const f = body.split(',')
    const type = f[0]
    const talker = NMEA_TALKER[type.slice(0, 2)] || type.slice(0, 2)
    const sentence = type.slice(2)
    const rec = { raw: line, type, sentence, talker, ok, checksum: given, checksumCalc: calc, fields: f.slice(1) }
    if (sentence === 'GGA') {
      rec.parsed = {
        utc: f[1],
        lat: nmeaCoord(f[2], f[3]),
        lon: nmeaCoord(f[4], f[5]),
        fixQuality: Number(f[6]),
        fixQualityText: ['无效', '单点定位', '差分GPS', 'PPS', 'RTK固定解', 'RTK浮点解', '航位推算', '手动', '模拟'][Number(f[6])] || '未知',
        satellites: Number(f[7]),
        hdop: Number(f[8]),
        altitude: Number(f[9]),
        altitudeUnit: f[10],
        geoidSep: Number(f[11]),
        geoidUnit: f[12],
        diffAge: f[13],
        diffStation: f[14]
      }
    } else if (sentence === 'RMC') {
      rec.parsed = {
        utc: f[1],
        status: f[2] === 'A' ? '有效' : '无效',
        lat: nmeaCoord(f[3], f[4]),
        lon: nmeaCoord(f[5], f[6]),
        speedKnots: Number(f[7]),
        speedKmh: Number(f[7]) * 1.852,
        course: Number(f[8]),
        date: f[9],
        magVar: Number(f[10]),
        magVarDir: f[11],
        mode: f[12]
      }
    } else if (sentence === 'GSA') {
      rec.parsed = {
        mode: f[1] === 'A' ? '自动' : '手动',
        fixType: Number(f[2]),
        fixTypeText: ['无定位', '2D', '3D'][Number(f[2]) - 1] || '未知',
        sats: f.slice(3, 15).filter(Boolean),
        pdop: Number(f[15]),
        hdop: Number(f[16]),
        vdop: Number(f[17])
      }
    } else if (sentence === 'GSV') {
      const sats = []
      for (let i = 4; i + 3 < f.length; i += 4) {
        if (!f[i]) continue
        sats.push({ prn: f[i], elevation: Number(f[i + 1]), azimuth: Number(f[i + 2]), snr: f[i + 3] ? Number(f[i + 3]) : null })
      }
      rec.parsed = { totalMsg: Number(f[1]), msgNum: Number(f[2]), satsInView: Number(f[3]), sats }
    } else if (sentence === 'VTG') {
      rec.parsed = {
        courseTrue: Number(f[1]),
        courseMag: Number(f[3]),
        speedKnots: Number(f[5]),
        speedKmh: Number(f[7]),
        mode: f[9]
      }
    } else if (sentence === 'GLL') {
      rec.parsed = { lat: nmeaCoord(f[1], f[2]), lon: nmeaCoord(f[3], f[4]), utc: f[5], status: f[6], mode: f[7] }
    } else if (sentence === 'ZDA') {
      rec.parsed = { utc: f[1], day: Number(f[2]), month: Number(f[3]), year: Number(f[4]), localZoneH: Number(f[5]), localZoneM: Number(f[6]) }
    }
    out.push(rec)
  }
  return out
}

// ============ RTCM3 解析 ============
// 消息类型表（常用）
export const RTCM_MSG_TYPES = {
  1001: 'GPS L1 伪距',
  1002: 'GPS L1 载波相位',
  1003: 'GPS L1/L2 伪距',
  1004: 'GPS L1/L2 载波相位',
  1005: '基站坐标（无天线高）',
  1006: '基站坐标（含天线高）',
  1007: '天线描述',
  1008: '天线描述+序列号',
  1009: 'GLONASS L1 伪距',
  1010: 'GLONASS L1 载波相位',
  1011: 'GLONASS L1/L2 伪距',
  1012: 'GLONASS L1/L2 载波相位',
  1013: '系统参数',
  1019: 'GPS 星历',
  1020: 'GLONASS 星历',
  1029: 'UNICOM 文本',
  1032: 'GLONASS 码相位偏差',
  1033: '接收机与天线描述',
  1071: 'GPS MSM1',
  1074: 'GPS MSM4',
  1077: 'GPS MSM7',
  1081: 'GLONASS MSM1',
  1084: 'GLONASS MSM4',
  1087: 'GLONASS MSM7',
  1091: 'Galileo MSM1',
  1094: 'Galileo MSM4',
  1097: 'Galileo MSM7',
  1111: 'QZSS MSM1',
  1114: 'QZSS MSM4',
  1117: 'QZSS MSM7',
  1121: 'BeiDou MSM1',
  1124: 'BeiDou MSM4',
  1127: 'BeiDou MSM7',
  1230: 'GLONASS 码相位偏差',
  4072: 'u-blox 私有',
  4090: 'ASCM 私有'
}

export function crc24q(data) {
  let crc = 0
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 16
    for (let j = 0; j < 8; j++) {
      crc <<= 1
      if (crc & 0x1000000) crc ^= 0x1864cfb
    }
  }
  return crc & 0xffffff
}

function bytesFromInput(input) {
  if (input instanceof Uint8Array) return input
  const s = String(input || '')
  const hex = s.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '')
  if (hex.length >= 6 && hex.length % 2 === 0) {
    const arr = new Uint8Array(hex.length / 2)
    for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16)
    return arr
  }
  throw new Error('请输入十六进制报文（如 D3 00 13 3E D0 ...）')
}

export function parseRtcm3(input) {
  const buf = bytesFromInput(input)
  const frames = []
  let i = 0
  while (i < buf.length) {
    // 找前导 0xD3
    if (buf[i] !== 0xd3) {
      i++
      continue
    }
    if (i + 3 > buf.length) break
    const len = ((buf[i + 1] & 0x03) << 8) | buf[i + 2]
    const total = 3 + len + 3
    if (i + total > buf.length) {
      frames.push({ offset: i, error: `长度不足：声明 ${len} 字节负载，实际仅剩 ${buf.length - i - 6}` })
      break
    }
    const payload = buf.slice(i + 3, i + 3 + len)
    const crcGiven = (buf[i + 3 + len] << 16) | (buf[i + 4 + len] << 8) | buf[i + 5 + len]
    const crcCalc = crc24q(buf.slice(i, i + 3 + len))
    const msgType = payload.length >= 2 ? (payload[0] << 4) | (payload[1] >> 4) : null
    frames.push({
      offset: i,
      length: total,
      payloadLength: len,
      messageType: msgType,
      messageName: RTCM_MSG_TYPES[msgType] || '未知/未收录',
      crcGiven: crcGiven.toString(16).toUpperCase().padStart(6, '0'),
      crcCalc: crcCalc.toString(16).toUpperCase().padStart(6, '0'),
      crcOk: crcGiven === crcCalc,
      payloadHex: Array.from(payload).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      headerHex: Array.from(buf.slice(i, i + 3)).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
    })
    i += total
  }
  return frames
}

// ============ NTRIP Source-Table ============
// 解析 SOURCETABLE 响应（含 STR / CAS / NET / ENDSOURCETABLE）
export function parseNtripSourcetable(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
  const result = { mountpoints: [], casters: [], networks: [], raw: lines }
  for (const line of lines) {
    const f = line.split(';')
    const tag = f[0]
    if (tag === 'STR') {
      result.mountpoints.push({
        mountpoint: f[1],
        identifier: f[2],
        format: f[3],
        formatDetails: f[4],
        carrier: f[5],
        navSystem: f[6],
        network: f[7],
        country: f[8],
        latitude: Number(f[9]),
        longitude: Number(f[10]),
        nmea: f[11] === '1',
        solution: Number(f[12]),
        generator: f[13],
        compression: f[14],
        authentication: f[15],
        fee: f[16] === 'Y',
        bitrate: Number(f[17]),
        misc: f.slice(18)
      })
    } else if (tag === 'CAS') {
      result.casters.push({ host: f[1], port: Number(f[2]), identifier: f[3], operator: f[4], nmea: f[5] === '1', country: f[6], latitude: Number(f[7]), longitude: Number(f[8]) })
    } else if (tag === 'NET') {
      result.networks.push({ identifier: f[1], operator: f[2], authentication: f[3], fee: f[4] === 'Y', web: f[5] })
    }
  }
  return result
}

export function buildNtripSourcetable(rows) {
  const lines = ['SOURCETABLE 200 OK', 'Server: Toolbox-NTRIP/1.0', 'Content-Type: text/plain', 'Content-Length: 0', '']
  for (const r of rows || []) {
    lines.push(
      [
        'STR',
        r.mountpoint || '',
        r.identifier || '',
        r.format || 'RTCM 3.2',
        r.formatDetails || '1005(10),1074(1),1084(1),1094(1),1124(1)',
        r.carrier || '2',
        r.navSystem || 'GPS+GLO+GAL+BDS',
        r.network || '',
        r.country || 'CHN',
        r.latitude === '' || r.latitude === undefined ? '' : Number(r.latitude).toFixed(2),
        r.longitude === '' || r.longitude === undefined ? '' : Number(r.longitude).toFixed(2),
        r.nmea ? '1' : '0',
        r.solution === undefined ? '0' : String(r.solution),
        r.generator || 'toolbox',
        r.compression || 'none',
        r.authentication || 'B',
        r.fee ? 'Y' : 'N',
        r.bitrate === undefined ? '9600' : String(r.bitrate),
        r.misc || ''
      ].join(';')
    )
  }
  lines.push('ENDSOURCETABLE')
  return lines.join('\r\n')
}

// ============ 基站坐标计算 ============
// 由已知控制点 + 观测基线推算基站坐标（简化：单点 + 已知坐标平均 / 加权平均）
export function averageCoordinate(points, weights) {
  const n = points.length
  if (!n) throw new Error('无有效点')
  const w = weights && weights.length === n ? weights : new Array(n).fill(1)
  const sw = w.reduce((s, x) => s + x, 0) || 1
  return {
    x: points.reduce((s, p, i) => s + p.x * w[i], 0) / sw,
    y: points.reduce((s, p, i) => s + p.y * w[i], 0) / sw,
    z: points.reduce((s, p, i) => s + p.z * w[i], 0) / sw
  }
}
