<template>
  <div class="min-h-screen bg-gray-50 pb-20">
    <!-- Hero Header -->
    <div class="bg-[#002888] py-16 px-4">
      <div class="max-w-6xl mx-auto text-center">
        <h1 class="text-3xl md:text-5xl font-black text-white mb-4">Precision Load Calculator</h1>
        <p class="text-blue-100 max-w-2xl mx-auto text-lg">
          Accurately estimate your power requirements to choose the perfect solar solution for your needs.
        </p>
      </div>
    </div>

    <!-- Calculator Component -->
    <NuxtErrorBoundary>
      <LazyLoadCalculator />
      <template #error="{ clearError }">
        <div class="max-w-3xl mx-auto px-4 py-16 text-center">
          <div class="bg-red-50 text-red-600 p-8 rounded-2xl border border-red-100">
            <span class="material-symbols-outlined text-4xl mb-4">error</span>
            <h3 class="text-xl font-bold mb-2">Calculator temporarily unavailable</h3>
            <p class="mb-6 opacity-80">
              We're having trouble loading the configuration data. Please try again or contact support.
            </p>
            <button
              class="bg-red-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-red-700 transition-colors"
              @click="clearError"
            >
              Try Again
            </button>
          </div>
        </div>
      </template>
    </NuxtErrorBoundary>

    <!-- FAQ / Info Section -->
    <section class="max-w-4xl mx-auto px-4 mt-12 space-y-8">
      <div class="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h3 class="text-xl font-bold text-gray-800 mb-4">How does it work?</h3>
        <p class="text-gray-600 leading-relaxed mb-4">
          This calculator uses industrial standard formulas for solar system sizing. We calculate your
          <strong>Total Connected Load</strong> and then apply a safety factor (typically 1.25x for panels and 1.2x for
          inverters) to ensure your system performs reliably even during peak usage.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="flex gap-3">
            <span class="material-symbols-outlined text-orange-500">info</span>
            <p class="text-sm text-gray-500">
              <strong>Inverter Rating:</strong> Measures the maximum power the system can deliver at once.
            </p>
          </div>
          <div class="flex gap-3">
            <span class="material-symbols-outlined text-orange-500">info</span>
            <p class="text-sm text-gray-500">
              <strong>Panel Capacity:</strong> Measures how much energy is generated daily to charge batteries.
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Solar Load Calculator' })
</script>
