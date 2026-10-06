<template>
  <div class="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(var(--accent)/0.18),transparent_60%)]"
    />
    <div class="relative w-full max-w-sm">
      <div class="mb-8 flex items-center justify-center gap-2">
        <AppLogo />
      </div>
      <slot />
    </div>
  </div>
</template>
