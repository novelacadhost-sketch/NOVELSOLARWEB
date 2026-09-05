import { defineVitestConfig } from '@nuxt/test-utils/config'
import { resolve } from 'node:path'

export default defineVitestConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['e2e/**', '**/node_modules/**', '**/dist/**'],
    env: {
      NUXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NUXT_PUBLIC_SUPABASE_KEY: 'test-key',
    },
  },
  define: {
    'import.meta.client': true,
    'import.meta.server': false,
    'import.meta.dev': true,
  },
  resolve: {
    alias: {
      '~': resolve('./app'),
      '@': resolve('./app'),
      '#components': resolve('./app/components'),
    },
  },
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.startsWith('Nuxt'),
      },
    },
  },
})
