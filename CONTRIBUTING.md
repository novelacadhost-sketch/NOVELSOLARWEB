# Contributing to NovelSolar

We welcome and appreciate all contributions to the NovelSolar frontend platform. This document outlines the standard procedures for establishing a clean development environment, committing cleanly, and maintaining the structural integrity of the codebase.

---

## 1. Local Development Setup

To get up and running correctly on your local machine:

1. **Prerequisites**
   Ensure you have installed:
   - Node.js (v18.0.0 or later preferably Node v20/v22 LTS)
   - npm (or yarn / pnpm)
   - Git

2. **Clone and Install**
   ```bash
   git clone https://github.com/your-org/NovelSolar.git
   cd NovelSolar
   npm install
   ```
3. **Environment Setup**
   Do not commit bare API keys.
   - Copy the `.env.example` file and rename it to `.env`
   - Fill in your local test thresholds for `SUPABASE_URL`, `BITRIX_WEBHOOK_URL`, `SMTP_HOST`, etc.
4. **Booting the Dev Server**
   ```bash
   npm run dev
   ```
   The site will be running via Nuxt/Vite at `http://localhost:3000`.

---

## 2. Technical Stack and Styling Conventions

The application relies strictly on standard frameworks:

- **Vue 3 (Composition API):** Use `<script setup>` in all Vue components implicitly. Refrain from Options API syntax.
- **Nuxt 4:** All complex logic should map through implicit global composables (`app/composables/...`) or the native `$fetch` module avoiding raw Axios imports.
- **Tailwind CSS:** For all internal styling requirements, prioritize utility classes directly inline in the exact layouts. Do not bloat `app/assets/css/main.css` unless defining core overriding directives or global interactions like `:focus-visible`.

### Image Optimization Rules

Instead of using raw `<img />` tags, forcefully leverage the native Nuxt `<NuxtImg>` component built upon `@nuxt/image`.
This allows our server context to dynamically execute Cloudinary resizes globally. E.g:

```vue
<NuxtImg src="/images/hero-banner.png" alt="Overview" preload eager fetchpriority="high" />
```

---

## 3. Pull Request Guidelines

1. **Branching:**
   - Base all feature branches strictly off `main` or your current core environment branch.
   - Please utilize concise formatting: `feature/cart-update`, `fix/contact-form-error`.
2. **Quality Checklist:**
   - Did you test your changes gracefully resizing down to a 320px mobile viewport?
   - Did you verify that no Bitrix errors loop endlessly inside the server log when generating Webhooks locally?
   - Ensure all server dependencies utilized properly conform to strict TypeScript typing checks (`npm run build` will perform implicit TS verifications and break).
3. **Draft the PR:**
   - Summarize the exact intent and which issue ID this PR closes.
   - Attach browser screenshots if any visual UI logic shifted.
   - Submit for a maintainer review.

---

## 4. Code of Conduct

As a core contributor, respect your peers. We uphold an open, inclusive, and professional open-source mindset when designing components.

If you encounter bugs, raise them concisely with exact reproduction errors in the Issue Tracker!
