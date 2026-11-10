<template>
  <NuxtLink
      v-if="visible"
      to="/"
      class="back-home group fixed bottom-8 left-8 z-[90] hidden lg:flex items-center gap-3 rounded-full bg-white/95 backdrop-blur pl-1.5 pr-5 py-1.5 border shadow-[0_10px_30px_-10px_rgba(0,40,136,0.45)] hover:shadow-[0_16px_36px_-10px_rgba(0,40,136,0.6)] hover:-translate-y-0.5 transition-all duration-300"
      :style="{ borderColor: `${color}26` }"
      aria-label="Back to the home page"
    >
      <span
        class="relative flex h-11 w-11 items-center justify-center rounded-full text-white overflow-hidden"
        :style="{ backgroundColor: color }"
      >
        <svg viewBox="0 0 32 32" class="h-7 w-7" aria-hidden="true">
          <!-- Sun: sits behind the roof and rises on hover -->
          <g class="sun">
            <circle cx="24" cy="9" r="3.2" fill="#FDB813" />
            <g class="rays" stroke="#FDB813" stroke-width="1.4" stroke-linecap="round">
              <path d="M24 3.2v1.4M24 13.4v1.4M18.2 9h1.4M28.4 9h1.4M19.9 4.9l1 1M27.1 12.1l1 1M19.9 13.1l1-1M27.1 5.9l1-1" />
            </g>
          </g>
          <!-- House with a solar panel on the roof -->
          <path d="M4.5 16.5 16 7l11.5 9.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M8 15v11.5h16V15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" />
          <path d="M9.6 13.4 14.4 9.5" stroke="#FDB813" stroke-width="2.2" stroke-linecap="round" />
          <rect class="door" x="13.5" y="19" width="5" height="7.5" rx="1" fill="currentColor" />
        </svg>
      </span>
      <span class="flex flex-col leading-tight">
        <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Go to</span>
        <span class="text-base font-black tracking-tight" :style="{ color }">
          Back home
          <span class="inline-block transition-transform duration-300 group-hover:-translate-x-0.5" aria-hidden="true"
            >&larr;</span
          >
        </span>
      </span>
    </NuxtLink>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ color?: string }>(), { color: '#002888' })

// Not on the home page itself, and not in the admin console, which has its own
// way back to the dashboard.
const route = useRoute()
const visible = computed(() => {
  const path = route.path.replace(/\/+$/, '') || '/'
  return path !== '/' && !path.startsWith('/admin')
})

const color = computed(() => props.color)
</script>

<style scoped>
.sun {
  transform: translateY(6px);
  opacity: 0;
  transition:
    transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease;
}
.back-home:hover .sun,
.back-home:focus-visible .sun {
  transform: translateY(0);
  opacity: 1;
}
.rays {
  transform-origin: 24px 9px;
}
.back-home:hover .rays {
  animation: spin 6s linear infinite;
}
.door {
  transition: fill 0.3s ease;
}
.back-home:hover .door {
  fill: #fdb813;
}
/* Slides in on arrival; leaves instantly, so it is never seen on the home page. */
.back-home {
  animation: slide-in 0.4s ease-out both;
}
@keyframes slide-in {
  from {
    opacity: 0;
    translate: -24px 0;
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .sun,
  .door {
    transition: none;
  }
  .back-home {
    animation: none;
  }
  .back-home:hover .rays {
    animation: none;
  }
}
</style>
