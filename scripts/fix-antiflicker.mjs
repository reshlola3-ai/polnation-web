/**
 * fix-antiflicker.mjs
 *
 * Removes Intellimize anti-flicker delay from polygon-clone/index.html.
 * Does NOT touch any HTML content — only removes the delay mechanism.
 *
 * Run: node scripts/fix-antiflicker.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'public', 'polygon-clone', 'index.html')

let html = readFileSync(SRC, 'utf8')

// 1. Remove anti-flicker CSS
html = html.replace(
  '<style>.anti-flicker, .anti-flicker * {visibility: hidden !important; opacity: 0 !important;}</style>',
  ''
)

// 2. Remove intellimize localStorage script
html = html.replace(
  /<script type="text\/javascript">localStorage\.removeItem\('intellimize_opt_out[^<]*<\/script>/,
  ''
)

// 3. Replace the intellimize anti-flicker timeout script with a wf.ready
//    initializer that fires callbacks on DOMContentLoaded immediately.
//    Original: adds 'anti-flicker' class + removes after 4000ms, also sets up intellimize
html = html.replace(
  /<script type="text\/javascript">\(function\(e,t,p\)\{var n=document\.documentElement[^<]*4000[^<]*'anti-flicker'\)<\/script>/,
  `<script type="text/javascript">(function(e){var s={r:[]};e.wf={r:s.r,ready:function(t){s.r.push(t)}};document.addEventListener('DOMContentLoaded',function(){s.r.forEach(function(fn){try{fn()}catch(ex){}})},false)})(window)</script>`
)

// 4. Remove wf.ready initializer that was separate (now merged above)
html = html.replace(
  '<script type="text/javascript">(function(e){var s={r:[]};e.wf={r:s.r,ready:t=>{s.r.push(t)}}})(window)</script>',
  ''
)

// 5. Remove intellimize CDN preload link
html = html.replace(
  '<link href="https://cdn.intellimize.co/snippet/117265402.js" rel="preload" as="script"/>',
  ''
)

// 6. Remove intellimize CDN script loader
html = html.replace(
  /<script type="text\/javascript">var wfClientScript=document\.createElement\("script"\);wfClientScript\.src="https:\/\/cdn\.intellimize\.co[^<]*<\/script>/,
  ''
)

// 7. Remove intellimize preconnect links
html = html.replace('<link href="https://api.intellimize.co" rel="preconnect" crossorigin="true"/>', '')
html = html.replace('<link href="https://log.intellimize.co" rel="preconnect" crossorigin="true"/>', '')
html = html.replace('<link href="https://117265402.intellimizeio.com" rel="preconnect"/>', '')

writeFileSync(SRC, html, 'utf8')
console.log('✓ Anti-flicker removed:', SRC)

// Verify
const remaining = (html.match(/intellimize/g) || []).length
console.log(`  Remaining 'intellimize' occurrences: ${remaining} (expected 1 — data attribute only)`)
const hasAntiFlicker = html.includes('anti-flicker')
console.log(`  'anti-flicker' present: ${hasAntiFlicker} (expected false)`)
