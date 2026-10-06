// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-09-20',
  devtools: { enabled: true },

  // Deploy tĩnh lên GitHub Pages và token nằm ở browser storage, nên chạy hoàn
  // toàn phía client (SPA). `nuxt generate` sẽ xuất index.html + 200/404.html.
  ssr: false,

  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/color-mode'],

  css: ['~/assets/css/tailwind.css'],

  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
  },

  runtimeConfig: {
    public: {
      // Đặt bằng NUXT_PUBLIC_API_BASE (file .env, xem .env.example), vd.
      // https://api.example.com. Mọi API đi qua `${apiBase}/graphql`; riêng
      // file HLS được tải từ hls_url / stream mà GraphQL trả về.
      apiBase: '',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'vi' },
      title: 'FFmpeg Stream',
      meta: [
        { name: 'description', content: 'Tải lên, xử lý và phát video HLS mã hóa.' },
        { name: 'theme-color', content: '#0a0a0f' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
})
