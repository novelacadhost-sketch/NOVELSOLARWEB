// Second pass: gallery images (PROPERTY_112) for products whose main image
// already migrated successfully. No new matching decisions are made here —
// it only touches Bitrix IDs already present in migration-log.json.
//   node .migrate-galleries.tmp.mjs           -> dry run
//   node .migrate-galleries.tmp.mjs --commit  -> apply
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { v2 as cloudinary } from 'cloudinary'

const COMMIT = process.argv.includes('--commit')
const S = 'C:/Users/Novel/AppData/Local/Temp/claude/C--Users-Novel-Downloads-codespaces-NovelSolar/7079c0b6-d5ec-4bb6-9431-f9bed51df227/scratchpad'
const IMG_ROOT = 'C:/Users/Novel/Downloads/novelsolar-product-images'
const MAIN_LOG = join(IMG_ROOT, 'migration-log.json')
const GAL_LOG = join(IMG_ROOT, 'gallery-log.json')
const MAX_GALLERY = 10 // matches MAX_GALLERY_FILES in productMedia.ts

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '').trim()] }),
)
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
})
const BX = env.BITRIX_WEBHOOK_URL.replace(/\/$/, '') + '/'
const TRANSFORM = 'f_auto,q_auto,w_1200'
const deliveryUrl = (u) => u.replace('/image/upload/', `/image/upload/${TRANSFORM}/`)

const mainLog = JSON.parse(readFileSync(MAIN_LOG, 'utf8'))
const { AUTO } = JSON.parse(readFileSync(`${S}/matches2.json`, 'utf8'))
const byId = new Map(AUTO.map((r) => [String(r.bitrixId), r]))
const galLog = existsSync(GAL_LOG) ? JSON.parse(readFileSync(GAL_LOG, 'utf8')) : {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const targets = Object.keys(mainLog)
  .map((id) => ({ id, row: byId.get(id) }))
  .filter((x) => x.row && x.row.images.length > 1)

const totalExtra = targets.reduce((n, t) => n + Math.min(t.row.images.length - 1, MAX_GALLERY), 0)
console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — ${targets.length} of ${Object.keys(mainLog).length} products have gallery images`)
console.log(`${totalExtra} additional images to upload\n`)

let uploaded = 0, updated = 0, skipped = 0, failed = 0
for (const [i, { id, row }] of targets.entries()) {
  if (galLog[id]) { skipped++; continue }
  const extras = row.images.slice(1, 1 + MAX_GALLERY)
  const label = `[${String(i + 1).padStart(2)}/${targets.length}] [${id}] ${row.bitrixName.slice(0, 42)} (+${extras.length})`

  if (!COMMIT) { console.log(`  would add ${extras.length} to ${row.folder}\n     ${label}`); continue }

  try {
    const urls = []
    for (const [j, file] of extras.entries()) {
      const local = join(IMG_ROOT, row.folder, file)
      if (!existsSync(local)) continue
      const res = await cloudinary.uploader.upload(local, {
        folder: 'novel_solar_products',
        public_id: `${row.folder}-g${j + 1}`,
        overwrite: false,
        resource_type: 'image',
      })
      uploaded++
      urls.push(deliveryUrl(res.secure_url))
    }
    if (!urls.length) { skipped++; continue }

    const upd = await fetch(`${BX}crm.product.update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(id), fields: { PROPERTY_112: JSON.stringify(urls) } }),
    }).then((r) => r.json())
    if (upd.error) throw new Error(`Bitrix: ${upd.error_description || upd.error}`)

    updated++
    galLog[id] = { product: row.product, bitrixName: row.bitrixName, gallery: urls, at: new Date().toISOString() }
    writeFileSync(GAL_LOG, JSON.stringify(galLog, null, 1))
    console.log(`  ok    ${label}`)
    await sleep(600)
  } catch (err) {
    failed++
    console.log(`  FAIL  ${label}\n        ${err.message}`)
  }
}

console.log(`\nuploaded ${uploaded}  bitrix-updated ${updated}  skipped ${skipped}  failed ${failed}`)
if (!COMMIT) console.log('nothing written. re-run with --commit.')
