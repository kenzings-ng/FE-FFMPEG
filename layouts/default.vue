<template>
  <div class="flex min-h-dvh flex-col">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
    >
      Bỏ qua tới nội dung
    </a>
    <AppHeader />
    <VerifyEmailBanner />
    <main id="main" class="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>
