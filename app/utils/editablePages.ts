/**
 * Pages whose images an admin may replace, and which images those are.
 *
 * The entries are the ORIGINAL paths, which double as the storage key: a
 * component renders `image('/images/foo.png')` and this list tells the admin
 * screen that `/images/foo.png` is replaceable on that page. Nothing has to be
 * named, and if the two ever drift the component simply renders the original.
 *
 * Adding an image to a page means wrapping it in `image()` in the component and
 * adding its path here. Listing a path no component renders is harmless but
 * useless — the admin would replace something invisible.
 */
export interface EditablePage {
  page: string
  label: string
  images: string[]
}

export const EDITABLE_IMAGE_PAGES: EditablePage[] = [
  {
    page: 'partners/haisic',
    label: 'Partner — Haisic',
    images: [
      '/images/Haisic_partner.png',
      '/images/haisic_aa_4.png',
      '/images/haisic_aa_1.png',
      '/images/haisic_aa_2.png',
      '/images/haisic_aa_3.png',
      '/images/haisic_aa_5.png',
      '/images/haisic_aa_6.png',
    ],
  },
  {
    page: 'partners/hithium',
    label: 'Partner — Hithium',
    images: [
      '/images/hithium_partner.png',
      '/images/hithium_hero.png',
      '/images/Hithium3.png',
      '/images/Hithium1.jpg',
    ],
  },
  {
    page: 'partners/itel',
    label: 'Partner — Itel',
    images: [
      '/images/logo-new-novel.-itel.png',
      '/images/itel_3.png',
      '/images/itel.jpg',
      '/images/itel-5-600x600.webp',
      '/images/itel_2.jpg',
      '/images/itel_1.jpg',
    ],
  },
  {
    page: 'partners/livoltek',
    label: 'Partner — Livoltek',
    images: [
      '/images/livoltek1.png',
      '/images/livoltek2.jpg',
      '/images/livoltek3.png',
      '/images/livoltekpartner.png',
      '/images/livoltek_family.png',
    ],
  },
  {
    page: 'partners/yinergy',
    label: 'Partner — Yinergy',
    images: [
      '/images/yinergy_partner.png',
      '/images/yinergy4.png',
      '/images/Yinergy2.png',
      '/images/yinergy3.png',
      '/images/yinergy1.png',
      '/images/yinergy5.png',
    ],
  },
]
