// Moved to shared/ so the server (sitemap) can use it without pulling app code
// into the server's type project, which broke type checking of the layouts.
export * from '#shared/productCategories'
