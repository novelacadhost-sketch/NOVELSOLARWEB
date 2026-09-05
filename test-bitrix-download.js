const webhook = process.env.NUXT_BITRIX_WEBHOOK_URL || ''

async function run() {
  const productId = '212'
  const fileId = '1364' // Property_44 file
  const detailFileId = '1363' // Detail Picture file

  const variants = [
    { name: 'morePhoto', id: fileId },
    { name: 'MorePhoto', id: fileId },
    { name: 'more_photo', id: fileId },
    { name: 'MORE_PHOTO', id: fileId },
    { name: 'PROPERTY_44', id: fileId },
    { name: 'property44', id: fileId },
    { name: 'detailPicture', id: detailFileId },
    { name: 'DetailPicture', id: detailFileId },
    { name: 'detail_picture', id: detailFileId },
    { name: 'DETAIL_PICTURE', id: detailFileId },
  ]

  for (const v of variants) {
    const params = new URLSearchParams()
    params.append('fields[productId]', productId)
    params.append('fields[fileId]', v.id)
    params.append('fields[fieldName]', v.name)

    await testDownload(`${webhook}catalog.product.download`, params, `Field: ${v.name}`)
  }
}

async function testDownload(url, body, label) {
  console.log(`--- Testing ${label} ---`)

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: body,
    })
    const contentType = response.headers.get('content-type') || ''

    if (response.ok && contentType.includes('image')) {
      console.log(`SUCCESS: ${label} - Status: ${response.status}, Type: ${contentType}`)
      return true
    } else {
      const text = await response.text()
      console.log(`FAIL: ${label} - Status: ${response.status}, Error: ${text.substring(0, 100)}`)
      return false
    }
  } catch (error) {
    console.log(`FAIL: ${label} - Error: ${error.message}`)
    return false
  }
}

run()
