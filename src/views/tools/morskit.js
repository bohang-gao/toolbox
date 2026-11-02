// 摩斯电码转换纯函数

export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '-....-', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', _: '..--.-',
  '"': '.-..-.', $: '...-..-', '@': '.--.-.'
}

export const REVERSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]))

// 文本 → 摩斯（字母间空格，单词间 /）；返回 { output, unsupported: string[] }
export function encodeMorse(text) {
  const unsupported = new Set()
  const words = String(text).toUpperCase().split(/\s+/).filter(Boolean)
  const encodedWords = words.map((word) =>
    Array.from(word)
      .map((ch) => {
        const code = MORSE[ch]
        if (!code) {
          unsupported.add(ch)
          return ''
        }
        return code
      })
      .filter(Boolean)
      .join(' ')
  ).filter(Boolean)
  return { output: encodedWords.join(' / '), unsupported: [...unsupported] }
}

export function normalizeMorse(s) {
  return String(s)
    .replace(/[·•]/g, '.')
    .replace(/[—–]/g, '-')
    .replace(/[｜|]/g, '/')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 摩斯 → 文本；返回 { output, unsupported: string[] }
export function decodeMorse(code) {
  const unsupported = new Set()
  const words = normalizeMorse(code).split(/\s*\/\s*/).filter(Boolean)
  const decoded = words.map((word) => {
    const letters = word.split(/\s+/).filter(Boolean)
    return letters.map((l) => {
      const ch = REVERSE[l]
      if (!ch) {
        unsupported.add(l)
        return ''
      }
      return ch
    }).join('')
  }).join(' ')
  return { output: decoded, unsupported: [...unsupported] }
}
