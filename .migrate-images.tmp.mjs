// One-off: upload matched product images to Cloudinary and write the delivery
// URL into Bitrix PROPERTY_102. Idempotent and dry-runnable.
//   node .migrate-images.tmp.mjs          -> dry run, writes nothing
//   node .migrate-images.tmp.mjs --commit -> uploads + updates Bitrix
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { v2 as cloudinary } from 'cloudinary'

const COMMIT = process.argv.includes('--commit')
const S = 'C:/Users/Novel/AppData/Local/Temp/claude/C--Users-Novel-Downloads-codespaces-NovelSolar/7079c0b6-d5ec-4bb6-9431-f9bed51df227/scratchpad'
const IMG_ROOT = 'C:/Users/Novel/Downloads/novelsolar-product-images'
const LOG = join(IMG_ROOT, 'migration-log.json')

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

// Bake the transformation into the stored URL. useProductImage returns
// PROPERTY_102 verbatim to the browser, so optimisation has to live in the
// URL itself — otherwise customers download the 2 MB original.
const TRANSFORM = 'f_auto,q_auto,w_1200'
const deliveryUrl = (secureUrl) => secureUrl.replace('/image/upload/', `/image/upload/${TRANSFORM}/`)

const { AUTO } = JSON.parse(readFileSync(`${S}/matches2.json`, 'utf8'))

// Current PROPERTY_102 state, so we never overwrite an existing image.
const existing = new Map(
  readFileSync(`${S}/catalog.jsonl`, 'utf8').trim().split('\n').filter(Boolean)
    .map(JSON.parse).map((r) => [String(r.ID), r.PROPERTY_102]),
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : {}

console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'} — ${AUTO.length} auto-matched products`)
console.log(`cloud: ${env.CLOUDINARY_CLOUD_NAME}   transform: ${TRANSFORM}\n`)

let uploaded = 0, updated = 0, skipped = 0, failed = 0
for (const [i, row] of AUTO.entries()) {
  const id = String(row.bitrixId)
  const main = row.images[0]
  const local = join(IMG_ROOT, row.folder, main || '')

  if (!main || !existsSync(local)) { console.log(`  SKIP  [${id}] no local image — ${row.product}`); skipped++; continue }
  if (existing.get(id)) { console.log(`  SKIP  [${id}] already has PROPERTY_102 — ${row.product}`); skipped++; continue }
  if (log[id]?.propertyUrl) { console.log(`  SKIP  [${id}] already migrated — ${row.product}`); skipped++; continue }

  const label = `[${String(i + 1).padStart(2)}/${AUTO.length}] [${id}] ${row.bitrixName.slice(0, 46)}`
  if (!COMMIT) { console.log(`  would upload ${row.folder}/${main}\n     ${label}`); continue }

  try {
    const res = await cloudinary.uploader.upload(local, {
      folder: 'novel_solar_products',
      public_id: `${row.folder}-main`,
      overwrite: false,
      resource_type: 'image',
    })
    uploaded++
    const url = deliveryUrl(res.secure_url)

    const upd = await fetch(`${BX}crm.product.update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(id), fields: { PROPERTY_102: url } }),
    }).then((r) => r.json())

    if (upd.error) throw new Error(`Bitrix: ${upd.error_description || upd.error}`)
    updated++
    log[id] = { product: row.product, bitrixName: row.bitrixName, publicId: res.public_id, propertyUrl: url, at: new Date().toISOString() }
    console.log(`  ok    ${label}`)
    writeFileSync(LOG, JSON.stringify(log, null, 1))
    await sleep(600) // stay well under Bitrix rate limits
  } catch (err) {
    failed++
    console.log(`  FAIL  ${label}\n        ${err.message}`)
  }
}

console.log(`\nuploaded ${uploaded}  bitrix-updated ${updated}  skipped ${skipped}  failed ${failed}`)
if (COMMIT) console.log(`log -> ${LOG}`)
else console.log('\nnothing written. re-run with --commit to apply.')
