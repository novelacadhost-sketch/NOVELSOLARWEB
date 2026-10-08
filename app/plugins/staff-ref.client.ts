/**
 * Remember a staff code from any page's link: novelsolar.com/shop/123?ref=DAFO12.
 *
 * Runs on every navigation, not just the first page, so a link opened inside
 * the site still counts. See useStaffRef for how long it lasts and who wins.
 */
export default defineNuxtPlugin(() => {
  const { save } = useStaffRef()
  const router = useRouter()

  const capture = (ref: unknown) => {
    save(Array.isArray(ref) ? ref[0] : ref)
  }

  capture(router.currentRoute.value.query.ref)
  router.afterEach((to) => capture(to.query.ref))
})
