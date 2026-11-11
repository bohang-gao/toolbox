// coordkit 算例验证（node 直接跑，ESM 通过动态 import）
import {
  geodeticToEcef, ecefToGeodetic, ddToDms, haversine, vincentyInverse,
  wgs84ToGcj02, utmForward, geohashEncode, helmertForward, swapAxes,
  ecefToEnu, enuToEcef, tmForward, tmInverse, vincentyDirect, parseDms,
  geodeticToGeocentricLat, cartesianToPolar, polarToCartesian,
  parseNmea, parseRtcm3, parseNtripSourcetable, solveHelmert, convertUnit,
  ANGLE_UNITS, LENGTH_UNITS, webMercatorForward, webMercatorInverse, geohashDecode, crc24q
} from '../src/views/tools/coordkit.js'

let pass = 0, fail = 0
const near = (name, got, want, tol) => {
  const ok = Math.abs(got - want) <= tol
  if (ok) pass++; else { fail++; console.log(`  FAIL ${name}: got ${got}, want ${want} (tol ${tol})`) }
}
const eq = (name, got, want) => {
  const ok = String(got) === String(want)
  if (ok) pass++; else { fail++; console.log(`  FAIL ${name}: got ${got}, want ${want}`) }
}

console.log('== 1. 大地 -> ECEF（预期值由 pyproj EPSG:4979->4978 独立给出）==')
const e = geodeticToEcef(39.9042, 116.4074, 0)
near('x', e.x, -2179073.802, 1)
near('y', e.y, 4388292.527, 1)
near('z', e.z, 4069831.422, 1)

console.log('== 2. ECEF -> 大地 回代 ==')
const g = ecefToGeodetic(e.x, e.y, e.z)
near('lat', g.lat, 39.9042, 1e-6)
near('lon', g.lon, 116.4074, 1e-6)
near('h', g.h, 0, 1e-3)

console.log('== 3. 度分秒 ==')
const dms = ddToDms(116.4074)
eq('dms.text', dms.text, "116°24′26.64″")

console.log('== 4. 距离 ==')
near('haversine', haversine(39.9042, 116.4074, 31.2304, 121.4737) / 1000, 1067, 2)
const v = vincentyInverse(39.9042, 116.4074, 31.2304, 121.4737)
near('vincenty', v.distance / 1000, 1067.6, 2)

console.log('== 5. GCJ02 ==')
const gcj = wgs84ToGcj02(39.9042, 116.4074)
near('gcj.lon', gcj.lon, 116.413642, 1e-5)
near('gcj.lat', gcj.lat, 39.905603, 1e-5)

console.log('== 6. UTM ==')
const utm = utmForward(39.9042, 116.4074)
eq('utm.zone', utm.zone, 50)
near('utm.E', utm.x, 449345.061, 0.01)
near('utm.N', utm.y, 4417292.494, 0.01)

console.log('== 7. Geohash ==')
const gh = geohashEncode(39.9042, 116.4074, 9)
eq('geohash 前缀', gh.slice(0, 5), 'wx4g0')
const ghd = geohashDecode(gh)
near('geohash 回代 lat', ghd.lat, 39.9042, 1e-4)
near('geohash 回代 lon', ghd.lon, 116.4074, 1e-4)

console.log('== 8. 七参数单位阵 ==')
const h0 = helmertForward(1, 2, 3, { dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, s: 0 })
near('h.x', h0.x, 1, 1e-12); near('h.y', h0.y, 2, 1e-12); near('h.z', h0.z, 3, 1e-12)

console.log('== 9. 轴交换 ==')
eq('swap Y/Z', JSON.stringify(swapAxes([1, 2, 3], 'XZY')), JSON.stringify([1, 3, 2]))

console.log('== 10. ENU 往返 ==')
const origin = { lat: 39.9042, lon: 116.4074, h: 50 }
const target = geodeticToEcef(39.91, 116.42, 120)
const enu = ecefToEnu(target.x, target.y, target.z, origin.lat, origin.lon, origin.h)
const back = enuToEcef(enu.e, enu.n, enu.u, origin.lat, origin.lon, origin.h)
near('enu 往返 x', back.x, target.x, 1e-6)
near('enu 往返 y', back.y, target.y, 1e-6)
near('enu 往返 z', back.z, target.z, 1e-6)

console.log('== 11. TM 往返 ==')
const tm = tmForward(39.9042, 116.4074, { lon0: 117 })
const tmB = tmInverse(tm.x, tm.y, { lon0: 117 })
near('tm 往返 lat', tmB.lat, 39.9042, 1e-7)
near('tm 往返 lon', tmB.lon, 116.4074, 1e-7)

console.log('== 12. Vincenty 正算往返 ==')
const vd = vincentyDirect(39.9042, 116.4074, 45, 100000)
const vi = vincentyInverse(39.9042, 116.4074, vd.lat, vd.lon)
near('正反算距离', vi.distance, 100000, 0.01)

console.log('== 13. DMS 解析 ==')
near('parseDms 度分秒', parseDms('116°24\'26.64"'), 116.4074, 1e-6)
near('parseDms 空格', parseDms('116 24 26.64'), 116.4074, 1e-6)
near('parseDms 南纬', parseDms('S39 54 15'), -39.9041666, 1e-6)

