/**
 * 校验 tools.js 里所有 icon 在 Font Awesome 4.7 中真实存在。
 * 用法：node tests/icons.test.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const src = readFileSync(resolve(root, 'src/data/tools.js'), 'utf8')
const css = readFileSync(resolve(root, 'public/fontawesome/css/font-awesome.min.css'), 'utf8')

const icons = [...src.matchAll(/icon:\s*'(fa-[a-z0-9-]+)'/g)].map((m) => m[1])
const unique = [...new Set(icons)]
const missing = unique.filter((ic) => !css.includes(`.${ic}:before`))

console.log(`icon total=${icons.length} unique=${unique.length} missing=${missing.length}`)
if (missing.length) {
  for (const m of missing) console.log(`  MISSING ${m}`)
  process.exit(1)
}
console.log('OK: 所有图标均存在于 Font Awesome 4.7')
