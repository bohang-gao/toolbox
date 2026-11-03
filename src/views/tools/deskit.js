// 纯 JS DES（ECB + PKCS#7）实现，供 des.vue 使用；已用 Node crypto(des-ecb) 交叉验证
// 注意：DES 已被 AES 取代，此实现仅用于复刻原站在线工具，不应用于真实安全场景。

const IP = [
  58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7
]

const FP = [
  40, 8, 48, 16, 56, 24, 64, 32, 39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30, 37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28, 35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26, 33, 1, 41, 9, 49, 17, 57, 25
]

const E = [
  32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11,
  12, 13, 12, 13, 14, 15, 16, 17, 16, 17, 18, 19, 20, 21, 20, 21,
  22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1
]

const P = [
  16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25
]

const PC1 = [
  57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4
]

const PC2 = [
  14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32
]

const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1]

const SBOX = [
  [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
    [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
    [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
    [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13]
  ],
  [
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
    [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
    [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
    [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9]
  ],
  [
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
    [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
    [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
    [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12]
  ],
  [
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
    [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
    [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
    [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14]
  ],
  [
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
    [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
    [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
    [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3]
  ],
  [
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
    [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
    [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
    [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13]
  ],
  [
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
    [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
    [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
    [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12]
  ],
  [
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
    [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
    [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
    [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
  ]
]

const BLOCK = 8

function permute(bits, table) {
  const out = new Array(table.length)
  for (let i = 0; i < table.length; i++) out[i] = bits[table[i] - 1]
  return out
}

function xorBits(a, b) {
  const out = new Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i]
  return out
}

function rotLeft(bits, n) {
  return bits.slice(n).concat(bits.slice(0, n))
}

function bytesToBits(bytes) {
  const bits = new Array(bytes.length * 8)
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    for (let j = 0; j < 8; j++) bits[i * 8 + j] = (b >> (7 - j)) & 1
  }
  return bits
}

function bitsToBytes(bits) {
  const out = new Uint8Array(bits.length / 8)
  for (let i = 0; i < out.length; i++) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i * 8 + j]
    out[i] = v
  }
  return out
}

function keySchedule(keyBytes) {
  const keyBits = bytesToBits(keyBytes)
  const cd = permute(keyBits, PC1)
  let c = cd.slice(0, 28)
  let d = cd.slice(28)
  const subkeys = []
  for (let i = 0; i < 16; i++) {
    c = rotLeft(c, SHIFTS[i])
    d = rotLeft(d, SHIFTS[i])
    subkeys.push(permute(c.concat(d), PC2))
  }
  return subkeys
}

function feistel(right, subkey) {
  const expanded = permute(right, E)
  const mixed = xorBits(expanded, subkey)
  const out = new Array(32)
  for (let i = 0; i < 8; i++) {
    const chunk = mixed.slice(i * 6, i * 6 + 6)
    const row = chunk[0] * 2 + chunk[5]
    const col = chunk[1] * 8 + chunk[2] * 4 + chunk[3] * 2 + chunk[4]
    const val = SBOX[i][row][col]
    out[i * 4] = (val >> 3) & 1
    out[i * 4 + 1] = (val >> 2) & 1
    out[i * 4 + 2] = (val >> 1) & 1
    out[i * 4 + 3] = val & 1
  }
  return permute(out, P)
}

function cryptBlock(blockBits, subkeys, decrypt) {
  const permuted = permute(blockBits, IP)
  let left = permuted.slice(0, 32)
  let right = permuted.slice(32)
  const keys = decrypt ? subkeys.slice().reverse() : subkeys
  for (let i = 0; i < 16; i++) {
    const nextLeft = right
    const nextRight = xorBits(left, feistel(right, keys[i]))
    left = nextLeft
    right = nextRight
  }
  return permute(right.concat(left), FP)
}

// 将任意 UTF-8 密钥规整为 8 字节（截断或补 0）
export function normalizeDesKey(keyText) {
  const raw = new TextEncoder().encode(String(keyText == null ? '' : keyText))
  if (raw.length === 0) throw new Error('请输入密钥')
  const key = new Uint8Array(BLOCK)
  key.set(raw.subarray(0, BLOCK))
  return key
}

function padPkcs7(bytes) {
  const rem = bytes.length % BLOCK
  const padLen = BLOCK - rem
  const out = new Uint8Array(bytes.length + padLen)
  out.set(bytes)
  out.fill(padLen, bytes.length)
  return out
}

function unpadPkcs7(bytes) {
  if (bytes.length === 0 || bytes.length % BLOCK !== 0) throw new Error('密文长度不是 8 字节的整数倍')
  const padLen = bytes[bytes.length - 1]
  if (padLen < 1 || padLen > BLOCK) throw new Error('解密失败：密钥错误或密文已损坏')
  for (let i = bytes.length - padLen; i < bytes.length; i++) {
    if (bytes[i] !== padLen) throw new Error('解密失败：密钥错误或密文已损坏')
  }
  return bytes.subarray(0, bytes.length - padLen)
}

function cryptBytes(bytes, keyBytes, decrypt) {
  const subkeys = keySchedule(keyBytes)
  const out = new Uint8Array(bytes.length)
  for (let off = 0; off < bytes.length; off += BLOCK) {
    const blockBits = bytesToBits(bytes.subarray(off, off + BLOCK))
    out.set(bitsToBytes(cryptBlock(blockBits, subkeys, decrypt)), off)
  }
  return out
}

// 明文（UTF-8 文本）→ 密文 Uint8Array
export function desEncrypt(text, keyText) {
  const key = normalizeDesKey(keyText)
  const padded = padPkcs7(new TextEncoder().encode(String(text == null ? '' : text)))
  return cryptBytes(padded, key, false)
}

// 密文 Uint8Array → 明文（UTF-8 文本）
export function desDecrypt(cipherBytes, keyText) {
  const key = normalizeDesKey(keyText)
  if (cipherBytes.length === 0) throw new Error('请输入密文')
  const plain = unpadPkcs7(cryptBytes(cipherBytes, key, true))
  return new TextDecoder('utf-8').decode(plain)
}