console.log('== 14. 地心纬度 ==')
const gcl = geodeticToGeocentricLat(45)
near('45° 大地纬度 -> 地心', gcl, 44.8076, 1e-3)

console.log('== 15. 极坐标 ==')
const pc = cartesianToPolar(100, 100)
near('r', pc.r, 141.421356, 1e-6)
near('theta', pc.theta, 45, 1e-9)
const pcc = polarToCartesian(pc.r, pc.theta)
near('回代 x', pcc.x, 100, 1e-9); near('回代 y', pcc.y, 100, 1e-9)

console.log('== 16. Web 墨卡托 ==')
const wm = webMercatorForward(39.9042, 116.4074)
const wmb = webMercatorInverse(wm.x, wm.y)
near('wm 往返 lat', wmb.lat, 39.9042, 1e-9)
near('wm 往返 lon', wmb.lon, 116.4074, 1e-9)

console.log('== 17. NMEA 解析 ==')
const nmea = parseNmea('$GNGGA,082123.00,3954.25200,N,11624.44400,E,4,12,0.8,55.2,M,-8.5,M,1.0,0000*4A')
eq('nmea 条数', nmea.length, 1)
near('nmea lat', nmea[0].parsed.lat, 39.9042, 1e-4)
near('nmea lon', nmea[0].parsed.lon, 116.4074, 1e-4)
eq('nmea fixQualityText', nmea[0].parsed.fixQualityText, 'RTK固定解')

console.log('== 18. RTCM3 解析（帧由本库 crc24q 生成，校验链路闭环）==')
// 构造 type=1005 的合法帧：payload 前 12 bit = 1005
const payload = new Uint8Array([0x3e, 0xd0, 0x00, 0x03, 0x46, 0x54, 0x53, 0x2d, 0x52, 0x54, 0x43, 0x4d])
const head = new Uint8Array([0xd3, (payload.length >> 8) & 0x03, payload.length & 0xff])
const bodyForCrc = new Uint8Array(head.length + payload.length)
bodyForCrc.set(head, 0); bodyForCrc.set(payload, head.length)
const crc = crc24q(bodyForCrc)
const frame = new Uint8Array(bodyForCrc.length + 3)
frame.set(bodyForCrc, 0)
frame[bodyForCrc.length] = (crc >> 16) & 0xff
frame[bodyForCrc.length + 1] = (crc >> 8) & 0xff
frame[bodyForCrc.length + 2] = crc & 0xff
const rtcmHex = Array.from(frame).map(b => b.toString(16).padStart(2, '0')).join(' ')
const rt = parseRtcm3(rtcmHex)
eq('rtcm 帧数', rt.length, 1)
if (rt.length) {
  eq('rtcm type', rt[0].messageType, 1005)
  eq('rtcm crcOk', rt[0].crcOk, true)
  eq('rtcm 名称', rt[0].messageName, '基站坐标（无天线高）')
}
// 篡改一个字节，CRC 必须报错
const bad = Array.from(frame)
bad[5] ^= 0xff
const rtBad = parseRtcm3(bad.map(b => b.toString(16).padStart(2, '0')).join(' '))
eq('篡改后 crcOk', rtBad[0].crcOk, false)

console.log('== 19. NTRIP Source-Table ==')
const st = parseNtripSourcetable('STR;BJFS;北京房山;RTCM 3.2;1005(10),1074(1);2;GPS+GLO;BJGNET;CHN;39.60;115.89;1;0;gnss;none;B;N;9600;')
eq('mountpoints', st.mountpoints.length, 1)
eq('mountpoint 名', st.mountpoints[0].mountpoint, 'BJFS')
near('mountpoint lat', st.mountpoints[0].latitude, 39.6, 1e-9)

console.log('== 20. 七参数求解（3 点往返） ==')
const src = [geodeticToEcef(39.9, 116.4, 0), geodeticToEcef(39.95, 116.45, 0), geodeticToEcef(39.85, 116.35, 0), geodeticToEcef(39.92, 116.38, 0)]
const P = { dx: 10, dy: -20, dz: 30, rx: 1.5, ry: -2.5, rz: 3.5, s: 2 }
const dst = src.map(p => helmertForward(p.x, p.y, p.z, P))
const solved = solveHelmert(src, dst)
near('solved.dx', solved.dx, 10, 1e-3)
near('solved.dy', solved.dy, -20, 1e-3)
near('solved.dz', solved.dz, 30, 1e-3)
near('solved.rx', solved.rx, 1.5, 1e-3)
near('solved.ry', solved.ry, -2.5, 1e-3)
near('solved.rz', solved.rz, 3.5, 1e-3)
near('solved.s', solved.s, 2, 1e-3)

console.log('== 21. 单位换算 ==')
near('度->角秒', convertUnit(1, '度', '角秒', ANGLE_UNITS), 3600, 1e-9)
near('千米->米', convertUnit(1, '千米', '米', LENGTH_UNITS), 1000, 1e-9)
near('海里->米', convertUnit(1, '海里', '米', LENGTH_UNITS), 1852, 1e-9)

console.log(`\n===== ${pass} passed, ${fail} failed =====`)
if (fail) process.exit(1)
