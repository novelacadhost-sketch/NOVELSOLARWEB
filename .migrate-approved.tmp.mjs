// Apply user-approved matches from the REVIEW>=0.85 shortlist.
// Indices are 1-based against the list shown in chat.
//   node .migrate-approved.tmp.mjs "1-8,10,11,12"           -> dry run
//   node .migrate-approved.tmp.mjs "1-8,10,11,12" --commit   -> apply
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { v2 as cloudinary } from 'cloudinary'

const SPEC = process.argv[2] || ''
const COMMIT = process.argv.includes('--commit')
const S = 'C:/Users/Novel/AppData/Local/Temp/claude/C--Users-Novel-Downloads-codespaces-NovelSolar/7079c0b6-d5ec-4bb6-9431-f9bed51df227/scratchpad'
const IMG_ROOT = 'C:/Users/Novel/Downloads/novelsolar-product-images'
const MAIN_LOG = join(IMG_ROOT, 'migration-log.json')
const GAL_LOG = join(IMG_ROOT, 'gallery-log.json')
const MAX_GALLERY = 10

const wanted = new Set()
for (const part of SPEC.split(',').map((s) => s.trim()).filter(Boolean)) {
  const m = part.match(/^(\d+)-(\d+)$/)
  if (m) { for (let i = +m[1]; i <= +m[2]; i++) wanted.add(i) }
  else wanted.add(Number(part))
}

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

const { REVIEW } = JSON.parse(readFileSync(`${S}/matches2.json`, 'utf8'))
const shortlist = REVIEW.filter((r) => r.score >= 0.85).sort((a, b) => b.score - a.score)
const picked = shortlist.filter((_, i) => wanted.has(i + 1))

const mainLog = JSON.parse(readFileSync(MAIN_LOG, 'utf8'))
const galLog = existsSync(GAL_LOG) ? JSON.parse(readFileSync(GAL_LOG, 'utf8')) : {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — applying ${picked.length} of ${shortlist.length} shortlisted`)
picked.forEach((r) => console.log(`   [${r.bitrixId}] ${r.bitrixName}  <- ${r.product} (${r.images.length} img)`))
console.log('')
if (!COMMIT) { console.log('nothing written. add --commit to apply.'); process.exit(0) }

let main = 0, gal = 0, failed = 0
for (const row of picked) {
  const id = String(row.bitrixId)
  if (mainLog[id]) { console.log(`  SKIP  [${id}] already has a migrated main image`); continue }
  try {
    const fields = {}
    const mainFile = join(IMG_ROOT, row.folder, row.images[0])
    if (!existsSync(mainFile)) throw new Error('main image missing on disk')
    const res = await cloudinary.uploader.upload(mainFile, {
      folder: 'novel_solar_products', public_id: `${row.folder}-main`, overwrite: false, resource_type: 'image',
    })
    fields.PROPERTY_102 = deliveryUrl(res.secure_url)

    const urls = []
    for (const [j, f] of row.images.slice(1, 1 + MAX_GALLERY).entries()) {
      const p = join(IMG_ROOT, row.folder, f)
      if (!existsSync(p)) continue
      const g = await cloudinary.uploader.upload(p, {
        folder: 'novel_solar_products', public_id: `${row.folder}-g${j + 1}`, overwrite: false, resource_type: 'image',
      })
      urls.push(deliveryUrl(g.secure_url))
    }
    if (urls.length) fields.PROPERTY_112 = JSON.stringify(urls)

    const upd = await fetch(`${BX}crm.product.update`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(id), fields }),
    }).then((r) => r.json())
    if (upd.error) throw new Error(`Bitrix: ${upd.error_description || upd.error}`)

    main++
    if (urls.length) { gal += urls.length; galLog[id] = { product: row.product, bitrixName: row.bitrixName, gallery: urls, at: new Date().toISOString() } }
    mainLog[id] = { product: row.product, bitrixName: row.bitrixName, publicId: res.public_id, propertyUrl: fields.PROPERTY_102, approvedFromReview: true, at: new Date().toISOString() }
    writeFileSync(MAIN_LOG, JSON.stringify(mainLog, null, 1))
    writeFileSync(GAL_LOG, JSON.stringify(galLog, null, 1))
    console.log(`  ok    [${id}] ${row.bitrixName.slice(0, 46)}  (+${urls.length} gallery)`)
    await sleep(600)
  } catch (err) {
    failed++
    console.log(`  FAIL  [${id}] ${row.bitrixName.slice(0, 40)}\n        ${err.message}`)
  }
}
console.log(`\nmain images ${main}   gallery images ${gal}   failed ${failed}`)
