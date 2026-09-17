export function useProductImage() {
  /**
   * The best available picture for a product.
   *
   *   1. `imageUrl` — the canonical URL the server resolved, which is what the
   *      Bitrix→Cloudinary mirror writes. It comes first because the server has
   *      strictly more information than this function does: it can see the
   *      mirror, and the Bitrix payload cannot.
   *   2. `PROPERTY_102` — a Cloudinary URL set by hand in Bitrix.
   *   3. The legacy Bitrix file fields, via the authenticated proxy.
   *   4. A placeholder.
   */
  const getProductImage = (product: any): string => {
    if (!product) return '/images/placeholder.png'

    if (typeof product.imageUrl === 'string' && product.imageUrl) return product.imageUrl
    if (typeof product.image_url === 'string' && product.image_url) return product.image_url

    const cloudinaryField = product.PROPERTY_102
    if (cloudinaryField) {
      if (Array.isArray(cloudinaryField) && cloudinaryField.length > 0) {
        return cloudinaryField[0].value
      }
      if (typeof cloudinaryField === 'string') {
        return cloudinaryField
      }
    }

    const legacyField = product.PROPERTY_44 || product.PREVIEW_PICTURE || product.DETAIL_PICTURE
    if (legacyField) {
      // Bitrix returns a FILE property as an ARRAY of { valueId, value }, and
      // only the unwrapped value carries showUrl. Reading .showUrl off the
      // array gives undefined, which sent every legacy-image product to the
      // placeholder — PROPERTY_102 was unwrapped above but this was not.
      const entry = Array.isArray(legacyField) ? legacyField[0]?.value : legacyField
      const relativeUrl = entry?.showUrl || entry?.downloadUrl
      if (relativeUrl) {
        const fullBitrixUrl = `https://nisl.bitrix24.com${relativeUrl}`
        return `/api/bitrix-image?url=${encodeURIComponent(fullBitrixUrl)}`
      }
      if (typeof entry === 'string' && entry.startsWith('http')) {
        return entry
      }
      if (typeof legacyField === 'string' && legacyField.startsWith('http')) {
        return legacyField
      }
    }

    return '/images/placeholder.png'
  }

  return { getProductImage }
}
