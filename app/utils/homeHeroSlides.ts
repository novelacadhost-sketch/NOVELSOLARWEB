import type { ContentBlock } from '~/composables/usePageContent'

// Built-in homepage hero slides, also the starting list in /admin/manage-pages.
// They are the FALLBACK, not dead code: they render before anything has been
// saved there, and whenever the CMS is empty or unreachable. Do not delete them
// to clean up; a database hiccup would then blank the hero.
export const HERO_SLIDES_FALLBACK: ContentBlock[] = [
  {
    image: '/images/Website BannersItel 500W SG.jpg.jpeg',
    eyebrow: 'Fast-Moving Solar Stock',
    title: 'Power Projects With Ready-to-Dispatch Solar Inventory.',
    description:
      'Browse trusted modules, batteries, charge controllers, and inverters sourced for installers, EPCs, and growing energy businesses.',
    caption: 'Install-ready products',
  },
  {
    image: '/images/Website BannersHithium SG.jpg.jpeg',
    eyebrow: 'Battery Storage',
    title: 'Scale Faster With Premium Lithium Storage Solutions.',
    description:
      'Source dependable storage systems built for residential backup, commercial resilience, and modern energy independence.',
    caption: 'High-capacity energy backup',
  },
  {
    image: '/images/Website Banners17.5kWh Lithium Battery.jpg.jpeg',
    eyebrow: 'Commercial Performance',
    title: 'Deliver Bigger Energy Systems Without Procurement Delays.',
    description:
      'Keep timelines moving with stocked solar essentials, reliable fulfillment, and quick access to the products your team needs most.',
    caption: 'Project-ready logistics',
  },
  {
    image: '/images/Website Banners1100VA Hybrid Inveretr.jpg.jpeg',
    eyebrow: 'Hybrid Inverters',
    title: 'Match Smarter Inverter Options To Every Customer Need.',
    description:
      'From compact backup setups to robust hybrid systems, find efficient inverter options that help you quote and close faster.',
    caption: 'Built for daily demand',
  },
  {
    image: '/images/Website Banners230ah Tubular Battery.jpg.jpeg',
    eyebrow: 'Reliable Backup',
    title: 'Keep Homes and Businesses Running Through Grid Downtime.',
    description:
      'Stock proven backup components that support dependable power delivery and long-term performance in the field.',
    caption: 'Reliable field performance',
  },
  {
    image: '/images/Website Banners200A MMPT CC.jpg.jpeg',
    eyebrow: 'System Components',
    title: 'Complete Your Solar Builds With High-Performance Accessories.',
    description:
      'Source the charge controllers and balance-of-system essentials that keep every installation efficient, safe, and scalable.',
    caption: 'Everything your build needs',
  },
  {
    image: '/images/Website Banners100A MMPT CC copy.jpg.jpeg',
    eyebrow: 'Installer Essentials',
    title: 'Stay Ready for Daily Sales With Popular Solar Bestsellers.',
    description:
      'Move quickly with the products customers ask for most, supported by dependable fulfillment and instant access to stock.',
    caption: 'Always ready to ship',
  },
  {
    image: '/images/Website Banners1250 SG.jpg.jpeg',
    eyebrow: 'Residential Solar',
    title: 'Build Efficient Home Power Packages That Customers Trust.',
    description:
      'Curate clean, practical solar packages for everyday users with dependable components and strong value at every tier.',
    caption: 'Home-ready energy kits',
  },
  {
    image: '/images/Website Banners1260 SG copy.jpg.jpeg',
    eyebrow: 'Energy Growth',
    title: 'Support Growing Demand With Better Stock Visibility.',
    description:
      'From first inquiry to final delivery, keep your solar pipeline moving with a shop built for quick product discovery.',
    caption: 'Designed for fast quoting',
  },
]
