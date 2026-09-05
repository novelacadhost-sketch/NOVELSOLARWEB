export default defineAppConfig({
  nav: {
    productMenu: [
      { title: 'Solar Panels' },
      { title: 'Inverters' },
      { title: 'Batteries' },
      { title: 'Charge Controllers' },
      { title: 'Lighting' },
      { title: 'Power Banks' },
      { title: 'Accessories' },
    ],

    servicesMenu: [
      { title: 'Power & Load Audit Service', link: '/services/audit' },
      { title: 'Inverter, Solar Panel & Battery Installation', link: '/services/installation' },
      { title: 'Inverter Repair (Solar Panel, Battery etc Repairs)', link: '/services/repair' },
      { title: 'Solar Panel, Tubular Battery & Inverter Maintenance', link: '/services/maintenance' },
    ],

    partnersMenu: [
      { title: 'Itel', link: '/partners/itel' },
      { title: 'Haisic', link: '/partners/haisic' },
      { title: 'Yinergy', link: '/partners/yinergy' },
      { title: 'Hithium', link: '/partners/hithium' },
      { title: 'Livoltek', link: '/partners/livoltek' },
    ],

    supportMenu: [
      { title: 'FAQ', link: '/faq' },
      { title: 'Contact Us', link: '/contact' },
    ],
  },

  calculator: {
    priceTiers: [
      { minLoad: 60, maxLoad: 200, minPrice: 160000, maxPrice: 500000 },
      { minLoad: 201, maxLoad: 400, minPrice: 500000, maxPrice: 700000 },
      { minLoad: 401, maxLoad: 600, minPrice: 700000, maxPrice: 1500000 },
      { minLoad: 601, maxLoad: 1000, minPrice: 1500000, maxPrice: 3000000 },
      { minLoad: 1001, maxLoad: null, minPrice: 5000000, maxPrice: 6000000 },
    ],
  },
})
