import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    tooling: true,
  },
})
  .override('nuxt/typescript/rules', {
    rules: {
      // Align with CLAUDE.md: "no any" is the goal, but many files still have
      // legacy `any` usage. Warn instead of error so existing code isn't blocked.
      '@typescript-eslint/no-explicit-any': 'warn',

      // The codebase uses `as never` casts intentionally (Supabase payloads)
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',

      // Allow unused vars prefixed with _ (common pattern for destructuring)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  })
  .override('nuxt/vue/rules', {
    rules: {
      // Multi-word component names aren't enforced (pages like index.vue)
      'vue/multi-word-component-names': 'off',

      // Allow v-html (used for blog content rendering)
      'vue/no-v-html': 'off',
    },
  })
  .append({
    rules: {
      'no-mixed-spaces-and-tabs': 'off',
    },
  })
